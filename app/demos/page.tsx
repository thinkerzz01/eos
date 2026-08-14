// Demos - SERVER Component (real, RLS-authorized rows -> client UI).
import { getDemos } from '@/lib/data/demos';
import { getTeachers } from '@/lib/data/teachers';
import { getSubjects } from '@/lib/data/subjects';
import { DemosClient } from './DemosClient';

export const dynamic = 'force-dynamic';

export default async function DemosPage() {
  const [demos, teachers, subjects] = await Promise.all([getDemos(), getTeachers(), getSubjects()]);
  const teacherOptions = teachers.map((t) => ({ id: t.id, name: t.name }));
  return <DemosClient initialDemos={demos} teachers={teacherOptions} subjects={subjects} />;
}
