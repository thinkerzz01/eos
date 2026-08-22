'use client';

import React from 'react';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
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
  const { role } = useRole();
  const isAdmin = role === 'admin';
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
        <Badge tone={row.status === 'paid' ? 'success' : row.status === 'in_grace' ? 'warning' : 'danger'}>
          {row.status.replace('_', ' ')}
        </Badge>
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
            <span>Manage Vouchers &amp; Payments →</span>
          </Link>
        </div>
      )}
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
