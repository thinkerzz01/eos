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

  // The student/teacher/subject picker lists are only for the admin/manager
  // "Assign homework" modal. Don't ship other teachers/students to a teacher's
  // or student's browser.
  const [homeworks, students, teachers, subjects] = await Promise.all([
    getHomework(),
    canManage ? getStudents() : Promise.resolve([]),
    canManage ? getTeachers() : Promise.resolve([]),
    canManage ? getSubjects() : Promise.resolve([]),
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
