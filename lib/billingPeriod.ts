// Billing period as an exact date range, anchored to the student's enrolment day.
// Classes often start mid-month, so a voucher's month ("September 2026") is shown
// as the real cycle it covers, e.g. "26 Sep – 25 Oct 2026" for a student who
// enrolled on the 26th. Display-only: works for existing and new vouchers with no
// data migration. Falls back to the raw period string if it can't be resolved.
export function billingPeriodLabel(
  period: string | null | undefined,
  enrolledAt: string | null | undefined,
  dueDate?: string | null
): string {
  const raw = (period ?? '').trim();

  // Resolve the cycle month (year + 0-based month) from the period string, then
  // fall back to the due date's month.
  let year: number | null = null;
  let month: number | null = null;
  const ym = raw.match(/^(\d{4})-(\d{1,2})/); // "2026-09"
  if (ym) {
    year = Number(ym[1]);
    month = Number(ym[2]) - 1;
  } else if (raw) {
    const d = new Date(`${raw} 1`); // "September 2026" -> 1 Sep 2026
    if (!Number.isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth();
    }
  }
  if (year === null && dueDate) {
    const d = new Date(dueDate);
    if (!Number.isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth();
    }
  }
  if (year === null || month === null) return raw || '—';

  let cycleDay = 1;
  if (enrolledAt) {
    const e = new Date(enrolledAt);
    if (!Number.isNaN(e.getTime())) cycleDay = e.getDate();
  }

  const start = new Date(year, month, cycleDay);
  const end = new Date(year, month + 1, cycleDay - 1); // day before next cycle
  const dm = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const dmy = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${dm(start)} – ${dmy(end)}`;
}
