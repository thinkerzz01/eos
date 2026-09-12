// Homework - SERVER Component (real, RLS-authorized rows -> client UI).
import { getHomework } from '@/lib/data/homework';
import { getStudents } from '@/lib/data/students';
import { getTeachers } from '@/lib/data/teachers';
import { getSubjects } from '@/lib/data/subjects';
import { getServerRole } from '@/lib/auth/serverRole';
import { HomeworkClient } from './HomeworkClient';

export const dynamic = 'force-dynamic';

export default async function HomeworkPage() {
  const role = await getServerRole();
  const canManage = role === 'admin' || role === 'manager';
  // Teachers can assign homework too, so they need the student + subject pickers
  // (both RLS-scoped to their own students). The teacher picker stays admin/manager
  // only - a teacher always authors as themselves, so we never ship the roster of
  // other teachers to a teacher's or student's browser.
  const canAssign = canManage || role === 'teacher';
  const [homeworks, students, teachers, subjects] = await Promise.all([
    getHomework(),
    canAssign ? getStudents() : Promise.resolve([]),
    canManage ? getTeachers() : Promise.resolve([]),
    canAssign ? getSubjects() : Promise.resolve([]),
  ]);
  return (
    <HomeworkClient
      initialHomeworks={homeworks}
      students={students.map((s) => ({ id: s.id, name: s.name }))}
      teachers={teachers.map((t) => ({ id: t.id, name: t.name }))}
      subjects={subjects}
    />
  );
}
