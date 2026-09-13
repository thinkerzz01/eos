'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { PaymentInfo } from '@/lib/config/paymentInfo';
import { VoucherSlip } from '@/components/fees/VoucherSlip';
import { Eye, ChevronDown } from 'lucide-react';

export interface VoucherRow {
  id: string;
  voucher_no: string;
  student_name: string;
  parent_name?: string; // parent / guardian (shown on the voucher)
  program?: string;     // enrolment program (shown on the voucher)
  period: string;       // raw month (e.g. "September 2026") - used for the period filter
  periodLabel: string;  // exact billing cycle (e.g. "26 Sep – 25 Oct 2026") - shown
  amount: number;
  due_date: string;
  grace_deadline: string;
  status: string;
}

const statusTone = (s: string): 'success' | 'warning' | 'danger' =>
  s === 'paid' ? 'success' : s === 'in_grace' ? 'warning' : 'danger';
const prettyStatus = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function FeesClient({
  initialVouchers,
  paymentInfo,
}: {
  initialVouchers: VoucherRow[];
  paymentInfo?: PaymentInfo | null;
}) {
  const { role } = useRole();
  const isAdmin = role === 'admin';
  // Default the period filter to THIS MONTH (fall back to All if there's no
  // voucher for it yet). Other months — including upcoming/advance — stay
  // selectable, and "All periods" shows everything.
  const nowLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' });
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState<string>(() =>
    initialVouchers.some((v) => v.period === nowLabel) ? nowLabel : 'all'
  );
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

      {/* VOUCHER DETAIL / PRINT — shared premium slip (identical on admin & student). */}
      {view && (
        <VoucherSlip
          voucherNo={view.voucher_no}
          studentName={view.student_name}
          parentName={view.parent_name}
          program={view.program}
          periodLabel={view.periodLabel}
          amount={view.amount}
          dueDate={view.due_date}
          status={prettyStatus(view.status)}
          paymentInfo={paymentInfo}
          showVoucherId={isAdmin}
          onClose={() => setView(null)}
        />
      )}
    </PortalLayout>
  );
}
