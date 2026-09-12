'use client';

// Dashboard alerts banner — surfaces the signed-in user's UNREAD in-app
// notifications right on their dashboard (e.g. "New homework assigned" for a
// student, "Homework submitted" for a teacher), so they don't have to open the
// bell. Reads the same app_notifications the TopBar bell uses (RLS-scoped to the
// current user). Best-effort: renders nothing if there's nothing unread.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, X, ChevronRight } from 'lucide-react';
import { listMyNotifications, markNotificationRead, markAllNotificationsRead, type MyNotification } from '@/app/notifications/actions';

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function DashboardAlerts() {
  const [items, setItems] = useState<MyNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    listMyNotifications()
      .then((r) => { if (alive) { setItems(r.items.filter((i) => !i.read).slice(0, 5)); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  if (!loaded || items.length === 0) return null;

  const dismiss = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try { await markNotificationRead(id); } catch { /* best-effort */ }
  };
  const dismissAll = async () => {
    setItems([]);
    try { await markAllNotificationsRead(); } catch { /* best-effort */ }
  };

  return (
    <div className="rounded-[18px] border border-[#E4DFF8] bg-[#F5F2FE] dark:border-[#5B47D6]/25 dark:bg-[#5B47D6]/10 p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 text-[#5A31F4] dark:text-[#b9adf2] font-medium text-sm">
          <Bell className="w-4 h-4" /> New for you
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#5A31F4] text-white text-[11px] font-semibold">{items.length}</span>
        </div>
        <button onClick={dismissAll} className="text-xs font-medium text-[#5A31F4] dark:text-[#b9adf2] hover:underline">Mark all read</button>
      </div>
      <div className="space-y-1.5">
        {items.map((n) => (
          <div key={n.id} className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-[#EBEDF3] dark:border-slate-800 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{n.title}</div>
              {n.body && <div className="text-xs text-[#6B7185] truncate">{n.body}</div>}
              <div className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</div>
            </div>
            {n.link && (
              <Link href={n.link} onClick={() => dismiss(n.id)} className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium text-[#5A31F4] dark:text-[#b9adf2] hover:underline">
                View <ChevronRight className="w-3 h-3" />
              </Link>
            )}
            <button onClick={() => dismiss(n.id)} aria-label="Dismiss" className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
