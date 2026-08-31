// Subjects manager - SERVER Component. Admin/manager add/edit/delete the academy's
// subject list (the source of truth for enrollment, classes and homework).
import { getSubjects } from '@/lib/data/subjects';
import { SubjectsClient } from './SubjectsClient';

export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/auth/requireRole';

export default async function SubjectsPage() {
  await requireRole(['admin', 'manager']);
  const subjects = await getSubjects();
  return <SubjectsClient initialSubjects={subjects} />;
}
