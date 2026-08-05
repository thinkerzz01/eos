// Teachers — SERVER Component (real, RLS-authorized rows -> client UI).
import { getTeachers } from '@/lib/data/teachers';
import { TeachersClient } from './TeachersClient';

export const dynamic = 'force-dynamic';

export default async function TeachersPage() {
  const teachers = await getTeachers();
  return <TeachersClient initialTeachers={teachers} />;
}
