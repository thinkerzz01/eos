// Payroll model config — the ONE place to change the pay rules.
//
// Thinkerzz pays each teacher a fixed monthly SALARY per student/subject they
// teach (one student_subjects row = one salary). The only deduction is a
// first-month commission: in a teacher's first paid month for that enrollment
// the company keeps MONTH1_COMMISSION of the agreed salary. From month 2 the
// teacher gets the full salary. Pay is floored at zero.

// First-month commission the company deducts from the agreed salary.
export const MONTH1_COMMISSION = 0.25; // 25%

// Pure salary math for a single enrollment-month. Kept here so the data layer,
// any export, and tests all agree on the numbers.
export function computeSalaryMath(input: {
  monthlySalary: number;
  isMonth1: boolean;
}): {
  commission: number;
  teacherPay: number;
} {
  const salary = Math.max(0, input.monthlySalary || 0);
  const commission = input.isMonth1 ? Math.round(salary * MONTH1_COMMISSION) : 0;
  const teacherPay = Math.max(0, salary - commission);
  return { commission, teacherPay };
}
