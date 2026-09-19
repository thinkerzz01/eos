'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { FinanceSummary } from '@/lib/data/finance';
import { addExpense, deleteExpense, EXPENSE_CATEGORIES } from './actions';
import { TrendingUp, TrendingDown, Plus, X, Trash2, Wallet, Receipt, Users } from 'lucide-react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function periodLabelOf(yyyymm: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyymm);
  if (!m) return yyyymm;
  return `${MONTH_NAMES[Math.min(11, Math.max(0, Number(m[2]) - 1))]} ${m[1]}`;
}
function monthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [{ value: 'all', label: 'All months' }];
  const n = new Date();
  let y = n.getUTCFullYear();
  let mo = n.getUTCMonth();
  for (let i = 0; i < 15; i++) {
    out.push({ value: `${y}-${String(mo + 1).padStart(2, '0')}`, label: `${MONTH_NAMES[mo]} ${y}` });
    mo -= 1;
    if (mo < 0) { mo = 11; y -= 1; }
  }
  return out;
}
const pkr = (n: number) => `${n < 0 ? '-' : ''}PKR ${Math.abs(Math.round(n)).toLocaleString()}`;
const fmtDate = (ymd?: string) => {
  if (!ymd) return '';
  const d = new Date(`${ymd}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const todayPKT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

const selCls = 'h-[38px] px-3 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200';
const inputCls = 'w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-sm font-medium text-slate-900 dark:text-slate-100';

export function FinanceClient({ summary, selectedPeriod }: { summary: FinanceSummary; selectedPeriod: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const isAll = selectedPeriod === 'all';
  const PERIOD = isAll ? 'All months' : periodLabelOf(selectedPeriod);
  const months = monthOptions();

  const [showAdd, setShowAdd] = useState(false);
  const [exCat, setExCat] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [exAmount, setExAmount] = useState('');
  const [exDate, setExDate] = useState(todayPKT());
  const [exNote, setExNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [exError, setExError] = useState<string | null>(null);

  const saveExpense = async () => {
    setExError(null);
    const amt = parseFloat(exAmount);
    if (Number.isNaN(amt) || amt <= 0) { setExError('Enter a valid amount.'); return; }
    setSaving(true);
    const res = await addExpense({ category: exCat, amount: amt, spentOn: exDate, note: exNote });
    setSaving(false);
    if (res.ok) {
      setShowAdd(false); setExAmount(''); setExNote(''); setExCat(EXPENSE_CATEGORIES[0]); setExDate(todayPKT());
      router.refresh();
      showToast('Expense recorded.', 'success');
    } else setExError(res.error ?? 'Failed to record expense.');
  };

  const removeExpense = async (id: string) => {
    if (!(await confirm({ title: 'Delete this expense?', message: 'It will be removed from the finance totals.', confirmLabel: 'Delete', danger: true }))) return;
    const res = await deleteExpense(id);
    if (res.ok) router.refresh();
    else showToast(res.error ?? 'Failed to delete.', 'error');
  };

  const profit = summary.profit.accrualProfit;
  const profitPositive = profit >= 0;

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white">Revenue &amp; Profit</h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Income (student fees) minus teacher salaries and other expenses, for {PERIOD}. Accrual = earned/owed; Cash = what actually moved.
            </p>
          </div>
          <select value={selectedPeriod} onChange={(e) => router.push(`/finance?period=${e.target.value}`)} className={selCls}>
            {months.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
        </div>

        {/* PROFIT BANNER */}
        <div className={`rounded-[18px] border p-5 shadow-sm ${profitPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                {profitPositive ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-rose-600" />}
                Profit ({PERIOD})
              </div>
              <div className={`mt-1 text-3xl font-heading font-medium ${profitPositive ? 'text-emerald-700' : 'text-rose-700'}`}>{pkr(profit)}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Fees billed {pkr(summary.income.billed)} - salaries earned {pkr(summary.salaries.earned)} - expenses {pkr(summary.expenses.total)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-slate-500">Net cash in hand</div>
              <div className="text-xl font-heading font-medium text-slate-800 mt-0.5">{pkr(summary.profit.netCash)}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">received {pkr(summary.income.received)} - paid out {pkr(summary.salaries.paid + summary.expenses.total)}</div>
            </div>
          </div>
        </div>

        {/* P&L: ACCRUAL vs CASH */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm">
            <h3 className="font-heading font-medium text-slate-900 dark:text-white text-sm mb-3">Accrual (earned &amp; owed)</h3>
            <PnlLine label="Income - fees billed" value={summary.income.billed} />
            <PnlLine label="Teacher salaries earned" value={-summary.salaries.earned} />
            <PnlLine label="Margin after salaries" value={summary.profit.marginAfterSalaries} strong />
            <PnlLine label="Other expenses" value={-summary.expenses.total} />
            <div className="border-t mt-2 pt-2"><PnlLine label="Profit" value={summary.profit.accrualProfit} strong accent /></div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm">
            <h3 className="font-heading font-medium text-slate-900 dark:text-white text-sm mb-3">Cash (actually moved)</h3>
            <PnlLine label="Fees received" value={summary.income.received} />
            <PnlLine label="Salaries paid" value={-summary.salaries.paid} />
            <PnlLine label="Expenses paid" value={-summary.expenses.total} />
            <div className="border-t mt-2 pt-2"><PnlLine label="Net cash" value={summary.profit.netCash} strong accent /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2"><div className="text-slate-500">Fees still to collect</div><div className="font-mono font-medium text-amber-700 mt-0.5">{pkr(summary.income.outstanding)}</div></div>
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2"><div className="text-slate-500">Salaries still to pay</div><div className="font-mono font-medium text-rose-700 mt-0.5">{pkr(summary.salaries.owed)}</div></div>
            </div>
          </div>
        </div>

        {/* EXPENSES */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-heading font-medium text-slate-900 dark:text-white text-sm flex items-center gap-1.5"><Wallet className="w-4 h-4 text-[#5B47D6]" /> Expenses · {pkr(summary.expenses.total)}</h3>
            <button onClick={() => setShowAdd(true)} className="h-[34px] px-3 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium rounded-xl flex items-center gap-1.5 shadow-sm">
              <Plus className="w-4 h-4" /> Add expense
            </button>
          </div>
          {summary.expenses.byCategory.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {summary.expenses.byCategory.map((c) => (
                <span key={c.category} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-medium rounded-full">{c.category}: {pkr(c.amount)}</span>
              ))}
            </div>
          )}
          {summary.expenses.rows.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium py-2">No expenses recorded for {PERIOD}. Add rent, ads, utilities and so on so the profit figure is real.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-slate-500 border-b"><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Category</th><th className="py-2 font-medium">Note</th><th className="py-2 font-medium text-right">Amount</th><th></th></tr></thead>
                <tbody>
                  {summary.expenses.rows.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 text-slate-600 dark:text-slate-300">{fmtDate(e.spentOn)}</td>
                      <td className="py-2 font-medium text-slate-800 dark:text-slate-100">{e.category}</td>
                      <td className="py-2 text-slate-500">{e.note}</td>
                      <td className="py-2 text-right font-mono font-medium text-slate-800 dark:text-slate-100">{pkr(e.amount)}</td>
                      <td className="py-2 text-right"><button onClick={() => removeExpense(e.id)} title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PER-STUDENT CONTRIBUTION */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm">
          <h3 className="font-heading font-medium text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-1.5"><Users className="w-4 h-4 text-[#5B47D6]" /> Per-student margin ({summary.studentCount} students)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500 border-b"><th className="py-2 font-medium">Student</th><th className="py-2 font-medium">Program</th><th className="py-2 font-medium text-right">Fee</th><th className="py-2 font-medium text-right">Teacher cost</th><th className="py-2 font-medium text-right">Margin</th></tr></thead>
              <tbody>
                {summary.students.map((s) => (
                  <tr key={s.studentId} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 font-medium text-slate-800 dark:text-slate-100">{s.studentName}</td>
                    <td className="py-2 text-slate-500">{s.program}</td>
                    <td className="py-2 text-right font-mono text-slate-700 dark:text-slate-200">{pkr(s.fee)}</td>
                    <td className="py-2 text-right font-mono text-rose-600">{pkr(s.teacherCost)}</td>
                    <td className={`py-2 text-right font-mono font-medium ${s.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pkr(s.margin)}</td>
                  </tr>
                ))}
                {summary.students.length === 0 && <tr><td colSpan={5} className="py-3 text-center text-slate-400">No enrollments in {PERIOD}.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* PER-TEACHER EARNED vs PAID */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm">
          <h3 className="font-heading font-medium text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-[#5B47D6]" /> Teacher pay - earned vs paid</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500 border-b"><th className="py-2 font-medium">Teacher</th><th className="py-2 font-medium text-right">Earned</th><th className="py-2 font-medium text-right">Paid</th><th className="py-2 font-medium text-right">Status</th></tr></thead>
              <tbody>
                {summary.teachers.map((t) => (
                  <tr key={t.teacherId} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 font-medium text-slate-800 dark:text-slate-100">{t.teacherName}</td>
                    <td className="py-2 text-right font-mono text-slate-700 dark:text-slate-200">{pkr(t.earned)}</td>
                    <td className="py-2 text-right font-mono text-slate-700 dark:text-slate-200">{pkr(t.paid)}</td>
                    <td className="py-2 text-right font-mono font-medium">
                      {t.variance > 0 ? <span className="text-amber-600">Overpaid {pkr(t.variance)}</span>
                        : t.variance < 0 ? <span className="text-rose-600">Owed {pkr(-t.variance)}</span>
                        : <span className="text-emerald-600">Settled</span>}
                    </td>
                  </tr>
                ))}
                {summary.teachers.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-slate-400">No teachers in {PERIOD}.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* ADD EXPENSE MODAL */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setShowAdd(false)}>
            <div className="bg-white dark:bg-slate-900 border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Add expense</h3>
                <button onClick={() => setShowAdd(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <div className="space-y-3 text-xs font-medium">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select value={exCat} onChange={(e) => setExCat(e.target.value)} className={inputCls}>
                    {EXPENSE_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Amount (PKR)</label>
                    <input type="number" value={exAmount} onChange={(e) => setExAmount(e.target.value)} placeholder="e.g. 40000" className={`${inputCls} font-mono`} />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Date</label>
                    <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Note (optional)</label>
                  <input type="text" value={exNote} onChange={(e) => setExNote(e.target.value)} placeholder="e.g. Office rent - September" className={inputCls} />
                </div>
                {exError && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2 rounded-xl">{exError}</div>}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
                <button onClick={saveExpense} disabled={saving} className="px-4 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">{saving ? 'Saving...' : 'Add expense'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}

function PnlLine({ label, value, strong, accent }: { label: string; value: number; strong?: boolean; accent?: boolean }) {
  const neg = value < 0;
  const color = accent ? (value >= 0 ? 'text-emerald-700' : 'text-rose-700') : neg ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100';
  return (
    <div className={`flex items-center justify-between py-1 ${strong ? 'font-medium' : ''}`}>
      <span className={`text-xs ${strong ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-sm font-mono ${color}`}>{value < 0 ? '-' : ''}PKR {Math.abs(Math.round(value)).toLocaleString()}</span>
    </div>
  );
}
