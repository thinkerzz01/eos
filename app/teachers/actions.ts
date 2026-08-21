'use server';

// Teachers write actions. LOCKED POLICY: only the Admin adds teachers and sets
// capacity (Managers cannot). RLS also enforces this - the teachers table gives
// Manager SELECT-only - but we check role here too for a friendly error.
// New teachers start every score at 0 (DB defaults) and render as "New".
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { provisionLogin } from '@/lib/auth/provision';

export interface ActionResult {
  ok: boolean;
  error?: string;
  // Set when the core write succeeded but the portal invite email did not send.
  warning?: string;
}

/**
 * Persist the teacher <-> subject links (teacher_subjects) for a teacher.
 * Resolves the picked subject NAMES (optionally scoped to the picked program
 * labels) to subject ids in this org, then reconciles: revives/creates the
 * wanted links and soft-deletes any active link no longer selected. Best-effort
 * by design - a failure here must never undo the teacher write, so callers wrap
 * it and only surface a soft warning. The teacher's `subjects`/`programs`
 * columns and the Teachers-tab subject/program filters are driven off this.
 */
async function syncTeacherSubjects(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  teacherId: string,
  subjectNames?: string[],
  programNames?: string[]
): Promise<void> {
  const names = Array.from(
    new Set((subjectNames ?? []).map((s) => s?.trim()).filter(Boolean) as string[])
  );
  const progs = (programNames ?? []).map((p) => p?.trim()).filter(Boolean) as string[];

  // Resolve wanted subject ids (only subjects that actually exist in this org).
  let wantIds: string[] = [];
  if (names.length) {
    let q = supabase
      .from('subjects')
      .select('id')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('name', names);
    if (progs.length) q = q.in('program', progs);
    const { data } = await q;
    wantIds = ((data as any[]) ?? []).map((r) => r.id as string);
  }

  // Revive/create the wanted links (UNIQUE(teacher_id,subject_id) -> upsert also
  // un-soft-deletes a previously removed link).
  if (wantIds.length) {
    const rows = wantIds.map((id) => ({
      org_id: orgId,
      teacher_id: teacherId,
      subject_id: id,
      deleted_at: null as string | null,
    }));
    await supabase.from('teacher_subjects').upsert(rows, { onConflict: 'teacher_id,subject_id' });
  }

  // Soft-delete any active link the teacher no longer teaches.
  const { data: existing } = await supabase
    .from('teacher_subjects')
    .select('id,subject_id')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null);
  const stale = ((existing as any[]) ?? [])
    .filter((r) => !wantIds.includes(r.subject_id))
    .map((r) => r.id as string);
  if (stale.length) {
    await supabase
      .from('teacher_subjects')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', stale);
  }
}

