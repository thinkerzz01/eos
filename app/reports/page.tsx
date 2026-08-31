// Reports - SERVER Component (real per-student monthly reports + funnel from the DB).
import { getMonthlyReports, getFunnelStats } from '@/lib/data/reports';
import { ReportsClient } from './ReportsClient';

export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/auth/requireRole';

export default async function ReportsPage() {
  await requireRole(['admin', 'manager']);
  const [reports, funnel] = await Promise.all([getMonthlyReports(), getFunnelStats()]);
  return <ReportsClient initialReports={reports} initialFunnel={funnel} />;
}
