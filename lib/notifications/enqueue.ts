// Idempotent enqueue into the `notifications` queue.
// Nothing sends directly; features/cron write a row here and the sender drains
// it. Idempotency is by (org_id, unique_key) — re-enqueuing the same event is a
// no-op (AGENTS.md §3.5). Relies on the partial unique index
// `idx_uniq_notifications_key`.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationType } from './templates';

export interface EnqueueInput {
  orgId: string;
  type: NotificationType;
  priority: 1 | 2 | 3;
  uniqueKey: string;
  payload: Record<string, any>;
  channels?: string[];
}

export type EnqueueResult = 'queued' | 'duplicate' | 'error';

export async function enqueueNotification(
  admin: SupabaseClient,
  input: EnqueueInput
): Promise<EnqueueResult> {
  const { error } = await admin.from('notifications').insert({
    org_id: input.orgId,
    type: input.type,
    priority: input.priority,
    channels: input.channels ?? ['email'],
    payload: input.payload,
    status: 'queued',
    retry_count: 0,
    unique_key: input.uniqueKey,
  });

  if (!error) return 'queued';
  // 23505 = unique_violation -> already enqueued for this event. No-op.
  if ((error as any).code === '23505') return 'duplicate';
  return 'error';
}
