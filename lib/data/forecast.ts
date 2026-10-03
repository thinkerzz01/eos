import 'server-only';

// Forward-looking fee + revenue forecast for the admin dashboard. Projects the
// next N calendar months (starting next month), BILLED not collected:
//   fees    = monthly_fee of each active MONTHLY student whose billing window
//             (billing_start_date .. billing_end_date) covers that month.
//   salaries= each active enrollment's monthly salary while inside its class window
//             (class start .. class end), minus the one-off 25% commission in the
//             enrollment's start month (same rule as the salary sheet).
//   revenue = fees - salaries (margin after salaries). No expense forecast - the
//             expenses ledger is one-off entries with no recurring concept, so the
//             forward view intentionally leaves expenses out (owner decision).
//
// Upfront students are excluded: their block is billed once at enrolment, so they
// contribute no recurring monthly fee.
import { addMonthsYMD, firstOfMonthYMD, monthLabelYMD } from '@/lib/date/ymd';
import { computeSalaryMath } from '@/lib/config/payroll';

export interface ForecastMonth {
  monthKey: string;   // 'YYYY-MM'
  monthLabel: string; // e.g. 'November 2026'
  fees: number;       // projected fees billed that month
  salaries: number;   // projected teacher salaries that month
  revenue: number;    // fees - salaries
  students: number;   // active monthly students billed that month
}

const ym = (v: unknown): string | null =>
  typeof v === 'string' && v.length >= 7 ? v.slice(0, 7) : null;

/**
 * Build the next `months` months of fee/revenue forecast. Takes the already-
 * authenticated, RLS-scoped supabase client from the caller so it runs under the
 * same admin session. Returns [] on any query error (never breaks the dashboard).
 */
export async function getForecast(
  supabase: any,
  todayISO: string,
  months = 6,
): Promise<ForecastMonth[]> {
  const [{ data: students }, { data: enrollments }] = await Promise.all([
    supabase
      .from('students')
      .select('monthly_fee,billing_start_date,billing_end_date')
      .eq('status', 'active')
      .eq('billing_mode', 'monthly')
      .gt('monthly_fee', 0)
      .is('deleted_at', null),
    supabase
      .from('student_subjects')
      .select('monthly_salary,salary_start_month,class_start_date,class_end_date,apply_commission,students(status,enrolled_at,deleted_at)')
      .is('deleted_at', null),
  ]);

  const firstThisMonth = firstOfMonthYMD(todayISO); // 'YYYY-MM-01' of the current month
  const out: ForecastMonth[] = [];

  for (let i = 1; i <= months; i++) {
    const mFirst = firstOfMonthYMD(addMonthsYMD(firstThisMonth, i)); // next month, then forward
    const mKey = mFirst.slice(0, 7);
    let fees = 0;
    let salaries = 0;
    let studentCount = 0;

    // Fees: active monthly students whose billing window covers this month.
    for (const s of (students as any[]) ?? []) {
      const start = ym(s.billing_start_date);
      const end = ym(s.billing_end_date);
      if (start && mKey < start) continue; // billing not started yet
      if (end && mKey > end) continue;     // commitment finished
      fees += Number(s.monthly_fee ?? 0);
      studentCount += 1;
    }

    // Salaries: active enrollments inside their class window, commission in month 1.
    for (const e of (enrollments as any[]) ?? []) {
      const stu = Array.isArray(e.students) ? e.students[0] : e.students;
      if (!stu || stu.status !== 'active' || stu.deleted_at) continue;
      const monthlySalary = Number(e.monthly_salary ?? 0);
      if (!(monthlySalary > 0)) continue;

      const startMonth =
        ym(e.class_start_date) ??
        (e.salary_start_month && /^\d{4}-\d{2}$/.test(e.salary_start_month) ? e.salary_start_month : null) ??
        ym(stu.enrolled_at);
      const endMonth = ym(e.class_end_date);
      if (!startMonth || mKey < startMonth) continue; // salary not started
      if (endMonth && mKey > endMonth) continue;      // salary ended

      const isMonth1 = mKey === startMonth && e.apply_commission !== false;
      salaries += computeSalaryMath({ monthlySalary, isMonth1 }).teacherPay;
    }

    out.push({
      monthKey: mKey,
      monthLabel: monthLabelYMD(mFirst),
      fees: Math.round(fees),
      salaries: Math.round(salaries),
      revenue: Math.round(fees - salaries),
      students: studentCount,
    });
  }

  return out;
}
