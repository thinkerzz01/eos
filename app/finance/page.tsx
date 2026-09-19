// Finance / Revenue - SERVER Component (Admin-only; RLS-authorized). Shows the
// full money picture: income (fees), costs (teacher salaries + expenses), profit.
import { getFinanceSummary } from '@/lib/data/finance';
import { requireRole } from '@/lib/auth/requireRole';
import { FinanceClient } from './FinanceClient';

export const dynamic = 'force-dynamic';

export default async function FinancePage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requireRole(['admin']);
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const raw = searchParams.period ?? '';
  const period = raw === 'all' || /^\d{4}-\d{2}$/.test(raw) ? raw : current;
  const summary = await getFinanceSummary(period);
  return <FinanceClient summary={summary} selectedPeriod={period} />;
}
