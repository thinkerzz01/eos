// Dashboard - SERVER Component. Fetches ONLY what the signed-in role's view uses,
// so a tab switch to the dashboard does the minimum work:
//   admin / manager -> adminData        (the operational dashboard)
//   teacher         -> teacherStats
//   student         -> their own student row
// (The old code fetched all four for every role; metrics was never rendered.)
import { getStudents } from '@/lib/data/students';
import { getTeacherDashboard } from '@/lib/data/teacherDashboard';
import { getAdminDashboard, EMPTY_ADMIN_DATA } from '@/lib/data/adminDashboard';
import { getServerRole } from '@/lib/auth/serverRole';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Shared cache() with the root layout -> the role RPC runs ONCE per request,
  // not twice.
  const role = await getServerRole();
  const isStaff = role === 'admin' || role === 'manager';
  const [students, teacherStats, adminData] = await Promise.all([
    role === 'student' ? getStudents() : Promise.resolve([]),
    role === 'teacher' ? getTeacherDashboard() : Promise.resolve(null),
    isStaff ? getAdminDashboard() : Promise.resolve(EMPTY_ADMIN_DATA),
  ]);

  return <DashboardClient initialStudents={students} teacherStats={teacherStats} adminData={adminData} />;
}
