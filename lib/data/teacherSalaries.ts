// Teacher SALARY & REVENUE sheet - RLS-enforced, server-only. Admin-only.
//
// One row per student/subject enrollment (student_subjects). Each teacher earns
// a fixed monthly salary per enrollment, minus a missed-class deduction and a
// first-month commission (see lib/config/payroll.ts). Revenue is computed per
// STUDENT: the student's monthly fee minus the teacher pay across their subjects.
import { createClient } from '@/lib/supabase/server';
import { classesForWeeklyDays, computeSalaryMath } from '@/lib/config/payroll';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

export interface SalaryRow {
  enrollmentId: string;
  teacherId: string;
  teacherName: string;
  teacherPhone: string;
  studentId: string;
  studentName: string;
  subjectName: string;
  program: string;
  weeklyDays: number | null;
  salaryStartMonth: string | null; // raw 'YYYY-MM' override, or null (auto)
  classesPerMonth: number;
  taught: number;
  missed: number;
  monthlySalary: number;
  hasSalary: boolean;
  perClass: number;
  missedDeduction: number;
  isMonth1: boolean;
  commission: number;
  salaryAfterDeduction: number;
  teacherPay: number;
  wentNegative: boolean;
  studentFee: number;
}

export interface TeacherRollup {
  teacherId: string;
  teacherName: string;
  teacherPhone: string;
  enrollments: number;
  earned: number;
  paid: number;
  balance: number;
  status: 'Pending' | 'Partial' | 'Paid';
  payoutDate?: string;
  paymentMethod: string;
}

export interface SalarySheet {
  rows: SalaryRow[];
  teachers: TeacherRollup[];
  totals: {
    totalFees: number;
    totalSalaries: number;
    totalCommission: number;
    totalMissedDeduction: number;
    grossRevenue: number;
    studentCount: number;
    teacherCount: number;
  };
  period: string;
  periodYYYYMM: string;
}

