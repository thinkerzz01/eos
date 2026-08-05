// Homework — SERVER Component (real, RLS-authorized rows -> client UI).
import { getHomework } from '@/lib/data/homework';
import { getStudents } from '@/lib/data/students';
import { getTeachers } from '@/lib/data/teachers';
import { getSubjects } from '@/lib/data/subjects';
import { HomeworkClient } from './HomeworkClient';

export const dynamic = 'force-dynamic';

export default async function HomeworkPage() {
  const [homeworks, students, teachers, subjects] = await Promise.all([
    getHomework(),
    getStudents(),
    getTeachers(),
    getSubjects(),
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
