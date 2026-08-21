// Dashboard aggregate metrics (RLS-enforced, server-only). Every query fails safe
// to 0/[] so a missing column or a role with no access never crashes the page.
import { createClient } from '@/lib/supabase/server';

export interface TodayClass {
  id: string;
  time: string;
  subject: string;
  student: string;
}
export interface TeacherLoad {
  id: string;
  name: string;
  load: number;
  capacity: number;
}
export interface DashboardMetrics {
  activeTeachers: number;
  activeStudents: number;
  classesToday: number;
  revenueThisMonth: number;
  demosNeedingTeacher: number;
  newLeadsToday: number;
  collected: number;
  outstanding: number;
  refunds: number;
  feeCollectionPct: number;
  forecast30: number; // expected fee revenue over the next 30 days
  paidToTeachers: number; // teacher payouts recorded this month
  todaysClasses: TodayClass[];
  teacherCapacity: TeacherLoad[];
}

const EMPTY: DashboardMetrics = {
  activeTeachers: 0, activeStudents: 0, classesToday: 0, revenueThisMonth: 0, demosNeedingTeacher: 0,
  newLeadsToday: 0, collected: 0, outstanding: 0, refunds: 0, feeCollectionPct: 0, forecast30: 0,
  paidToTeachers: 0, todaysClasses: [], teacherCapacity: [],
};

function one(rel: any): any {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return EMPTY;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const todayPKT = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const dayStart = `${todayPKT}T00:00:00+05:00`;
  const dayEnd = `${todayPKT}T23:59:59+05:00`;

  const [teachersRes, classesRes, paymentsRes, vouchersRes, vPaymentsRes, demosRes, loadRes, studentsRes, payoutsRes, leadsRes] =
    await Promise.all([
      supabase.from('teachers').select('id,name,capacity').is('deleted_at', null),
      supabase.from('class_sessions').select('id,start_at,students(name),subjects(name)').gte('start_at', dayStart).lte('start_at', dayEnd).is('deleted_at', null).order('start_at', { ascending: true }),
      supabase.from('payments').select('amount').gte('created_at', monthStart).is('deleted_at', null),
      supabase.from('vouchers').select('id,amount,status').neq('status', 'paid').is('deleted_at', null),
      supabase.from('payments').select('amount,voucher_id').is('deleted_at', null),
      supabase.from('demos').select('id', { count: 'exact', head: true }).eq('status', 'needs_teacher').is('deleted_at', null),
      supabase.from('class_sessions').select('teacher_id').is('deleted_at', null),
      supabase.from('students').select('monthly_fee').eq('status', 'active').is('deleted_at', null),
      supabase.from('teacher_payouts').select('amount').gte('paid_at', monthStart).is('deleted_at', null),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', dayStart).is('deleted_at', null),
    ]);

  const teachers = teachersRes.data ?? [];
  const activeStudentRows = studentsRes.data ?? [];
  // Forecast for the next 30 days = one month's fee from each active student.
  const forecast30 = (activeStudentRows as any[]).reduce((s, r) => s + Number(r.monthly_fee || 0), 0);
  // Teacher payouts recorded this month (teacher_payouts may not exist yet -> 0).
  const paidToTeachers = (payoutsRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  const todaysClasses: TodayClass[] = (classesRes.data ?? []).map((c: any) => ({
    id: c.id,
    time: new Date(c.start_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' }),
    subject: one(c.subjects)?.name ?? '',
    student: one(c.students)?.name ?? '',
  }));

  // Refunds are stored as NEGATIVE rows in `payments` (see issueRefund), not the
  // dead `refunds` table - so derive both net revenue and the refund total from
  // this month's payments.
  const monthPayments = (paymentsRes.data ?? []) as any[];
  const revenueThisMonth = monthPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const paidByVoucher = new Map<string, number>();
  for (const p of vPaymentsRes.data ?? []) {
    const k = (p as any).voucher_id as string;
    paidByVoucher.set(k, (paidByVoucher.get(k) ?? 0) + Number((p as any).amount || 0));
  }
  let outstanding = 0;
  for (const v of vouchersRes.data ?? []) {
    outstanding += Math.max(0, Number((v as any).amount || 0) - (paidByVoucher.get((v as any).id) ?? 0));
  }

  const refunds = monthPayments
    .filter((p) => Number(p.amount || 0) < 0)
    .reduce((s: number, p: any) => s + Math.abs(Number(p.amount || 0)), 0);

  const loadByTeacher = new Map<string, number>();
  for (const c of loadRes.data ?? []) {
    const t = (c as any).teacher_id as string;
    if (t) loadByTeacher.set(t, (loadByTeacher.get(t) ?? 0) + 1);
  }
  const teacherCapacity: TeacherLoad[] = (teachers as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    load: loadByTeacher.get(t.id) ?? 0,
    capacity: Number(t.capacity || 0),
  }));

  const collected = revenueThisMonth;
  const totalBilled = collected + outstanding;

  return {
    activeTeachers: teachers.length,
    activeStudents: activeStudentRows.length,
    classesToday: todaysClasses.length,
    revenueThisMonth,
    demosNeedingTeacher: demosRes.count ?? 0,
    newLeadsToday: leadsRes.count ?? 0,
    collected,
    outstanding,
    refunds,
    feeCollectionPct: totalBilled > 0 ? Math.round((collected / totalBilled) * 100) : 0,
    forecast30,
    paidToTeachers,
    todaysClasses,
    teacherCapacity,
  };
}
