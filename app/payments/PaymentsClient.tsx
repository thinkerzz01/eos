'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { PaymentTransaction } from '@/lib/mockFinanceData';
import {
  Receipt,
  Search,
  Lock,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export function PaymentsClient({ initialPayments }: { initialPayments: PaymentTransaction[] }) {
  const { role } = useRole();
  const [payments, setPayments] = useState<PaymentTransaction[]>(initialPayments);

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
            Per <strong>AGENTS.md §3.3</strong>, Manager tokens are strictly denied access at the database level to all finance tables.
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
              <span>Payments Ledger & Transactions Audit</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Audited transaction history including positive fee receipts and negative refund entries.
            </p>
          </div>

          <Link
            href="/vouchers"
            className="h-[38px] px-3.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Manage Vouchers →</span>
          </Link>
        </div>

        {/* PAYMENTS DATA TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-xs">
                  <th className="py-3.5 px-3">RECEIPT NO & STUDENT</th>
                  <th className="py-3.5 px-3">DATE & METHOD</th>
                  <th className="py-3.5 px-3">TRANSACTION TYPE</th>
                  <th className="py-3.5 px-3">AMOUNT</th>
                  <th className="py-3.5 px-3">AUDITED BY / REASON</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{p.studentName}</div>
                      <div className="text-xs text-[#6B7185] font-mono">{p.receiptNo}</div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-slate-900 dark:text-slate-100">{p.paymentDate}</div>
                      <div className="text-xs text-[#6B7185]">{p.paymentMethod}</div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                          p.type === 'Refund'
                            ? 'bg-rose-100 text-rose-700'
                            : p.type === 'Partial Payment'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {p.type}
                      </span>
                    </td>

                    {/* AMOUNT COLUMN (NEGATIVE FOR REFUNDS) */}
                    <td className="py-3.5 px-3 font-mono font-extrabold text-sm">
                      <span className={p.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {p.amount < 0 ? `-PKR ${Math.abs(p.amount).toLocaleString()}` : `+PKR ${p.amount.toLocaleString()}`}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-slate-900">{p.auditedBy}</div>
                      <div className="text-xs text-[#6B7185]">{p.reason || 'Standard Fee Receipt'}</div>
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
