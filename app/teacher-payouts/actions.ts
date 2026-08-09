'use server';

// Teacher payout write action (Admin only - RLS denies Manager on the pay tables).
// Records an actual payment made to a teacher into teacher_payouts.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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

  const now = new Date();
  const period = input.period?.trim() || `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const { error } = await supabase.from('teacher_payouts').insert({
    org_id: profile.org_id,
    teacher_id: input.teacherId,
    period,
    amount: input.amount,
    method: input.method === 'JazzCash' ? 'jazzcash' : 'bank_transfer',
    reference: input.reference?.trim() || null,
    by_user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/teacher-payouts');
  revalidatePath('/');
  return { ok: true };
}
