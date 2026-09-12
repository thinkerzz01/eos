// Teachers - SERVER Component (real, RLS-authorized rows -> client UI).
import { getTeachers } from '@/lib/data/teachers';
import { getServerIdentity } from '@/lib/auth/serverRole';
import { listProvisionedIds } from '@/lib/auth/provision';
import { TeachersClient } from './TeachersClient';

export const dynamic = 'force-dynamic';

export default async function TeachersPage() {
  const identity = await getServerIdentity();
  const canManage = identity.role === 'admin' || identity.role === 'manager';
  const [teachers, portalAccessIds] = await Promise.all([
    getTeachers(),
    canManage && identity.orgId ? listProvisionedIds('teacher', identity.orgId) : Promise.resolve([]),
  ]);
  return <TeachersClient initialTeachers={teachers} portalAccessIds={portalAccessIds} />;
}
