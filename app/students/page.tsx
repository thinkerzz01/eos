// Students - SERVER Component (Step 2 reference wiring).
// Fetches real, RLS-authorized rows on the server, then hands them to the
// existing interactive client UI. No mock data, no service-role bypass.
import { getStudents } from '@/lib/data/students';
import { StudentsClient } from './StudentsClient';

export const dynamic = 'force-dynamic'; // per-request: depends on the user session

export default async function StudentsPage() {
  const students = await getStudents();
  return <StudentsClient initialStudents={students} />;
}
