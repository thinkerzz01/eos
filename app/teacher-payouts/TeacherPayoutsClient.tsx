'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatPKR } from '@/lib/format';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { useToast } from '@/components/ui/Toast';
import { recordTeacherPayout, setEnrollmentSalary } from './actions';
import type { SalarySheet, SalaryRow, TeacherRollup } from '@/lib/data/teacherSalaries';
import { Lock as LockIcon, X, Search, MessageSquare, Wallet, DollarSign } from 'lucide-react';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Badge } from '@/components/ui/Badge';

// wa.me digits (0300... -> 92300...)
function waDigits(phone: string): string {
  let d = (phone || '').replace(/\D/g, '');
  if (d.startsWith('92')) return d;
  if (d.startsWith('0')) return '92' + d.slice(1);
  if (d.startsWith('3')) return '92' + d;
  return d;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function periodLabelOf(yyyymm: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyymm);
  if (!m) return yyyymm;
  return `${MONTH_NAMES[Math.min(11, Math.max(0, Number(m[2]) - 1))]} ${m[1]}`;
}
function monthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [{ value: 'all', label: 'All months' }];
  const n = new Date();
  // Upcoming (next) month first, so advance salaries paid ahead show up there.
  let ny = n.getUTCFullYear();
  let nmo = n.getUTCMonth() + 1;
  if (nmo > 11) { nmo = 0; ny += 1; }
  out.push({ value: `${ny}-${String(nmo + 1).padStart(2, '0')}`, label: `Upcoming · ${MONTH_NAMES[nmo]} ${ny}` });
  // This month, then the trailing 14 months.
  let y = n.getUTCFullYear();
  let mo = n.getUTCMonth();
  for (let i = 0; i < 15; i++) {
    out.push({ value: `${y}-${String(mo + 1).padStart(2, '0')}`, label: `${MONTH_NAMES[mo]} ${y}` });
    mo -= 1;
    if (mo < 0) { mo = 11; y -= 1; }
  }
  return out;
}
const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
// 'YYYY-MM-DD' -> '06 Sep 2026' (falls back to the raw value).
const fmtDate = (ymd?: string) => {
  if (!ymd) return '';
  const d = new Date(ymd);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function TeacherPayoutsClient({ sheet, selectedPeriod }: { sheet: SalarySheet; selectedPeriod: string }) {
  const { role } = useRole();
  const { showToast } = useToast();
  const router = useRouter();
  const fmt = (n: number) => formatPKR(n);
  const PERIOD = selectedPeriod === 'all' ? 'All months' : periodLabelOf(selectedPeriod);
  const isAll = selectedPeriod === 'all';
  const months = monthOptions();

  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sheet.rows;
    return sheet.rows.filter((r) =>
      r.teacherName.toLowerCase().includes(q) ||
      r.studentName.toLowerCase().includes(q) ||
      r.subjectName.toLowerCase().includes(q)
    );
  }, [sheet.rows, search]);

  // SET / EDIT SALARY MODAL
  const [salaryRow, setSalaryRow] = useState<SalaryRow | null>(null);
  const [salInput, setSalInput] = useState('');
  const [salStart, setSalStart] = useState('');
  const [salSaving, setSalSaving] = useState(false);
  const [salError, setSalError] = useState<string | null>(null);
  const openSalary = (r: SalaryRow) => {
    setSalaryRow(r);
    setSalInput(r.monthlySalary > 0 ? String(r.monthlySalary) : '');
    // Auto-fill the first-paid month from the student's start month; admin may change it.
    setSalStart(r.salaryStartMonth ?? r.enrolledMonth);
    setSalError(null);
  };
  const saveSalary = async () => {
    if (!salaryRow) return;
    setSalError(null);
    const amt = parseFloat(salInput);
    if (Number.isNaN(amt) || amt < 0) { setSalError('Enter a valid monthly salary.'); return; }
    setSalSaving(true);
    const res = await setEnrollmentSalary({
      enrollmentId: salaryRow.enrollmentId,
      monthlySalary: amt,
      // Keep it dynamic (null) when left at the auto start month; store an explicit
      // override only when the admin picks a different first-paid month.
      salaryStartMonth: salStart && salStart !== salaryRow.enrolledMonth ? salStart : null,
    });
    setSalSaving(false);
    if (res.ok) { setSalaryRow(null); router.refresh(); showToast('Salary saved.', 'success'); }
    else setSalError(res.error ?? 'Failed to save the salary.');
  };

  // PAY TEACHER MODAL
  const [payTeacher, setPayTeacher] = useState<TeacherRollup | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState('');
  const [paying, setPaying] = useState(false);
  const todayPKT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const openPay = (t: TeacherRollup) => {
    if (isAll) { showToast('Pick a specific month to record a payout.', 'error'); return; }
    setPayTeacher(t);
    setPayAmount(t.balance > 0 ? String(t.balance) : (t.earned > 0 ? String(t.earned) : ''));
    setPayMethod('Bank Transfer');
    setPayRef('');
    setPayDate(todayPKT()); // default to today; admin can change
  };
  const submitPay = async () => {
    if (!payTeacher) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) { showToast('Enter a valid payout amount.', 'error'); return; }
    setPaying(true);
    const res = await recordTeacherPayout({ teacherId: payTeacher.teacherId, amount: amt, method: payMethod, reference: payRef, period: PERIOD, paidAt: payDate || undefined });
    setPaying(false);
    if (res.ok) { showToast(`Payout recorded for ${payTeacher.teacherName}.`, 'success'); setPayTeacher(null); router.refresh(); }
    else showToast(res.error ?? 'Could not record the payout.', 'error');
  };

  const sendReceiptWa = (t: TeacherRollup) => {
    const text = [
      `*Thinkerzz - Teacher Salary*`, ``,
      `Teacher: ${t.teacherName}`,
      `Period: ${PERIOD}`,
      `Earned: ${pkr(t.earned)}`,
      `Paid: ${pkr(t.paid)}`,
      t.balance > 0 ? `Balance: ${pkr(t.balance)}` : `Status: Paid in full`,
      ``, `Thank you for your work!`,
    ].join('\n');
    window.open(`https://wa.me/${waDigits(t.teacherPhone ?? '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (role === 'manager') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
        <div className="p-8 max-w-lg mx-auto text-center bg-white border border-rose-200 rounded-3xl shadow-xl space-y-4 my-12">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto"><LockIcon className="w-7 h-7" /></div>
          <h2 className="font-heading font-medium text-xl text-slate-900">Access restricted</h2>
          <p className="text-xs text-[#6B7185] leading-relaxed">Teacher salaries, payouts and revenue are visible to the Admin only.</p>
        </div>
      </PortalLayout>
    );
  }

  const t = sheet.totals;
  const boxCls = 'bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs';
  const selCls = 'bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-[13px]';

  const sumSalary = rows.reduce((s, r) => s + r.monthlySalary, 0);
  const sumComm = rows.reduce((s, r) => s + r.commission, 0);
  const sumPay = rows.reduce((s, r) => s + r.teacherPay, 0);

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-sm">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white">Teacher Salaries &amp; Revenue</h1>
            <p className="text-[13px] text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Payroll for {PERIOD}. Each teacher earns a fixed monthly salary per student/subject (25% first-month commission). The cards show real cash: fees collected vs salaries paid this month.
            </p>
          </div>
          <div className={boxCls}>
            <span className="text-[11px] text-[#6B7185] block font-medium">Month</span>
            <select value={selectedPeriod} onChange={(e) => router.push(`/teacher-payouts?period=${e.target.value}`)} className={selCls}>
              {months.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </div>
        </div>

        {/* KPI CARDS - real cash for the month (in bank vs paid out) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Fees Received', value: fmt(t.feesReceived), sub: `Collected in ${PERIOD}`, color: 'text-emerald-600' },
            { label: 'Fees Outstanding', value: fmt(t.feesOutstanding), sub: `of ${fmt(t.feesBilled)} billed`, color: 'text-amber-600' },
            { label: 'Salaries Paid', value: fmt(t.salariesPaid), sub: t.salaryOutstanding > 0 ? `${fmt(t.salaryOutstanding)} still owed` : 'All teachers paid', color: 'text-purple-600' },
            { label: 'Net This Month', value: fmt(t.netThisMonth), sub: 'Received − salaries paid', color: t.netThisMonth >= 0 ? 'text-emerald-600' : 'text-rose-600' },
          ].map((c) => (
            <div key={c.label} className="bg-white dark:bg-slate-900 border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase">{c.label}</div>
              <div className={`font-heading font-medium text-2xl ${c.color}`}>{c.value}</div>
              <div className="text-xs text-slate-500 font-medium">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* SEARCH */}
        <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 p-3 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px]">
          <div className="relative w-full sm:w-[300px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teacher, student or subject..." className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-[13px] font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]" />
          </div>
          <div className="text-[12px] text-slate-400 font-medium">One row per student/subject. Set a monthly salary on each.</div>
        </div>

        {/* SALARY SHEET (per enrollment) */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-white">Salary Sheet · {PERIOD}</div>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left text-sm border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 text-[13px]">
                  <th className="py-3 px-3">Teacher</th>
                  <th className="py-3 px-3">Student / Subject</th>
                  <th className="py-3 px-3">Period</th>
                  <th className="py-3 px-3 text-right">Salary</th>
                  <th className="py-3 px-3 text-right">Commission</th>
                  <th className="py-3 px-3 text-right">Pay</th>
                  <th className="py-3 px-3 text-center">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400 font-medium">{sheet.rows.length === 0 ? 'No enrollments this month. Assign students to teachers first.' : 'No rows match your search.'}</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.enrollmentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{r.teacherName}</div>
                      {r.isMonth1 && <span className="inline-block mt-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Month 1 · 25%</span>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{r.studentName}</div>
                      {r.subjectName && <div className="text-xs text-[#6B7185]">{r.subjectName}</div>}
                    </td>
                    <td className="py-3 px-3 text-[12px] text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.periodLabel}</td>
                    <td className="py-3 px-3 text-right font-mono">
                      {r.hasSalary ? pkr(r.monthlySalary) : (
                        <button onClick={() => openSalary(r)} className="text-[#5B47D6] font-sans font-medium hover:underline cursor-pointer">Set salary</button>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-600">{r.commission > 0 ? pkr(r.commission) : ''}</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">{pkr(r.teacherPay)}</td>
                    <td className="py-3 px-3 text-center">
                      <button onClick={() => openSalary(r)} className="px-2.5 py-1 border border-[#EBEDF3] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-[12px] rounded-lg cursor-pointer inline-flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-[#5B47D6]" /> {r.hasSalary ? 'Edit' : 'Set'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-t-2 border-[#EBEDF3] dark:border-slate-700 font-semibold text-[13px]">
                    <td className="py-3 px-3" colSpan={3}>Totals · {rows.length} row{rows.length === 1 ? '' : 's'}</td>
                    <td className="py-3 px-3 text-right font-mono">{pkr(sumSalary)}</td>
                    <td className="py-3 px-3 text-right font-mono text-amber-600">{pkr(sumComm)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-900 dark:text-white">{pkr(sumPay)}</td>
                    <td className="py-3 px-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* MOBILE CARD LIST (phones) */}
          <div className="md:hidden divide-y divide-[#F1F2F7] dark:divide-slate-800">
            {rows.length === 0 ? (
              <div className="py-10 text-center text-slate-400 font-medium text-sm">{sheet.rows.length === 0 ? 'No enrollments this month. Assign students to teachers first.' : 'No rows match your search.'}</div>
            ) : (
              rows.map((r) => (
                <div key={r.enrollmentId} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.teacherName}</div>
                      <div className="text-xs text-[#6B7185] truncate">{r.studentName}{r.subjectName ? ` · ${r.subjectName}` : ''}</div>
                    </div>
                    <div className="text-right font-mono font-semibold text-slate-900 dark:text-slate-100 shrink-0">{pkr(r.teacherPay)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="text-slate-700 dark:text-slate-200">{r.periodLabel}</span>
                    {r.isMonth1 && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Month 1 · 25%</span>}
                    <span className="text-[#6B7185]">Salary: {r.hasSalary ? pkr(r.monthlySalary) : '-'}</span>
                    {r.commission > 0 && <span className="text-amber-600 font-mono">Comm: {pkr(r.commission)}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button onClick={() => openSalary(r)} className="px-3 py-2 rounded-xl border border-[#EBEDF3] dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-[#5B47D6]" /> {r.hasSalary ? 'Edit salary' : 'Set salary'}</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PAY TEACHERS (per teacher rollup) */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#5B47D6]" /> Pay Teachers · {PERIOD}
          </div>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left text-sm border-collapse min-w-[840px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 text-[13px]">
                  <th className="py-3 px-3">Teacher</th>
                  <th className="py-3 px-3 text-center">Subjects</th>
                  <th className="py-3 px-3 text-right">Earned</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-3">Paid On</th>
                  <th className="py-3 px-3 text-right">Balance</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                {sheet.teachers.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400 font-medium">No teachers to pay this month.</td></tr>
                ) : sheet.teachers.map((tr) => (
                  <tr key={tr.teacherId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">{tr.teacherName}</td>
                    <td className="py-3 px-3 text-center text-purple-600">{tr.enrollments}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-900 dark:text-slate-100">{pkr(tr.earned)}</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-600">{pkr(tr.paid)}</td>
                    <td className="py-3 px-3 text-[12px] whitespace-nowrap">
                      {tr.payoutDate ? (
                        <>
                          <span className="text-slate-700 dark:text-slate-200">{fmtDate(tr.payoutDate)}</span>
                          {tr.paymentMethod && <span className="block text-[11px] text-slate-400">{tr.paymentMethod}</span>}
                        </>
                      ) : (
                        <span className="text-slate-400">Not paid</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-600">{pkr(tr.balance)}</td>
                    <td className="py-3 px-3"><Badge tone={tr.status === 'Paid' ? 'success' : tr.status === 'Partial' ? 'warning' : 'neutral'}>{tr.status}</Badge></td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {tr.status !== 'Paid' && (
                          <button onClick={() => openPay(tr)} className="px-2.5 py-1 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white font-medium text-[13px] rounded-lg cursor-pointer">Pay</button>
                        )}
                        <RowActionsMenu
                          actions={[
                            { label: tr.status === 'Paid' ? 'Pay Again' : 'Record Payout', icon: <Wallet className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => openPay(tr) },
                            { label: 'Send Receipt', icon: <MessageSquare className="w-3.5 h-3.5" />, tone: 'success', disabled: !tr.teacherPhone, onClick: () => sendReceiptWa(tr) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD LIST (phones) */}
          <div className="md:hidden divide-y divide-[#F1F2F7] dark:divide-slate-800">
            {sheet.teachers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-medium text-sm">No teachers to pay this month.</div>
            ) : (
              sheet.teachers.map((tr) => (
                <div key={tr.teacherId} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{tr.teacherName}</div>
                      <div className="text-xs text-[#6B7185] truncate">{tr.enrollments} subject{tr.enrollments === 1 ? '' : 's'}</div>
                    </div>
                    <Badge tone={tr.status === 'Paid' ? 'success' : tr.status === 'Partial' ? 'warning' : 'neutral'}>{tr.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="text-slate-700 dark:text-slate-200 font-mono">Earned: {pkr(tr.earned)}</span>
                    <span className="text-emerald-600 font-mono">Paid: {pkr(tr.paid)}</span>
                    {tr.balance > 0 && <span className="text-rose-600 font-mono">Balance: {pkr(tr.balance)}</span>}
                    {tr.payoutDate && <span className="text-[#6B7185]">{fmtDate(tr.payoutDate)}{tr.paymentMethod ? ` · ${tr.paymentMethod}` : ''}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {tr.status !== 'Paid' && (
                      <button onClick={() => openPay(tr)} className="px-3 py-2 rounded-xl bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium">Pay</button>
                    )}
                    <RowActionsMenu
                      actions={[
                        { label: tr.status === 'Paid' ? 'Pay Again' : 'Record Payout', icon: <Wallet className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => openPay(tr) },
                        { label: 'Send Receipt', icon: <MessageSquare className="w-3.5 h-3.5" />, tone: 'success', disabled: !tr.teacherPhone, onClick: () => sendReceiptWa(tr) },
                      ]}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SET / EDIT SALARY MODAL */}
      {salaryRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setSalaryRow(null)}>
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Monthly Salary</h3>
                <p className="text-xs text-[#6B7185]">{salaryRow.teacherName} · {salaryRow.studentName}{salaryRow.subjectName ? ` · ${salaryRow.subjectName}` : ''}</p>
              </div>
              <button onClick={() => setSalaryRow(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3 text-xs font-medium">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Monthly salary (PKR)</label>
                <input type="number" value={salInput} onChange={(e) => setSalInput(e.target.value)} placeholder="e.g. 15000" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 font-mono font-medium text-base text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">First paid month</label>
                <input type="month" value={salStart} onChange={(e) => setSalStart(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                <p className="text-[11px] text-slate-500 mt-1">Auto-filled from the student&apos;s start month. The 25% commission applies only in this first month; from next month the teacher gets the full salary. Change it only if the first paid month differs.</p>
              </div>
              {salError && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2 rounded-xl">{salError}</div>}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setSalaryRow(null)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
              <button onClick={saveSalary} disabled={salSaving} className="px-4 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">{salSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PAY TEACHER MODAL */}
      {payTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setPayTeacher(null)}>
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Pay {payTeacher.teacherName}</h3>
              <button onClick={() => setPayTeacher(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-[13px] font-medium grid grid-cols-2 gap-y-1">
              <span className="text-slate-500">Earned ({PERIOD})</span><span className="text-right font-mono">{pkr(payTeacher.earned)}</span>
              <span className="text-slate-500">Already paid</span><span className="text-right font-mono text-emerald-600">{pkr(payTeacher.paid)}</span>
              <span className="text-slate-500">Balance</span><span className="text-right font-mono text-rose-600">{pkr(payTeacher.balance)}</span>
            </div>
            <div className="space-y-3 text-xs font-medium">
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1">Payout Amount (PKR)</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="e.g. 30000" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 font-mono font-medium text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1">Payout Date</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                <p className="text-[11px] text-slate-500 mt-1">Defaults to today. Set the date you actually paid the teacher.</p>
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1">Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="JazzCash">JazzCash</option>
                </select>
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1">Reference (optional)</label>
                <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="e.g. transaction id" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setPayTeacher(null)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
              <button onClick={submitPay} disabled={paying} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">{paying ? 'Recording...' : 'Record Payout'}</button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
