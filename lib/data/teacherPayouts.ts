// Teacher payouts data-access - RLS-enforced, server-only. Admin-only
// (teacher_pay_rates is the isolated pay table; Managers are DENIED at the DB).
//
// Payroll math (Master Plan §): a teacher's EARNED amount this month is
//   perClassPay × completed classes this month.
// We also sum what has already been paid this month (teacher_payouts) so the
// admin sees the remaining balance and a Pending / Partial / Paid status.
import { createClient } from '@/lib/supabase/server';
import type { TeacherPayout } from '@/app/teacher-payouts/TeacherPayoutsClient';

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export async function getTeacherPayouts(periodYYYYMM?: string): Promise<TeacherPayout[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  // Payroll is per FACULTY MEMBER: list every active teacher (not just those with
  // a rate set), so the admin can see everyone and set rates / record payouts here.
  const { data: teachers, error } = await supabase
    .from('teachers')
    .select('id,name,phone,status')
    .is('deleted_at', null)
    .neq('status', 'left')
    .order('name', { ascending: true });
  if (error || !teachers) return [];

  // Latest per-class rate per teacher (teacher_pay_rates is versioned history).
  const { data: rateRows } = await supabase
    .from('teacher_pay_rates')
    .select('teacher_id,rate_per_class,effective_from')
    .is('deleted_at', null)
    .order('effective_from', { ascending: false });
  const rateByTeacher = new Map<string, number>();
  for (const r of (rateRows as any[]) ?? []) {
    if (!rateByTeacher.has(r.teacher_id)) rateByTeacher.set(r.teacher_id, Number(r.rate_per_class || 0));
  }

  // Target month - defaults to the current month, or a 'YYYY-MM' passed in.
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // 0-indexed
  if (periodYYYYMM && /^\d{4}-\d{2}$/.test(periodYYYYMM)) {
    const [y, m] = periodYYYYMM.split('-').map(Number);
    year = y;
    month = Math.min(11, Math.max(0, m - 1));
  }
  const period = `${MONTHS[month]} ${year}`;
  const monthStart = new Date(Date.UTC(year, month, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(year, month + 1, 1)).toISOString();

  // Completed classes THIS MONTH per teacher (drives the earned amount).
  const completedByTeacher = new Map<string, number>();
  const { data: classRows } = await supabase
    .from('class_sessions')
    .select('teacher_id')
    .eq('status', 'completed')
    .gte('start_at', monthStart)
    .lt('start_at', monthEnd)
    .is('deleted_at', null);
  for (const c of (classRows as any[]) ?? []) {
    const t = c.teacher_id as string;
    if (t) completedByTeacher.set(t, (completedByTeacher.get(t) ?? 0) + 1);
  }

  // Subjects per teacher (from teacher_subjects) - best-effort labels.
  const subjectsByTeacher = new Map<string, Set<string>>();
  const { data: tsRows } = await supabase
    .from('teacher_subjects')
    .select('teacher_id,subjects(name)')
    .is('deleted_at', null);
  for (const row of (tsRows as any[]) ?? []) {
    const t = row.teacher_id as string;
    const subj = one<any>(row.subjects);
    if (!t || !subj?.name) continue;
    if (!subjectsByTeacher.has(t)) subjectsByTeacher.set(t, new Set());
    subjectsByTeacher.get(t)!.add(subj.name);
  }

  // Already-paid this month per teacher.
  const paidByTeacher = new Map<string, { amount: number; at: string; method: string }>();
  const { data: payoutRows } = await supabase
    .from('teacher_payouts')
    .select('teacher_id,amount,paid_at,period,method')
    .eq('period', period)
    .is('deleted_at', null);
  for (const p of (payoutRows as any[]) ?? []) {
    const prev = paidByTeacher.get(p.teacher_id);
    paidByTeacher.set(p.teacher_id, {
      amount: (prev?.amount ?? 0) + Number(p.amount || 0),
      at: p.paid_at,
      method: p.method === 'jazzcash' ? 'JazzCash' : 'Bank Transfer',
    });
  }

  return (teachers as any[]).map((t) => {
    const perClassPay = rateByTeacher.get(t.id) ?? 0;
    const completedClassesCount = completedByTeacher.get(t.id) ?? 0;
    const grossAmount = perClassPay * completedClassesCount;
    const paid = paidByTeacher.get(t.id);
    const paidAmount = paid?.amount ?? 0;
    const status: TeacherPayout['status'] =
      paidAmount > 0 && paidAmount >= grossAmount && grossAmount > 0 ? 'Paid'
      : paidAmount > 0 ? 'Partial'
      : 'Pending';
    return {
      id: t.id,
      teacherId: t.id,
      teacherName: t.name ?? '',
      teacherPhone: t.phone ?? '',
      subjects: Array.from(subjectsByTeacher.get(t.id) ?? []).sort(),
      perClassPay,
      completedClassesCount,
      grossAmount,
      paidAmount,
      status,
      payoutDate: paid ? String(paid.at).slice(0, 10) : undefined,
      paymentMethod: paid?.method ?? '',
      bankAccount: '',
    };
  });
}
