'use client';

import React, { useState, useMemo } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { AuditLogEntry } from '@/lib/mockSupportData';
import { Lock, Search } from 'lucide-react';

export function AuditLogClient({ initialLogs }: { initialLogs: AuditLogEntry[] }) {
  const { role } = useRole();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return initialLogs;
    const q = search.toLowerCase();
    return initialLogs.filter((l) =>
      [l.action, l.targetTable, l.actorName, l.actorRole, l.details].some((v) => (v ?? '').toLowerCase().includes(q))
    );
  }, [initialLogs, search]);

  // RLS DENIAL CHECK FOR MANAGERS
  if (role === 'manager') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
        <div className="p-8 max-w-lg mx-auto text-center bg-white border border-rose-200 rounded-3xl shadow-xl space-y-4 my-12">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Access restricted</h2>
          <p className="text-xs text-[#6B7185] leading-relaxed">
            The activity log is visible to the Admin only. Please contact the academy owner if you need access.
          </p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Activity Log</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Immutable audit history of all system writes, admin decisions, and security events.
            </p>
          </div>

          <div className="relative w-full sm:w-[280px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, actor, table or details..."
              className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-[13px] font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]"
            />
          </div>
        </div>

        {/* AUDIT LOG TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                  <th className="py-3.5 px-3">Action & Table</th>
                  <th className="py-3.5 px-3">Actor & Role</th>
                  <th className="py-3.5 px-3">Timestamp & IP</th>
                  <th className="py-3.5 px-3">Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-[#6B7185]">No log entries match your search.</td></tr>
                ) : filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-sm text-purple-700 font-mono">{log.action}</div>
                      <div className="text-xs text-[#6B7185] font-mono">{log.targetTable}</div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-slate-900 dark:text-slate-100">{log.actorName}</div>
                      <div className="text-xs text-[#6B7185]">{log.actorRole}</div>
                    </td>

                    <td className="py-3.5 px-3 font-mono">
                      <div>{log.timestamp}</div>
                      <div className="text-xs text-slate-500">{log.ipAddress}</div>
                    </td>

                    <td className="py-3.5 px-3 text-slate-800 font-medium">
                      {log.details}
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
