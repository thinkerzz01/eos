// Shared formatting helpers. Currency was previously re-implemented per screen
// (some rounding, some not, some prefixing +/-), so amounts read inconsistently.
// This is the single source of truth: whole-rupee, thousands-separated.

/**
 * Format a PKR amount, e.g. 12345.6 -> "PKR 12,346". With `sign`, always shows a
 * leading +/- (for ledgers where a refund is negative): "-PKR 500" / "+PKR 500".
 */
export function formatPKR(amount: number | null | undefined, opts?: { sign?: boolean }): string {
  const n = Number(amount || 0);
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US');
  if (opts?.sign) return `${n < 0 ? '-' : '+'}PKR ${abs}`;
  return `${n < 0 ? '-' : ''}PKR ${abs}`;
}
