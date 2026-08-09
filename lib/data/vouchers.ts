// Vouchers data-access - RLS-enforced, server-only. Admin-only (Manager DENIED
// on every finance table at the DB). Sums payments for the running balance;
// partial payments keep the voucher Due with a balance (locked policy).
import { createClient } from '@/lib/supabase/server';
import type { FeeVoucher } from '@/lib/mockFinanceData';

const STATUS_UI: Record<string, FeeVoucher['status']> = {
  due: 'Due',
  in_grace: 'In Grace',
  paid: 'Paid',
  stopped: 'Stopped',
};

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

function mapRow(r: any): FeeVoucher {
  const student = one<any>(r.students);
  const payments: any[] = Array.isArray(r.payments) ? r.payments : [];
  const paidAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalAmount = Number(r.amount || 0);
  const graceDeadline = r.grace_deadline; // 'YYYY-MM-DD'
  // Master Plan §2: in grace up to AND INCLUDING the grace-deadline date; overdue
  // begins the day AFTER. Compare PKT calendar dates so the deadline day is still
  // grace (was `new Date(graceDeadline) < new Date()`, which fired a day early).
  const todayPKT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const needsAdminDecision =
    r.status !== 'paid' && !!graceDeadline && todayPKT > graceDeadline;
  return {
    id: r.id,
    voucherNo: r.voucher_no,
    studentId: r.student_id,
    studentName: student?.name ?? '',
    parentName: student?.parent_name ?? '',
    parentPhone: student?.phone ?? '',
    program: student?.program ?? '',
    dueDate: r.due_date,
    graceDeadlineDate: graceDeadline,
    totalAmount,
    paidAmount,
    runningBalance: totalAmount - paidAmount,
    status: STATUS_UI[r.status as string] ?? 'Due',
    needsAdminDecision,
  };
}

export async function getVouchers(): Promise<FeeVoucher[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('vouchers')
    .select('id,student_id,voucher_no,period,amount,due_date,grace_deadline,status,students(name,parent_name,phone,program),payments(amount)')
    .is('deleted_at', null)
    .order('due_date', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
