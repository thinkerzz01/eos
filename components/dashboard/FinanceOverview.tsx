'use client';

// Lightweight, dependency-free finance visual for the admin dashboard: a collection
// -rate donut + a bar comparison of the month's money figures. Pure SVG/CSS so there
// is no charting library to ship.
import React from 'react';

function fmtPkr(n: number): string {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

export function FinanceOverview({
  collected,
  outstanding,
  forecast30,
  paidToTeachers,
  refunds,
  feeCollectionPct,
}: {
  collected: number;
  outstanding: number;
  forecast30: number;
  paidToTeachers: number;
  refunds: number;
  feeCollectionPct: number;
}) {
  const net = collected - paidToTeachers - refunds;
  const bars = [
    { label: 'Collected', value: collected, color: '#12A150' },
    { label: 'Outstanding', value: outstanding, color: '#E5A50A' },
    { label: 'Forecast (30d)', value: forecast30, color: '#2E7BEE' },
    { label: 'Paid to teachers', value: paidToTeachers, color: '#8B5CF6' },
  ];
  const max = Math.max(1, ...bars.map((b) => b.value));

  // Donut geometry
  const R = 52;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, feeCollectionPct));
  const dash = (pct / 100) * C;

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">Finance at a glance</h3>
        <span className="text-xs font-bold text-slate-400">This month</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-6 items-center">
        {/* Collection-rate donut */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 140 140" className="w-[130px] h-[130px] -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#EEF0F5" strokeWidth="14" />
            <circle
              cx="70" cy="70" r={R} fill="none" stroke="#12A150" strokeWidth="14" strokeLinecap="round"
              strokeDasharray={`${dash} ${C - dash}`}
            />
            <text x="70" y="66" transform="rotate(90 70 70)" textAnchor="middle" className="fill-slate-900 dark:fill-white" style={{ fontSize: 26, fontWeight: 800 }}>{pct}%</text>
            <text x="70" y="86" transform="rotate(90 70 70)" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10, fontWeight: 700 }}>COLLECTED</text>
          </svg>
          <div className="text-xs font-bold text-slate-500 mt-1">Collection rate</div>
        </div>

        {/* Money bars */}
        <div className="space-y-3">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-600 dark:text-slate-300">{b.label}</span>
                <span className="font-mono text-slate-900 dark:text-white">{fmtPkr(b.value)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(b.value / max) * 100}%`, background: b.color }} />
              </div>
            </div>
          ))}

          <div className="flex justify-between items-center pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 text-xs font-extrabold">
            <span className="text-slate-500">Net this month (collected − payouts − refunds)</span>
            <span className={`font-mono ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPkr(net)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
