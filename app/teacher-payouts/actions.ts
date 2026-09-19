'use server';

// Teacher payout write action (Admin only - RLS denies Manager on the pay tables).
// Records an actual payment made to a teacher into teacher_payouts.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { friendlyDbError } from '@/lib/friendlyError';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

  // UTC to match the reader (lib/data/teacherPayouts + the page), so a recorded
  // payout lands under the same month label the admin is viewing.
  const now = new Date();
  const period = input.period?.trim() || `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  // Stamp the chosen payout date at noon PKT so the calendar day never rolls
  // over when read back; default to the current timestamp.
  const paidAtIso = input.paidAt ? new Date(`${input.paidAt}T12:00:00+05:00`).toISOString() : undefined;

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

  const { error } = await supabase
    .from('student_subjects')
    .update({
      monthly_salary: input.monthlySalary,
      class_start_date: startDate,
      class_end_date: endDate,
      // Keep the legacy month column in sync with the start date (the commission
      // month), so any reader that has not moved to the exact dates stays correct.
      salary_start_month: startDate ? startDate.slice(0, 7) : null,
    })
    .eq('id', input.enrollmentId);
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/teacher-payouts');
  return { ok: true };
}
