// Attendance Register - SERVER Component. Reuses the RLS-authorized class rows
// (with their recorded attendance mark) and lets staff/teachers mark a whole
// day at once. Students are not given this screen (they only view their own).
import { getSchedule } from '@/lib/data/schedule';
import { getServerRole } from '@/lib/auth/serverRole';
import { AttendanceRegisterClient } from './AttendanceRegisterClient';
import { StudentAttendanceView } from './StudentAttendanceView';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const [classes, role] = await Promise.all([getSchedule(), getServerRole()]);
  // Students get a read-only view of their own attendance; staff/teachers get the
  // full register. RLS already scopes `classes` to the signed-in user.
  if (role === 'student') return <StudentAttendanceView initialClasses={classes} />;
  return <AttendanceRegisterClient initialClasses={classes} />;
}
