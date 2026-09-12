// Students - SERVER Component (Step 2 reference wiring).
// Fetches real, RLS-authorized rows on the server, then hands them to the
// existing interactive client UI. No mock data, no service-role bypass.
import { getStudents } from '@/lib/data/students';
import { getSubjects } from '@/lib/data/subjects';
import { getTeachers } from '@/lib/data/teachers';
import { getServerIdentity } from '@/lib/auth/serverRole';
import { listProvisionedIds } from '@/lib/auth/provision';
import { StudentsClient } from './StudentsClient';

export const dynamic = 'force-dynamic'; // per-request: depends on the user session

export default async function StudentsPage() {
  const identity = await getServerIdentity();
  const canManage = identity.role === 'admin' || identity.role === 'manager';
  // Subject/teacher pickers are only for the admin/manager "Assign Teacher &
  // Subjects" action - teachers/students never see them, so don't ship the lists.
  const [students, subjects, teachers, portalAccessIds] = await Promise.all([
    getStudents(),
    canManage ? getSubjects() : Promise.resolve([]),
    canManage ? getTeachers() : Promise.resolve([]),
    canManage && identity.orgId ? listProvisionedIds('student', identity.orgId) : Promise.resolve([]),
  ]);
  return (
    <StudentsClient
      initialStudents={students}
      subjects={subjects}
      teachers={teachers.map((t) => ({ id: t.id, name: t.name }))}
      portalAccessIds={portalAccessIds}
    />
  );
}
