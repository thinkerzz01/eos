'use client';

import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { DataTable } from '@/components/ui/DataTable';

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

export function FeesClient({ initialVouchers }: { initialVouchers: VoucherRow[] }) {
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
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
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
      <DataTable
        columns={columns}
        data={initialVouchers}
        keyExtractor={(row) => row.id}
        searchPlaceholder="Search vouchers by number or student..."
        filterChips={[
          { id: 'all', label: 'All Vouchers', value: 'all' },
          { id: 'due', label: 'Due / In Grace', value: 'due' },
          { id: 'paid', label: 'Paid', value: 'paid' },
        ]}
        activeFilter="all"
      />
    </PortalLayout>
  );
}
