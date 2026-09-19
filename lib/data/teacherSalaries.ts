// Teacher SALARY & REVENUE sheet - RLS-enforced, server-only. Admin-only.
//
// One row per student/subject enrollment (student_subjects). Each teacher earns
// a fixed monthly salary per enrollment, minus a first-month commission only
// (see lib/config/payroll.ts). Revenue is computed per STUDENT: the student's
// monthly fee minus the teacher pay across their subjects.
import { createClient } from '@/lib/supabase/server';
import { computeSalaryMath } from '@/lib/config/payroll';
import { billingPeriodLabel } from '@/lib/billingPeriod';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

// Inclusive count of months from 'YYYY-MM' a to b (0 if a is after b).
function monthsInclusive(a: string, b: string): number {
  const am = /^(\d{4})-(\d{2})$/.exec(a);
  const bm = /^(\d{4})-(\d{2})$/.exec(b);
  if (!am || !bm) return 0;
  const n = (Number(bm[1]) - Number(am[1])) * 12 + (Number(bm[2]) - Number(am[2])) + 1;
  return n > 0 ? n : 0;
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
  periodLabel: string;             // exact pay cycle, e.g. "06 Sep - 05 Oct 2026"
  salaryStartMonth: string | null; // raw 'YYYY-MM' override, or null (auto)
  enrolledMonth: string;           // 'YYYY-MM' the student started (auto first-paid month)
  enrolledDate: string;            // 'YYYY-MM-DD' the student started (prefill for class start)
  classStartDate: string | null;   // 'YYYY-MM-DD' exact class start (salary anchor)
  classEndDate: string | null;     // 'YYYY-MM-DD' exact class end (salary stops after)
  monthlySalary: number;
  hasSalary: boolean;
  isMonth1: boolean;
  commission: number;
  teacherPay: number;
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
    feesBilled: number;       // this month's voucher amounts
    feesReceived: number;     // actual payments collected on those vouchers (in bank)
    feesOutstanding: number;  // billed − received (still to collect)
    salariesEarned: number;   // computed teacher pay owed
    salariesPaid: number;     // actual payouts made this month
    salaryOutstanding: number;// earned − paid (still to pay)
    commission: number;
    netThisMonth: number;     // feesReceived − salariesPaid
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
    totals: { feesBilled: 0, feesReceived: 0, feesOutstanding: 0, salariesEarned: 0, salariesPaid: 0, salaryOutstanding: 0, commission: 0, netThisMonth: 0, studentCount: 0, teacherCount: 0 },
    period: '',
    periodYYYYMM: periodYYYYMM ?? '',
  };

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return empty;

  // Target month (UTC, consistent with the reader/writer elsewhere).
  // 'all' aggregates every month up to the current one.
  const isAll = periodYYYYMM === 'all';
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  if (!isAll && periodYYYYMM && /^\d{4}-\d{2}$/.test(periodYYYYMM)) {
    const [y, m] = periodYYYYMM.split('-').map(Number);
    year = y;
    month = Math.min(11, Math.max(0, m - 1));
  }
  const mm = String(month + 1).padStart(2, '0');
  const selectedYYYYMM = `${year}-${mm}`; // current month, and the upper bound for 'all'
  const period = isAll ? 'All months' : `${MONTHS[month]} ${year}`;
  // 'all' includes every enrollment (no upper bound); a month view stops at month end.
  const monthEnd = isAll ? new Date(Date.UTC(9999, 0, 1)).toISOString() : new Date(Date.UTC(year, month + 1, 1)).toISOString();

  // Enrollments that existed during (or before) the target month. Select falls
  // back gracefully when a migration has not been applied yet:
  //   FULL (class dates) -> SALARY (salary cols only) -> BASE (no pay cols).
  const FULL = 'id,teacher_id,student_id,subject_id,monthly_salary,salary_start_month,class_start_date,class_end_date,created_at,students(name,program,monthly_fee,status,enrolled_at,deleted_at),subjects(name),teachers(name,phone)';
  const SALARY = 'id,teacher_id,student_id,subject_id,monthly_salary,salary_start_month,created_at,students(name,program,monthly_fee,status,enrolled_at,deleted_at),subjects(name),teachers(name,phone)';
  const BASE = 'id,teacher_id,student_id,subject_id,created_at,students(name,program,monthly_fee,status,enrolled_at,deleted_at),subjects(name),teachers(name,phone)';
  let enr: any[] | null = null;
  {
    const res = await supabase.from('student_subjects').select(FULL).is('deleted_at', null).lt('created_at', monthEnd);
    if (res.error) {
      const sal = await supabase.from('student_subjects').select(SALARY).is('deleted_at', null).lt('created_at', monthEnd);
      if (sal.error) {
        const fb = await supabase.from('student_subjects').select(BASE).is('deleted_at', null).lt('created_at', monthEnd);
        enr = (fb.data as any[]) ?? [];
      } else {
        enr = (sal.data as any[]) ?? [];
      }
    } else {
      enr = (res.data as any[]) ?? [];
    }
  }

  // Already-paid this month per teacher (latest row wins for the display date).
  const paidByTeacher = new Map<string, { amount: number; at: string; method: string }>();
  {
    let pq = supabase
      .from('teacher_payouts')
      .select('teacher_id,amount,paid_at,method')
      .is('deleted_at', null)
      .order('paid_at', { ascending: true });
    if (!isAll) pq = pq.eq('period', period); // 'all' sums every period's payouts
    const { data: payouts } = await pq;
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

    const monthlySalary = Number(e.monthly_salary ?? 0);
    const enrolledDate = (student.enrolled_at ? String(student.enrolled_at) : String(e.created_at || '')).slice(0, 10);
    // Auto first-paid month = the student's enrolment month (when they first paid
    // us), falling back to the enrolment row's creation month. Admin can override.
    const enrolledMonth = enrolledDate.slice(0, 7);
    const classStartDate = (e.class_start_date && /^\d{4}-\d{2}-\d{2}$/.test(e.class_start_date)) ? String(e.class_start_date) : null;
    const classEndDate = (e.class_end_date && /^\d{4}-\d{2}-\d{2}$/.test(e.class_end_date)) ? String(e.class_end_date) : null;
    // Salary starts at the exact class start date (its month is the commission
    // month); fall back to the legacy month override, then the enrolment month.
    const startMonth = classStartDate
      ? classStartDate.slice(0, 7)
      : (e.salary_start_month && /^\d{4}-\d{2}$/.test(e.salary_start_month))
        ? e.salary_start_month
        : enrolledMonth;
    // Salary stops after the class end date's month (blank = open-ended).
    const endMonth = classEndDate ? classEndDate.slice(0, 7) : null;

    let isMonth1 = false;
    let commission = 0;
    let teacherPay = 0;
    let rowPeriodLabel: string;
    // Anchor the pay-cycle label to the exact class start day when we have it.
    const cycleAnchor = classStartDate ?? student.enrolled_at;
    if (isAll) {
      // Lifetime: salary for every month from start to the current month (capped at
      // the class end month), with the 25% commission charged once (first month).
      const capMonth = endMonth && endMonth < selectedYYYYMM ? endMonth : selectedYYYYMM;
      const monthsActive = monthsInclusive(startMonth, capMonth);
      const oneComm = computeSalaryMath({ monthlySalary, isMonth1: true }).commission;
      commission = monthsActive >= 1 ? oneComm : 0;
      teacherPay = Math.max(0, monthlySalary * monthsActive - commission);
      rowPeriodLabel = monthsActive > 0 ? `All · ${monthsActive} mo` : 'Not started';
    } else {
      // Only pay inside the active window [startMonth, endMonth].
      const started = selectedYYYYMM >= startMonth;
      const ended = endMonth != null && selectedYYYYMM > endMonth;
      if (!started || ended) {
        commission = 0;
        teacherPay = 0;
        rowPeriodLabel = ended ? 'Ended' : 'Not started';
      } else {
        isMonth1 = startMonth === selectedYYYYMM;
        const math = computeSalaryMath({ monthlySalary, isMonth1 });
        commission = math.commission;
        teacherPay = math.teacherPay;
        rowPeriodLabel = billingPeriodLabel(period, cycleAnchor);
      }
    }

    rows.push({
      enrollmentId: e.id,
      teacherId: e.teacher_id,
      teacherName: teacher?.name ?? '',
      teacherPhone: teacher?.phone ?? '',
      studentId: e.student_id,
      studentName: student.name ?? '',
      subjectName: subject?.name ?? '',
      program: student.program ?? '',
      periodLabel: rowPeriodLabel,
      salaryStartMonth: (e.salary_start_month && /^\d{4}-\d{2}$/.test(e.salary_start_month)) ? e.salary_start_month : null,
      enrolledMonth,
      enrolledDate,
      classStartDate,
      classEndDate,
      monthlySalary,
      hasSalary: monthlySalary > 0,
      isMonth1,
      commission,
      teacherPay,
      studentFee: Number(student.monthly_fee ?? 0),
    });
  }

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

  // ACTUAL CASH for the month - wired to real records, not the agreed fee:
  //   feesBilled   = sum of this month's voucher amounts
  //   feesReceived = actual payments collected on those vouchers (what's in bank)
  //   salariesPaid = actual teacher_payouts made this month
  let feesBilled = 0;
  let feesReceived = 0;
  {
    let vq = supabase
      .from('vouchers')
      .select('id,amount,status')
      .is('deleted_at', null);
    if (!isAll) vq = vq.eq('period', period); // 'all' sums every period's fees
    const { data: vs } = await vq;
    const vouchers = (vs as any[]) ?? [];
    feesBilled = vouchers.reduce((s, v) => s + Number(v.amount || 0), 0);
    const vids = vouchers.map((v) => v.id);

    // Payments recorded per voucher (for partial collections).
    const paidByVoucher = new Map<string, number>();
    if (vids.length) {
      const { data: ps } = await supabase
        .from('payments')
        .select('amount,voucher_id')
        .in('voucher_id', vids)
        .is('deleted_at', null);
      for (const p of (ps as any[]) ?? []) {
        paidByVoucher.set(p.voucher_id, (paidByVoucher.get(p.voucher_id) ?? 0) + Number(p.amount || 0));
      }
    }
    // Received = full amount for vouchers marked Paid, else the partial payments
    // recorded. (Vouchers can be marked Paid by status without a payment row.)
    for (const v of vouchers) {
      const amount = Number(v.amount || 0);
      feesReceived += v.status === 'paid' ? amount : Math.min(amount, paidByVoucher.get(v.id) ?? 0);
    }
  }

  const salariesEarned = rows.reduce((s, r) => s + r.teacherPay, 0);
  const salariesPaid = teachers.reduce((s, tt) => s + tt.paid, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const studentCount = new Set(rows.map((r) => r.studentId)).size;

  return {
    rows,
    teachers,
    totals: {
      feesBilled,
      feesReceived,
      feesOutstanding: Math.max(0, feesBilled - feesReceived),
      salariesEarned,
      salariesPaid,
      salaryOutstanding: Math.max(0, salariesEarned - salariesPaid),
      commission: totalCommission,
      netThisMonth: feesReceived - salariesPaid,
      studentCount,
      teacherCount: byTeacher.size,
    },
    period,
    periodYYYYMM: selectedYYYYMM,
  };
}
