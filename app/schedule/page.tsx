// Schedule - SERVER Component (real, RLS-authorized rows -> client UI).
import { getSchedule } from '@/lib/data/schedule';
import { getStudents } from '@/lib/data/students';
import { getTeachers } from '@/lib/data/teachers';
import { getSubjects } from '@/lib/data/subjects';
import { getServerRole } from '@/lib/auth/serverRole';
import { ScheduleClient } from './ScheduleClient';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const role = await getServerRole();
  const canManage = role === 'admin' || role === 'manager';

  // The student/teacher/subject picker lists exist ONLY for the admin/manager
  // "Schedule" wizard. Teachers and students never schedule, so we don't ship
  // those rosters to their browser at all (they'd expose other teachers/students).
  const [classes, students, teachers, subjects] = await Promise.all([
    getSchedule(),
    canManage ? getStudents() : Promise.resolve([]),
    canManage ? getTeachers() : Promise.resolve([]),
    canManage ? getSubjects() : Promise.resolve([]),
  ]);
  return (
    <ScheduleClient
      initialClasses={classes}
      students={students.map((s) => ({ id: s.id, name: s.name, program: s.program }))}
      teachers={teachers.map((t) => ({ id: t.id, name: t.name }))}
      subjects={subjects}
    />
  );
}
