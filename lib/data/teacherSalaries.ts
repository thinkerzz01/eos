// Teacher SALARY & REVENUE sheet - RLS-enforced, server-only. Admin-only.
//
// MODEL (permanent, deterministic - no ledger table):
//  - One row per student/subject enrollment (student_subjects). Each enrollment
//    earns a fixed monthly salary, accrued in CYCLE MONTHS anchored to the class
//    start DAY (the 6th -> 6th-to-6th, the 15th -> 15th-to-15th), exactly like a
//    student's billing cycle. A class running 17 Sep - 17 Oct is ONE cycle, not two.
//  - The 25% first-month commission is charged on cycle 1 only (toggle per row).
//  - A cycle counts once its start date has passed, and while it is inside the
//    class window [class_start, class_end) (end exclusive; blank = ongoing).
//  - Each cycle's pay is DUE 7 days after that cycle starts (owner's rule:
//    "paid in the second week / after seven days").
//
// RECONCILIATION is CUMULATIVE, so every filter is consistent:
//    balance (as of the filter) = total earned up to that point - total paid up to
//    that point. A payout clears whatever is owed regardless of which month it was
//    earned in. Payouts are matched by their actual paid_at DATE, never by a
//    free-text period label (the old bug). The month view reads as a statement:
//    opening owed + earned this month - paid this month = closing owed.
import { createClient } from '@/lib/supabase/server';
import { MONTH1_COMMISSION } from '@/lib/config/payroll';
import { addDaysYMD, addMonthsYMD, firstOfMonthYMD, todayYMD } from '@/lib/date/ymd';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DUE_OFFSET_DAYS = 7; // a cycle's salary is due this many days after it starts

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

