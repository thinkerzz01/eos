// Reports — SERVER Component (real per-student monthly reports + funnel from the DB).
import { getMonthlyReports, getFunnelStats } from '@/lib/data/reports';
import { ReportsClient } from './ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const [reports, funnel] = await Promise.all([getMonthlyReports(), getFunnelStats()]);
  return <ReportsClient initialReports={reports} initialFunnel={funnel} />;
}
