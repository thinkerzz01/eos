'use client';

import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { Lock as LockIcon } from 'lucide-react';

export interface TeacherPayout {
  id: string;
  teacherId: string;
  teacherName: string;
  subjects: string[];
  perClassPay: number;
  completedClassesCount: number;
  grossAmount: number;
  status: 'Pending' | 'Approved' | 'Paid';
  payoutDate?: string;
  paymentMethod: string;
  bankAccount: string;
}

export function TeacherPayoutsClient({ initialPayouts }: { initialPayouts: TeacherPayout[] }) {
  const { role } = useRole();
  const payouts = initialPayouts;

  // RLS DENIAL CHECK FOR MANAGERS
  if (role === 'manager') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
        <div className="p-8 max-w-lg mx-auto text-center bg-white border border-rose-200 rounded-3xl shadow-xl space-y-4 my-12">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <LockIcon className="w-7 h-7" />
          </div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Access Denied (RLS Level Security)</h2>
          <p className="text-xs text-[#6B7185] leading-relaxed">
            Per <strong>AGENTS.md §3.3</strong>, Manager tokens are strictly denied access at the database level to <code className="bg-slate-100 px-1 py-0.5 rounded">teacher_pay_rates</code> and <code className="bg-slate-100 px-1 py-0.5 rounded">teacher_payouts</code>.
          </p>
        </div>
      </PortalLayout>
    );
  }

  // Summary figures derived from the real payout rows (rate × completed classes).
  const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
  const totalPayroll = payouts.reduce((s, p) => s + p.grossAmount, 0);
  const pendingSum = payouts.filter((p) => p.status !== 'Paid').reduce((s, p) => s + p.grossAmount, 0);
  const dispatchedSum = payouts.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.grossAmount, 0);

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Teacher Payouts & Faculty Payroll (Admin Only)</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Per-class rate calculations and verified class-completion counts. Bank-transfer dispatch is not yet enabled (see note below).
            </p>
          </div>
        </div>

        {/* PAYOUTS SUMMARY CARDS (derived from live rows) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Total Monthly Payroll</div>
            <div className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">{fmt(totalPayroll)}</div>
            <div className="text-xs text-emerald-600 font-bold">{payouts.length} Faculty Member{payouts.length === 1 ? '' : 's'}</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Pending Payouts</div>
            <div className="font-heading font-extrabold text-2xl text-purple-600">{fmt(pendingSum)}</div>
            <div className="text-xs text-purple-600 font-bold">Awaiting Dispatch</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Dispatched Payouts</div>
            <div className="font-heading font-extrabold text-2xl text-emerald-600">{fmt(dispatchedSum)}</div>
            <div className="text-xs text-emerald-600 font-bold">{dispatchedSum > 0 ? 'Paid' : '—'}</div>
          </div>
        </div>

        {/* PAYOUTS DATA TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-xs">
                  <th className="py-3.5 px-3">TEACHER NAME & SUBJECTS</th>
                  <th className="py-3.5 px-3">PER CLASS RATE</th>
                  <th className="py-3.5 px-3">COMPLETED CLASSES</th>
                  <th className="py-3.5 px-3">GROSS PAYOUT</th>
                  <th className="py-3.5 px-3">BANK DETAILS</th>
                  <th className="py-3.5 px-3">STATUS</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 font-semibold">
                      No payout rows yet. Set per-class pay rates and complete classes to populate payroll.
                    </td>
                  </tr>
                ) : (
                  payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{p.teacherName}</div>
                        <div className="text-xs text-[#6B7185]">{p.subjects.join(' · ')}</div>
                      </td>

                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                        PKR {p.perClassPay.toLocaleString()} / class
                      </td>

                      <td className="py-3.5 px-3 font-bold text-purple-600">
                        {p.completedClassesCount} Classes Completed
                      </td>

                      <td className="py-3.5 px-3 font-mono font-extrabold text-slate-900 text-sm">
                        PKR {p.grossAmount.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-xs">
                        <div>{p.paymentMethod}</div>
                        <div className="text-slate-500 font-bold">{p.bankAccount}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                            p.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : p.status === 'Approved'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Honest limitation note — payout dispatch needs a schema addition. */}
        <p className="text-xs text-slate-400 font-medium px-1">
          Note: approving and dispatching a bank transfer is not yet enabled — it requires a
          <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded mx-1">payouts</code>
          table (with a status) that is not part of the current schema. The per-class rates and
          completed-class counts shown above are live.
        </p>

      </div>
    </PortalLayout>
  );
}
