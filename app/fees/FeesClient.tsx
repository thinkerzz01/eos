'use client';

import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { DataTable } from '@/components/ui/DataTable';
import type { PaymentInfo } from '@/lib/config/paymentInfo';

export interface VoucherRow {
  id: string;
  voucher_no: string;
  student_name: string;
  period: string;
  amount: number;
  due_date: string;
  grace_deadline: string;
  status: string;
}

export function FeesClient({
  initialVouchers,
  paymentInfo,
}: {
  initialVouchers: VoucherRow[];
  paymentInfo?: PaymentInfo | null;
}) {
  const columns = [
    { header: 'Voucher No', accessorKey: 'voucher_no' as keyof VoucherRow },
    { header: 'Student', accessorKey: 'student_name' as keyof VoucherRow },
    { header: 'Period', accessorKey: 'period' as keyof VoucherRow },
    {
      header: 'Amount',
      cell: (row: VoucherRow) => (
        <span className="font-mono font-semibold text-slate-200">
          PKR {row.amount.toLocaleString()}
        </span>
      ),
    },
    { header: 'Due Date', accessorKey: 'due_date' as keyof VoucherRow },
    { header: 'Grace Deadline', accessorKey: 'grace_deadline' as keyof VoucherRow },
    {
      header: 'Status',
      cell: (row: VoucherRow) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
            row.status === 'paid'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : row.status === 'in_grace'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          {row.status.replace('_', ' ')}
        </span>
      ),
    },
  ];

  return (
    <PortalLayout
      title="Fees & Vouchers Management"
      subtitle="Issue fee vouchers, record payments/partial payments, handle grace decisions, and view financial ledger."
      allowedRoles={['admin', 'student']} // Manager DENIED per locked policy
    >
      {paymentInfo && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="text-sm font-semibold text-slate-200">How to pay your fee</h3>
          <div className="mt-2 grid gap-1 text-sm text-slate-300">
            {paymentInfo.bankTitle && (
              <div>
                Bank Title:{' '}
                <span className="font-medium text-slate-100">{paymentInfo.bankTitle}</span>
              </div>
            )}
            {paymentInfo.bankAccountNo && (
              <div>
                Account No:{' '}
                <span className="font-mono text-slate-100">{paymentInfo.bankAccountNo}</span>
              </div>
            )}
            {paymentInfo.bankIban && (
              <div>
                IBAN: <span className="font-mono text-slate-100">{paymentInfo.bankIban}</span>
              </div>
            )}
            {paymentInfo.wallet && (
              <div>
                Mobile Wallet:{' '}
                <span className="font-medium text-slate-100">{paymentInfo.wallet}</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            After paying, share your receipt with the academy so your voucher is marked paid.
          </p>
        </div>
      )}
      <DataTable
        columns={columns}
        data={initialVouchers}
        keyExtractor={(row) => row.id}
        searchPlaceholder="Search vouchers by number or student..."
      />
    </PortalLayout>
  );
}
