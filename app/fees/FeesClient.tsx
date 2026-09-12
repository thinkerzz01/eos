'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { PaymentInfo } from '@/lib/config/paymentInfo';
import { Eye, X, Printer, ChevronDown } from 'lucide-react';

export interface VoucherRow {
  id: string;
  voucher_no: string;
  student_name: string;
  period: string;       // raw month (e.g. "September 2026") - used for the period filter
  periodLabel: string;  // exact billing cycle (e.g. "26 Sep – 25 Oct 2026") - shown
  amount: number;
  due_date: string;
  grace_deadline: string;
  status: string;
}

const statusTone = (s: string): 'success' | 'warning' | 'danger' =>
  s === 'paid' ? 'success' : s === 'in_grace' ? 'warning' : 'danger';
const prettyStatus = (s: string) => s.replace(/_/g, ' ');

export function FeesClient({
  initialVouchers,
  paymentInfo,
}: {
  initialVouchers: VoucherRow[];
  paymentInfo?: PaymentInfo | null;
}) {
  const { role } = useRole();
  const isAdmin = role === 'admin';
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [view, setView] = useState<VoucherRow | null>(null);

  const periods = useMemo(
    () => Array.from(new Set(initialVouchers.map((v) => v.period).filter(Boolean))),
    [initialVouchers]
  );
  const statuses = useMemo(
    () => Array.from(new Set(initialVouchers.map((v) => v.status).filter(Boolean))),
    [initialVouchers]
  );
  const filterChips = [
    { id: 'all', label: 'All', value: 'all' },
    ...statuses.map((s) => ({ id: s, label: prettyStatus(s), value: s })),
  ];

  const data = useMemo(
    () =>
      initialVouchers.filter(
        (v) => (status === 'all' || v.status === status) && (period === 'all' || v.period === period)
      ),
    [initialVouchers, status, period]
  );

  const columns = [
    ...(isAdmin ? [{ header: 'Student', accessorKey: 'student_name' as keyof VoucherRow }] : []),
    { header: 'Period', accessorKey: 'periodLabel' as keyof VoucherRow },
    {
      header: 'Amount',
      cell: (row: VoucherRow) => (
        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">PKR {row.amount.toLocaleString()}</span>
      ),
    },
    { header: 'Due Date', accessorKey: 'due_date' as keyof VoucherRow },
    { header: 'Grace Deadline', accessorKey: 'grace_deadline' as keyof VoucherRow },
    {
      header: 'Status',
      cell: (row: VoucherRow) => <Badge tone={statusTone(row.status)}>{prettyStatus(row.status)}</Badge>,
    },
    {
      header: '',
      cell: (row: VoucherRow) => (
        <button
          onClick={() => setView(row)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            row.status === 'paid'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              : 'bg-[#5B47D6] hover:bg-[#4F3DC7] text-white'
          }`}
        >
          <Eye className="w-3.5 h-3.5" /> View voucher
        </button>
      ),
    },
  ];

  return (
    <PortalLayout
      title={isAdmin ? 'Fee Ledger' : 'My Fee Vouchers'}
      subtitle={
        isAdmin
          ? 'Read-only view of all fee vouchers. Issuing vouchers, recording payments, and grace decisions are handled in Vouchers.'
          : 'Your fee vouchers and how to pay.'
      }
      allowedRoles={['admin', 'student']} // Manager DENIED per locked policy
    >
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <Link
            href="/vouchers"
            className="px-4 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium rounded-xl shadow-sm inline-flex items-center gap-1.5"
          >
            <span>Manage Vouchers &amp; Payments</span>
          </Link>
        </div>
      )}

      {/* PERIOD FILTER (status + search live in the table's own bar) */}
      {periods.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs font-medium text-[#6B7185] dark:text-slate-400">Period</label>
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-100 pl-3 pr-8 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]"
            >
              <option value="all">All periods</option>
              {periods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(row) => row.id}
        searchPlaceholder="Search vouchers…"
        filterChips={filterChips}
        activeFilter={status}
        onFilterChange={setStatus}
        emptyTitle="No vouchers"
        emptyDescription="There are no fee vouchers matching these filters."
      />

      {/* VOUCHER DETAIL / PRINT */}
      {view && (
        <>
          <style>{`
            @media print {
              @page { margin: 0; }
              html, body { background: #ffffff !important; }
              body * { visibility: hidden !important; }
              #fee-voucher-print, #fee-voucher-print * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
              }
              #fee-voucher-print {
                position: absolute; left: 0; top: 0; width: 100%;
                max-width: 100% !important; max-height: none !important;
                box-shadow: none !important; border: none !important; overflow: visible !important;
                padding: 32px !important; border-radius: 0 !important;
              }
            }
          `}</style>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in" onClick={() => setView(null)}>
            <div id="fee-voucher-print" className="bg-white text-slate-900 rounded-3xl p-6 sm:p-7 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-heading font-semibold text-lg">Fee Voucher</div>
                  <div className="text-xs text-slate-500 mt-0.5">{view.student_name || 'Student'}</div>
                </div>
                <button onClick={() => setView(null)} className="print:hidden p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Amount Due</div>
                  <div className="font-mono font-bold text-2xl text-slate-900 mt-0.5">PKR {view.amount.toLocaleString()}</div>
                </div>
                <Badge tone={statusTone(view.status)}>{prettyStatus(view.status)}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[13px]">
                {[
                  ['Billing period', view.periodLabel],
                  ['Due date', view.due_date],
                  ['Grace deadline', view.grace_deadline],
                  ['Status', prettyStatus(view.status)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</div>
                    <div className="font-medium text-slate-900 mt-0.5 break-words">{v}</div>
                  </div>
                ))}
              </div>

              {paymentInfo && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[13px]">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">How to pay</div>
                  <div className="space-y-0.5 text-slate-700">
                    {paymentInfo.bankTitle && <div>Bank Title: <span className="font-medium text-slate-900">{paymentInfo.bankTitle}</span></div>}
                    {paymentInfo.bankAccountNo && <div>Account No: <span className="font-mono text-slate-900">{paymentInfo.bankAccountNo}</span></div>}
                    {paymentInfo.bankIban && <div>IBAN: <span className="font-mono text-slate-900">{paymentInfo.bankIban}</span></div>}
                    {paymentInfo.wallet && <div>Mobile Wallet: <span className="font-medium text-slate-900">{paymentInfo.wallet}</span></div>}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400">After paying, share your receipt with the academy so your voucher is marked paid.</p>

              <div className="flex justify-end pt-1">
                <button onClick={() => window.print()} className="print:hidden inline-flex items-center gap-2 bg-[#0F172A] hover:bg-[#0b1120] text-white font-medium text-sm rounded-xl px-4 py-2.5">
                  <Printer className="w-4 h-4" /> Print Voucher
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </PortalLayout>
  );
}
