// Dashboard — SERVER Component. The student-derived KPIs (active, at-risk, fees
// due, average health/attendance) are now computed from real RLS-authorized
// rows. Remaining tiles that aggregate other entities are still placeholders
// until those are wired in.
import { getStudents } from '@/lib/data/students';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const students = await getStudents();
  return <DashboardClient initialStudents={students} />;
}
