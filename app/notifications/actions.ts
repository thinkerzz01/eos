'use server';

// In-app notification reads + mark-as-read for the CURRENT user (the TopBar bell).
// Uses the session client, so RLS (own_app_notifications) scopes everything to the
// signed-in user automatically. Degrades to an empty inbox if the table has not
// been migrated yet, so the bell never breaks the app.
import { createClient } from '@/lib/supabase/server';

export interface MyNotification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface MyNotifications {
  items: MyNotification[];
  unread: number;
}

export async function listMyNotifications(): Promise<MyNotifications> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { items: [], unread: 0 };

  const { data, error } = await supabase
    .from('app_notifications')
    .select('id,title,body,link,read_at,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error || !data) return { items: [], unread: 0 };

  const items: MyNotification[] = (data as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body ?? '',
    link: r.link ?? null,
    read: !!r.read_at,
    createdAt: r.created_at,
  }));
  return { items, unread: items.filter((i) => !i.read).length };
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  if (!id) return { ok: false };
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { ok: false };
  const { error } = await supabase
    .from('app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  return { ok: !error };
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { ok: false };
  const { error } = await supabase
    .from('app_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
    .is('deleted_at', null);
  return { ok: !error };
}
