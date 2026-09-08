'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import type { MarketingData, SourceStat } from '@/lib/data/marketing';
import { recordAdSpend, AD_CHANNELS } from './actions';
import { Button } from '@/components/ui/Button';
import { TrendingUp, RotateCcw, DollarSign, X, Phone, MessageSquare } from 'lucide-react';

// Normalise a stored phone to wa.me digits (Pakistan country code, no plus).
function waNumber(phone?: string): string {
  const d = (phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('92')) return d;
  if (d.startsWith('0')) return '92' + d.slice(1);
  if (d.length === 10) return '92' + d;
  return d;
}

// Short PKT date, e.g. "11 Aug".
function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' });
}

// Client-safe copies of the source order/labels. Defined here (not imported from
// lib/data/marketing) so this client component never pulls in the server-only
// supabase/next-headers module.
const MARKETING_SOURCE_ORDER = ['google', 'facebook', 'instagram', 'whatsapp', 'referral', 'walk_in'];
const MARKETING_SOURCE_LABEL: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  walk_in: 'Walk-in',
};

const MARKETING_CHANNEL_LABEL: Record<string, string> = {
  google: 'Google', facebook: 'Facebook', instagram: 'Instagram',
  whatsapp: 'WhatsApp', referral: 'Referral', walk_in: 'Walk-in',
};

