// Syllabus Manager - SERVER Component. Admin/manager build & edit the master
// syllabus outline (topics -> subtopics -> objectives) per subject. Teachers mark
// coverage and students view progress in later phases (against per-student snapshots).
import { requireRole } from '@/lib/auth/requireRole';
import { listSyllabusSubjects } from '@/lib/data/syllabus';
import { SyllabusClient } from './SyllabusClient';

export const dynamic = 'force-dynamic';

export default async function SyllabusPage() {
  await requireRole(['admin', 'manager']);
  const subjects = await listSyllabusSubjects();
  return <SyllabusClient initialSubjects={subjects} />;
}
