// Teacher Payouts - SERVER Component (Admin-only pay table; RLS-authorized rows).
import { getTeacherPayouts } from '@/lib/data/teacherPayouts';
import { TeacherPayoutsClient } from './TeacherPayoutsClient';

export const dynamic = 'force-dynamic';

export default async function TeacherPayoutsPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const period = /^\d{4}-\d{2}$/.test(searchParams.period ?? '') ? searchParams.period! : current;
  const payouts = await getTeacherPayouts(period);
  return <TeacherPayoutsClient initialPayouts={payouts} selectedPeriod={period} />;
}
