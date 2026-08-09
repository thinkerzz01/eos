'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRouter } from 'next/navigation';
import { useRole } from '@/components/ui/RoleContext';
import { FeeVoucher, PaymentTransaction } from '@/lib/mockFinanceData';
import type { PaymentInfo } from '@/lib/config/paymentInfo';
import { recordPayment, issueRefund, adminFeeDecision, createVoucher } from './actions';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  X,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Clock,
  ShieldCheck,
  RotateCcw,
  FileText,
  Lock,
  MessageSquare,
  Phone,
  ArrowDownRight,
  TrendingDown,
  Sparkles,
} from 'lucide-react';

// Add N days to a YYYY-MM-DD date, returned as YYYY-MM-DD (PKT calendar).
function addDaysPKT(ymd: string, n: number): string {
  const dt = new Date(`${ymd}T00:00:00+05:00`);
  dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}
// Human month label for a date, e.g. "September 2026" (used as the voucher period).
function monthLabelPKT(ymd: string): string {
  return new Date(`${ymd}T00:00:00+05:00`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  });
}

// Normalise a Pakistani phone to wa.me digits (0300... -> 92300...).
function waDigits(phone: string): string {
  let d = (phone || '').replace(/\D/g, '');
  if (d.startsWith('92')) return d;
  if (d.startsWith('0')) return '92' + d.slice(1);
  if (d.startsWith('3')) return '92' + d; // bare mobile without leading 0
  return d;
}

// Build the WhatsApp fee-voucher message (voucher details + how to pay).
function voucherWhatsappText(v: FeeVoucher, pay?: PaymentInfo | null): string {
  const lines = [
    `*Thinkerzz - Fee Voucher*`,
    ``,
    `Voucher: ${v.voucherNo}`,
    `Student: ${v.studentName}`,
    `Program: ${v.program}`,
    `Amount: PKR ${v.totalAmount.toLocaleString()}`,
    v.runningBalance > 0 ? `Balance due: PKR ${v.runningBalance.toLocaleString()}` : `Status: Paid`,
    `Due date: ${v.dueDate}`,
  ];
  if (pay && (pay.bankTitle || pay.bankAccountNo || pay.bankIban || pay.wallet)) {
    lines.push(``, `*How to pay*`);
    if (pay.bankTitle) lines.push(`Bank Title: ${pay.bankTitle}`);
    if (pay.bankAccountNo) lines.push(`Account No: ${pay.bankAccountNo}`);
    if (pay.bankIban) lines.push(`IBAN: ${pay.bankIban}`);
    if (pay.wallet) lines.push(`Mobile Wallet: ${pay.wallet}`);
    lines.push(``, `Please share the payment receipt after paying. Thank you!`);
  }
  return lines.join('\n');
}

