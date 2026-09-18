'use client';

// Phase 2 - the checklist a teacher uses to mark syllabus coverage while
// completing a class. Loads the student's frozen snapshot for the subject, groups
// it by topic, and lets the teacher tick subtopics covered in this session. Each
// tick saves immediately (stamped with the session), so nothing is lost if the
// teacher closes the drawer without hitting "Complete".
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { getSessionSyllabus, setSubtopicCoverage, type CoverageItem } from '@/app/schedule/syllabusCoverage';

export function SessionSyllabusPanel({
  studentId,
  subjectId,
  sessionId,
}: {
  studentId: string;
  subjectId: string;
  sessionId: string;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [items, setItems] = useState<CoverageItem[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getSessionSyllabus({ studentId, subjectId }).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (!res.ok) { showToast(res.error ?? 'Could not load syllabus.', 'error'); return; }
      setHasSnapshot(res.hasSnapshot);
      setItems(res.items);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, subjectId]);

  const groups = useMemo(() => {
    const map = new Map<string, { code: string | null; name: string | null; items: CoverageItem[] }>();
    for (const it of items) {
      const key = `${it.topicCode ?? ''}|${it.topicName ?? ''}`;
      if (!map.has(key)) map.set(key, { code: it.topicCode, name: it.topicName, items: [] });
      map.get(key)!.items.push(it);
    }
    return Array.from(map.values());
  }, [items]);

  const total = items.length;
  const covered = items.filter((i) => i.status === 'covered').length;
  const pct = total ? Math.round((covered / total) * 100) : 0;

  const toggle = async (item: CoverageItem) => {
    const nextCovered = item.status !== 'covered';
    // optimistic
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextCovered ? 'covered' : 'pending', coveredOn: nextCovered ? new Date().toISOString().slice(0, 10) : null } : i)));
    setSaving((s) => ({ ...s, [item.id]: true }));
    const res = await setSubtopicCoverage({ itemId: item.id, covered: nextCovered, sessionId });
    setSaving((s) => ({ ...s, [item.id]: false }));
    if (!res.ok) {
      // revert
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      showToast(res.error ?? 'Could not save.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading syllabus…
      </div>
    );
  }
  if (!hasSnapshot || total === 0) {
    return (
      <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 border border-[#EBEDF3] dark:border-slate-800 rounded-xl px-3 py-2.5">
        No syllabus outline is set up for this subject yet. An admin can build it in Syllabus, then generate the student snapshot.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="font-medium text-slate-900 dark:text-slate-100 uppercase text-xs flex items-center gap-1.5">
          <ListChecks className="w-4 h-4 text-[#5B47D6]" /> Syllabus covered this class
        </div>
        <span className="text-[11px] text-slate-500">{covered}/{total} · {pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="max-h-[38vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
        {groups.map((g, gi) => {
          const key = `${g.code ?? ''}|${gi}`;
          const gCovered = g.items.filter((i) => i.status === 'covered').length;
          const isOpen = openTopics[key] ?? true;
          return (
            <div key={key} className="border border-[#EBEDF3] dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenTopics((o) => ({ ...o, [key]: !isOpen }))}
                className="w-full flex items-center gap-1.5 px-2.5 py-2 bg-slate-50 dark:bg-slate-800/60 text-left"
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                <span className="text-xs font-medium text-slate-800 dark:text-slate-100 flex-1 truncate">
                  {g.code && <span className="text-[#5B47D6] mr-1">{g.code}</span>}{g.name}
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">{gCovered}/{g.items.length}</span>
              </button>
              {isOpen && (
                <div className="divide-y divide-[#F1F2F7] dark:divide-slate-800">
                  {g.items.map((it) => {
                    const isCovered = it.status === 'covered';
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => toggle(it)}
                        disabled={saving[it.id]}
                        className="w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-60"
                      >
                        <span className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border ${isCovered ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                          {saving[it.id] ? <Loader2 className="w-3 h-3 animate-spin text-slate-400" /> : isCovered ? <Check className="w-3 h-3 text-white" /> : null}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs text-slate-800 dark:text-slate-100">
                            {it.subtopicCode && <span className="text-[#5B47D6] font-medium mr-1">{it.subtopicCode}</span>}{it.subtopicName}
                          </span>
                          {isCovered && it.coveredOn && (
                            <span className="block text-[10px] text-emerald-600 mt-0.5">Covered {it.coveredOn}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
