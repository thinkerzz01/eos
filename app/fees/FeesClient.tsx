'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { PaymentInfo } from '@/lib/config/paymentInfo';
import { Eye, Printer, ChevronDown } from 'lucide-react';

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

      {/* VOUCHER DETAIL / PRINT — same branded design as the admin voucher slip */}
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
                border-radius: 0 !important;
              }
            }
          `}</style>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in" onClick={() => setView(null)}>
            <div id="fee-voucher-print" className="bg-white rounded-3xl p-0 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-7 space-y-5 text-slate-900 text-[15px]">
                {/* Colored branded header */}
                <div className="flex items-center gap-3 rounded-2xl bg-[#5B47D6] text-white px-5 py-4">
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center font-medium text-lg">T</div>
                  <div>
                    <div className="font-medium text-xl leading-tight">Thinkerzz</div>
                    <div className="text-xs text-purple-200 font-medium uppercase tracking-widest">Fee Voucher</div>
                  </div>
                  {/* Voucher ID is an internal reference: shown to admin, hidden from the student's voucher/print. */}
                  {isAdmin && (
                    <div className="ml-auto text-right">
                      <div className="text-[11px] text-purple-200">Voucher</div>
                      <div className="font-mono font-medium text-sm">{view.voucher_no || '—'}</div>
                    </div>
                  )}
                </div>

                {/* Amount headline */}
                <div className="rounded-2xl border-2 border-[#5B47D6]/20 bg-[#5B47D6]/5 p-4 text-center">
                  <div className="text-xs font-medium uppercase tracking-widest text-[#5B47D6]">Amount To Pay</div>
                  <div className="font-heading font-medium text-4xl text-slate-900 mt-1">PKR {view.amount.toLocaleString()}</div>
                  <div className="text-[13px] font-medium text-slate-500 mt-1">Due by {view.due_date}</div>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[14px] font-medium">
                  <div className="text-slate-500">Student</div><div className="text-right">{view.student_name || '-'}</div>
                  <div className="text-slate-500">Billing Period</div><div className="text-right">{view.periodLabel}</div>
                  <div className="text-slate-500">Grace Deadline</div><div className="text-right">{view.grace_deadline}</div>
                  <div className="text-slate-500">Status</div><div className="text-right">{prettyStatus(view.status)}</div>
                </div>

                {paymentInfo && (paymentInfo.bankTitle || paymentInfo.bankAccountNo || paymentInfo.bankIban || paymentInfo.wallet) && (
                  <div className="space-y-2.5">
                    {(paymentInfo.bankTitle || paymentInfo.bankAccountNo || paymentInfo.bankIban) && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[13px]">
                        <div className="font-medium text-[#5B47D6] mb-1 uppercase tracking-wide text-xs">Bank Transfer</div>
                        <div className="space-y-0.5 text-slate-700">
                          {paymentInfo.bankTitle && <div>Title: <span className="font-medium">{paymentInfo.bankTitle}</span></div>}
                          {paymentInfo.bankAccountNo && <div>Account No: <span className="font-mono">{paymentInfo.bankAccountNo}</span></div>}
                          {paymentInfo.bankIban && <div>IBAN: <span className="font-mono">{paymentInfo.bankIban}</span></div>}
                        </div>
                      </div>
                    )}
                    {paymentInfo.wallet && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[13px]">
                        <div className="font-medium text-[#12A150] mb-1 uppercase tracking-wide text-xs">JazzCash / Mobile Wallet</div>
                        <div className="text-slate-700"><span className="font-medium">{paymentInfo.wallet}</span></div>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-center text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-100">
                  Please share the payment receipt after paying. Thank you. · Thinkerzz
                </div>
              </div>

              <div className="flex gap-2 p-4 border-t border-slate-200 bg-slate-50 print:hidden">
                <button onClick={() => window.print()} className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl">
                  <Printer className="w-4 h-4" /> Print Voucher
                </button>
                <button onClick={() => setView(null)} className="px-3 py-2 border border-slate-300 font-medium text-xs rounded-xl">Close</button>
              </div>
            </div>
          </div>
        </>
      )}
    </PortalLayout>
  );
}
