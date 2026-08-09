// Dashboard - SERVER Component. Student-derived KPIs from RLS-authorized rows,
// plus aggregate metrics (today's classes, revenue, teacher load, demos/tickets)
// for the admin/manager views.
import { getStudents } from '@/lib/data/students';
import { getDashboardMetrics } from '@/lib/data/dashboard';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [students, metrics] = await Promise.all([getStudents(), getDashboardMetrics()]);
  return <DashboardClient initialStudents={students} metrics={metrics} />;
}
