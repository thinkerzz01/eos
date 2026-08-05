// Email Queue (notifications) — SERVER Component (real, RLS-authorized rows).
import { getNotifications } from '@/lib/data/notifications';
import { EmailQueueClient } from './EmailQueueClient';

export const dynamic = 'force-dynamic';

export default async function EmailQueuePage() {
  const notifications = await getNotifications();
  return <EmailQueueClient initialNotifications={notifications} />;
}
