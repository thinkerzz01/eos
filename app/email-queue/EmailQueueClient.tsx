'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Badge } from '@/components/ui/Badge';
import { NotificationItem } from '@/lib/mockIntelligenceData';
import { RefreshCw, Search } from 'lucide-react';

export function EmailQueueClient({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
  const router = useRouter();
  const notifications = initialNotifications;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (statusFilter !== 'All Statuses' && n.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return [n.recipientEmail, n.uniqueKey, n.templateName, n.messageBody].some((v) => (v ?? '').toLowerCase().includes(q));
      }
      return true;
    });
  }, [notifications, search, statusFilter]);

  // Metrics derived from the real queue rows (not hardcoded).
  const sentCount = notifications.filter((n) => n.status === 'Sent').length;
  const p1Pending = notifications.filter((n) => n.priority === 1 && n.status !== 'Sent').length;
  const p23Pending = notifications.filter((n) => n.priority !== 1 && n.status !== 'Sent').length;
  const failedCount = notifications.filter((n) => n.status === 'Failed').length;

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Email Queue</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Priority-based queue (Priority 1 &gt; 2 &gt; 3), Resend 100/day cap, and failure retries. Draining is performed by the scheduled cron job (<code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/api/cron/send</code>), not from this screen.
            </p>
          </div>

          <button
            onClick={() => router.refresh()}
            className="h-[38px] px-4 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 text-[#5B47D6]" />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* NOTIFICATION QUEUE METRICS BANNER (live) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center text-xs font-medium">
          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Sent (this queue)</div>
            <div className="font-heading font-medium text-2xl text-slate-900">{sentCount} / 100</div>
            <div className="text-xs text-emerald-600">Resend daily cap</div>
          </div>

          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Priority 1 Pending</div>
            <div className="font-heading font-medium text-2xl text-rose-600">{p1Pending} Item{p1Pending === 1 ? '' : 's'}</div>
            <div className="text-xs text-rose-600">Drained First</div>
          </div>

          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Priority 2 & 3 Pending</div>
            <div className="font-heading font-medium text-2xl text-purple-600">{p23Pending} Item{p23Pending === 1 ? '' : 's'}</div>
            <div className="text-xs text-purple-600">Drained After P1</div>
          </div>

          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Failed (retrying)</div>
            <div className="font-heading font-medium text-2xl text-amber-600 mt-1">{failedCount}</div>
            <div className="text-xs text-slate-500">Auto-retried by cron</div>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 p-3 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px]">
          <div className="relative w-full sm:w-[280px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recipient, template or key..." className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-[13px] font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]" />
          </div>
          <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[11px] text-[#6B7185] block font-medium">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-[13px]">
              <option>All Statuses</option>
              <option value="Sent">Sent</option>
              <option value="Pending">Pending</option>
              <option value="Retrying">Retrying</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        {/* NOTIFICATION QUEUE TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                  <th className="py-3.5 px-3">Priority</th>
                  <th className="py-3.5 px-3">Unique Key & Recipient</th>
                  <th className="py-3.5 px-3">Template</th>
                  <th className="py-3.5 px-3">Message Body (Merge Fields)</th>
                  <th className="py-3.5 px-3">Status & Retries</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 font-semibold">
                      {notifications.length === 0 ? 'The notification queue is empty. Reminders and reports are enqueued by the cron jobs.' : 'No queue items match your search.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3">
                        <Badge tone={item.priority === 1 ? 'danger' : item.priority === 2 ? 'brand' : 'neutral'}>
                          Priority {item.priority}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{item.recipientEmail}</div>
                        <div className="text-xs text-[#6B7185] font-mono">{item.uniqueKey}</div>
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {item.templateName}
                      </td>

                      <td className="py-3.5 px-3 text-slate-800 max-w-xs font-mono text-xs">
                        {item.messageBody}
                      </td>

                      <td className="py-3.5 px-3 font-mono">
                        <Badge tone={item.status === 'Sent' ? 'success' : item.status === 'Failed' ? 'danger' : 'warning'}>
                          {item.status}
                        </Badge>
                        {item.retryCount > 0 && <div className="text-xs text-rose-600 mt-1">Retries: {item.retryCount}</div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </PortalLayout>
  );
}
