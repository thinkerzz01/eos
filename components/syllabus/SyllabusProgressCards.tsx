'use client';

// Shared read-only syllabus progress cards: a ring + bar per subject and
// expandable topics with covered/pending subtopics. Used by the student's own
// "My Syllabus" page and by the staff student-profile view. Presentational only.
import React, { useState } from 'react';
import type { MySubject } from '@/lib/data/studentSyllabus';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';

function Ring({ pct, size = 56 }: { pct: number; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100 dark:text-slate-800" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          className={pct >= 100 ? 'text-emerald-500' : 'text-[#5B47D6]'}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-medium text-slate-700 dark:text-slate-200">
        {pct}%
      </span>
    </div>
  );
}

function SubjectCard({ s }: { s: MySubject }) {
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});
  return (
    <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <Ring pct={s.pct} />
          <div className="min-w-0 flex-1">
            <div className="font-heading font-medium text-slate-900 dark:text-white text-lg truncate">{s.subjectName}</div>
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {s.program && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{s.program}</span>}
              <span>{s.covered} of {s.total} subtopics covered</span>
              {s.lastCoveredOn && <span className="text-slate-400">· last updated {s.lastCoveredOn}</span>}
            </div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-4">
          <div className={`h-full transition-all ${s.pct >= 100 ? 'bg-emerald-500' : 'bg-[#5B47D6]'}`} style={{ width: `${s.pct}%` }} />
        </div>
      </div>

      <div className="border-t border-[#EBEDF3] dark:border-slate-800 divide-y divide-[#F1F2F7] dark:divide-slate-800">
        {s.topics.map((t, ti) => {
          const key = `${s.subjectId}-${ti}`;
          const open = openTopics[key] ?? false;
          const done = t.total > 0 && t.covered >= t.total;
          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => setOpenTopics((o) => ({ ...o, [key]: !open }))}
                className="w-full flex items-center gap-2 px-4 sm:px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 flex-1 truncate">
                  {t.code && <span className="text-[#5B47D6] mr-1.5">{t.code}</span>}{t.name}
                </span>
                <span className={`text-[11px] shrink-0 ${done ? 'text-emerald-600' : 'text-slate-500'}`}>{t.covered}/{t.total}</span>
                <span className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 hidden sm:block">
                  <span className={`block h-full ${done ? 'bg-emerald-500' : 'bg-[#5B47D6]'}`} style={{ width: `${t.total ? (t.covered / t.total) * 100 : 0}%` }} />
                </span>
              </button>
              {open && (
                <div className="pb-2">
                  {t.items.map((it, ii) => (
                    <div key={ii} className="flex items-start gap-2.5 px-4 sm:px-5 py-1.5 pl-11">
                      <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${it.covered ? 'bg-emerald-500' : 'border border-slate-300 dark:border-slate-600'}`}>
                        {it.covered && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm ${it.covered ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                          {it.code && <span className="text-[#5B47D6] font-medium mr-1.5">{it.code}</span>}{it.name}
                        </span>
                        {it.covered && it.coveredOn && <span className="block text-[11px] text-emerald-600 mt-0.5">Covered {it.coveredOn}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SyllabusProgressCards({ subjects }: { subjects: MySubject[] }) {
  return (
    <div className="space-y-4">
      {subjects.map((s) => <SubjectCard key={s.subjectId} s={s} />)}
    </div>
  );
}
