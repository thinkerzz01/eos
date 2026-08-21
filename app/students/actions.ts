'use server';

// Students write actions. REFERENCE PATTERN for the write path (Step: forms
// persist to the DB). Runs on the server with the user's session, so Postgres
// RLS decides who may insert (admin + manager for students; everyone else is
// denied at the DB). No service-role bypass. The audit_log trigger records the
// write automatically.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { provisionLogin } from '@/lib/auth/provision';

const ENROLLABLE_PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'A Level (A1)', 'A Level (A2)', 'IGCSE', 'Matric (9)', 'Matric (10)', 'Inter (11)', 'Inter (12)'];
const SOURCES = ['google', 'facebook', 'instagram', 'whatsapp', 'referral', 'walk_in'];

// A student email is REQUIRED at creation: it is the address Google Calendar
// invites (class + demo events) are sent to, and the portal-login invite. Kept
// deliberately strict so we never create a student the calendar cannot reach.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(raw?: string): boolean {
  return !!raw && EMAIL_RE.test(raw.trim());
}

export interface CreateStudentInput {
  name: string;
  parent_name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  gender?: string;
  program: string;
  exam_session: string;
  enrolled_at?: string;
  months_committed?: string;
  monthly_fee: string;
  fee_status?: string;
  next_due_date: string;
  source?: string;
  // Per-subject teacher assignments -> student_subjects links.
  enrollments?: { subject: string; teacherId: string }[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  // Set when the student was created but the portal invite email did not send.
  warning?: string;
}

function normalizeSource(raw?: string): string {
  const s = (raw ?? '').toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
  return SOURCES.includes(s) ? s : 'google';
}

/**
 * List active teachers with the subject names they teach, for the admission
 * form's per-subject teacher picker. RLS lets admin/manager read teachers +
 * teacher_subjects; anyone else gets []. Best-effort - returns [] on any error.
 */
export interface EnrollableTeacher {
  id: string;
  name: string;
  subjects: string[];
}
export async function listEnrollableTeachers(): Promise<EnrollableTeacher[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data: teachers, error } = await supabase
    .from('teachers')
    .select('id,name,status')
    .is('deleted_at', null)
    .neq('status', 'left')
    .order('name', { ascending: true });
  if (error || !teachers) return [];

  const { data: links } = await supabase
    .from('teacher_subjects')
    .select('teacher_id,subjects(name)')
    .is('deleted_at', null);
  const byTeacher = new Map<string, Set<string>>();
  for (const row of (links as any[]) ?? []) {
    const tid = row.teacher_id as string;
    const subj = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
    if (!tid || !subj?.name) continue;
    if (!byTeacher.has(tid)) byTeacher.set(tid, new Set());
    byTeacher.get(tid)!.add(subj.name);
  }
  return (teachers as any[]).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    subjects: Array.from(byTeacher.get(t.id) ?? []).sort(),
  }));
}

/**
 * Persist a student's subject enrollments (student_subjects). Each enrollment
 * names a subject + the teacher who takes it; we resolve the subject row for the
 * student's program and insert the link. syllabus_template_id is left NULL (the
 * syllabus system is archived - see the 2026-08-21 migration). Best-effort:
 * failures here never undo the student. This is what powers teacher load, the
 * teacher roster, the dashboard Teacher filter, and per-subject grades.
 */
async function enrollStudentSubjects(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  studentId: string,
  program: string,
  enrollments?: { subject: string; teacherId: string }[]
): Promise<void> {
  const clean = (enrollments ?? []).filter((e) => e?.subject?.trim() && e?.teacherId?.trim());
  if (clean.length === 0) return;

  const names = Array.from(new Set(clean.map((e) => e.subject.trim())));
  const { data: subs } = await supabase
    .from('subjects')
    .select('id,name')
    .eq('org_id', orgId)
    .eq('program', program)
    .is('deleted_at', null)
    .in('name', names);
  const idByName = new Map<string, string>();
  for (const s of (subs as any[]) ?? []) idByName.set(s.name, s.id);

  const rows = clean
    .map((e) => {
      const subjectId = idByName.get(e.subject.trim());
      if (!subjectId) return null;
      return {
        org_id: orgId,
        student_id: studentId,
        subject_id: subjectId,
        teacher_id: e.teacherId.trim(),
        target_grade: 'A*',
      };
    })
    .filter(Boolean) as Record<string, any>[];
  if (rows.length) await supabase.from('student_subjects').insert(rows);
}

