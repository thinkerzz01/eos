// My Syllabus - SERVER Component. A student's read-only view of their own
// syllabus coverage (Phase 3). RLS scopes the data to the signed-in student.
import { requireRole } from '@/lib/auth/requireRole';
import { getMySyllabus } from '@/lib/data/studentSyllabus';
import { MySyllabusClient } from './MySyllabusClient';

export const dynamic = 'force-dynamic';

export default async function MySyllabusPage() {
  await requireRole(['student']);
  const subjects = await getMySyllabus();
  return <MySyllabusClient subjects={subjects} />;
}
