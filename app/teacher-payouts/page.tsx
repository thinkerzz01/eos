// Teacher Payouts - SERVER Component (Admin-only pay table; RLS-authorized rows).
import { getTeacherPayouts } from '@/lib/data/teacherPayouts';
import { TeacherPayoutsClient } from './TeacherPayoutsClient';

export const dynamic = 'force-dynamic';

export default async function TeacherPayoutsPage() {
  const payouts = await getTeacherPayouts();
  return <TeacherPayoutsClient initialPayouts={payouts} />;
}
