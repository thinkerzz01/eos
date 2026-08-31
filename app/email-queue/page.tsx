// Email Queue (notifications) - SERVER Component (real, RLS-authorized rows).
import { getNotifications } from '@/lib/data/notifications';
import { EmailQueueClient } from './EmailQueueClient';

export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/auth/requireRole';

export default async function EmailQueuePage() {
  await requireRole(['admin', 'manager']);
  const notifications = await getNotifications();
  return <EmailQueueClient initialNotifications={notifications} />;
}
