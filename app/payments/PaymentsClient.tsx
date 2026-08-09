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
  const [receipt, setReceipt] = useState<PaymentTransaction | null>(null);

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
                  <th className="py-3.5 px-3 text-center">ACTIONS</th>
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

                    <td className="py-3.5 px-3 text-center">
                      <button
                        onClick={() => setReceipt(p)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-lg cursor-pointer"
                      >
                        Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* C5 explainer: what this ledger is vs vouchers */}
        <p className="text-xs text-slate-400 font-medium mt-3">
          This is the read-only <strong>payment ledger</strong> - every payment and refund, kept as a permanent audit trail (never edited or deleted). To create a voucher, collect a payment, or send a voucher to a student, use the <Link href="/vouchers" className="text-[#5B47D6] underline">Vouchers</Link> screen.
        </p>

      </div>

      {/* RECEIPT PREVIEW / PRINT */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setReceipt(null)}>
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4 text-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#5B47D6] to-[#8B7BF0] text-white flex items-center justify-center font-black text-lg">T</div>
                <div>
                  <div className="font-extrabold text-base leading-tight">Thinkerzz Academy</div>
                  <div className="text-xs text-slate-500 font-semibold">Payment Receipt</div>
                </div>
                <div className="ml-auto font-mono font-bold text-sm">{receipt.receiptNo}</div>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs font-semibold">
                <div className="text-slate-500">Student</div><div className="text-right">{receipt.studentName}</div>
                <div className="text-slate-500">Date</div><div className="text-right">{receipt.paymentDate}</div>
                <div className="text-slate-500">Method</div><div className="text-right">{receipt.paymentMethod}</div>
                <div className="text-slate-500">Type</div><div className="text-right">{receipt.type}</div>
                <div className="text-slate-500">Amount</div>
                <div className={`text-right font-mono font-bold ${receipt.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {receipt.amount < 0 ? `-PKR ${Math.abs(receipt.amount).toLocaleString()}` : `PKR ${receipt.amount.toLocaleString()}`}
                </div>
                <div className="text-slate-500">Audited by</div><div className="text-right">{receipt.auditedBy}</div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => window.print()} className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl">Print Receipt</button>
              <button onClick={() => setReceipt(null)} className="px-3 py-2 border border-slate-300 font-bold text-xs rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
