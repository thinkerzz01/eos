// Fees (parent's own vouchers) data-access - RLS-enforced, server-only.
// RLS auto-scopes: an admin sees all vouchers; a student/parent sees only their
// own child's (student_read_own_vouchers policy). Same query, different result.
import { createClient } from '@/lib/supabase/server';
import type { VoucherRow } from '@/app/fees/FeesClient';
import { billingPeriodLabel } from '@/lib/billingPeriod';

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

function mapRow(r: any): VoucherRow {
  const student = one<any>(r.students);
  return {
    id: r.id,
    voucher_no: r.voucher_no,
    student_name: student?.name ?? '',
    period: r.period,
    // Exact billing cycle anchored to the student's enrolment day (mid-month starts).
    periodLabel: billingPeriodLabel(r.period, student?.enrolled_at, r.due_date),
    amount: Number(r.amount || 0),
    due_date: r.due_date,
    grace_deadline: r.grace_deadline,
    status: r.status,
  };
}

export async function getFeeVouchers(): Promise<VoucherRow[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('vouchers')
    .select('id,voucher_no,period,amount,due_date,grace_deadline,status,students(name,enrolled_at)')
    .is('deleted_at', null)
    .order('due_date', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