export function VouchersClient({
  initialVouchers,
  initialPayments,
  students,
  paymentInfo,
}: {
  initialVouchers: FeeVoucher[];
  initialPayments: PaymentTransaction[];
  students: { id: string; name: string }[];
  paymentInfo?: PaymentInfo | null;
}) {
  const { role } = useRole();
  const router = useRouter();

  // LOCAL VOUCHER & PAYMENT STORES (seeded from server, RLS-authorized)
  const [vouchersList, setVouchersList] = useState<FeeVoucher[]>(initialVouchers);
  const [paymentsList, setPaymentsList] = useState<PaymentTransaction[]>(initialPayments);

  // Keep the view in sync when the server refetches after a write (router.refresh()).
  useEffect(() => { setVouchersList(initialVouchers); }, [initialVouchers]);
  useEffect(() => { setPaymentsList(initialPayments); }, [initialPayments]);

  // CREATE VOUCHER MODAL STATE
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newPaidDate, setNewPaidDate] = useState(''); // date the student paid this fee
  const [newAmount, setNewAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState(''); // auto = paid date + 30 days (editable)
  const [creating, setCreating] = useState(false);
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('All Vouchers');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // MODAL STATES
  const [partialPayVoucher, setPartialPayVoucher] = useState<FeeVoucher | null>(null);
  const [previewVoucher, setPreviewVoucher] = useState<FeeVoucher | null>(null);
  const [payAmountInput, setPayAmountInput] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'Bank Transfer' | 'JazzCash'>('Bank Transfer');

  const [refundVoucher, setRefundVoucher] = useState<FeeVoucher | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');

  // ADMIN FEE DECISION MODAL
  const [decisionVoucher, setDecisionVoucher] = useState<FeeVoucher | null>(null);

  const filteredVouchers = useMemo(() => {
    return vouchersList.filter((v) => {
      if (selectedStatusTab === 'Paid' && v.status !== 'Paid') return false;
      if (selectedStatusTab === 'Due' && v.status !== 'Due') return false;
      if (selectedStatusTab === 'In Grace' && v.status !== 'In Grace') return false;
      if (selectedStatusTab === 'Stopped' && v.status !== 'Stopped') return false;
      if (selectedStatusTab === 'Needs Admin Decision' && !v.needsAdminDecision) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesStudent = v.studentName.toLowerCase().includes(q);
        const matchesVoucher = v.voucherNo.toLowerCase().includes(q);
        if (!matchesStudent && !matchesVoucher) return false;
      }

      return true;
    });
  }, [vouchersList, selectedStatusTab, searchQuery]);

  // HANDLE PARTIAL / FULL PAYMENT (persists via server action, RLS-enforced)
  const handleRecordPayment = async () => {
    if (!partialPayVoucher) return;
    const amountNum = parseFloat(payAmountInput);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const res = await recordPayment({
      voucherId: partialPayVoucher.id,
      amount: amountNum,
      method: payMethod,
    });

    if (res.ok) {
      setPartialPayVoucher(null);
      setPayAmountInput('');
      router.refresh();
      alert(
        res.fullyPaid
          ? 'Voucher marked as PAID.'
          : `Payment recorded. Voucher remains Due with a running balance of PKR ${(res.balance ?? 0).toLocaleString()}.`
      );
    } else {
      alert(res.error ?? 'Failed to record payment.');
    }
  };

  // HANDLE REFUND - negative payment linked to the voucher (server action, audited)
  const handleIssueRefund = async () => {
    if (!refundVoucher) return;
    const refundNum = parseFloat(refundAmountInput);
    if (isNaN(refundNum) || refundNum <= 0) return;

    const res = await issueRefund({
      voucherId: refundVoucher.id,
      amount: refundNum,
      reason: refundReason || 'Admin approved fee adjustment refund',
    });

    if (res.ok) {
      setRefundVoucher(null);
      setRefundAmountInput('');
      setRefundReason('');
      router.refresh();
      alert(`Refund of PKR ${refundNum.toLocaleString()} issued as an audited negative payment.`);
    } else {
      alert(res.error ?? 'Failed to issue refund.');
    }
  };

  // HANDLE ADMIN FEE DECISION (STOP / EXTEND / MARK PAID) - audited to fee_decisions
  const handleAdminDecision = async (choice: 'Stop' | 'Extend' | 'Mark Paid') => {
    if (!decisionVoucher) return;

    const res = await adminFeeDecision({ voucherId: decisionVoucher.id, choice });
    if (res.ok) {
      setDecisionVoucher(null);
      router.refresh();
      alert(`Admin decision recorded and audited: ${choice}.`);
    } else {
      alert(res.error ?? 'Failed to record decision.');
    }
  };

  // HANDLE CREATE VOUCHER (persists via server action, RLS-enforced)
  const handleCreateVoucher = async () => {
    const amountNum = parseFloat(newAmount);
    if (!newStudentId) { alert('Please select a student.'); return; }
    if (isNaN(amountNum) || amountNum <= 0) { alert('Please enter a valid fee amount.'); return; }
    if (!newPaidDate) { alert('Please select the date the fee was paid.'); return; }
    if (!newDueDate) { alert('Please select a next due date.'); return; }

    setCreating(true);
    const res = await createVoucher({
      studentId: newStudentId,
      period: monthLabelPKT(newPaidDate), // derived from the paid date
      amount: amountNum,
      dueDate: newDueDate,
    });
    setCreating(false);

    if (res.ok) {
      setShowCreateModal(false);
      setNewStudentId('');
      setNewPaidDate('');
      setNewAmount('');
      setNewDueDate('');
      router.refresh();
      alert('Voucher created successfully.');
    } else {
      alert(res.error ?? 'Failed to create voucher.');
    }
  };

  // RLS CHECK: MANAGER DENIED AT DATABASE LEVEL
  if (role === 'manager') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
        <div className="p-8 max-w-lg mx-auto text-center bg-white border border-rose-200 rounded-3xl shadow-xl space-y-4 my-12">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Access Denied (RLS Level Security)</h2>
          <p className="text-xs text-[#6B7185] leading-relaxed">
            Per <strong>AGENTS.md §3.3</strong>, Manager tokens are strictly denied access at the database level to all finance tables (<code className="bg-slate-100 px-1 py-0.5 rounded">vouchers</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">payments</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">refunds</code>).
          </p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Fee Vouchers & Fee Cycle (Admin Only)</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              No late fees. 3-day grace period. Partial payments & negative refund transactions.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/payments"
              className="h-[38px] px-3.5 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-[#5B47D6]" />
              <span>Payments Ledger →</span>
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-[38px] px-3.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Voucher</span>
            </button>
          </div>
        </div>

        {/* 3-DAY GRACE POLICY BANNER */}
        <div className="p-4 bg-gradient-to-r from-purple-900 to-[#1B1E38] text-white rounded-[20px] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-heading font-extrabold text-xs text-purple-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Locked Policy: 3-Day Grace & Admin Decision Rule</span>
            </div>
            <p className="text-xs text-purple-100 leading-relaxed max-w-2xl">
              Paying within the 3-day grace period scores <strong>100 on Fee Timeliness</strong>. Grace expiry <strong>never auto-stops a student</strong>; it raises a card for Admin to choose: <strong>Stop</strong>, <strong>Extend Grace</strong>, or <strong>Mark Paid</strong>.
            </p>
          </div>
          <span className="px-3 py-1 bg-emerald-500 text-white font-extrabold text-xs rounded-full shrink-0">
            No Late Fees Ever
          </span>
        </div>

        {/* VOUCHERS KPI & STATUS TABS */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-[#EBEDF3] dark:border-slate-800 pb-3">
            <div className="flex items-center gap-1 bg-[#F6F7FB] dark:bg-slate-800 p-1 rounded-xl flex-wrap">
              {[
                { name: 'All Vouchers', count: vouchersList.length },
                { name: 'Paid', count: vouchersList.filter((v) => v.status === 'Paid').length },
                { name: 'Due', count: vouchersList.filter((v) => v.status === 'Due').length },
                { name: 'In Grace', count: vouchersList.filter((v) => v.status === 'In Grace').length },
                { name: 'Stopped', count: vouchersList.filter((v) => v.status === 'Stopped').length },
                { name: 'Needs Admin Decision', count: vouchersList.filter((v) => v.needsAdminDecision).length },
              ].map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => setSelectedStatusTab(tab.name)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedStatusTab === tab.name
                      ? tab.name === 'Needs Admin Decision'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-[#5B47D6] text-white shadow-sm'
                      : 'text-[#6B7185] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-xs ${selectedStatusTab === tab.name ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-[#6B7185]'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search voucher or student..."
                className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]"
              />
            </div>
          </div>
        </div>

        {/* VOUCHERS DATA TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-xs">
                  <th className="py-3.5 px-3">VOUCHER NO & STUDENT</th>
                  <th className="py-3.5 px-3">PARENT & PHONE</th>
                  <th className="py-3.5 px-3">DUE DATE & GRACE DEADLINE</th>
                  <th className="py-3.5 px-3">TOTAL FEE</th>
                  <th className="py-3.5 px-3">PAID AMOUNT</th>
                  <th className="py-3.5 px-3">RUNNING BALANCE</th>
                  <th className="py-3.5 px-3">STATUS</th>
                  <th className="py-3.5 px-3 text-center">ACTIONS</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#6B7185]">
                      No fee vouchers match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{v.studentName}</div>
                        <div className="text-xs text-[#6B7185] font-mono">{v.voucherNo}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-slate-900 dark:text-slate-100">{v.parentName}</div>
                        <div className="text-xs text-[#6B7185] font-mono">{v.parentPhone}</div>
                      </td>

                      <td className="py-3.5 px-3 font-mono">
                        <div>Due: <strong className="text-slate-900">{v.dueDate}</strong></div>
                        <div className="text-purple-600 font-bold">Grace: {v.graceDeadlineDate}</div>
                      </td>

                      <td className="py-3.5 px-3 font-mono font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                        PKR {v.totalAmount.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-3 font-mono font-extrabold text-emerald-600 text-sm">
                        PKR {v.paidAmount.toLocaleString()}
                      </td>

                      {/* RUNNING BALANCE COLUMN FOR PARTIAL PAYMENTS */}
                      <td className="py-3.5 px-3 font-mono font-extrabold text-rose-600 text-sm">
                        PKR {v.runningBalance.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                            v.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : v.status === 'In Grace'
                              ? 'bg-purple-100 text-purple-700'
                              : v.status === 'Stopped'
                              ? 'bg-slate-700 text-white'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {v.status}
                        </span>
                        {v.needsAdminDecision && (
                          <span className="block text-xs font-extrabold text-rose-600 mt-1 animate-pulse">
                            ⚠️ Needs Admin Decision
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setPreviewVoucher(v)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-lg cursor-pointer"
                          >
                            View
                          </button>
                          {v.needsAdminDecision ? (
                            <button
                              onClick={() => setDecisionVoucher(v)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
                            >
                              Fee Decision →
                            </button>
                          ) : (
                            <>
                              {v.status !== 'Paid' && (
                                <button
                                  onClick={() => {
                                    setPartialPayVoucher(v);
                                    setPayAmountInput(v.runningBalance.toString());
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
                                >
                                  + Payment
                                </button>
                              )}

                              {v.paidAmount > 0 && (
                                <button
                                  onClick={() => setRefundVoucher(v)}
                                  className="px-2.5 py-1 bg-rose-50 text-rose-700 font-extrabold text-xs rounded-lg border border-rose-200 hover:bg-rose-100 cursor-pointer"
                                >
                                  Refund
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PARTIAL / FULL PAYMENT MODAL */}
        {/* CREATE VOUCHER MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">Create Fee Voucher</h3>
                <button onClick={() => setShowCreateModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Student</label>
                  <select
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select a student...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {students.length === 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-1">No students yet. Add a student first.</p>
                  )}
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Date Fee Paid</label>
                  <input
                    type="date"
                    value={newPaidDate}
                    onChange={(e) => {
                      const d = e.target.value;
                      setNewPaidDate(d);
                      // Auto-set the next due date to 30 days later (still editable below).
                      if (d) setNewDueDate(addDaysPKT(d, 30));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    The day the student paid this month&apos;s fee. The next due date is set to 30 days later automatically.
                  </p>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Amount (PKR)</label>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="e.g. 20000"
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 font-mono font-extrabold text-base text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Next Due Date (auto +30 days)</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Auto-filled to 30 days after the paid date. Edit it only if you need a different due date. A 3-day grace deadline is added automatically.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
                <button
                  onClick={handleCreateVoucher}
                  disabled={creating}
                  className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-extrabold text-xs shadow-md disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Voucher'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VOUCHER PREVIEW (view / print / send on WhatsApp) */}
        {previewVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in" onClick={() => setPreviewVoucher(null)}>
            <div className="bg-white rounded-3xl p-0 max-w-md w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div id="voucher-print" className="p-6 space-y-4 text-slate-900">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#5B47D6] to-[#8B7BF0] text-white flex items-center justify-center font-black text-lg">T</div>
                  <div>
                    <div className="font-extrabold text-base leading-tight">Thinkerzz</div>
                    <div className="text-xs text-slate-500 font-semibold">Fee Voucher</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-xs text-slate-500">Voucher</div>
                    <div className="font-mono font-bold text-sm">{previewVoucher.voucherNo}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs font-semibold">
                  <div className="text-slate-500">Student</div><div className="text-right">{previewVoucher.studentName}</div>
                  <div className="text-slate-500">Parent</div><div className="text-right">{previewVoucher.parentName}</div>
                  <div className="text-slate-500">Program</div><div className="text-right">{previewVoucher.program}</div>
                  <div className="text-slate-500">Due Date</div><div className="text-right">{previewVoucher.dueDate}</div>
                  <div className="text-slate-500">Amount</div><div className="text-right font-mono font-bold">PKR {previewVoucher.totalAmount.toLocaleString()}</div>
                  <div className="text-slate-500">Paid</div><div className="text-right font-mono">PKR {previewVoucher.paidAmount.toLocaleString()}</div>
                  <div className="text-slate-500">Balance</div>
                  <div className={`text-right font-mono font-bold ${previewVoucher.runningBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>PKR {previewVoucher.runningBalance.toLocaleString()}</div>
                  <div className="text-slate-500">Status</div><div className="text-right font-bold">{previewVoucher.status}</div>
                </div>

                {paymentInfo && (paymentInfo.bankTitle || paymentInfo.bankAccountNo || paymentInfo.bankIban || paymentInfo.wallet) && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
                    <div className="font-extrabold text-slate-700 mb-1">How to pay</div>
                    <div className="space-y-0.5 text-slate-700">
                      {paymentInfo.bankTitle && <div>Bank Title: <span className="font-semibold">{paymentInfo.bankTitle}</span></div>}
                      {paymentInfo.bankAccountNo && <div>Account No: <span className="font-mono">{paymentInfo.bankAccountNo}</span></div>}
                      {paymentInfo.bankIban && <div>IBAN: <span className="font-mono">{paymentInfo.bankIban}</span></div>}
                      {paymentInfo.wallet && <div>Mobile Wallet: <span className="font-semibold">{paymentInfo.wallet}</span></div>}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 p-4 border-t border-slate-200 bg-slate-50">
                <a
                  href={`https://wa.me/${waDigits(previewVoucher.parentPhone)}?text=${encodeURIComponent(voucherWhatsappText(previewVoucher, paymentInfo))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl"
                >
                  Send on WhatsApp
                </a>
                <button onClick={() => window.print()} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl">Print</button>
                <button onClick={() => setPreviewVoucher(null)} className="px-3 py-2 border border-slate-300 font-bold text-xs rounded-xl">Close</button>
              </div>
            </div>
          </div>
        )}

        {partialPayVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">
                  Record Fee Payment - {partialPayVoucher.studentName}
                </h3>
                <button onClick={() => setPartialPayVoucher(null)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs font-bold">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <div>Voucher No: <span className="font-mono text-slate-900">{partialPayVoucher.voucherNo}</span></div>
                  <div>Total Fee: <span className="font-mono text-slate-900">PKR {partialPayVoucher.totalAmount.toLocaleString()}</span></div>
                  <div>Current Running Balance: <span className="font-mono text-rose-600">PKR {partialPayVoucher.runningBalance.toLocaleString()}</span></div>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1">Payment Amount (PKR)</label>
                  <input
                    type="number"
                    value={payAmountInput}
                    onChange={(e) => setPayAmountInput(e.target.value)}
                    className="w-full bg-slate-50 border rounded-xl p-2.5 font-mono font-extrabold text-base text-slate-900"
                  />
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Partial payment updates running balance; voucher stays <strong>Due</strong> until balance reaches 0.
                  </p>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="JazzCash">JazzCash</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setPartialPayVoucher(null)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
                <button onClick={handleRecordPayment} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-extrabold text-xs shadow-md">
                  Confirm Payment Entry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REFUND MODAL (NEGATIVE PAYMENT ENTRY) */}
        {refundVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">
                  Issue Refund - {refundVoucher.studentName}
                </h3>
                <button onClick={() => setRefundVoucher(null)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs font-bold">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-900">
                  <div>Total Paid to Date: <span className="font-mono">PKR {refundVoucher.paidAmount.toLocaleString()}</span></div>
                  <div className="text-xs font-medium pt-1">
                    Note: Per AGENTS.md §4, refunds are recorded as a <strong>negative payment entry</strong> linked to the voucher. The original payment is never edited or deleted.
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1">Refund Amount (PKR)</label>
                  <input
                    type="number"
                    value={refundAmountInput}
                    onChange={(e) => setRefundAmountInput(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full bg-slate-50 border rounded-xl p-2.5 font-mono font-extrabold text-base text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1">Refund Reason (Mandatory Audit)</label>
                  <textarea
                    rows={2}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Enter reason for audit log..."
                    className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setRefundVoucher(null)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
                <button onClick={handleIssueRefund} className="px-4 py-2 bg-rose-600 text-white rounded-xl font-extrabold text-xs shadow-md">
                  Issue Audited Negative Refund Entry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN FEE DECISION MODAL (GRACE EXPIRED) */}
        {decisionVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">
                  Fees Need an Admin Decision
                </h3>
                <button onClick={() => setDecisionVoucher(null)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-[#6B7185] font-medium leading-relaxed">
                  The 3-day grace period for student <strong>{decisionVoucher.studentName}</strong> ({decisionVoucher.voucherNo}) expired on <strong>{decisionVoucher.graceDeadlineDate}</strong>. Select an audited Admin action:
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() => handleAdminDecision('Stop')}
                    className="w-full p-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-2xl text-left font-extrabold text-rose-700 flex justify-between items-center transition-all"
                  >
                    <div>
                      <div>1. Stop Student (Change Status to Stopped)</div>
                      <div className="text-xs font-normal text-rose-600">Restricts student portal access until resolved</div>
                    </div>
                    <span>→</span>
                  </button>

                  <button
                    onClick={() => handleAdminDecision('Extend')}
                    className="w-full p-3 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-2xl text-left font-extrabold text-[#5B47D6] flex justify-between items-center transition-all"
                  >
                    <div>
                      <div>2. Extend Grace Period (+3 Days)</div>
                      <div className="text-xs font-normal text-purple-700">Grants additional time without stopping student</div>
                    </div>
                    <span>→</span>
                  </button>

                  <button
                    onClick={() => handleAdminDecision('Mark Paid')}
                    className="w-full p-3 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-2xl text-left font-extrabold text-emerald-700 flex justify-between items-center transition-all"
                  >
                    <div>
                      <div>3. Mark Paid (Confirm Manual Payment)</div>
                      <div className="text-xs font-normal text-emerald-600">Records full payment and clears balance</div>
                    </div>
                    <span>→</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t">
                <button onClick={() => setDecisionVoucher(null)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
