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
}): Promise<PayoutResult> {
  if (!input.teacherId) return { ok: false, error: 'Teacher is required.' };
  if (!(input.amount > 0)) return { ok: false, error: 'Enter a valid payout amount.' };

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

  const { error } = await supabase.from('teacher_payouts').insert({
    org_id: profile.org_id,
    teacher_id: input.teacherId,
    period,
    amount: input.amount,
    method: input.method === 'JazzCash' ? 'jazzcash' : 'bank_transfer',
    reference: input.reference?.trim() || null,
    by_user_id: user.id,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/teacher-payouts');
  revalidatePath('/');
  return { ok: true };
}

// Set an enrollment's salary inputs (monthly salary and the first paid month
// for the 25% commission). Admin only. One student_subjects row = one
// teacher+subject salary.
export async function setEnrollmentSalary(input: {
  enrollmentId: string;
  monthlySalary: number;
  salaryStartMonth?: string | null; // 'YYYY-MM' | null (null = use enrolment month)
}): Promise<PayoutResult> {
  if (!input.enrollmentId) return { ok: false, error: 'Enrollment is required.' };
  if (!(input.monthlySalary >= 0)) return { ok: false, error: 'Enter a valid monthly salary.' };
  const startMonth = input.salaryStartMonth?.trim() || null;
  if (startMonth && !/^\d{4}-\d{2}$/.test(startMonth)) {
    return { ok: false, error: 'First month must be in YYYY-MM format.' };
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
      salary_start_month: startMonth,
    })
    .eq('id', input.enrollmentId);
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/teacher-payouts');
  return { ok: true };
}
