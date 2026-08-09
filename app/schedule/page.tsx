// Schedule — SERVER Component (real, RLS-authorized rows -> client UI).
import { getSchedule } from '@/lib/data/schedule';
import { getStudents } from '@/lib/data/students';
import { getTeachers } from '@/lib/data/teachers';
import { getSubjects } from '@/lib/data/subjects';
import { ScheduleClient } from './ScheduleClient';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const [classes, students, teachers, subjects] = await Promise.all([
    getSchedule(),
    getStudents(),
    getTeachers(),
    getSubjects(),
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
