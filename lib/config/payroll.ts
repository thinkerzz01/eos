// Payroll model config — the ONE place to change the pay rules.
//
// Thinkerzz pays each teacher a fixed monthly SALARY per student/subject they
// teach (one student_subjects row = one salary). Two derived rules:
//   1. Missed-class deduction: salary ÷ scheduled classes = per-class rate;
//      each class missed (scheduled − taught) deducts one per-class rate.
//   2. Month-1 commission: in a teacher's first paid month for that enrollment,
//      the company keeps MONTH1_COMMISSION of the agreed salary.
// Both can apply in the same month (missed deduction first, then commission),
// and teacher pay is floored at zero.

// Weekly schedule → scheduled classes per month (editable here in one place).
export const SCHEDULE_CLASSES: Record<number, number> = {
  3: 13, // 3 days / week
  4: 17, // 4 days / week
  5: 22, // 5 days / week
};

// First-month commission the company deducts from the agreed salary.
export const MONTH1_COMMISSION = 0.25; // 25%

export const WEEKLY_DAYS_OPTIONS = [3, 4, 5] as const;

// Scheduled classes for a weekly-days choice (null when unset).
export function classesForWeeklyDays(days?: number | null): number | null {
  if (!days) return null;
  return SCHEDULE_CLASSES[days] ?? null;
}

// Pure salary math for a single enrollment-month. Kept here so the data layer,
// any export, and tests all agree on the numbers.
export function computeSalaryMath(input: {
  monthlySalary: number;
  classesPerMonth: number; // scheduled classes this month (from schedule)
  taught: number; // classes actually completed this month
  isMonth1: boolean;
}): {
  missed: number;
  perClass: number;
  missedDeduction: number;
  salaryAfterDeduction: number;
  commission: number;
  teacherPay: number;
  wentNegative: boolean;
} {
  const salary = Math.max(0, input.monthlySalary || 0);
  const scheduled = Math.max(0, input.classesPerMonth || 0);
  const taught = Math.max(0, input.taught || 0);

  const missed = Math.max(0, scheduled - taught);
  const perClass = scheduled > 0 ? salary / scheduled : 0;
  const missedDeduction = Math.round(missed * perClass);
  const salaryAfterDeduction = salary - missedDeduction;
  const commission = input.isMonth1 ? Math.round(salary * MONTH1_COMMISSION) : 0;
  const raw = salaryAfterDeduction - commission;
  const teacherPay = Math.max(0, raw); // floored at zero
  return {
    missed,
    perClass: Math.round(perClass),
    missedDeduction,
    salaryAfterDeduction,
    commission,
    teacherPay,
    wentNegative: raw < 0,
  };
}