// "01 Sep 2026" from a YYYY-MM-DD date (UTC, no drift).
function dmy(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Number of cycles that have STARTED on/before `asOf` and fall inside the class
// window [start, end) (end exclusive; null = ongoing). Cycles are anchored to the
// start day: start, start+1mo, start+2mo, ...
function cyclesStarted(start: string | null, end: string | null, asOf: string): number {
  if (!start || asOf < start) return 0;
  let k = 0;
  while (k < 1200) {
    const cs = addMonthsYMD(start, k);
    if (cs > asOf) break;
    if (end && cs >= end) break;
    k++;
  }
  return k;
}

// Number of cycles whose DUE date (start + 7d) has passed as of `today`, inside
// the class window. Used only to flag overdue-to-teacher.
function cyclesDue(start: string | null, end: string | null, today: string): number {
  if (!start) return 0;
  let k = 0;
  while (k < 1200) {
    const cs = addMonthsYMD(start, k);
    if (end && cs >= end) break;
    if (addDaysYMD(cs, DUE_OFFSET_DAYS) > today) break;
    k++;
  }
  return k;
}

// Pay for n cycles: full salary per cycle, minus the one-off 25% commission if the
// first cycle is included and commission applies.
function payFor(salary: number, applyCommission: boolean, nCycles: number): number {
  if (nCycles <= 0) return 0;
  const commission = applyCommission ? Math.round(salary * MONTH1_COMMISSION) : 0;
  return Math.max(0, salary * nCycles - commission);
}

// The cycle window (start..end-1day) for the cycle that starts inside month `ym`.
function cycleWindowInMonth(start: string, ym: string): { from: string; to: string } {
  const day = Number(start.slice(8, 10));
  const first = `${ym}-01`;
  const lastDay = Number(addDaysYMD(addMonthsYMD(first, 1), -1).slice(8, 10));
  const from = `${ym}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
  const to = addDaysYMD(addMonthsYMD(from, 1), -1);
  return { from, to };
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
  periodLabel: string;             // the cycle this period covers, e.g. "06 Oct - 05 Nov 2026"
  salaryStartMonth: string | null; // raw 'YYYY-MM' override, or null (auto)
  enrolledMonth: string;           // 'YYYY-MM' the student started
  enrolledDate: string;            // 'YYYY-MM-DD' the student started (prefill for class start)
  classStartDate: string | null;   // 'YYYY-MM-DD' exact class start (salary anchor)
  classEndDate: string | null;     // 'YYYY-MM-DD' exact class end (salary stops; blank = ongoing)
  monthlySalary: number;
  hasSalary: boolean;
  isMonth1: boolean;               // this period contains the enrollment's first cycle
  applyCommission: boolean;        // false = never deduct the 25% first-month cut
  commission: number;              // commission included in this period's pay
  teacherPay: number;              // pay earned in the selected period (one cycle for a month)
  studentFee: number;
}

export interface TeacherRollup {
  teacherId: string;
  teacherName: string;
  teacherPhone: string;
  enrollments: number;
  earned: number;        // earned in the selected period (statement line)
  paid: number;          // paid in the selected period (statement line)
  opening: number;       // owed carried in at the start of the period
  balance: number;       // owed as of the end of the period (cumulative; >= 0)
  overpaid: number;      // paid beyond earned as of the period (cumulative; >= 0)
  overdue: number;       // earned, past its 7-day due, still unpaid (as of today)
  earnedToDate: number;  // cumulative earned through the period end
  paidToDate: number;    // cumulative paid through the period end
  status: 'Pending' | 'Partial' | 'Paid';
  payoutDate?: string;   // latest payout IN the period
  paymentMethod: string;
  payoutId?: string;     // latest payout row in the period (edit/delete target)
  payoutCount: number;   // payout rows in the period
}

export interface SalarySheet {
  rows: SalaryRow[];
  teachers: TeacherRollup[];
  totals: {
    feesBilled: number;
    feesReceived: number;
    feesOutstanding: number;
    salariesEarned: number;    // earned in the period
    salariesPaid: number;      // paid in the period
    salaryOutstanding: number; // cumulative owed across teachers (as of period end)
    salaryOverdue: number;     // cumulative overdue across teachers (as of today)
    commission: number;
    netThisMonth: number;      // feesReceived - salariesPaid
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
    totals: { feesBilled: 0, feesReceived: 0, feesOutstanding: 0, salariesEarned: 0, salariesPaid: 0, salaryOutstanding: 0, salaryOverdue: 0, commission: 0, netThisMonth: 0, studentCount: 0, teacherCount: 0 },
    period: '',
    periodYYYYMM: periodYYYYMM ?? '',
  };

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return empty;

  const today = todayYMD(); // PKT

  // Resolve the filter window.
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
  const selectedYYYYMM = `${year}-${mm}`;
  const period = isAll ? 'All months' : `${MONTHS[month]} ${year}`;

  // Statement window boundaries (date-only).
  const monthStart = `${selectedYYYYMM}-01`;
  const monthEnd = addDaysYMD(addMonthsYMD(monthStart, 1), -1);
  const prevEnd = addDaysYMD(monthStart, -1);
  // As-of points: a past month closes at its month end; the current month closes
  // at today (so cycles later this month are not pre-counted).
  const asOfClose = isAll ? today : (monthEnd < today ? monthEnd : today);
  const asOfOpen = isAll ? '' : (prevEnd < today ? prevEnd : today);

  // Enrollments (non-deleted), with student + teacher. Skip deleted students and
  // removed teachers so nothing dangles.
  const STU = 'students(name,program,monthly_fee,status,enrolled_at,deleted_at),subjects(name),teachers(name,phone,deleted_at)';
  const COMM = `id,teacher_id,student_id,subject_id,monthly_salary,salary_start_month,class_start_date,class_end_date,apply_commission,created_at,${STU}`;
  const FULL = `id,teacher_id,student_id,subject_id,monthly_salary,salary_start_month,class_start_date,class_end_date,created_at,${STU}`;
  const SALARY = `id,teacher_id,student_id,subject_id,monthly_salary,salary_start_month,created_at,${STU}`;
  const BASE = `id,teacher_id,student_id,subject_id,created_at,${STU}`;
  let enr: any[] = [];
  for (const sel of [COMM, FULL, SALARY, BASE]) {
    const res = await supabase.from('student_subjects').select(sel).is('deleted_at', null);
    if (!res.error) { enr = (res.data as any[]) ?? []; break; }
  }

  // All payouts (not filtered by the free-text period). Reconcile by paid_at DATE.
  const payouts: { teacherId: string; amount: number; at: string; method: string; id: string }[] = [];
  {
    const { data } = await supabase
      .from('teacher_payouts')
      .select('id,teacher_id,amount,paid_at,method')
      .is('deleted_at', null)
      .order('paid_at', { ascending: true });
    for (const p of (data as any[]) ?? []) {
      payouts.push({
        teacherId: p.teacher_id,
        amount: Number(p.amount || 0),
        at: new Date(p.paid_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }),
        method: p.method === 'jazzcash' ? 'JazzCash' : 'Bank Transfer',
        id: p.id,
      });
    }
  }
  const paidUpTo = (teacherId: string, asOf: string) =>
    payouts.filter((p) => p.teacherId === teacherId && (asOf === '' ? false : p.at <= asOf)).reduce((s, p) => s + p.amount, 0);
  const paidInWindow = (teacherId: string) =>
    payouts.filter((p) => p.teacherId === teacherId && (isAll || (p.at >= monthStart && p.at <= monthEnd)));

  // Build per-enrollment rows for the selected period.
  const rows: SalaryRow[] = [];
  for (const e of enr) {
    const student = one<any>(e.students);
    const subject = one<any>(e.subjects);
    const teacher = one<any>(e.teachers);
    if (!student || student.deleted_at) continue;   // student removed
    if (!teacher || teacher.deleted_at) continue;    // teacher removed

    const monthlySalary = Number(e.monthly_salary ?? 0);
    const applyCommission = e.apply_commission !== false;
    const enrolledDate = (student.enrolled_at ? String(student.enrolled_at) : String(e.created_at || '')).slice(0, 10);
    const enrolledMonth = enrolledDate.slice(0, 7);
    const classStartDate = (e.class_start_date && /^\d{4}-\d{2}-\d{2}$/.test(e.class_start_date)) ? String(e.class_start_date) : null;
    const classEndDate = (e.class_end_date && /^\d{4}-\d{2}-\d{2}$/.test(e.class_end_date)) ? String(e.class_end_date) : null;
    // Cycle anchor: the exact class start date; fall back to the legacy month, then
    // the enrolment date.
    const start = classStartDate
      ?? (e.salary_start_month && /^\d{4}-\d{2}$/.test(e.salary_start_month) ? `${e.salary_start_month}-01` : null)
      ?? (enrolledDate || null);
    const end = classEndDate; // exclusive stop; null = ongoing

    // Period accrual = cumulative(close) - cumulative(open).
    const payClose = payFor(monthlySalary, applyCommission, cyclesStarted(start, end, asOfClose));
    const payOpen = payFor(monthlySalary, applyCommission, cyclesStarted(start, end, asOfOpen));
    const periodPay = Math.max(0, payClose - payOpen);

    // Is the first cycle inside this period? (for the "Month 1 / 25%" badge)
    const firstCycleInPeriod = !!start && (isAll
      ? cyclesStarted(start, end, asOfClose) >= 1 && payOpen === 0
      : start >= monthStart && start <= monthEnd && start <= asOfClose && (!end || start < end));
    const rowCommission = firstCycleInPeriod && applyCommission ? Math.round(monthlySalary * MONTH1_COMMISSION) : 0;

    // Cycle label for this period.
    let periodLabel: string;
    if (isAll) {
      const n = cyclesStarted(start, end, today);
      if (!start || n <= 0) periodLabel = 'Not started';
      else {
        const span = end ? `${dmy(start)} - ${dmy(end)}` : `From ${dmy(start)}`;
        periodLabel = `${span} · ${n} cycle${n === 1 ? '' : 's'}`;
      }
    } else if (periodPay > 0 && start) {
      const w = cycleWindowInMonth(start, selectedYYYYMM);
      periodLabel = `${dmy(w.from)} - ${dmy(w.to)}`;
    } else if (!start || (start && selectedYYYYMM < start.slice(0, 7))) {
      periodLabel = 'Not started';
    } else if (end && selectedYYYYMM >= end.slice(0, 7)) {
      periodLabel = 'Ended';
    } else {
      periodLabel = 'No cycle this month';
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
      periodLabel,
      salaryStartMonth: (e.salary_start_month && /^\d{4}-\d{2}$/.test(e.salary_start_month)) ? e.salary_start_month : null,
      enrolledMonth,
      enrolledDate,
      classStartDate,
      classEndDate,
      monthlySalary,
      hasSalary: monthlySalary > 0,
      isMonth1: firstCycleInPeriod,
      applyCommission,
      commission: rowCommission,
      teacherPay: periodPay,
      studentFee: Number(student.monthly_fee ?? 0),
    });
  }

  rows.sort((a, b) =>
    a.teacherName.localeCompare(b.teacherName) ||
    a.studentName.localeCompare(b.studentName) ||
    a.subjectName.localeCompare(b.subjectName)
  );

  // Per-teacher rollup. Earnings aggregate the enrollment accruals; balances are
  // cumulative (earned-to-date minus paid-to-date).
  const byTeacher = new Map<string, TeacherRollup & { _earnedClose: number; _earnedOpen: number; _earnedDue: number }>();
  for (const e of enr) {
    const student = one<any>(e.students);
    const teacher = one<any>(e.teachers);
    if (!student || student.deleted_at) continue;
    if (!teacher || teacher.deleted_at) continue;

    const monthlySalary = Number(e.monthly_salary ?? 0);
    const applyCommission = e.apply_commission !== false;
    const enrolledDate = (student.enrolled_at ? String(student.enrolled_at) : String(e.created_at || '')).slice(0, 10);
    const classStartDate = (e.class_start_date && /^\d{4}-\d{2}-\d{2}$/.test(e.class_start_date)) ? String(e.class_start_date) : null;
    const classEndDate = (e.class_end_date && /^\d{4}-\d{2}-\d{2}$/.test(e.class_end_date)) ? String(e.class_end_date) : null;
    const start = classStartDate
      ?? (e.salary_start_month && /^\d{4}-\d{2}$/.test(e.salary_start_month) ? `${e.salary_start_month}-01` : null)
      ?? (enrolledDate || null);
    const end = classEndDate;

    const tId = e.teacher_id as string;
    let t = byTeacher.get(tId);
    if (!t) {
      t = {
        teacherId: tId, teacherName: teacher?.name ?? '', teacherPhone: teacher?.phone ?? '',
        enrollments: 0, earned: 0, paid: 0, opening: 0, balance: 0, overpaid: 0, overdue: 0,
        earnedToDate: 0, paidToDate: 0, status: 'Pending', paymentMethod: '', payoutCount: 0,
        _earnedClose: 0, _earnedOpen: 0, _earnedDue: 0,
      };
      byTeacher.set(tId, t);
    }
    t.enrollments += 1;
    t._earnedClose += payFor(monthlySalary, applyCommission, cyclesStarted(start, end, asOfClose));
    t._earnedOpen += payFor(monthlySalary, applyCommission, cyclesStarted(start, end, asOfOpen));
    t._earnedDue += payFor(monthlySalary, applyCommission, cyclesDue(start, end, today));
  }

  const teachers: TeacherRollup[] = Array.from(byTeacher.values()).map((t) => {
    const paidToDate = paidUpTo(t.teacherId, asOfClose);
    const paidOpen = paidUpTo(t.teacherId, asOfOpen);
    const win = paidInWindow(t.teacherId);
    const paidPeriod = win.reduce((s, p) => s + p.amount, 0);
    const latest = win.length ? win[win.length - 1] : undefined;

    const earnedToDate = t._earnedClose;
    const earnedPeriod = Math.max(0, t._earnedClose - t._earnedOpen);
    const opening = t._earnedOpen - paidOpen;
    const net = earnedToDate - paidToDate; // >0 owed, <0 overpaid
    const overdue = Math.max(0, t._earnedDue - paidUpTo(t.teacherId, today));

    const status: TeacherRollup['status'] =
      net <= 0 && earnedToDate > 0 ? 'Paid'
      : paidToDate > 0 ? 'Partial'
      : 'Pending';

    return {
      teacherId: t.teacherId,
      teacherName: t.teacherName,
      teacherPhone: t.teacherPhone,
      enrollments: t.enrollments,
      earned: earnedPeriod,
      paid: paidPeriod,
      opening: Math.round(opening),
      balance: Math.max(0, Math.round(net)),
      overpaid: Math.max(0, Math.round(-net)),
      overdue: Math.round(overdue),
      earnedToDate: Math.round(earnedToDate),
      paidToDate: Math.round(paidToDate),
      status,
      payoutDate: latest ? latest.at : undefined,
      paymentMethod: latest?.method ?? '',
      payoutId: latest?.id,
      payoutCount: win.length,
    };
  }).sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  // ---- Student fee cash for the period (unchanged; student-side billing label) ----
  let feesBilled = 0;
  let feesReceived = 0;
  {
    let vq = supabase.from('vouchers').select('id,amount,status,due_date').is('deleted_at', null);
    if (!isAll) vq = vq.eq('period', period);
    const { data: vs } = await vq;
    // A voucher is "billed/outstanding" only once it has actually come DUE as of
    // today (or is already paid). Vouchers cut a few days ahead by the billing
    // cron are upcoming fees, not outstanding ones, so they stay out of these
    // cards until their due date.
    const vouchers = ((vs as any[]) ?? []).filter((v) => {
      if (v.status === 'paid') return true;
      const due = String(v.due_date || '').slice(0, 10);
      return !!due && due <= today;
    });
    feesBilled = vouchers.reduce((s, v) => s + Number(v.amount || 0), 0);
    const vids = vouchers.map((v) => v.id);
    const paidByVoucher = new Map<string, number>();
    if (vids.length) {
      const { data: ps } = await supabase.from('payments').select('amount,voucher_id').in('voucher_id', vids).is('deleted_at', null);
      for (const p of (ps as any[]) ?? []) {
        paidByVoucher.set(p.voucher_id, (paidByVoucher.get(p.voucher_id) ?? 0) + Number(p.amount || 0));
      }
    }
    for (const v of vouchers) {
      const amount = Number(v.amount || 0);
      feesReceived += v.status === 'paid' ? amount : Math.min(amount, paidByVoucher.get(v.id) ?? 0);
    }
  }

  const salariesEarned = rows.reduce((s, r) => s + r.teacherPay, 0);
  const salariesPaid = teachers.reduce((s, tt) => s + tt.paid, 0);
  const salaryOutstanding = teachers.reduce((s, tt) => s + tt.balance, 0);
  const salaryOverdue = teachers.reduce((s, tt) => s + tt.overdue, 0);
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
      salaryOutstanding,
      salaryOverdue,
      commission: totalCommission,
      netThisMonth: feesReceived - salariesPaid,
      studentCount,
      teacherCount: teachers.length,
    },
    period,
    periodYYYYMM: selectedYYYYMM,
  };
}