export async function createStudent(input: CreateStudentInput): Promise<ActionResult> {
  const name = input.name?.trim();
  const parent_name = input.parent_name?.trim();
  const phone = input.phone?.trim();

  // Validate against what the schema actually requires (NOT NULL + CHECKs).
  if (!name || !parent_name || !phone) {
    return { ok: false, error: 'Name, parent name, and phone are required.' };
  }
  if (!isValidEmail(input.email)) {
    return { ok: false, error: 'A valid email is required - class calendar invites are sent to it.' };
  }
  if (!ENROLLABLE_PROGRAMS.includes(input.program)) {
    return { ok: false, error: 'Program must be a CAIE program (O Level, A Level, or IGCSE).' };
  }
  if (!input.exam_session?.trim()) {
    return { ok: false, error: 'Exam session is required.' };
  }
  const fee = Number(input.monthly_fee);
  if (!input.monthly_fee || Number.isNaN(fee) || fee < 0) {
    return { ok: false, error: 'A valid monthly fee is required.' };
  }
  if (!input.next_due_date) {
    return { ok: false, error: 'Next due date is required.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  // org_id comes from the caller's own profile (multi-tenant scoping).
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) {
    return { ok: false, error: 'No organisation profile found for your account.' };
  }

  const row: Record<string, any> = {
    org_id: profile.org_id,
    name,
    parent_name,
    phone,
    whatsapp: input.whatsapp?.trim() || null,
    email: input.email!.trim(),
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    program: input.program,
    exam_session: input.exam_session.trim(),
    monthly_fee: fee,
    next_due_date: input.next_due_date,
    source: normalizeSource(input.source),
  };
  if (input.gender) row.gender = input.gender;
  if (input.fee_status) row.fee_status = input.fee_status;
  if (input.enrolled_at) row.enrolled_at = input.enrolled_at;
  if (input.months_committed) {
    const m = parseInt(input.months_committed, 10);
    if (!Number.isNaN(m)) row.months_committed = m;
  }

  // RLS enforces the actual permission here. A denied role gets an error row.
  const { data: inserted, error } = await supabase
    .from('students')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    return { ok: false, error: error.message };
  }

  // Link the enrolled subjects to their teachers (best-effort - never undo the
  // student). Powers teacher load / roster / dashboard filter.
  try {
    await enrollStudentSubjects(supabase, profile.org_id, inserted.id, row.program, input.enrollments);
  } catch {
    /* enrollment links are non-critical; the student already exists */
  }

  // Auto-provision the student's portal login when an email is on file
  // (best-effort: never undo the student we just created).
  let warning: string | undefined;
  if (row.email) {
    const invite = await provisionLogin({
      email: row.email,
      name,
      role: 'student',
      orgId: profile.org_id,
      studentId: inserted.id,
    });
    if (!invite.ok && !invite.skipped) {
      warning = `Student added, but the portal invite could not be sent: ${invite.error}`;
    }
  }

  revalidatePath('/students');
  revalidatePath('/');
  return { ok: true, warning };
}

/**
 * Bulk import students from parsed CSV rows. The CSV format lacks exam session /
 * monthly fee / next due date (required by the schema), so those are defaulted
 * for the Admin to edit later. Rows missing a name/parent or with a non-CAIE
 * program are skipped rather than inserted with fake data.
 */
export async function bulkCreateStudents(
  rows: {
    name: string;
    parentName: string;
    parentPhone?: string;
    parentEmail?: string;
    program: string;
    feeStatus?: string;
  }[]
): Promise<{ ok: boolean; inserted: number; skipped: number; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, inserted: 0, skipped: 0, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, inserted: 0, skipped: 0, error: 'No organisation profile found.' };

  const FEE: Record<string, string> = {
    paid: 'paid', due: 'due', 'in grace': 'in_grace', in_grace: 'in_grace', stopped: 'stopped',
  };
  const dueDefault = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // students.phone is NOT NULL with a unique index - rows without a phone must be
  // skipped (counted in `skipped`), not force-inserted as 'N/A' (which collides).
  // Email is likewise required (calendar invites), so email-less rows are skipped.
  const valid = rows.filter(
    (r) =>
      r.name?.trim() &&
      r.parentName?.trim() &&
      r.parentPhone?.trim() &&
      isValidEmail(r.parentEmail) &&
      ENROLLABLE_PROGRAMS.includes(r.program)
  );
  const skipped = rows.length - valid.length;
  if (valid.length === 0) {
    return {
      ok: false,
      inserted: 0,
      skipped,
      error: 'No valid rows - each needs a name, a parent name, a valid email, a phone, and a CAIE program (O/A Level, IGCSE).',
    };
  }

  const toInsert = valid.map((r) => ({
    org_id: profile.org_id,
    name: r.name.trim(),
    parent_name: r.parentName.trim(),
    phone: r.parentPhone!.trim(),
    email: r.parentEmail!.trim(),
    program: r.program,
    exam_session: 'To be set',
    monthly_fee: 0,
    next_due_date: dueDefault,
    fee_status: FEE[(r.feeStatus ?? '').toLowerCase()] ?? 'due',
    source: 'walk_in',
    status: 'active',
  }));

  const { data, error } = await supabase.from('students').insert(toInsert).select('id');
  if (error) return { ok: false, inserted: 0, skipped, error: error.message };

  revalidatePath('/students');
  revalidatePath('/');
  return { ok: true, inserted: data?.length ?? toInsert.length, skipped };
}

