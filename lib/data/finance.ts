// Finance / Revenue summary - RLS-enforced, server-only. Admin-only.
//
// One clear money picture per month (or all-time): income (student fees), the two
// cost lines (teacher salaries + other expenses), and the resulting profit, shown
// on BOTH an accrual basis (earned/billed/owed) and a cash basis (what moved).
// Reuses getSalarySheet for the fee + salary numbers so the two screens agree.
import { createClient } from '@/lib/supabase/server';
import { getSalarySheet } from '@/lib/data/teacherSalaries';
import { addMonthsYMD } from '@/lib/date/ymd';

export interface ExpenseRow {
  id: string;
  category: string;
  amount: number;
  spentOn: string; // YYYY-MM-DD
  note: string;
}
export interface StudentMargin {
  studentId: string;
  studentName: string;
  program: string;
  fee: number;        // student's monthly fee (income, accrual)
  teacherCost: number; // sum of teacher pay across their subjects
  margin: number;      // fee - teacherCost
}
export interface TeacherPayStatus {
  teacherId: string;
  teacherName: string;
  earned: number;
  paid: number;
  variance: number; // paid - earned  (positive = overpaid, negative = still owed)
}

export interface FinanceSummary {
  period: string;
  periodYYYYMM: string;
  isAll: boolean;
  income: { billed: number; received: number; outstanding: number };
  salaries: { earned: number; paid: number; owed: number; commission: number };
  expenses: { total: number; byCategory: { category: string; amount: number }[]; rows: ExpenseRow[] };
  profit: {
    marginAfterSalaries: number; // fees billed - salaries earned
    accrualProfit: number;       // fees billed - salaries earned - other expenses
    netCash: number;             // fees received - salaries paid - other expenses
  };
  students: StudentMargin[];
  teachers: TeacherPayStatus[];
  studentCount: number;
  teacherCount: number;
}

export async function getFinanceSummary(periodYYYYMM?: string): Promise<FinanceSummary> {
  const sheet = await getSalarySheet(periodYYYYMM);
  const isAll = periodYYYYMM === 'all';
  const selected = sheet.periodYYYYMM; // resolved YYYY-MM

  // Expenses for the same window (all-time, or within the selected month).
  const supabase = createClient();
  let expRows: ExpenseRow[] = [];
  {
    let q = supabase
      .from('expenses')
      .select('id,category,amount,spent_on,note')
      .is('deleted_at', null)
      .order('spent_on', { ascending: false });
    if (!isAll && /^\d{4}-\d{2}$/.test(selected)) {
      const monthStart = `${selected}-01`;
      const nextMonth = addMonthsYMD(monthStart, 1);
      q = q.gte('spent_on', monthStart).lt('spent_on', nextMonth);
    }
    const { data } = await q;
    expRows = ((data as any[]) ?? []).map((e) => ({
      id: e.id,
      category: e.category ?? 'Misc',
      amount: Number(e.amount ?? 0),
      spentOn: String(e.spent_on ?? '').slice(0, 10),
      note: e.note ?? '',
    }));
  }
  const expensesTotal = expRows.reduce((s, e) => s + e.amount, 0);
  const byCatMap = new Map<string, number>();
  for (const e of expRows) byCatMap.set(e.category, (byCatMap.get(e.category) ?? 0) + e.amount);
  const byCategory = Array.from(byCatMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Per-student contribution (income - teacher cost) from the salary rows.
  const byStudent = new Map<string, StudentMargin>();
  for (const r of sheet.rows) {
    let m = byStudent.get(r.studentId);
    if (!m) {
      m = { studentId: r.studentId, studentName: r.studentName, program: r.program, fee: r.studentFee, teacherCost: 0, margin: 0 };
      byStudent.set(r.studentId, m);
    }
    m.teacherCost += r.teacherPay;
  }
  const students = Array.from(byStudent.values())
    .map((m) => ({ ...m, margin: m.fee - m.teacherCost }))
    .sort((a, b) => b.margin - a.margin);

  // Per-teacher earned vs paid (variance not floored, so overpayments show).
  const teachers: TeacherPayStatus[] = sheet.teachers
    .map((t) => ({ teacherId: t.teacherId, teacherName: t.teacherName, earned: t.earned, paid: t.paid, variance: t.paid - t.earned }))
    .sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  const billed = sheet.totals.feesBilled;
  const received = sheet.totals.feesReceived;
  const salariesEarned = sheet.totals.salariesEarned;
  const salariesPaid = sheet.totals.salariesPaid;

  return {
    period: sheet.period,
    periodYYYYMM: selected,
    isAll,
    income: { billed, received, outstanding: sheet.totals.feesOutstanding },
    salaries: { earned: salariesEarned, paid: salariesPaid, owed: sheet.totals.salaryOutstanding, commission: sheet.totals.commission },
    expenses: { total: expensesTotal, byCategory, rows: expRows },
    profit: {
      marginAfterSalaries: billed - salariesEarned,
      accrualProfit: billed - salariesEarned - expensesTotal,
      netCash: received - salariesPaid - expensesTotal,
    },
    students,
    teachers,
    studentCount: sheet.totals.studentCount,
    teacherCount: sheet.totals.teacherCount,
  };
}
