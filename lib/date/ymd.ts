// Date-only (YYYY-MM-DD) helpers with NO timezone drift. All fee/billing dates are
// stored as plain dates (Postgres DATE), so we do the arithmetic in UTC on the
// Y-M-D parts and never round-trip through a local Date that could shift the day.

/** Add N days to a YYYY-MM-DD date. */
export function addDaysYMD(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/**
 * Add N calendar months to a YYYY-MM-DD date, clamping the day to the last day of
 * the target month (so 31 Jan + 1 month = 28/29 Feb, and the 17th stays the 17th).
 */
export function addMonthsYMD(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, 1)); // first of the month, safe to shift
  base.setUTCMonth(base.getUTCMonth() + n);
  const ty = base.getUTCFullYear();
  const tm = base.getUTCMonth(); // 0-based target month
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const dt = new Date(Date.UTC(ty, tm, day));
  return dt.toISOString().slice(0, 10);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "September 2026" from a YYYY-MM-DD date (voucher period label). */
export function monthLabelYMD(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Today's date in Asia/Karachi as YYYY-MM-DD (en-CA gives ISO order). */
export function todayYMD(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

/** First day (YYYY-MM-01) of the month that contains `ymd`. */
export function firstOfMonthYMD(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** true when a and b (YYYY-MM-DD) fall in the same calendar month. */
export function sameMonthYMD(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}
