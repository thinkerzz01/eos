'use client';

// Syllabus Manager (admin/manager). Pick a subject, then build/edit its master
// outline: Topic (1) -> Subtopic (1.1) -> learning objectives. Reorder with the
// up/down arrows; edit one item at a time. Edits here never disturb students who
// already hold a snapshot of the outline (that is the point of the snapshot).
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import type { SyllabusSubjectRow, SubjectSyllabus } from '@/lib/data/syllabus';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { labelWithCode } from '@/lib/syllabiSeed';
import {
  getOutline, ensureTemplate, updateTemplate,
  addTopic, updateTopic, deleteTopic, moveTopic,
  addSubtopic, updateSubtopic, deleteSubtopic, moveSubtopic, generateSnapshots,
  bulkSetObjectives,
} from './actions';
import {
  ListChecks, Plus, Edit3, Trash2, Check, X, ChevronUp, ChevronDown, BookOpen, Search, RefreshCw,
  ClipboardPaste,
} from 'lucide-react';

// A subject is Complete when every subtopic carries at least one objective,
// Partial when it has an outline but objectives are still missing, Empty when no
// outline exists yet. This is the single source of truth for the review status.
type SubStatus = 'complete' | 'partial' | 'empty';
function subjectStatus(s: SyllabusSubjectRow): SubStatus {
  if (!s.hasOutline || s.subtopicCount === 0) return 'empty';
  return s.objectiveCount >= s.subtopicCount ? 'complete' : 'partial';
}
const STATUS_META: Record<SubStatus, { label: string; dot: string; text: string }> = {
  complete: { label: 'Complete', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  partial: { label: 'Needs objectives', dot: 'bg-amber-500', text: 'text-amber-600' },
  empty: { label: 'No outline', dot: 'bg-slate-300 dark:bg-slate-600', text: 'text-slate-500' },
};

// Core subjects float to the top of the picker (in this order); the rest follow
// alphabetically. Keeps the subjects the academy teaches most within easy reach.
const MAIN_SUBJECTS = [
  'Mathematics', 'Additional Mathematics', 'Further Mathematics', 'Statistics',
  'Physics', 'Chemistry', 'Biology', 'Combined Science',
  'Computer Science', 'Information Technology',
  'Accounting', 'Economics', 'Business', 'Business Studies',
  'English (First Language)', 'English (Second Language)', 'Literature in English',
];
const mainRank = (name: string) => {
  const i = MAIN_SUBJECTS.indexOf(name);
  return i === -1 ? MAIN_SUBJECTS.length : i;
};

type EditState =
  | { kind: 'topic'; id: string; code: string; name: string }
  | { kind: 'subtopic'; id: string; code: string; name: string; objectivesText: string }
  | null;

export function SyllabusClient({ initialSubjects }: { initialSubjects: SyllabusSubjectRow[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [query, setQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('All Programs');
  const [statusFilter, setStatusFilter] = useState<'all' | SubStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Bulk objectives paste modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState<'replace' | 'append'>('replace');
  const [outline, setOutline] = useState<SubjectSyllabus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<EditState>(null);
  const [addTopicCode, setAddTopicCode] = useState('');
  const [addTopicName, setAddTopicName] = useState('');
  const [addSubFor, setAddSubFor] = useState<string | null>(null);
  const [addSubCode, setAddSubCode] = useState('');
  const [addSubName, setAddSubName] = useState('');

  // template header edit
  const [hdrYears, setHdrYears] = useState('');
  const [hdrCode, setHdrCode] = useState('');
  const [createYears, setCreateYears] = useState('');

  const programs = useMemo(
    () => Array.from(new Set(initialSubjects.map((s) => s.program))).sort(),
    [initialSubjects]
  );
  const filtered = useMemo(() => {
    return initialSubjects
      .filter((s) => programFilter === 'All Programs' || s.program === programFilter)
      .filter((s) => statusFilter === 'all' || subjectStatus(s) === statusFilter)
      .filter((s) => !query.trim() || s.name.toLowerCase().includes(query.trim().toLowerCase()) || (s.code ?? '').includes(query.trim()))
      .slice()
      .sort((a, b) => {
        const ra = mainRank(a.name), rb = mainRank(b.name);
        if (ra !== rb) return ra - rb;              // main subjects first, in priority order
        if (a.program !== b.program) return a.program.localeCompare(b.program);
        return a.name.localeCompare(b.name);        // then alphabetical
      });
  }, [initialSubjects, programFilter, statusFilter, query]);

  // Completeness roll-up for the review overview - overall and per program.
  const overview = useMemo(() => {
    const blank = () => ({ complete: 0, partial: 0, empty: 0, total: 0 });
    const overall = blank();
    const perProgram = new Map<string, ReturnType<typeof blank>>();
    for (const s of initialSubjects) {
      const st = subjectStatus(s);
      overall[st]++; overall.total++;
      const p = perProgram.get(s.program) ?? blank();
      p[st]++; p.total++;
      perProgram.set(s.program, p);
    }
    return { overall, perProgram: Array.from(perProgram.entries()).sort((a, b) => a[0].localeCompare(b[0])) };
  }, [initialSubjects]);

  const selectedSubject = initialSubjects.find((s) => s.id === selectedId) ?? null;

  async function reloadOutline(subjectId: string) {
    setLoading(true);
    const res = await getOutline(subjectId);
    setLoading(false);
    if (res.ok && res.outline) {
      setOutline(res.outline);
      setHdrYears(res.outline.template?.examYears ?? '');
      setHdrCode(res.outline.template?.code ?? '');
    } else {
      setOutline(null);
      if (res.error) showToast(res.error, 'error');
    }
  }

  const selectSubject = (s: SyllabusSubjectRow) => {
    setSelectedId(s.id);
    setEditing(null);
    setAddSubFor(null);
    setCreateYears('');
    reloadOutline(s.id);
  };

  const afterMutation = async () => {
    if (selectedId) await reloadOutline(selectedId);
    router.refresh(); // keep the subject picker counts in sync
  };

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      if (okMsg) showToast(okMsg, 'success');
      await afterMutation();
      return true;
    }
    showToast(res.error ?? 'Something went wrong.', 'error');
    return false;
  };

  const handleGenerateSnapshots = async () => {
    setBusy(true);
    const res = await generateSnapshots();
    setBusy(false);
    if (res.ok) {
      showToast(`Created ${res.created ?? 0} snapshot${res.created === 1 ? '' : 's'} across ${res.scanned ?? 0} enrollment${res.scanned === 1 ? '' : 's'}.`, 'success');
      router.refresh();
    } else {
      showToast(res.error ?? 'Failed to generate snapshots.', 'error');
    }
  };

  const handleBulkObjectives = async () => {
    if (!selectedSubject) return;
    if (!bulkText.trim()) { showToast('Paste some objectives first.', 'error'); return; }
    setBusy(true);
    const res = await bulkSetObjectives({ subjectId: selectedSubject.id, text: bulkText, mode: bulkMode });
    setBusy(false);
    if (!res.ok) { showToast(res.error ?? 'Failed to apply.', 'error'); return; }
    const un = res.unmatched ?? [];
    showToast(
      `Filled ${res.updated ?? 0} subtopic${res.updated === 1 ? '' : 's'}` + (un.length ? ` · ${un.length} code${un.length === 1 ? '' : 's'} not found` : ''),
      un.length ? 'info' : 'success'
    );
    setBulkOpen(false);
    setBulkText('');
    await afterMutation();
  };

  // ---- template ----
  const handleCreateOutline = async () => {
    if (!selectedSubject) return;
    await run(
      () => ensureTemplate({ subjectId: selectedSubject.id, examYears: createYears, code: selectedSubject.code ?? '' }),
      'Outline created.'
    );
  };
  const handleSaveHeader = async () => {
    if (!outline?.template) return;
    await run(() => updateTemplate({ id: outline.template!.id, examYears: hdrYears, code: hdrCode }), 'Saved.');
  };

  // ---- topics ----
  const handleAddTopic = async () => {
    if (!outline?.template) return;
    if (!addTopicName.trim()) { showToast('Enter a topic name.', 'error'); return; }
    const ok = await run(() => addTopic({ templateId: outline.template!.id, code: addTopicCode, name: addTopicName }));
    if (ok) { setAddTopicCode(''); setAddTopicName(''); }
  };
  const handleSaveTopic = async () => {
    if (editing?.kind !== 'topic') return;
    const ok = await run(() => updateTopic({ id: editing.id, code: editing.code, name: editing.name }));
    if (ok) setEditing(null);
  };
  const handleDeleteTopic = async (id: string, name: string) => {
    if (!(await confirm({ title: `Delete topic "${name}"?`, message: 'Its subtopics are removed too. Students who already snapshotted this outline keep their copy.', confirmLabel: 'Delete', danger: true }))) return;
    await run(() => deleteTopic(id));
  };

  // ---- subtopics ----
  const handleAddSubtopic = async (topicId: string) => {
    if (!addSubName.trim()) { showToast('Enter a subtopic name.', 'error'); return; }
    const ok = await run(() => addSubtopic({ topicId, code: addSubCode, name: addSubName }));
    if (ok) { setAddSubCode(''); setAddSubName(''); setAddSubFor(null); }
  };
  const handleSaveSubtopic = async () => {
    if (editing?.kind !== 'subtopic') return;
    const objectives = editing.objectivesText.split('\n').map((s) => s.trim()).filter(Boolean);
    const ok = await run(() => updateSubtopic({ id: editing.id, code: editing.code, name: editing.name, objectives }));
    if (ok) setEditing(null);
  };
  const handleDeleteSubtopic = async (id: string, name: string) => {
    if (!(await confirm({ title: `Delete subtopic "${name}"?`, message: 'Students who already snapshotted this outline keep their copy.', confirmLabel: 'Delete', danger: true }))) return;
    await run(() => deleteSubtopic(id));
  };

  const inputCls = 'px-2.5 py-1.5 rounded-lg border border-[#E2E5EE] dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#5B47D6]/30';

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-[#5B47D6]" /> Syllabus
            </h1>
            <p className="text-sm text-[#6B7185]">
              Build the official outline for each subject - topics, subtopics and learning objectives. Teachers mark coverage against it; students see their progress. Editing an outline never changes a student who is already studying it.
            </p>
          </div>
          <button
            onClick={handleGenerateSnapshots}
            disabled={busy}
            title="Create syllabus copies for enrolled students who do not have one yet (only for subjects that already have an outline)."
            className="shrink-0 px-3 py-2 rounded-lg border border-[#E2E5EE] dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Generate student snapshots
          </button>
        </div>

        {/* REVIEW OVERVIEW - completeness at a glance before enabling teachers/students */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3">
            <div className="text-sm font-heading font-medium text-slate-900 dark:text-white">Completeness</div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {overview.overall.complete} complete</div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><span className="w-2 h-2 rounded-full bg-amber-500" /> {overview.overall.partial} need objectives</div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" /> {overview.overall.empty} no outline</div>
            <div className="text-xs text-slate-400 ml-auto">{overview.overall.total} subjects total</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-2.5">
            {overview.perProgram.map(([program, v]) => {
              const pct = (n: number) => (v.total ? (n / v.total) * 100 : 0);
              return (
                <button
                  key={program}
                  onClick={() => { setProgramFilter(program); setStatusFilter('all'); }}
                  className="text-left group"
                  title={`Filter to ${program}`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-[#5B47D6] truncate">{program}</span>
                    <span className="text-slate-400 shrink-0 ml-2">{v.complete + v.partial}/{v.total}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${pct(v.complete)}%` }} />
                    <div className="bg-amber-500 h-full" style={{ width: `${pct(v.partial)}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
          {/* SUBJECT PICKER */}
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm p-3 h-fit">
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subject" className={`${inputCls} w-full pl-8`} />
            </div>
            <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className={`${inputCls} w-full mb-2`}>
              <option>All Programs</option>
              {programs.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={`${inputCls} w-full mb-2`}>
              <option value="all">All statuses</option>
              <option value="complete">Complete</option>
              <option value="partial">Needs objectives</option>
              <option value="empty">No outline</option>
            </select>
            <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-0.5">
              {filtered.length === 0 && <div className="text-sm text-slate-500 px-2 py-3">No subjects.</div>}
              {filtered.map((s) => {
                const active = s.id === selectedId;
                const st = subjectStatus(s);
                return (
                  <button
                    key={s.id}
                    onClick={() => selectSubject(s)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors ${active ? 'bg-[#5B47D6] text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                  >
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-white/80' : STATUS_META[st].dot}`} title={STATUS_META[st].label} />
                      <span className="truncate">{labelWithCode(s.name, s.code)}</span>
                    </div>
                    <div className={`text-[11px] ${active ? 'text-white/80' : 'text-slate-500'}`}>
                      {s.program}
                      {s.hasOutline
                        ? ` · ${s.topicCount}t, ${s.subtopicCount}s · ${s.objectiveCount}/${s.subtopicCount} obj`
                        : ' · No outline yet'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* OUTLINE EDITOR */}
          <div className="min-w-0">
            {!selectedSubject && (
              <div className="bg-white dark:bg-slate-900 border border-dashed border-[#D9DCE8] dark:border-slate-700 rounded-2xl p-10 text-center text-slate-500">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                Pick a subject on the left to view or build its syllabus.
              </div>
            )}

            {selectedSubject && loading && (
              <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl p-10 text-center text-slate-500">Loading outline...</div>
            )}

            {selectedSubject && !loading && outline && !outline.template && (
              <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm p-5">
                <h2 className="font-heading text-lg text-slate-900 dark:text-white mb-1">{labelWithCode(selectedSubject.name, selectedSubject.code)}</h2>
                <p className="text-sm text-slate-500 mb-4">No outline yet. Create one to start adding topics.</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Exam-year label (optional)</label>
                    <input value={createYears} onChange={(e) => setCreateYears(e.target.value)} placeholder="e.g. 2025-2027" className={inputCls} />
                  </div>
                  <button onClick={handleCreateOutline} disabled={busy} className="px-4 py-2 rounded-lg bg-[#5B47D6] text-white text-sm font-medium disabled:opacity-60 flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Create outline
                  </button>
                </div>
              </div>
            )}

            {selectedSubject && !loading && outline?.template && (
              <div className="space-y-4">
                {/* Template header */}
                <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <div className="font-heading text-lg text-slate-900 dark:text-white">{labelWithCode(selectedSubject.name, selectedSubject.code)}</div>
                      <div className="text-xs text-slate-500">{selectedSubject.program}</div>
                    </div>
                    <div className="ml-auto flex items-end gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Exam years</label>
                        <input value={hdrYears} onChange={(e) => setHdrYears(e.target.value)} placeholder="2025-2027" className={`${inputCls} w-32`} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Code</label>
                        <input value={hdrCode} onChange={(e) => setHdrCode(e.target.value)} placeholder="9702" className={`${inputCls} w-24`} />
                      </div>
                      <button onClick={handleSaveHeader} disabled={busy} className="px-3 py-2 rounded-lg border border-[#E2E5EE] dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">Save</button>
                      <button onClick={() => { setBulkOpen(true); setBulkText(''); setBulkMode('replace'); }} disabled={busy} className="px-3 py-2 rounded-lg border border-[#E2E5EE] dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1.5" title="Paste learning objectives for many subtopics at once">
                        <ClipboardPaste className="w-4 h-4" /> Bulk objectives
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const st = subjectStatus(selectedSubject);
                    const filled = selectedSubject.objectiveCount, total = selectedSubject.subtopicCount;
                    return (
                      <div className={`mt-3 flex items-center gap-1.5 text-xs ${STATUS_META[st].text}`}>
                        <span className={`w-2 h-2 rounded-full ${STATUS_META[st].dot}`} />
                        {STATUS_META[st].label}
                        {total > 0 && <span className="text-slate-400">· objectives on {filled}/{total} subtopics</span>}
                      </div>
                    );
                  })()}
                </div>

                {/* Topics */}
                {outline.topics.length === 0 && (
                  <div className="text-sm text-slate-500 px-1">No topics yet. Add the first one below.</div>
                )}

                {outline.topics.map((t, ti) => (
                  <div key={t.id} className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    {/* Topic header */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-[#EBEDF3] dark:border-slate-800">
                      {editing?.kind === 'topic' && editing.id === t.id ? (
                        <>
                          <input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="1" className={`${inputCls} w-16`} />
                          <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={`${inputCls} flex-1`} />
                          <button onClick={handleSaveTopic} disabled={busy} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" title="Save"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditing(null)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Cancel"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <span className="font-heading font-medium text-slate-900 dark:text-white">
                            {t.code && <span className="text-[#5B47D6] mr-1.5">{t.code}</span>}{t.name}
                          </span>
                          <span className="text-[11px] text-slate-400">{t.subtopics.length} subtopic{t.subtopics.length === 1 ? '' : 's'}</span>
                          <div className="ml-auto flex items-center gap-0.5">
                            <button onClick={() => run(() => moveTopic({ templateId: outline.template!.id, id: t.id, dir: 'up' }))} disabled={busy || ti === 0} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30" title="Move up"><ChevronUp className="w-4 h-4" /></button>
                            <button onClick={() => run(() => moveTopic({ templateId: outline.template!.id, id: t.id, dir: 'down' }))} disabled={busy || ti === outline.topics.length - 1} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30" title="Move down"><ChevronDown className="w-4 h-4" /></button>
                            <button onClick={() => setEditing({ kind: 'topic', id: t.id, code: t.code, name: t.name })} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" title="Edit"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteTopic(t.id, t.name)} className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Subtopics */}
                    <div className="divide-y divide-[#F1F2F7] dark:divide-slate-800">
                      {t.subtopics.map((s, si) => (
                        <div key={s.id} className="px-4 py-2.5">
                          {editing?.kind === 'subtopic' && editing.id === s.id ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="1.1" className={`${inputCls} w-20`} />
                                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={`${inputCls} flex-1`} />
                                <button onClick={handleSaveSubtopic} disabled={busy} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" title="Save"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditing(null)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Cancel"><X className="w-4 h-4" /></button>
                              </div>
                              <textarea
                                value={editing.objectivesText}
                                onChange={(e) => setEditing({ ...editing, objectivesText: e.target.value })}
                                rows={4}
                                placeholder="Learning objectives - one per line"
                                className={`${inputCls} w-full font-mono text-xs`}
                              />
                              <div className="text-[11px] text-slate-400">One learning objective per line.</div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-slate-800 dark:text-slate-100">
                                  {s.code && <span className="text-[#5B47D6] font-medium mr-1.5">{s.code}</span>}{s.name}
                                </div>
                                {s.objectives.length > 0 && (
                                  <ul className="mt-1 ml-1 space-y-0.5 list-disc list-inside text-[12px] text-slate-500">
                                    {s.objectives.map((o, oi) => <li key={oi}>{o}</li>)}
                                  </ul>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button onClick={() => run(() => moveSubtopic({ topicId: t.id, id: s.id, dir: 'up' }))} disabled={busy || si === 0} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" title="Move up"><ChevronUp className="w-4 h-4" /></button>
                                <button onClick={() => run(() => moveSubtopic({ topicId: t.id, id: s.id, dir: 'down' }))} disabled={busy || si === t.subtopics.length - 1} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" title="Move down"><ChevronDown className="w-4 h-4" /></button>
                                <button onClick={() => setEditing({ kind: 'subtopic', id: s.id, code: s.code, name: s.name, objectivesText: s.objectives.join('\n') })} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteSubtopic(s.id, s.name)} className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30" title="Delete"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add subtopic */}
                      <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/30">
                        {addSubFor === t.id ? (
                          <div className="flex items-center gap-2">
                            <input value={addSubCode} onChange={(e) => setAddSubCode(e.target.value)} placeholder="1.1" className={`${inputCls} w-20`} />
                            <input value={addSubName} onChange={(e) => setAddSubName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSubtopic(t.id)} placeholder="Subtopic name" className={`${inputCls} flex-1`} autoFocus />
                            <button onClick={() => handleAddSubtopic(t.id)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-[#5B47D6] text-white text-sm font-medium disabled:opacity-60">Add</button>
                            <button onClick={() => { setAddSubFor(null); setAddSubCode(''); setAddSubName(''); }} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setAddSubFor(t.id); setAddSubCode(''); setAddSubName(''); }} className="text-sm text-[#5B47D6] font-medium flex items-center gap-1 hover:underline">
                            <Plus className="w-4 h-4" /> Add subtopic
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add topic */}
                <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm p-4">
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Topic no.</label>
                      <input value={addTopicCode} onChange={(e) => setAddTopicCode(e.target.value)} placeholder="1" className={`${inputCls} w-20`} />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Topic name</label>
                      <input value={addTopicName} onChange={(e) => setAddTopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()} placeholder="e.g. Physical quantities and units" className={`${inputCls} w-full`} />
                    </div>
                    <button onClick={handleAddTopic} disabled={busy} className="px-4 py-2 rounded-lg bg-[#5B47D6] text-white text-sm font-medium disabled:opacity-60 flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Add topic
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BULK OBJECTIVES MODAL */}
      {bulkOpen && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !busy && setBulkOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBEDF3] dark:border-slate-800">
              <div>
                <div className="font-heading font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <ClipboardPaste className="w-5 h-5 text-[#5B47D6]" /> Bulk objectives
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{labelWithCode(selectedSubject.name, selectedSubject.code)} · {selectedSubject.program}</div>
              </div>
              <button onClick={() => setBulkOpen(false)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                One subtopic per line. Start each line with the subtopic code, then a colon, then the objectives separated by semicolons. Existing subtopics are matched by code - nothing new is created.
              </div>
              <pre className="text-[11px] bg-slate-50 dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-lg p-3 overflow-x-auto text-slate-600 dark:text-slate-300">{`1.1: Define proton, neutron and electron; State relative charge and mass
1.2: Describe isotopes; Calculate relative atomic mass
2.1: Explain ionic bonding`}</pre>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={12}
                placeholder="Paste your objectives here..."
                className={`${inputCls} w-full font-mono text-xs`}
                autoFocus
              />
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <input type="radio" checked={bulkMode === 'replace'} onChange={() => setBulkMode('replace')} /> Replace existing
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <input type="radio" checked={bulkMode === 'append'} onChange={() => setBulkMode('append')} /> Add to existing
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#EBEDF3] dark:border-slate-800">
              <button onClick={() => setBulkOpen(false)} disabled={busy} className="px-4 py-2 rounded-lg border border-[#E2E5EE] dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">Cancel</button>
              <button onClick={handleBulkObjectives} disabled={busy || !bulkText.trim()} className="px-4 py-2 rounded-lg bg-[#5B47D6] text-white text-sm font-medium disabled:opacity-60 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