const FEE_UI_TO_DB: Record<string, string> = {
  Paid: 'paid',
  Due: 'due',
  'In Grace': 'in_grace',
  Stopped: 'stopped',
};

/**
 * Update a student's identity/fee fields from the profile editor. RLS enforces
 * that only admin/manager may write. Program is validated against the CAIE
 * CHECK; the derived performance/health score is NOT written here (it is
 * computed from attendance/homework).
 */
export async function updateStudent(input: {
  id: string;
  name?: string;
  parentName?: string;
  parentPhone?: string;
  program?: string;
  feeStatus?: string;
  // Widened editable set (previously uneditable after admission).
  email?: string;
  whatsapp?: string;
  city?: string;
  address?: string;
  gender?: string;
  examSession?: string;
  monthlyFee?: string | number;
  nextDueDate?: string;
  dob?: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: 'Missing student id.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const patch: Record<string, any> = {};
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.parentName?.trim()) patch.parent_name = input.parentName.trim();
  if (input.parentPhone?.trim()) patch.phone = input.parentPhone.trim();
  if (input.program) {
    if (!ENROLLABLE_PROGRAMS.includes(input.program)) {
      return { ok: false, error: 'Program must be a CAIE program (O Level, A Level, or IGCSE).' };
    }
    patch.program = input.program;
  }
  if (input.feeStatus && FEE_UI_TO_DB[input.feeStatus]) patch.fee_status = FEE_UI_TO_DB[input.feeStatus];

  // Email is the calendar-invite address, so if it is being changed it must stay
  // valid (an empty string would blank a required contact channel).
  if (input.email !== undefined) {
    const e = input.email.trim();
    if (!isValidEmail(e)) {
      return { ok: false, error: 'Enter a valid email - class calendar invites are sent to it.' };
    }
    patch.email = e;
  }
  if (input.whatsapp !== undefined) patch.whatsapp = input.whatsapp.trim() || null;
  if (input.city !== undefined) patch.city = input.city.trim() || null;
  if (input.address !== undefined) patch.address = input.address.trim() || null;
  if (input.gender && ['male', 'female', 'other'].includes(input.gender)) patch.gender = input.gender;
  if (input.examSession?.trim()) patch.exam_session = input.examSession.trim();
  if (input.monthlyFee !== undefined && input.monthlyFee !== '') {
    const fee = Number(input.monthlyFee);
    if (Number.isNaN(fee) || fee < 0) return { ok: false, error: 'Enter a valid monthly fee.' };
    patch.monthly_fee = fee;
  }
  if (input.nextDueDate?.trim()) patch.next_due_date = input.nextDueDate.trim();
  if (input.dob?.trim()) patch.date_of_birth = input.dob.trim();

  if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to update.' };

  const { error } = await supabase.from('students').update(patch).eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/students');
  revalidatePath('/');
  return { ok: true };
}

/**
 * Mark a student as passed out / alumni. Sets status = 'stopped' (which the UI
 * surfaces as "Alumni") so they drop out of the active roster but stay on record.
 * RLS enforces admin/manager. Reversible by re-activating from the profile editor.
 */
export async function markStudentPassout(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Missing student id.' };

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase
    .from('students')
    .update({ status: 'stopped' })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/students');
  revalidatePath('/');
  return { ok: true };
}

/** Soft-delete a student (sets deleted_at). RLS enforces admin/manager. */
export async function softDeleteStudent(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Missing student id.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase
    .from('students')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/students');
  revalidatePath('/');
  return { ok: true };
}
