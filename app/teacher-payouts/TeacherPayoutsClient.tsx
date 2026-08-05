'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import {
  Wallet,
  CheckCircle2,
  Clock,
  DollarSign,
  Search,
  Filter,
  Download,
  Lock,
  MessageSquare,
  Mail,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  Wallet as WalletIcon,
  CheckCircle2 as CheckIcon,
  Clock as ClockIcon,
  DollarSign as DollarIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Lock as LockIcon,
  MessageSquare as MessageIcon,
  Mail as MailIcon,
  ShieldCheck as ShieldIcon,
  Zap as ZapIcon,
  CreditCard,
  Building,
  UserCheck,
} from 'lucide-react';

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
  const [payouts, setPayouts] = useState<TeacherPayout[]>(initialPayouts);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleApprovePayout = (id: string) => {
    const updated = payouts.map((p) => {
      if (p.id === id) {
        return { ...p, status: 'Paid' as const, payoutDate: 'Today' };
      }
      return p;
    });
    setPayouts(updated);
    alert('Teacher payout approved and processed successfully!');
  };

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
              Per-class rate calculations, verified class completion counts, and monthly bank transfer dispatches.
            </p>
          </div>
        </div>

        {/* PAYOUTS SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Total Monthly Payroll</div>
            <div className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">PKR 0</div>
            <div className="text-[11px] text-emerald-600 font-bold">0 Faculty Members</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Approved & Pending Payouts</div>
            <div className="font-heading font-extrabold text-2xl text-purple-600">PKR 0</div>
            <div className="text-[11px] text-purple-600 font-bold">Ready for Bank Transfer</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Dispatched Payouts</div>
            <div className="font-heading font-extrabold text-2xl text-emerald-600">PKR 0</div>
            <div className="text-[11px] text-emerald-600 font-bold">—</div>
          </div>
        </div>

        {/* PAYOUTS DATA TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-[11.5px]">
                  <th className="py-3.5 px-3">TEACHER NAME & SUBJECTS</th>
                  <th className="py-3.5 px-3">PER CLASS RATE</th>
                  <th className="py-3.5 px-3">COMPLETED CLASSES</th>
                  <th className="py-3.5 px-3">GROSS PAYOUT</th>
                  <th className="py-3.5 px-3">BANK DETAILS</th>
                  <th className="py-3.5 px-3">STATUS</th>
                  <th className="py-3.5 px-3 text-center">ACTION</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{p.teacherName}</div>
                      <div className="text-[11px] text-[#6B7185]">{p.subjects.join(' · ')}</div>
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

                    <td className="py-3.5 px-3 font-mono text-[11px]">
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

                    <td className="py-3.5 px-3 text-center">
                      {p.status !== 'Paid' ? (
                        <button
                          onClick={() => handleApprovePayout(p.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          Process Bank Transfer →
                        </button>
                      ) : (
                        <span className="text-emerald-600 font-extrabold text-xs">Paid on {p.payoutDate}</span>
                      )}
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
