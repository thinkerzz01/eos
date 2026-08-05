// Reports — SERVER Component (real per-student monthly reports from the DB).
import { getMonthlyReports } from '@/lib/data/reports';
import { ReportsClient } from './ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const reports = await getMonthlyReports();
  return <ReportsClient initialReports={reports} />;
}
