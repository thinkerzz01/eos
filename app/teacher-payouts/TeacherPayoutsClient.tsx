'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatPKR } from '@/lib/format';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { useToast } from '@/components/ui/Toast';
import { recordTeacherPayout } from './actions';
import { setTeacherPayRate } from '@/app/teachers/actions';
import { Lock as LockIcon, X, Search, Eye, MessageSquare, Wallet, DollarSign } from 'lucide-react';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Badge } from '@/components/ui/Badge';

export interface TeacherPayout {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherPhone?: string;
  subjects: string[];
  perClassPay: number;
  completedClassesCount: number;
  grossAmount: number; // earned this month = perClassPay × completedClassesCount
  paidAmount: number; // already paid this month
  status: 'Pending' | 'Partial' | 'Paid';
  payoutDate?: string;
  paymentMethod: string;
  bankAccount: string;
}

// wa.me digits (0300... -> 92300...)
function waDigits(phone: string): string {
  let d = (phone || '').replace(/\D/g, '');
  if (d.startsWith('92')) return d;
  if (d.startsWith('0')) return '92' + d.slice(1);
  if (d.startsWith('3')) return '92' + d;
  return d;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// 'YYYY-MM' -> "August 2026"
function periodLabelOf(yyyymm: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyymm);
  if (!m) return yyyymm;
  return `${MONTH_NAMES[Math.min(11, Math.max(0, Number(m[2]) - 1))]} ${m[1]}`;
}
// Last 15 months (current first) as { value: 'YYYY-MM', label } options.
function recentMonths(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const n = new Date();
  let y = n.getUTCFullYear();
  let mo = n.getUTCMonth();
  for (let i = 0; i < 15; i++) {
    const value = `${y}-${String(mo + 1).padStart(2, '0')}`;
    out.push({ value, label: `${MONTH_NAMES[mo]} ${y}` });
    mo -= 1;
    if (mo < 0) { mo = 11; y -= 1; }
  }
  return out;
}

