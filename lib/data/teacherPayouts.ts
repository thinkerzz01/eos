// Teacher payouts data-access - RLS-enforced, server-only. Admin-only
// (teacher_pay_rates is the isolated pay table; Managers are DENIED at the DB).
import { createClient } from '@/lib/supabase/server';
import type { TeacherPayout } from '@/app/teacher-payouts/TeacherPayoutsClient';

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

function mapRow(r: any): TeacherPayout {
  const teacher = one<any>(r.teachers);
  return {
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: teacher?.name ?? '',
    subjects: [],
    perClassPay: Number(r.rate_per_class || 0),
    completedClassesCount: 0, // from class_sessions (Phase 4)
    grossAmount: 0,
    status: 'Pending',
    paymentMethod: '',
    bankAccount: '',
  };
}

export async function getTeacherPayouts(): Promise<TeacherPayout[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('teacher_pay_rates')
    .select('id,teacher_id,rate_per_class,currency,effective_from,teachers(name)')
    .is('deleted_at', null)
    .order('effective_from', { ascending: false });

  if (error || !data) return [];

  // teacher_pay_rates is versioned history (one row per rate change). Ordered by
  // effective_from DESC above, so the FIRST row per teacher is their latest rate.
  // Keep only that one to avoid duplicating a teacher / inflating headcount.
  const seen = new Set<string>();
  const latestPerTeacher = (data as any[]).filter((r) => {
    if (seen.has(r.teacher_id)) return false;
    seen.add(r.teacher_id);
    return true;
  });

  // Mark a teacher Paid if there is a payout recorded for the current month.
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  const period = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const paidByTeacher = new Map<string, { amount: number; at: string }>();
  const { data: payoutRows } = await supabase
    .from('teacher_payouts')
    .select('teacher_id,amount,paid_at,period')
    .eq('period', period)
    .is('deleted_at', null);
  for (const p of (payoutRows as any[]) ?? []) {
    const prev = paidByTeacher.get(p.teacher_id);
    paidByTeacher.set(p.teacher_id, {
      amount: (prev?.amount ?? 0) + Number(p.amount || 0),
      at: p.paid_at,
    });
  }

  return latestPerTeacher.map((r) => {
    const row = mapRow(r);
    const paid = paidByTeacher.get(r.teacher_id);
    if (paid) {
      row.status = 'Paid';
      row.grossAmount = paid.amount;
      row.payoutDate = String(paid.at).slice(0, 10);
    }
    return row;
  });
}
