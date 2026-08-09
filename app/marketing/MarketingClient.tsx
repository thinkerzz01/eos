'use client';

import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import type { SourceStat } from '@/lib/data/marketing';
import { TrendingUp } from 'lucide-react';

export function MarketingClient({ initialStats }: { initialStats: SourceStat[] }) {
  const totalLeads = initialStats.reduce((s, r) => s + r.leads, 0);
  const totalWon = initialStats.reduce((s, r) => s + r.won, 0);
  const totalSpend = initialStats.reduce((s, r) => s + r.spend, 0);
  const overallConv = totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0;

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#5B47D6]" />
              <span>Marketing & Source Performance</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Where leads come from and how they convert. Cost per student stays blank until ad spend is recorded.
            </p>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center text-xs font-bold">
          <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Total Leads</div>
            <div className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">{totalLeads}</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Converted (Won)</div>
            <div className="font-heading font-extrabold text-2xl text-emerald-600">{totalWon}</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Overall Conversion</div>
            <div className="font-heading font-extrabold text-2xl text-purple-600">{overallConv}%</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl space-y-1">
            <div className="text-slate-500 uppercase">Ad Spend</div>
            <div className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">{totalSpend > 0 ? `PKR ${totalSpend.toLocaleString()}` : '-'}</div>
          </div>
        </div>

        {/* SOURCE TABLE (Google first) */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-xs">
                  <th className="py-3.5 px-3">SOURCE</th>
                  <th className="py-3.5 px-3">LEADS</th>
                  <th className="py-3.5 px-3">CONVERTED</th>
                  <th className="py-3.5 px-3">CONVERSION</th>
                  <th className="py-3.5 px-3">AD SPEND</th>
                  <th className="py-3.5 px-3">COST / STUDENT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                {initialStats.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-3 font-extrabold text-sm text-slate-900 dark:text-slate-100">{r.source}</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-slate-100">{r.leads}</td>
                    <td className="py-3.5 px-3 font-bold text-emerald-600">{r.won}</td>
                    <td className="py-3.5 px-3 font-bold text-purple-600">{r.conversionPct}%</td>
                    <td className="py-3.5 px-3 font-mono text-slate-900 dark:text-slate-100">{r.spend > 0 ? `PKR ${r.spend.toLocaleString()}` : '-'}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-900 dark:text-slate-100">{r.costPerStudent != null ? `PKR ${r.costPerStudent.toLocaleString()}` : '-'}</td>
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