export function MarketingClient({ data }: { data: MarketingData }) {
  const router = useRouter();
  // FILTERS
  const [range, setRange] = useState<'all' | '7' | '30' | 'custom'>('all');

  // AD SPEND ENTRY
  const monthStart = new Date().toISOString().slice(0, 8) + '01';
  const [showSpend, setShowSpend] = useState(false);
  const [spChannel, setSpChannel] = useState<string>('google');
  const [spAmount, setSpAmount] = useState('');
  const [spMonth, setSpMonth] = useState(monthStart);
  const [spSaving, setSpSaving] = useState(false);
  const [spError, setSpError] = useState<string | null>(null);

  const handleRecordSpend = async () => {
    setSpError(null);
    setSpSaving(true);
    const res = await recordAdSpend({ channel: spChannel, amount: spAmount, period: spMonth });
    setSpSaving(false);
    if (res.ok) {
      setShowSpend(false); setSpAmount(''); setSpError(null);
      router.refresh();
    } else {
      setSpError(res.error ?? 'Failed to record ad spend.');
    }
  };
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [conv, setConv] = useState<'all' | 'converted' | 'not'>('all');

  const spendByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data.spend) m.set(s.key, s.amount);
    return m;
  }, [data.spend]);

  // Date-range predicate (PKT day boundaries kept simple via ISO compare).
  const inRange = (iso: string): boolean => {
    if (!iso) return range === 'all';
    const t = new Date(iso).getTime();
    const now = Date.now();
    if (range === '7') return t >= now - 7 * 864e5;
    if (range === '30') return t >= now - 30 * 864e5;
    if (range === 'custom') {
      if (fromDate && t < new Date(`${fromDate}T00:00:00`).getTime()) return false;
      if (toDate && t > new Date(`${toDate}T23:59:59`).getTime()) return false;
      return true;
    }
    return true; // all
  };

  const filteredLeads = useMemo(
    () =>
      data.leads.filter((l) => {
        if (!inRange(l.createdISO)) return false;
        if (conv === 'converted' && l.status !== 'won') return false;
        if (conv === 'not' && l.status === 'won') return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.leads, range, fromDate, toDate, conv]
  );

  const stats: SourceStat[] = useMemo(() => {
    const byKey = new Map<string, { leads: number; won: number; lost: number }>();
    for (const l of filteredLeads) {
      const e = byKey.get(l.source) ?? { leads: 0, won: 0, lost: 0 };
      e.leads++;
      if (l.status === 'won') e.won++;
      if (l.status === 'lost') e.lost++;
      byKey.set(l.source, e);
    }
    return MARKETING_SOURCE_ORDER.filter((k) => sourceFilter === 'All Sources' || MARKETING_SOURCE_LABEL[k] === sourceFilter)
      .map((k) => {
        const c = byKey.get(k) ?? { leads: 0, won: 0, lost: 0 };
        const spend = spendByKey.get(k) ?? 0;
        return {
          key: k,
          source: MARKETING_SOURCE_LABEL[k] ?? k,
          leads: c.leads,
          won: c.won,
          lost: c.lost,
          conversionPct: c.leads > 0 ? Math.round((c.won / c.leads) * 100) : 0,
          spend,
          costPerStudent: spend > 0 && c.won > 0 ? Math.round(spend / c.won) : null,
        };
      });
  }, [filteredLeads, sourceFilter, spendByKey]);

  // The individual leads behind the numbers (respects every filter), so the
  // team can see WHO came from each source and contact them.
  const visibleLeads = useMemo(
    () => filteredLeads.filter((l) => sourceFilter === 'All Sources' || MARKETING_SOURCE_LABEL[l.source] === sourceFilter),
    [filteredLeads, sourceFilter]
  );

  const totalLeads = stats.reduce((s, r) => s + r.leads, 0);
  const totalWon = stats.reduce((s, r) => s + r.won, 0);
  const totalLost = stats.reduce((s, r) => s + (r.lost ?? 0), 0);
  const totalSpend = stats.reduce((s, r) => s + r.spend, 0);
  const overallConv = totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0;
  const maxSourceLeads = Math.max(1, ...stats.map((r) => r.leads));

  const reset = () => { setRange('all'); setFromDate(''); setToDate(''); setSourceFilter('All Sources'); setConv('all'); };

  const seg = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${active ? 'bg-[#5B47D6] text-white' : 'text-[#6B7185] hover:bg-slate-100'}`;

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-sm">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#5B47D6]" />
              <span>Marketing & Source Performance</span>
            </h1>
            <p className="text-[13px] text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Where leads come from and how they convert. Cost per student stays blank until ad spend is recorded.
            </p>
          </div>
          <Button variant="primary" onClick={() => { setShowSpend(true); setSpError(null); }} className="shrink-0">
            <DollarSign className="w-4 h-4" />
            <span>Record Ad Spend</span>
          </Button>
        </div>

        {/* AD SPEND MODAL */}
        {showSpend && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 my-6">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-medium text-lg text-slate-900 dark:text-white">Record Ad Spend</h3>
                <button onClick={() => setShowSpend(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <p className="text-xs text-[#6B7185]">Adds to the channel&apos;s total spend so cost-per-student and ROI can be computed.</p>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Channel</label>
                  <select value={spChannel} onChange={(e) => setSpChannel(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]">
                    {AD_CHANNELS.map((c) => (<option key={c} value={c}>{MARKETING_CHANNEL_LABEL[c] ?? c}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Amount (PKR)</label>
                  <input type="number" value={spAmount} onChange={(e) => setSpAmount(e.target.value)} placeholder="e.g. 15000" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm px-3 py-2 rounded-xl font-mono focus:outline-none focus:border-[#5B47D6]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Month</label>
                  <input type="date" value={spMonth} onChange={(e) => setSpMonth(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                </div>
                {spError && <p className="text-xs font-medium text-rose-600">{spError}</p>}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowSpend(false)} className="px-4 py-2 border rounded-xl font-medium text-xs text-slate-600 dark:text-slate-300">Cancel</button>
                <button onClick={handleRecordSpend} disabled={spSaving} className="px-5 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-medium rounded-xl shadow-sm">
                  {spSaving ? 'Saving…' : 'Record Spend'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FILTER BAR */}
        <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 p-3 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px]">
          <div className="inline-flex rounded-lg bg-[#F2F3F8] dark:bg-slate-800 p-[3px]">
            <button className={seg(range === 'all')} onClick={() => setRange('all')}>All Time</button>
            <button className={seg(range === '7')} onClick={() => setRange('7')}>Last 7 Days</button>
            <button className={seg(range === '30')} onClick={() => setRange('30')}>Last 30 Days</button>
            <button className={seg(range === 'custom')} onClick={() => setRange('custom')}>Custom</button>
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-1.5 text-[13px]">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 font-medium" />
              <span className="text-[#6B7185]">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 font-medium" />
            </div>
          )}

          <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-3 py-1.5">
            <span className="text-[11px] text-[#6B7185] block font-medium">Source</span>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-[13px]">
              <option>All Sources</option>
              {MARKETING_SOURCE_ORDER.map((k) => (<option key={k} value={MARKETING_SOURCE_LABEL[k]}>{MARKETING_SOURCE_LABEL[k]}</option>))}
            </select>
          </div>

          <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-3 py-1.5">
            <span className="text-[11px] text-[#6B7185] block font-medium">Conversion</span>
            <select value={conv} onChange={(e) => setConv(e.target.value as any)} className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-[13px]">
              <option value="all">All Leads</option>
              <option value="converted">Converted Only</option>
              <option value="not">Not Converted</option>
            </select>
          </div>

          <button onClick={reset} className="ml-auto text-[13px] font-medium text-[#5B47D6] hover:underline flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-center font-medium">
          <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl space-y-1">
            <div className="text-slate-500 text-[13px]">Total Leads</div>
            <div className="font-heading font-medium text-2xl text-slate-900 dark:text-white">{totalLeads}</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl space-y-1">
            <div className="text-slate-500 text-[13px]">Converted (Won)</div>
            <div className="font-heading font-medium text-2xl text-emerald-600">{totalWon}</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl space-y-1">
            <div className="text-slate-500 text-[13px]">Lost</div>
            <div className="font-heading font-medium text-2xl text-rose-600">{totalLost}</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl space-y-1">
            <div className="text-slate-500 text-[13px]">Overall Conversion</div>
            <div className="font-heading font-medium text-2xl text-purple-600">{overallConv}%</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl space-y-1">
            <div className="text-slate-500 text-[13px]">Ad Spend</div>
            <div className="font-heading font-medium text-2xl text-slate-900 dark:text-white">{totalSpend > 0 ? `PKR ${totalSpend.toLocaleString()}` : '-'}</div>
          </div>
        </div>

        {/* SOURCE CHART — leads per source, split into Won / Pending / Lost.
            Pure CSS bars (no chart lib), recomputed live from the filters. */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-heading font-medium text-slate-900 dark:text-white text-[15px]">Leads by Source</h2>
            <div className="flex items-center gap-3 text-[11px] font-medium text-[#6B7185]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Won</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" /> Pending</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Lost</span>
            </div>
          </div>
          {totalLeads === 0 ? (
            <div className="py-8 text-center text-[13px] text-[#6B7185]">No leads match these filters.</div>
          ) : (
            <div className="space-y-2.5">
              {stats.map((r) => {
                const lost = r.lost ?? 0;
                const pending = Math.max(0, r.leads - r.won - lost);
                return (
                  <div key={r.key} className="flex items-center gap-3">
                    <div className="w-20 shrink-0 text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">{r.source}</div>
                    <div className="flex-1 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden" style={{ maxWidth: `${(r.leads / maxSourceLeads) * 100}%`, minWidth: r.leads > 0 ? '2rem' : '0' }}>
                      <div className="flex h-full w-full">
                        {r.won > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(r.won / r.leads) * 100}%` }} title={`Won: ${r.won}`} />}
                        {pending > 0 && <div className="h-full bg-slate-300 dark:bg-slate-600" style={{ width: `${(pending / r.leads) * 100}%` }} title={`Pending: ${pending}`} />}
                        {lost > 0 && <div className="h-full bg-rose-500" style={{ width: `${(lost / r.leads) * 100}%` }} title={`Lost: ${lost}`} />}
                      </div>
                    </div>
                    <div className="w-10 shrink-0 text-right text-[13px] font-medium text-slate-900 dark:text-slate-100 tabular-nums">{r.leads}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SOURCE TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                  <th className="py-3.5 px-3">Source</th>
                  <th className="py-3.5 px-3">Leads</th>
                  <th className="py-3.5 px-3">Converted</th>
                  <th className="py-3.5 px-3">Lost</th>
                  <th className="py-3.5 px-3">Conversion</th>
                  <th className="py-3.5 px-3">Ad Spend</th>
                  <th className="py-3.5 px-3">Cost / Student</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                {stats.length === 0 || totalLeads === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-[#6B7185]">No leads match these filters.</td></tr>
                ) : (
                  stats.map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">{r.source}</td>
                      <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">{r.leads}</td>
                      <td className="py-3.5 px-3 font-medium text-emerald-600">{r.won}</td>
                      <td className="py-3.5 px-3 font-medium text-rose-600">{r.lost ?? 0}</td>
                      <td className="py-3.5 px-3 font-medium text-purple-600">{r.conversionPct}%</td>
                      <td className="py-3.5 px-3 font-mono text-slate-900 dark:text-slate-100">{r.spend > 0 ? `PKR ${r.spend.toLocaleString()}` : '-'}</td>
                      <td className="py-3.5 px-3 font-mono text-slate-900 dark:text-slate-100">{r.costPerStudent != null ? `PKR ${r.costPerStudent.toLocaleString()}` : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* LEAD DETAIL TABLE — who the leads actually are, so they can be acted on */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EBEDF3] dark:border-slate-800 flex items-center justify-between gap-2">
            <h2 className="font-heading font-medium text-slate-900 dark:text-white text-[15px]">
              Leads ({visibleLeads.length})
            </h2>
            <p className="text-[12px] text-[#6B7185]">Name, city and contact for every lead in the current filter.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 text-[13px]">
                  <th className="py-3 px-3">Student</th>
                  <th className="py-3 px-3">City</th>
                  <th className="py-3 px-3">Area / Town</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Program</th>
                  <th className="py-3 px-3">Source</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                {visibleLeads.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-[#6B7185]">No leads match these filters.</td></tr>
                ) : (
                  visibleLeads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-900 dark:text-slate-100">{l.name || '-'}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{l.city || '-'}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{l.area || '-'}</td>
                      <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">{l.phone || '-'}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{l.program || '-'}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{MARKETING_SOURCE_LABEL[l.source] ?? l.source}</td>
                      <td className="py-3 px-3 text-slate-500">{fmtDate(l.createdISO)}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${l.status === 'won' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                          {l.status === 'won' ? 'Converted' : (l.status ? l.status.charAt(0).toUpperCase() + l.status.slice(1) : 'New')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {waNumber(l.phone) && (
                            <a href={`https://wa.me/${waNumber(l.phone)}`} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {l.phone && (
                            <a href={`tel:${l.phone.replace(/\s/g, '')}`} title="Call" className="p-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
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

      </div>
    </PortalLayout>
  );
}
