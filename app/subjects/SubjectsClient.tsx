'use client';

// Subjects manager: add / edit / delete the academy's subjects. Writes go straight
// to the DB (createSubject/updateSubject/deleteSubject) and reflect immediately in
// the teacher/student enrollment pickers and the class/homework subject lists.
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import type { SubjectOption } from '@/lib/data/subjects';
import { ALL_PROGRAMS } from '@/lib/syllabiSeed';
import { createSubject, updateSubject, deleteSubject } from './actions';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { BookOpen, Plus, Edit3, Trash2, Check, X, Search } from 'lucide-react';

export function SubjectsClient({ initialSubjects }: { initialSubjects: SubjectOption[] }) {
  const router = useRouter();
  const [programFilter, setProgramFilter] = useState('All Programs');
  const [query, setQuery] = useState('');

  // Add form
  const [addName, setAddName] = useState('');
  const [addProgram, setAddProgram] = useState<string>(ALL_PROGRAMS[0]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit modal
  const [editing, setEditing] = useState<SubjectOption | null>(null);
  const [edName, setEdName] = useState('');
  const [edProgram, setEdProgram] = useState('');
  const [edSaving, setEdSaving] = useState(false);
  const [edError, setEdError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return initialSubjects
      .filter((s) => programFilter === 'All Programs' || s.program === programFilter)
      .filter((s) => !query.trim() || s.name.toLowerCase().includes(query.trim().toLowerCase()));
  }, [initialSubjects, programFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, SubjectOption[]>();
    for (const s of filtered) {
      if (!map.has(s.program)) map.set(s.program, []);
      map.get(s.program)!.push(s);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleAdd = async () => {
    setAddError(null);
    if (!addName.trim()) { setAddError('Enter a subject name.'); return; }
    setAdding(true);
    const res = await createSubject({ name: addName, program: addProgram });
    setAdding(false);
    if (res.ok) { setAddName(''); router.refresh(); }
    else setAddError(res.error ?? 'Failed to add subject.');
  };

  const openEdit = (s: SubjectOption) => {
    setEditing(s); setEdName(s.name); setEdProgram(s.program); setEdError(null);
  };
  const handleEdit = async () => {
    if (!editing) return;
    setEdError(null);
    if (!edName.trim()) { setEdError('Enter a subject name.'); return; }
    setEdSaving(true);
    const res = await updateSubject({ id: editing.id, name: edName, program: edProgram });
    setEdSaving(false);
    if (res.ok) { setEditing(null); router.refresh(); }
    else setEdError(res.error ?? 'Failed to update subject.');
  };
  const handleDelete = async (s: SubjectOption) => {
    if (!confirm(`Delete "${s.name}" (${s.program})?\n\nIt is removed from the pickers. Past classes/homework that used it are kept.`)) return;
    const res = await deleteSubject(s.id);
    if (res.ok) router.refresh();
    else alert(res.error ?? 'Failed to delete subject.');
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">
        {/* HEADER */}
        <div className="flex flex-col gap-1">
          <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#5B47D6]" /> Subjects
          </h1>
          <p className="text-sm text-[#6B7185]">
            The academy&apos;s subject list. Add or remove subjects here — changes apply instantly to the teacher &amp; student enrollment pickers and to classes/homework.
          </p>
        </div>

        {/* ADD FORM */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Subject name</label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="e.g. Sociology"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Program</label>
              <select
                value={addProgram}
                onChange={(e) => setAddProgram(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]"
              >
                {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </div>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="px-5 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5 justify-center"
            >
              <Plus className="w-4 h-4" /> {adding ? 'Adding…' : 'Add Subject'}
            </button>
          </div>
          {addError && <p className="text-xs font-semibold text-rose-600 mt-2">{addError}</p>}
        </div>

        {/* FILTERS */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subjects…"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]"
            />
          </div>
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]"
          >
            <option>All Programs</option>
            {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>
        </div>

        {/* LIST (grouped by program) */}
        {grouped.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm py-12 text-center text-[#6B7185]">
            No subjects yet. Add your first subject above.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([program, subs]) => (
              <div key={program} className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{program}</span>
                  <span className="text-xs text-[#6B7185]">{subs.length} subject{subs.length === 1 ? '' : 's'}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {subs.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{s.name}</span>
                      <RowActionsMenu
                        actions={[
                          { label: 'Edit', icon: <Edit3 className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => openEdit(s) },
                          { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, tone: 'danger', onClick: () => handleDelete(s) },
                        ]}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EDIT MODAL */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 my-6 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-extrabold text-lg text-slate-900 dark:text-white">Edit Subject</h3>
                <button onClick={() => setEditing(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Subject name</label>
                <input value={edName} onChange={(e) => setEdName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Program</label>
                <select value={edProgram} onChange={(e) => setEdProgram(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]">
                  {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
              {edError && <p className="text-xs font-semibold text-rose-600">{edError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300">Cancel</button>
                <button onClick={handleEdit} disabled={edSaving} className="px-5 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2">
                  <Check className="w-4 h-4" /> {edSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
