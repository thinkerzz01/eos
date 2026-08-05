// Notifications queue (email-queue screen) data-access — RLS-enforced, server-only.
import { createClient } from '@/lib/supabase/server';
import type { NotificationItem } from '@/lib/mockIntelligenceData';

const STATUS_UI: Record<string, NotificationItem['status']> = {
  queued: 'Pending',
  sent: 'Sent',
  failed: 'Failed',
};

function mapRow(r: any): NotificationItem {
  const payload = r.payload ?? {};
  return {
    id: r.id,
    uniqueKey: r.unique_key,
    priority: (r.priority as 1 | 2 | 3) ?? 2,
    recipientEmail: payload.email ?? payload.recipient ?? '',
    templateName: r.type,
    messageBody: payload.body ?? '',
    status: STATUS_UI[r.status as string] ?? 'Pending',
    retryCount: r.retry_count ?? 0,
    createdAt: r.created_at,
  };
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('id,type,channels,priority,payload,status,retry_count,unique_key,created_at')
    .is('deleted_at', null)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