export function TeacherPayoutsClient({ initialPayouts, selectedPeriod }: { initialPayouts: TeacherPayout[]; selectedPeriod: string }) {
  const { role } = useRole();
  const { showToast } = useToast();
  const router = useRouter();
  const payouts = initialPayouts;
  const fmt = (n: number) => formatPKR(n);
  const PERIOD = periodLabelOf(selectedPeriod);
  const monthOptions = recentMonths();

  // FILTERS
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Statuses');

  const filtered = useMemo(() => {
    return payouts.filter((p) => {
      if (status !== 'All Statuses' && p.status !== status) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.teacherName.toLowerCase().includes(q) && !p.subjects.some((s) => s.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [payouts, status, search]);

  // PAY MODAL
  const [payTeacher, setPayTeacher] = useState<TeacherPayout | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  const openPay = (p: TeacherPayout) => {
    const remaining = Math.max(0, p.grossAmount - p.paidAmount);
    setPayTeacher(p);
    setPayAmount(remaining > 0 ? String(remaining) : (p.grossAmount > 0 ? String(p.grossAmount) : ''));
    setPayMethod('Bank Transfer');
    setPayRef('');
  };

  const submitPay = async () => {
    if (!payTeacher) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) { showToast('Enter a valid payout amount.', 'error'); return; }
    setPaying(true);
    const res = await recordTeacherPayout({ teacherId: payTeacher.teacherId, amount: amt, method: payMethod, reference: payRef });
    setPaying(false);
    if (res.ok) {
      showToast(`Payout recorded for ${payTeacher.teacherName}.`, 'success');
      setPayTeacher(null);
      router.refresh();
    } else {
      showToast(res.error ?? 'Could not record the payout.', 'error');
    }
  };

  // VIEW + SEND RECEIPT
  const [viewPayout, setViewPayout] = useState<TeacherPayout | null>(null);

  // SET PER-CLASS RATE
  const [rateTeacher, setRateTeacher] = useState<TeacherPayout | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [rateSaving, setRateSaving] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const openSetRate = (p: TeacherPayout) => {
    setRateTeacher(p); setRateInput(p.perClassPay > 0 ? String(p.perClassPay) : ''); setRateError(null);
  };
  const handleSetRate = async () => {
    if (!rateTeacher) return;
    setRateError(null);
    const rate = parseFloat(rateInput);
    if (Number.isNaN(rate) || rate <= 0) { setRateError('Enter a valid per-class rate.'); return; }
    setRateSaving(true);
    const res = await setTeacherPayRate({ teacherId: rateTeacher.teacherId, ratePerClass: rate });
    setRateSaving(false);
    if (res.ok) { setRateTeacher(null); router.refresh(); }
    else setRateError(res.error ?? 'Failed to set the rate.');
  };

  const sendReceiptWa = (p: TeacherPayout) => {
    const text = [
      `*Thinkerzz - Teacher Payout*`,
      ``,
      `Teacher: ${p.teacherName}`,
      `Period: ${PERIOD}`,
      `Completed classes: ${p.completedClassesCount}`,
      `Rate: PKR ${p.perClassPay.toLocaleString()} / class`,
      `Earned: PKR ${p.grossAmount.toLocaleString()}`,
      `Paid: PKR ${p.paidAmount.toLocaleString()}`,
      ``,
      `Thank you for your work!`,
    ].join('\n');
    window.open(`https://wa.me/${waDigits(p.teacherPhone ?? '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // RLS DENIAL CHECK FOR MANAGERS
  if (role === 'manager') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
        <div className="p-8 max-w-lg mx-auto text-center bg-white border border-rose-200 rounded-3xl shadow-xl space-y-4 my-12">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto"><LockIcon className="w-7 h-7" /></div>
          <h2 className="font-heading font-medium text-xl text-slate-900">Access restricted</h2>
          <p className="text-xs text-[#6B7185] leading-relaxed">Teacher pay rates and payouts are visible to the Admin only. Please contact the academy owner if you need access.</p>
        </div>
      </PortalLayout>
    );
  }

  const totalEarned = filtered.reduce((s, p) => s + p.grossAmount, 0);
  const totalPaid = filtered.reduce((s, p) => s + p.paidAmount, 0);
  const totalDue = filtered.reduce((s, p) => s + Math.max(0, p.grossAmount - p.paidAmount), 0);
  const boxCls = 'bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs';
  const selCls = 'bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-[13px]';

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-sm">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Teacher Payouts</span>
            </h1>
            <p className="text-[13px] text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Payroll for {PERIOD}. Each teacher earns their per-class rate for every class completed this month. Record a payout and send the teacher a receipt.
            </p>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
            <div className="text-xs font-medium text-slate-500 uppercase">Earned This Month</div>
            <div className="font-heading font-medium text-2xl text-slate-900 dark:text-white">{fmt(totalEarned)}</div>
            <div className="text-xs text-slate-500 font-medium">{filtered.length} Faculty Member{filtered.length === 1 ? '' : 's'}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
            <div className="text-xs font-medium text-slate-500 uppercase">Balance Due</div>
            <div className="font-heading font-medium text-2xl text-purple-600">{fmt(totalDue)}</div>
            <div className="text-xs text-purple-600 font-medium">Awaiting Payout</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
            <div className="text-xs font-medium text-slate-500 uppercase">Paid This Month</div>
            <div className="font-heading font-medium text-2xl text-emerald-600">{fmt(totalPaid)}</div>
            <div className="text-xs text-emerald-600 font-medium">Dispatched</div>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 p-3 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px]">
          <div className={boxCls}>
            <span className="text-[11px] text-[#6B7185] block font-medium">Month</span>
            <select
              value={selectedPeriod}
              onChange={(e) => router.push(`/teacher-payouts?period=${e.target.value}`)}
              className={selCls}
            >
              {monthOptions.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </div>
          <div className="relative w-full sm:w-[260px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teacher or subject..." className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-[13px] font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]" />
          </div>
          <div className={boxCls}>
            <span className="text-[11px] text-[#6B7185] block font-medium">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selCls}>
              <option>All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        </div>

        {/* PAYOUTS DATA TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                  <th className="py-3.5 px-3">Teacher & Subjects</th>
                  <th className="py-3.5 px-3">Per Class Rate</th>
                  <th className="py-3.5 px-3">Completed Classes</th>
                  <th className="py-3.5 px-3">Earned</th>
                  <th className="py-3.5 px-3">Paid</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">{payouts.length === 0 ? 'No active teachers yet. Add teachers on the Teachers tab.' : 'No teachers match these filters.'}</td></tr>
                ) : (
                  filtered.map((p) => {
                    const balance = Math.max(0, p.grossAmount - p.paidAmount);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{p.teacherName}</div>
                          <div className="text-xs text-[#6B7185]">{p.subjects.length ? p.subjects.join(' · ') : '-'}</div>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {p.perClassPay > 0 ? `PKR ${p.perClassPay.toLocaleString()}` : (
                            <button onClick={() => openSetRate(p)} className="text-[#5B47D6] font-sans font-medium hover:underline cursor-pointer">Set rate →</button>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-purple-600">{p.completedClassesCount}</td>
                        <td className="py-3.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-100">PKR {p.grossAmount.toLocaleString()}</td>
                        <td className="py-3.5 px-3 font-mono font-semibold text-emerald-600">PKR {p.paidAmount.toLocaleString()}</td>
                        <td className="py-3.5 px-3">
                          <Badge tone={p.status === 'Paid' ? 'success' : p.status === 'Partial' ? 'warning' : 'neutral'}>{p.status}</Badge>
                          {balance > 0 && <div className="text-xs text-rose-600 font-semibold mt-1">Bal PKR {balance.toLocaleString()}</div>}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {p.status !== 'Paid' && (
                              <button onClick={() => openPay(p)} className="px-2.5 py-1 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white font-medium text-[13px] rounded-lg cursor-pointer">Pay</button>
                            )}
                            <RowActionsMenu
                              actions={[
                                { label: 'View Details', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setViewPayout(p) },
                                { label: p.perClassPay > 0 ? 'Update Rate' : 'Set Rate', icon: <DollarSign className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => openSetRate(p) },
                                { label: p.status === 'Paid' ? 'Pay Again' : 'Record Payout', icon: <Wallet className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => openPay(p) },
                                { label: 'Send Receipt', icon: <MessageSquare className="w-3.5 h-3.5" />, tone: 'success', disabled: !p.teacherPhone, onClick: () => sendReceiptWa(p) },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 border-t text-[13px] font-medium text-slate-600">Showing {filtered.length} of {payouts.length} teachers · {PERIOD}</div>
        </div>

      </div>

      {/* PAY TEACHER MODAL */}
      {payTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setPayTeacher(null)}>
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Pay {payTeacher.teacherName}</h3>
              <button onClick={() => setPayTeacher(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-[13px] font-medium grid grid-cols-2 gap-y-1">
              <span className="text-slate-500">Completed classes</span><span className="text-right">{payTeacher.completedClassesCount}</span>
              <span className="text-slate-500">Earned</span><span className="text-right font-mono">PKR {payTeacher.grossAmount.toLocaleString()}</span>
              <span className="text-slate-500">Already paid</span><span className="text-right font-mono text-emerald-600">PKR {payTeacher.paidAmount.toLocaleString()}</span>
              <span className="text-slate-500">Balance</span><span className="text-right font-mono text-rose-600">PKR {Math.max(0, payTeacher.grossAmount - payTeacher.paidAmount).toLocaleString()}</span>
            </div>
            <div className="space-y-3 text-xs font-medium">
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1">Payout Amount (PKR)</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="e.g. 30000" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 font-mono font-medium text-slate-900 dark:text-slate-100" />
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

      {/* VIEW DETAILS MODAL */}
      {viewPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setViewPayout(null)}>
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">{viewPayout.teacherName}</h3>
                <p className="text-xs text-[#6B7185]">Payout details · {PERIOD}</p>
              </div>
              <button onClick={() => setViewPayout(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              {[
                ['Subjects', viewPayout.subjects.length ? viewPayout.subjects.join(', ') : '-'],
                ['Per class rate', `PKR ${viewPayout.perClassPay.toLocaleString()}`],
                ['Completed classes', String(viewPayout.completedClassesCount)],
                ['Earned', `PKR ${viewPayout.grossAmount.toLocaleString()}`],
                ['Paid', `PKR ${viewPayout.paidAmount.toLocaleString()}`],
                ['Balance', `PKR ${Math.max(0, viewPayout.grossAmount - viewPayout.paidAmount).toLocaleString()}`],
                ['Status', viewPayout.status],
                ['Last payout', viewPayout.payoutDate ? `${viewPayout.payoutDate}${viewPayout.paymentMethod ? ` · ${viewPayout.paymentMethod}` : ''}` : 'None yet'],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[#6B7185]">{k}</div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 break-words">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => sendReceiptWa(viewPayout)} disabled={!viewPayout.teacherPhone} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-medium text-xs flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Send Receipt</button>
              {viewPayout.status !== 'Paid' && (
                <button onClick={() => { const p = viewPayout; setViewPayout(null); openPay(p); }} className="px-4 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl font-medium text-xs">Record Payout</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SET PER-CLASS RATE MODAL */}
      {rateTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setRateTeacher(null)}>
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Set Per-Class Rate</h3>
                <p className="text-xs text-[#6B7185]">{rateTeacher.teacherName} · earns this per completed class</p>
              </div>
              <button onClick={() => setRateTeacher(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div>
              <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Rate per class (PKR)</label>
              <input type="number" value={rateInput} onChange={(e) => setRateInput(e.target.value)} placeholder="e.g. 1500" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 font-mono font-medium text-base text-slate-900 dark:text-slate-100" />
              <p className="text-xs text-slate-500 font-medium mt-1">A new rate row is saved (history is preserved). Earned = rate × completed classes.</p>
              {rateError && <div className="mt-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-2 rounded-xl">{rateError}</div>}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setRateTeacher(null)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
              <button onClick={handleSetRate} disabled={rateSaving} className="px-4 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">{rateSaving ? 'Saving...' : 'Save Rate'}</button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
