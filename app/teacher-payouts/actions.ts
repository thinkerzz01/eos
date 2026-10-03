'use server';

// Teacher payout write action (Admin only - RLS denies Manager on the pay tables).
// Records an actual payment made to a teacher into teacher_payouts.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { friendlyDbError } from '@/lib/friendlyError';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Month label ("October 2026") for a payout, taken from the actual pay date
// (YYYY-MM-DD) or today in PKT. Kept only as a human-readable note.
function monthLabelFromPayDate(paidAt?: string): string {
  const ymd = paidAt && /^\d{4}-\d{2}-\d{2}$/.test(paidAt)
    ? paidAt
    : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const [y, m] = ymd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export interface PayoutResult {
  ok: boolean;
  error?: string;
}

export async function recordTeacherPayout(input: {
  teacherId: string;
  amount: number;
  method?: string; // 'Bank Transfer' | 'JazzCash'
  reference?: string;
  period?: string; // defaults to the current month
  paidAt?: string; // 'YYYY-MM-DD' the payout was made; defaults to now
}): Promise<PayoutResult> {
  if (!input.teacherId) return { ok: false, error: 'Teacher is required.' };
  if (!(input.amount > 0)) return { ok: false, error: 'Enter a valid payout amount.' };
  if (input.paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(input.paidAt)) {
    return { ok: false, error: 'Enter a valid payout date.' };
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
  if (profile.role !== 'admin') return { ok: false, error: 'Only an admin can pay teachers.' };

  // Stamp the chosen payout date at noon PKT so the calendar day never rolls
  // over when read back; default to the current timestamp.
  const paidAtIso = input.paidAt ? new Date(`${input.paidAt}T12:00:00+05:00`).toISOString() : undefined;

  // The period label is derived from the ACTUAL pay date, not the month being
  // viewed. Reconciliation matches by paid_at date (see teacherSalaries.ts), so
  // this label is just a human note that always agrees with when money moved.
  const period = monthLabelFromPayDate(input.paidAt);

  const { error } = await supabase.from('teacher_payouts').insert({
    org_id: profile.org_id,
    teacher_id: input.teacherId,
    period,
    amount: input.amount,
    method: input.method === 'JazzCash' ? 'jazzcash' : 'bank_transfer',
    reference: input.reference?.trim() || null,
    by_user_id: user.id,
    ...(paidAtIso ? { paid_at: paidAtIso } : {}),
  });
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/teacher-payouts');
  revalidatePath('/');
  return { ok: true };
}

// Set an enrollment's salary inputs: monthly salary + the exact class start/end
// dates. The 25% commission falls in the month of the start date; salary stops
// after the end date (blank = open-ended). Admin only. One student_subjects row =
// one teacher+subject salary.
export async function setEnrollmentSalary(input: {
  enrollmentId: string;
  monthlySalary: number;
  classStartDate?: string | null; // 'YYYY-MM-DD' | null (null = use enrolment date)
  classEndDate?: string | null;   // 'YYYY-MM-DD' | null (null = open-ended)
  applyCommission?: boolean;      // false = never deduct the 25% first-month cut
}): Promise<PayoutResult> {
  if (!input.enrollmentId) return { ok: false, error: 'Enrollment is required.' };
  if (!(input.monthlySalary >= 0)) return { ok: false, error: 'Enter a valid monthly salary.' };
  const startDate = input.classStartDate?.trim() || null;
  const endDate = input.classEndDate?.trim() || null;
  const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (startDate && !isYmd(startDate)) return { ok: false, error: 'Enter a valid class start date.' };
  if (endDate && !isYmd(endDate)) return { ok: false, error: 'Enter a valid class end date.' };
  if (startDate && endDate && endDate < startDate) {
    return { ok: false, error: 'The class end date cannot be before the start date.' };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (profile?.role !== 'admin') return { ok: false, error: 'Only an admin can set salaries.' };

  const base = {
    monthly_salary: input.monthlySalary,
    class_start_date: startDate,
    class_end_date: endDate,
    // Keep the legacy month column in sync with the start date (the commission
    // month), so any reader that has not moved to the exact dates stays correct.
    salary_start_month: startDate ? startDate.slice(0, 7) : null,
  };
  const applyCommission = input.applyCommission !== false;
  let { error } = await supabase
    .from('student_subjects')
    .update({ ...base, apply_commission: applyCommission })
    .eq('id', input.enrollmentId);
  // Graceful fallback if the apply_commission migration has not been run yet.
  if (error && /apply_commission|column .* does not exist|schema cache/i.test(error.message)) {
    ({ error } = await supabase.from('student_subjects').update(base).eq('id', input.enrollmentId));
  }
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/teacher-payouts');
  return { ok: true };
}

// Admin: edit an existing payout row (amount / date / method / reference).
export async function updateTeacherPayout(input: {
  payoutId: string;
  amount: number;
  method?: string;
  reference?: string;
  paidAt?: string; // 'YYYY-MM-DD'
}): Promise<PayoutResult> {
  if (!input.payoutId) return { ok: false, error: 'Payout is required.' };
  if (!(input.amount !== 0)) return { ok: false, error: 'Enter a non-zero amount.' };
  if (input.paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(input.paidAt)) {
    return { ok: false, error: 'Enter a valid payout date.' };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).is('deleted_at', null).maybeSingle();
  if (profile?.role !== 'admin') return { ok: false, error: 'Only an admin can edit payouts.' };

  const paidAtIso = input.paidAt ? new Date(`${input.paidAt}T12:00:00+05:00`).toISOString() : undefined;
  const { error } = await supabase
    .from('teacher_payouts')
    .update({
      amount: input.amount,
      method: input.method === 'JazzCash' ? 'jazzcash' : 'bank_transfer',
      reference: input.reference?.trim() || null,
      ...(paidAtIso ? { paid_at: paidAtIso } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.payoutId)
    .is('deleted_at', null);
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/teacher-payouts');
  revalidatePath('/');
  return { ok: true };
}

// Admin: soft-delete a teacher's payouts for a month, matched by the ACTUAL
// pay date (paid_at), so it lines up with how the sheet groups them. `periodYYYYMM`
// is 'YYYY-MM'. Reverts that month's payouts to unpaid.
export async function deleteTeacherPayouts(input: {
  teacherId: string;
  periodYYYYMM: string;
}): Promise<PayoutResult> {
  if (!input.teacherId || !/^\d{4}-\d{2}$/.test(input.periodYYYYMM || '')) {
    return { ok: false, error: 'Teacher and a specific month are required.' };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).is('deleted_at', null).maybeSingle();
  if (profile?.role !== 'admin') return { ok: false, error: 'Only an admin can delete payouts.' };

  // Match payouts whose paid_at falls in the selected PKT month.
  const [y, m] = input.periodYYYYMM.split('-').map(Number); // m is 1-12
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const monthStart = new Date(`${input.periodYYYYMM}-01T00:00:00+05:00`).toISOString();
  const nextStart = new Date(`${ny}-${String(nm).padStart(2, '0')}-01T00:00:00+05:00`).toISOString();

  const { error } = await supabase
    .from('teacher_payouts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('teacher_id', input.teacherId)
    .gte('paid_at', monthStart)
    .lt('paid_at', nextStart)
    .is('deleted_at', null);
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/teacher-payouts');
  revalidatePath('/');
  return { ok: true };
}

// Admin: record a REFUND from a teacher (money coming back). Stored as a
// negative-amount payout row, so the net "Paid" for the period goes down.
export async function refundTeacherPayout(input: {
  teacherId: string;
  amount: number;   // positive amount to refund; stored negative
  method?: string;
  reference?: string;
  period?: string;
  paidAt?: string;  // 'YYYY-MM-DD'
}): Promise<PayoutResult> {
  if (!input.teacherId) return { ok: false, error: 'Teacher is required.' };
  if (!(input.amount > 0)) return { ok: false, error: 'Enter a valid refund amount.' };
  if (input.paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(input.paidAt)) {
    return { ok: false, error: 'Enter a valid refund date.' };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('org_id,role').eq('user_id', user.id).is('deleted_at', null).maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };
  if (profile.role !== 'admin') return { ok: false, error: 'Only an admin can record a refund.' };

  const period = monthLabelFromPayDate(input.paidAt);
  const paidAtIso = input.paidAt ? new Date(`${input.paidAt}T12:00:00+05:00`).toISOString() : undefined;
  const ref = input.reference?.trim();

  const { error } = await supabase.from('teacher_payouts').insert({
    org_id: profile.org_id,
    teacher_id: input.teacherId,
    period,
    amount: -Math.abs(input.amount), // negative => reduces net paid
    method: input.method === 'JazzCash' ? 'jazzcash' : 'bank_transfer',
    reference: ref ? `Refund: ${ref}` : 'Refund',
    by_user_id: user.id,
    ...(paidAtIso ? { paid_at: paidAtIso } : {}),
  });
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/teacher-payouts');
  revalidatePath('/');
  return { ok: true };
}
