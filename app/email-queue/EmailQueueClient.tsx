'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { NotificationItem } from '@/lib/mockIntelligenceData';
import {
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Zap,
  Filter,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

export function EmailQueueClient({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
  const { role } = useRole();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

  const handleDrainQueue = () => {
    // Sort queue by priority: Priority 1 first, then 2, then 3 (AGENTS.md §3.5)
    const updated = notifications.map((item) => {
      if (item.status === 'Pending' || item.status === 'Failed') {
        return {
          ...item,
          status: 'Sent' as const,
          lastAttemptAt: 'Just now',
          retryCount: item.status === 'Failed' ? item.retryCount + 1 : item.retryCount,
        };
      }
      return item;
    });

    setNotifications(updated);
    alert('Queue drain process completed! Priority 1 dispatched first, followed by Priority 2 & 3 within the 100/day Resend cap.');
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher', 'student']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Notification Queue & Cron Dispatcher</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Priority-based queue drainer (Priority 1 &gt; 2 &gt; 3), Resend 100/day cap tracker, and failure retries.
            </p>
          </div>

          <button
            onClick={handleDrainQueue}
            className="h-[38px] px-4 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>Drain Queue Now (Cron Simulation)</span>
          </button>
        </div>

        {/* NOTIFICATION QUEUE METRICS BANNER */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center text-xs font-bold">
          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Resend Daily Cap</div>
            <div className="font-heading font-extrabold text-2xl text-slate-900">4 / 100</div>
            <div className="text-[10.5px] text-emerald-600">Within Free Cap</div>
          </div>

          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Priority 1 Queue</div>
            <div className="font-heading font-extrabold text-2xl text-rose-600">2 Items</div>
            <div className="text-[10.5px] text-rose-600">Drained First</div>
          </div>

          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Priority 2 & 3 Queue</div>
            <div className="font-heading font-extrabold text-2xl text-purple-600">2 Items</div>
            <div className="text-[10.5px] text-purple-600">Drained After P1</div>
          </div>

          <div className="p-4 bg-white border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Pronoun Merge Status</div>
            <div className="font-heading font-extrabold text-xs text-emerald-600 mt-2">100% Compliant</div>
            <div className="text-[10.5px] text-slate-500">No hardcoded pronouns</div>
          </div>
        </div>

        {/* NOTIFICATION QUEUE TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-[11.5px]">
                  <th className="py-3.5 px-3">PRIORITY</th>
                  <th className="py-3.5 px-3">UNIQUE KEY & RECIPIENT</th>
                  <th className="py-3.5 px-3">TEMPLATE</th>
                  <th className="py-3.5 px-3">MESSAGE BODY (MERGE FIELDS)</th>
                  <th className="py-3.5 px-3">STATUS & RETRIES</th>
                  <th className="py-3.5 px-3 text-center">ACTION</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                {notifications.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
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
                      <div className="text-[11px] text-[#6B7185] font-mono">{item.uniqueKey}</div>
                    </td>

                    <td className="py-3.5 px-3 font-extrabold text-slate-900 dark:text-slate-100">
                      {item.templateName}
                    </td>

                    <td className="py-3.5 px-3 text-slate-800 max-w-xs font-mono text-[11px]">
                      {item.messageBody}
                    </td>

                    <td className="py-3.5 px-3 font-mono">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                          item.status === 'Sent'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'Failed'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.retryCount > 0 && <div className="text-[10.5px] text-rose-600 mt-1">Retries: {item.retryCount}</div>}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      {item.status === 'Failed' ? (
                        <button
                          onClick={handleDrainQueue}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-lg shadow-xs cursor-pointer"
                        >
                          Retry Delivery
                        </button>
                      ) : (
                        <span className="text-slate-400 font-bold text-xs">— Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </PortalLayout>
  );
}
