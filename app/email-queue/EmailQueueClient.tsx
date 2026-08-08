'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { NotificationItem } from '@/lib/mockIntelligenceData';
import { RefreshCw } from 'lucide-react';

export function EmailQueueClient({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
  const router = useRouter();
  const notifications = initialNotifications;

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
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Notification Queue & Cron Dispatcher</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Priority-based queue (Priority 1 &gt; 2 &gt; 3), Resend 100/day cap, and failure retries. Draining is performed by the scheduled cron job (<code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/api/cron/send</code>), not from this screen.
            </p>
          </div>

          <button
            onClick={() => router.refresh()}
            className="h-[38px] px-4 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 text-[#5B47D6]" />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* NOTIFICATION QUEUE METRICS BANNER (live) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center text-xs font-bold">
          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Sent (this queue)</div>
            <div className="font-heading font-extrabold text-2xl text-slate-900">{sentCount} / 100</div>
            <div className="text-xs text-emerald-600">Resend daily cap</div>
          </div>

          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Priority 1 Pending</div>
            <div className="font-heading font-extrabold text-2xl text-rose-600">{p1Pending} Item{p1Pending === 1 ? '' : 's'}</div>
            <div className="text-xs text-rose-600">Drained First</div>
          </div>

          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Priority 2 & 3 Pending</div>
            <div className="font-heading font-extrabold text-2xl text-purple-600">{p23Pending} Item{p23Pending === 1 ? '' : 's'}</div>
            <div className="text-xs text-purple-600">Drained After P1</div>
          </div>

          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Failed (retrying)</div>
            <div className="font-heading font-extrabold text-2xl text-amber-600 mt-1">{failedCount}</div>
            <div className="text-xs text-slate-500">Auto-retried by cron</div>
          </div>
        </div>

        {/* NOTIFICATION QUEUE TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-xs">
                  <th className="py-3.5 px-3">PRIORITY</th>
                  <th className="py-3.5 px-3">UNIQUE KEY & RECIPIENT</th>
                  <th className="py-3.5 px-3">TEMPLATE</th>
                  <th className="py-3.5 px-3">MESSAGE BODY (MERGE FIELDS)</th>
                  <th className="py-3.5 px-3">STATUS & RETRIES</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                {notifications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 font-semibold">
                      The notification queue is empty. Reminders and reports are enqueued by the cron jobs.
                    </td>
                  </tr>
                ) : (
                  notifications.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                            item.priority === 1
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : item.priority === 2
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          Priority {item.priority}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{item.recipientEmail}</div>
                        <div className="text-xs text-[#6B7185] font-mono">{item.uniqueKey}</div>
                      </td>

                      <td className="py-3.5 px-3 font-extrabold text-slate-900 dark:text-slate-100">
                        {item.templateName}
                      </td>

                      <td className="py-3.5 px-3 text-slate-800 max-w-xs font-mono text-xs">
                        {item.messageBody}
                      </td>

                      <td className="py-3.5 px-3 font-mono">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                            item.status === 'Sent'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.status === 'Failed'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.status}
                        </span>
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
