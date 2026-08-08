'use client';

import React from 'react';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { AuditLogEntry } from '@/lib/mockSupportData';
import {
  FileText,
  Lock,
  ShieldCheck,
  Search,
} from 'lucide-react';

export function AuditLogClient({ initialLogs }: { initialLogs: AuditLogEntry[] }) {
  const { role } = useRole();

  // RLS DENIAL CHECK FOR MANAGERS
  if (role === 'manager') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
        <div className="p-8 max-w-lg mx-auto text-center bg-white border border-rose-200 rounded-3xl shadow-xl space-y-4 my-12">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Access Denied (RLS Level Security)</h2>
          <p className="text-xs text-[#6B7185] leading-relaxed">
            Per <strong>AGENTS.md §3.3</strong>, Manager tokens are strictly denied access at the database level to <code className="bg-slate-100 px-1 py-0.5 rounded">audit_log</code>.
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
              <span>Append-Only System Audit Log (Admin Only)</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Immutable audit history of all system writes, admin decisions, and security events.
            </p>
          </div>
        </div>

        {/* AUDIT LOG TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-xs">
                  <th className="py-3.5 px-3">ACTION & TABLE</th>
                  <th className="py-3.5 px-3">ACTOR & ROLE</th>
                  <th className="py-3.5 px-3">TIMESTAMP & IP</th>
                  <th className="py-3.5 px-3">DETAILS</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                {initialLogs.map((log) => (
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
