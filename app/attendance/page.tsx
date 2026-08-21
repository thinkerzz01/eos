// Attendance Register - SERVER Component. Reuses the RLS-authorized class rows
// (with their recorded attendance mark) and lets staff/teachers mark a whole
// day at once. Students are not given this screen (they only view their own).
import { getSchedule } from '@/lib/data/schedule';
import { AttendanceRegisterClient } from './AttendanceRegisterClient';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const classes = await getSchedule();
  return <AttendanceRegisterClient initialClasses={classes} />;
}
