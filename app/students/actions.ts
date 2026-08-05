'use server';

// Students write actions. REFERENCE PATTERN for the write path (Step: forms
// persist to the DB). Runs on the server with the user's session, so Postgres
// RLS decides who may insert (admin + manager for students; everyone else is
// denied at the DB). No service-role bypass. The audit_log trigger records the
// write automatically.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const CAIE_PROGRAMS = ['O Level', 'A Level', 'IGCSE'];
const SOURCES = ['google', 'facebook', 'instagram', 'whatsapp', 'referral', 'walk_in'];

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
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function normalizeSource(raw?: string): string {
  const s = (raw ?? '').toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
  return SOURCES.includes(s) ? s : 'google';
}

export async function createStudent(input: CreateStudentInput): Promise<ActionResult> {
  const name = input.name?.trim();
  const parent_name = input.parent_name?.trim();
  const phone = input.phone?.trim();

  // Validate against what the schema actually requires (NOT NULL + CHECKs).
  if (!name || !parent_name || !phone) {
    return { ok: false, error: 'Name, parent name, and phone are required.' };
  }
  if (!CAIE_PROGRAMS.includes(input.program)) {
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
    email: input.email?.trim() || null,
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
  const { error } = await supabase.from('students').insert(row);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/students');
  revalidatePath('/');
  return { ok: true };
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

  const valid = rows.filter(
    (r) => r.name?.trim() && r.parentName?.trim() && CAIE_PROGRAMS.includes(r.program)
  );
  const skipped = rows.length - valid.length;
  if (valid.length === 0) {
    return {
      ok: false,
      inserted: 0,
      skipped,
      error: 'No valid rows — each needs a name, a parent name, and a CAIE program (O/A Level, IGCSE).',
    };
  }

  const toInsert = valid.map((r) => ({
    org_id: profile.org_id,
    name: r.name.trim(),
    parent_name: r.parentName.trim(),
    phone: r.parentPhone?.trim() || 'N/A',
    email: r.parentEmail?.trim() || null,
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