export async function getSalarySheet(periodYYYYMM?: string): Promise<SalarySheet> {
  const empty: SalarySheet = {
    rows: [],
    teachers: [],
    totals: { totalFees: 0, totalSalaries: 0, totalCommission: 0, totalMissedDeduction: 0, grossRevenue: 0, studentCount: 0, teacherCount: 0 },
    period: '',
    periodYYYYMM: periodYYYYMM ?? '',
  };

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return empty;

  // Target month (UTC, consistent with the reader/writer elsewhere).
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  if (periodYYYYMM && /^\d{4}-\d{2}$/.test(periodYYYYMM)) {
    const [y, m] = periodYYYYMM.split('-').map(Number);
    year = y;
    month = Math.min(11, Math.max(0, m - 1));
  }
  const mm = String(month + 1).padStart(2, '0');
  const selectedYYYYMM = `${year}-${mm}`;
  const period = `${MONTHS[month]} ${year}`;
  const monthStart = new Date(Date.UTC(year, month, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(year, month + 1, 1)).toISOString();

  // Enrollments that existed during (or before) the target month. FULL select
  // falls back to BASE when the salary columns have not been migrated yet.
  const FULL = 'id,teacher_id,student_id,subject_id,monthly_salary,weekly_days,salary_start_month,created_at,students(name,program,monthly_fee,status,enrolled_at,deleted_at),subjects(name),teachers(name,phone)';
  const BASE = 'id,teacher_id,student_id,subject_id,created_at,students(name,program,monthly_fee,status,enrolled_at,deleted_at),subjects(name),teachers(name,phone)';
  let enr: any[] | null = null;
  {
    const res = await supabase.from('student_subjects').select(FULL).is('deleted_at', null).lt('created_at', monthEnd);
    if (res.error) {
      const fb = await supabase.from('student_subjects').select(BASE).is('deleted_at', null).lt('created_at', monthEnd);
      enr = (fb.data as any[]) ?? [];
    } else {
      enr = (res.data as any[]) ?? [];
    }
  }

  // Sessions this month → taught (completed) and actual scheduled (not cancelled).
  const taughtByKey = new Map<string, number>();
  const scheduledByKey = new Map<string, number>();
  const key = (st: string, su: string, te: string) => `${st}|${su}|${te}`;
  {
    const { data: sess } = await supabase
      .from('class_sessions')
      .select('teacher_id,student_id,subject_id,status')
      .gte('start_at', monthStart)
      .lt('start_at', monthEnd)
      .is('deleted_at', null);
    for (const s of (sess as any[]) ?? []) {
      if (!s.teacher_id || !s.student_id || !s.subject_id) continue;
      const k = key(s.student_id, s.subject_id, s.teacher_id);
      if (s.status !== 'cancelled') scheduledByKey.set(k, (scheduledByKey.get(k) ?? 0) + 1);
      if (s.status === 'completed') taughtByKey.set(k, (taughtByKey.get(k) ?? 0) + 1);
    }
  }

  // Already-paid this month per teacher (latest row wins for the display date).
  const paidByTeacher = new Map<string, { amount: number; at: string; method: string }>();
  {
    const { data: payouts } = await supabase
      .from('teacher_payouts')
      .select('teacher_id,amount,paid_at,method')
      .eq('period', period)
      .is('deleted_at', null)
      .order('paid_at', { ascending: true });
    for (const p of (payouts as any[]) ?? []) {
      const prev = paidByTeacher.get(p.teacher_id);
      paidByTeacher.set(p.teacher_id, {
        amount: (prev?.amount ?? 0) + Number(p.amount || 0),
        at: p.paid_at,
        method: p.method === 'jazzcash' ? 'JazzCash' : 'Bank Transfer',
      });
    }
  }

  const rows: SalaryRow[] = [];
  for (const e of enr) {
    const student = one<any>(e.students);
    const subject = one<any>(e.subjects);
    const teacher = one<any>(e.teachers);
    if (!student || student.deleted_at) continue; // student removed
    if (student.enrolled_at && String(student.enrolled_at) > monthEnd.slice(0, 10)) continue; // not enrolled yet

    const k = key(e.student_id, e.subject_id, e.teacher_id);
    const taught = taughtByKey.get(k) ?? 0;
    const scheduledActual = scheduledByKey.get(k) ?? 0;
    const weeklyDays: number | null = e.weekly_days ?? null;
    const classesPerMonth = classesForWeeklyDays(weeklyDays) ?? scheduledActual;

    const monthlySalary = Number(e.monthly_salary ?? 0);
    const startMonth = (e.salary_start_month && /^\d{4}-\d{2}$/.test(e.salary_start_month))
      ? e.salary_start_month
      : String(e.created_at || '').slice(0, 7);
    const isMonth1 = startMonth === selectedYYYYMM;

    const math = computeSalaryMath({ monthlySalary, classesPerMonth, taught, isMonth1 });

    rows.push({
      enrollmentId: e.id,
      teacherId: e.teacher_id,
      teacherName: teacher?.name ?? '—',
      teacherPhone: teacher?.phone ?? '',
      studentId: e.student_id,
      studentName: student.name ?? '',
      subjectName: subject?.name ?? '',
      program: student.program ?? '',
      weeklyDays,
      salaryStartMonth: (e.salary_start_month && /^\d{4}-\d{2}$/.test(e.salary_start_month)) ? e.salary_start_month : null,
      classesPerMonth,
      taught,
      missed: math.missed,
      monthlySalary,
      hasSalary: monthlySalary > 0,
      perClass: math.perClass,
      missedDeduction: math.missedDeduction,
      isMonth1,
      commission: math.commission,
      salaryAfterDeduction: math.salaryAfterDeduction,
      teacherPay: math.teacherPay,
      wentNegative: math.wentNegative,
      studentFee: Number(student.monthly_fee ?? 0),
    });
  }

  // Sort: teacher name, then student, then subject.
  rows.sort((a, b) =>
    a.teacherName.localeCompare(b.teacherName) ||
    a.studentName.localeCompare(b.studentName) ||
    a.subjectName.localeCompare(b.subjectName)
  );

  // Per-teacher rollup (payment is per teacher).
  const byTeacher = new Map<string, TeacherRollup>();
  for (const r of rows) {
    let t = byTeacher.get(r.teacherId);
    if (!t) {
      const paid = paidByTeacher.get(r.teacherId);
      t = {
        teacherId: r.teacherId,
        teacherName: r.teacherName,
        teacherPhone: r.teacherPhone,
        enrollments: 0,
        earned: 0,
        paid: paid?.amount ?? 0,
        balance: 0,
        status: 'Pending',
        payoutDate: paid ? String(paid.at).slice(0, 10) : undefined,
        paymentMethod: paid?.method ?? '',
      };
      byTeacher.set(r.teacherId, t);
    }
    t.enrollments += 1;
    t.earned += r.teacherPay;
  }
  const teachers = Array.from(byTeacher.values()).map((t) => {
    const balance = Math.max(0, t.earned - t.paid);
    const status: TeacherRollup['status'] =
      t.paid > 0 && t.paid >= t.earned && t.earned > 0 ? 'Paid'
      : t.paid > 0 ? 'Partial'
      : 'Pending';
    return { ...t, balance, status };
  }).sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  // Company totals. Fees are per STUDENT (count each student once).
  const feeByStudent = new Map<string, number>();
  for (const r of rows) if (!feeByStudent.has(r.studentId)) feeByStudent.set(r.studentId, r.studentFee);
  const totalFees = Array.from(feeByStudent.values()).reduce((s, v) => s + v, 0);
  const totalSalaries = rows.reduce((s, r) => s + r.teacherPay, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const totalMissedDeduction = rows.reduce((s, r) => s + r.missedDeduction, 0);

  return {
    rows,
    teachers,
    totals: {
      totalFees,
      totalSalaries,
      totalCommission,
      totalMissedDeduction,
      grossRevenue: totalFees - totalSalaries,
      studentCount: feeByStudent.size,
      teacherCount: byTeacher.size,
    },
    period,
    periodYYYYMM: selectedYYYYMM,
  };
}
