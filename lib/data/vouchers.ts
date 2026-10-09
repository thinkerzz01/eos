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
  // Distinct, non-deleted subject names for this student (for the message's "Level & Subject").
  const subjectRows: any[] = Array.isArray(student?.student_subjects) ? student.student_subjects : [];
  const subjects = Array.from(
    new Set(
      subjectRows
        .filter((ss) => !ss.deleted_at)
        .map((ss) => one<any>(ss.subjects)?.name)
        .filter(Boolean)
    )
  ).join(', ');
  const payments: any[] = Array.isArray(r.payments) ? r.payments : [];
  // Exclude soft-deleted payments so a deleted receipt drops off the paid total.
  const paidAmount = payments.filter((p) => !p.deleted_at).reduce((sum, p) => sum + Number(p.amount || 0), 0);
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
    voucherNo: r.code ?? r.voucher_no,
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
    period: r.period ?? '',
    enrolledAt: student?.enrolled_at ?? null,
    subjects,
  };
}

export async function getVouchers(): Promise<FeeVoucher[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('vouchers')
    .select('id,code,student_id,voucher_no,period,amount,due_date,grace_deadline,status,students(name,parent_name,phone,program,enrolled_at,deleted_at,student_subjects(deleted_at,subjects(name))),payments(amount,deleted_at)')
    .is('deleted_at', null)
    .order('due_date', { ascending: false });

  if (error || !data) return [];
  // Hide vouchers whose student has been soft-deleted (or hard-removed): a deleted
  // student's fees must not linger in the list or Outstanding. Alumni/stopped
  // students stay visible - their vouchers are real history, only DELETED is hidden.
  return (data as any[])
    .filter((r) => { const s = one<any>(r.students); return s && !s.deleted_at; })
    .map(mapRow);
}