export async function createTeacher(input: {
  name: string;
  email: string;
  phone: string;
  city?: string;
  capacity: string | number;
  joinDate?: string;
  subjects?: string[];
  programs?: string[];
}): Promise<ActionResult> {
  const name = input.name?.trim();
  const email = input.email?.trim();
  const phone = input.phone?.trim();
  const capacity =
    typeof input.capacity === 'number' ? input.capacity : parseInt(input.capacity, 10);

  if (!name || !email || !phone) {
    return { ok: false, error: 'Name, email, and phone are required.' };
  }
  if (!capacity || Number.isNaN(capacity) || capacity <= 0) {
    return { ok: false, error: 'Enter a valid capacity (max active students).' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };
  if (profile.role !== 'admin') {
    return { ok: false, error: 'Only an Admin can add teachers and set capacity.' };
  }

  const row: Record<string, any> = {
    org_id: profile.org_id,
    name,
    email,
    phone,
    city: input.city?.trim() || null,
    capacity,
    status: 'available',
    // rating / demos_given / demos_converted / reliability default to 0 -> "New"
  };
  if (input.joinDate) row.join_date = input.joinDate;

  const { data: inserted, error } = await supabase
    .from('teachers')
    .insert(row)
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  // Persist the teaching subjects/programs (best-effort - never undo the teacher).
  try {
    await syncTeacherSubjects(supabase, profile.org_id, inserted.id, input.subjects, input.programs);
  } catch {
    /* subject links are non-critical; the teacher already exists */
  }

  // Auto-provision the teacher's portal login (best-effort: a mail/quota failure
  // must not undo the teacher we just created).
  let warning: string | undefined;
  const invite = await provisionLogin({
    email,
    name,
    role: 'teacher',
    orgId: profile.org_id,
    teacherId: inserted.id,
  });
  if (!invite.ok) {
    warning = `Teacher added, but the portal invite could not be sent: ${invite.error}`;
  }

  revalidatePath('/teachers');
  revalidatePath('/');
  return { ok: true, warning };
}

/** Update a teacher's basic profile. Admin-only (RLS + explicit role check). */
export async function updateTeacher(input: {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  capacity?: string | number;
  joinDate?: string;
  // When provided (even empty), the teacher's subject/program links are
  // reconciled to exactly this selection. Omit to leave the links untouched.
  subjects?: string[];
  programs?: string[];
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: 'Missing teacher id.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };
  if (profile.role !== 'admin') return { ok: false, error: 'Only an Admin can edit teachers.' };

  const patch: Record<string, any> = {};
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.email?.trim()) patch.email = input.email.trim();
  if (input.phone?.trim()) patch.phone = input.phone.trim();
  if (input.city !== undefined) patch.city = input.city?.trim() || null;
  if (input.capacity !== undefined && input.capacity !== '') {
    const cap = typeof input.capacity === 'number' ? input.capacity : parseInt(input.capacity, 10);
    if (Number.isNaN(cap) || cap <= 0) return { ok: false, error: 'Enter a valid capacity.' };
    patch.capacity = cap;
  }
  if (input.joinDate) patch.join_date = input.joinDate;

  const wantsSubjectSync = input.subjects !== undefined || input.programs !== undefined;
  if (Object.keys(patch).length === 0 && !wantsSubjectSync) {
    return { ok: false, error: 'Nothing to update.' };
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('teachers').update(patch).eq('id', input.id);
    if (error) return { ok: false, error: error.message };
  }

  if (wantsSubjectSync) {
    try {
      await syncTeacherSubjects(supabase, profile.org_id, input.id, input.subjects, input.programs);
    } catch {
      /* subject links are non-critical */
    }
  }

  revalidatePath('/teachers');
  revalidatePath('/');
  return { ok: true };
}

/** Soft-delete a teacher (sets deleted_at). Admin-only. */
export async function softDeleteTeacher(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Missing teacher id.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (profile?.role !== 'admin') return { ok: false, error: 'Only an Admin can delete teachers.' };

  const { error } = await supabase
    .from('teachers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/teachers');
  revalidatePath('/');
  return { ok: true };
}

/**
 * Record that a teacher has LEFT the academy, with the reason. Keeps the record
 * (for history/reporting) but moves them off the active roster (status = 'left').
 * Requires the left_at / leaving_reason columns + 'left' status (see migration).
 * Admin-only.
 */
export async function markTeacherLeft(input: { id: string; reason: string }): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: 'Missing teacher id.' };
  const reason = input.reason?.trim();
  if (!reason) return { ok: false, error: 'Please select or enter a reason.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (profile?.role !== 'admin') return { ok: false, error: 'Only an Admin can record a teacher leaving.' };

  const { error } = await supabase
    .from('teachers')
    .update({ status: 'left', left_at: new Date().toISOString(), leaving_reason: reason })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/teachers');
  revalidatePath('/');
  return { ok: true };
}

/**
 * Set a teacher's per-class pay rate. LOCKED: teacher_pay_rates is the isolated
 * Admin-only table (Managers/Teachers are denied at the DB). Inserts a new rate
 * row (effective_from defaults to today) so history is preserved.
 */
export async function setTeacherPayRate(input: {
  teacherId: string;
  ratePerClass: number;
}): Promise<ActionResult> {
  if (!input.teacherId) return { ok: false, error: 'Teacher is required.' };
  if (!(input.ratePerClass > 0)) return { ok: false, error: 'Enter a valid per-class rate.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };
  if (profile.role !== 'admin') {
    return { ok: false, error: 'Only an Admin can set teacher pay rates.' };
  }

  const { error } = await supabase.from('teacher_pay_rates').insert({
    org_id: profile.org_id,
    teacher_id: input.teacherId,
    rate_per_class: input.ratePerClass,
    // effective_from defaults to CURRENT_DATE
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/teachers');
  revalidatePath('/teacher-payouts');
  return { ok: true };
}
