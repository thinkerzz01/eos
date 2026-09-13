// Teacher Salaries & Revenue - SERVER Component (Admin-only; RLS-authorized).
import { getSalarySheet } from '@/lib/data/teacherSalaries';
import { requireRole } from '@/lib/auth/requireRole';
import { TeacherPayoutsClient } from './TeacherPayoutsClient';

export const dynamic = 'force-dynamic';

export default async function TeacherPayoutsPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requireRole(['admin']);
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const raw = searchParams.period ?? '';
  const period = raw === 'all' || /^\d{4}-\d{2}$/.test(raw) ? raw : current;
  const sheet = await getSalarySheet(period);
  return <TeacherPayoutsClient sheet={sheet} selectedPeriod={period} />;
}
