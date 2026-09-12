'use client';

// Attendance Register: mark (or correct) a whole day of classes at once. Each
// class_session is one student, so a "day register" is the list of that day's
// sessions with a quick Present/Late/Absent per row + a "mark all present" bulk.
// Prefilled from the already-recorded mark so it doubles as a correction view.
import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { ScheduledClass } from '@/lib/mockAcademicsData';
import { bulkMarkAttendance, clearAttendance } from '@/app/schedule/actions';
import { downloadCsv } from '@/lib/export/csv';
import { CalendarCheck, Check, Users, ChevronDown, ClipboardList, ListChecks, Download, Search, Trash2 } from 'lucide-react';

type Mark = 'Present' | 'Late' | 'Absent';

const isoToPktDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }) : '';

const MARK_FROM_STATUS: Record<string, Mark> = { present: 'Present', late: 'Late', absent: 'Absent' };

export function AttendanceRegisterClient({ initialClasses }: { initialClasses: ScheduledClass[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [clearingId, setClearingId] = useState<string | null>(null);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

  // Every day (PKT) that actually has a class, sorted. Used to pick a sensible
  // default date and to offer quick-jumps when the chosen day is empty - so the
  // register never opens on a blank weekend and looks broken.
  const classDates = useMemo(
    () =>
      Array.from(
        new Set(
          initialClasses
            .filter((c) => c.status !== 'Cancelled')
            .map((c) => isoToPktDate(c.startAtISO))
            .filter(Boolean)
        )
      ).sort(),
    [initialClasses]
  );

  // Default to today if today has classes; else the most recent past day with
  // classes; else the next upcoming day with classes; else today.
  const defaultDate = useMemo(() => {
    if (classDates.length === 0) return today;
    if (classDates.includes(today)) return today;
    const past = classDates.filter((d) => d < today);
    if (past.length) return past[past.length - 1];
    return classDates[0];
  }, [classDates, today]);

  const [date, setDate] = useState(defaultDate);
  const [teacherFilter, setTeacherFilter] = useState('All Teachers');
  const [choices, setChoices] = useState<Record<string, Mark>>({});
  const [saving, setSaving] = useState(false);

  // REGISTER (mark a day) vs HISTORY (running log of every recorded mark).
  const [view, setView] = useState<'register' | 'history'>('register');
  const [histTeacher, setHistTeacher] = useState('All Teachers');
  const [histStudent, setHistStudent] = useState('All Students');
  const [histMark, setHistMark] = useState<'All' | 'Present' | 'Late' | 'Absent'>('All');
  const [histRange, setHistRange] = useState<'all' | 'week' | 'month'>('all');
  const [histSearch, setHistSearch] = useState('');

  // Distinct teachers present in the data (for the filter).
  const teachers = useMemo(() => {
    const set = new Map<string, string>();
    for (const c of initialClasses) if (c.teacherId) set.set(c.teacherId, c.teacherName || 'Unassigned');
    return Array.from(set.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [initialClasses]);

  // Sessions on the chosen day (optionally one teacher), excluding cancelled.
  const rows = useMemo(() => {
    return initialClasses
      .filter((c) => c.status !== 'Cancelled')
      .filter((c) => isoToPktDate(c.startAtISO) === date)
      .filter((c) => teacherFilter === 'All Teachers' || c.teacherName === teacherFilter)
      .sort((a, b) => (a.startAtISO ?? '').localeCompare(b.startAtISO ?? ''));
  }, [initialClasses, date, teacherFilter]);

  // Seed the per-row choice from the recorded mark (or Present) whenever the
  // visible set changes.
  useEffect(() => {
    setChoices((prev) => {
      const next: Record<string, Mark> = {};
      for (const c of rows) {
        next[c.id] = prev[c.id] ?? MARK_FROM_STATUS[c.attendanceStatus ?? ''] ?? 'Present';
      }
      return next;
    });
  }, [rows]);

  const setMark = (id: string, m: Mark) => setChoices((p) => ({ ...p, [id]: m }));

  // Changing a mark that is ALREADY recorded asks for confirmation first, so a
  // saved attendance can't be flipped by a casual click. Fresh (unrecorded) rows
  // change instantly. The change still only persists on "Save Register".
  const handleMarkClick = async (c: ScheduledClass, m: Mark) => {
    const current = MARK_FROM_STATUS[c.attendanceStatus ?? ''];
    if (c.attendanceStatus && current && current !== m) {
      const ok = await confirm({
        title: 'Change recorded attendance?',
        message: `${c.studentName || 'This student'} is currently marked ${current} for this class. Change it to ${m}? You still need to press "Save Register" to apply it.`,
        confirmLabel: 'Change',
        danger: false,
      });
      if (!ok) return;
    }
    setMark(c.id, m);
  };

  // Remove a recorded mark entirely and reopen the class.
  const handleClearMark = async (c: ScheduledClass) => {
    const ok = await confirm({
      title: 'Delete this attendance mark?',
      message: `This removes the recorded attendance for ${c.studentName || 'this student'} on ${c.date} (${c.startAt}) and reopens the class as not completed.`,
      confirmLabel: 'Delete mark',
      danger: true,
    });
    if (!ok) return;
    setClearingId(c.id);
    const res = await clearAttendance({ sessionId: c.id });
    setClearingId(null);
    if (res.ok) {
      router.refresh();
      showToast('Attendance mark deleted.', 'success');
    } else {
      showToast(res.error ?? 'Failed to delete the mark.', 'error');
    }
  };
  const markAllPresent = () => setChoices((p) => {
    const next = { ...p };
    for (const c of rows) next[c.id] = 'Present';
    return next;
  });

  const markedCount = rows.filter((c) => c.attendanceStatus).length;

  // When the chosen day has no classes, offer the nearest days that do (up to two
  // before, two after) as one-tap chips.
  const nearbyDates = useMemo(() => {
    const before = classDates.filter((d) => d < date).slice(-2);
    const after = classDates.filter((d) => d > date).slice(0, 2);
    return [...before, ...after];
  }, [classDates, date]);
  const chipLabel = (d: string) =>
    new Date(`${d}T12:00:00+05:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });

  // ---- HISTORY LOG (every class that has a recorded attendance mark) ----------
  const addDaysPkt = (base: string, n: number) => {
    const d = new Date(`${base}T00:00:00+05:00`);
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  };
  // Students that appear in the data (for the history filter).
  const students = useMemo(
    () => Array.from(new Set(initialClasses.map((c) => c.studentName).filter(Boolean))).sort(),
    [initialClasses]
  );
  const histRows = useMemo(() => {
    const rangeStart = histRange === 'week' ? addDaysPkt(today, -6) : histRange === 'month' ? addDaysPkt(today, -29) : '';
    const q = histSearch.trim().toLowerCase();
    return initialClasses
      .filter((c) => c.attendanceStatus) // only classes with a recorded mark
      .filter((c) => histTeacher === 'All Teachers' || c.teacherName === histTeacher)
      .filter((c) => histStudent === 'All Students' || c.studentName === histStudent)
      .filter((c) => histMark === 'All' || MARK_FROM_STATUS[c.attendanceStatus ?? ''] === histMark)
      .filter((c) => !rangeStart || isoToPktDate(c.startAtISO) >= rangeStart)
      .filter((c) => !q || (c.studentName ?? '').toLowerCase().includes(q) || (c.subject ?? '').toLowerCase().includes(q) || (c.teacherName ?? '').toLowerCase().includes(q))
      .sort((a, b) => (b.startAtISO ?? '').localeCompare(a.startAtISO ?? '')); // newest first
  }, [initialClasses, histTeacher, histStudent, histMark, histRange, histSearch, today]);
  const histCounts = useMemo(() => {
    let present = 0, late = 0, absent = 0;
    for (const c of histRows) {
      if (c.attendanceStatus === 'present') present++;
      else if (c.attendanceStatus === 'late') late++;
      else if (c.attendanceStatus === 'absent') absent++;
    }
    return { present, late, absent, total: histRows.length };
  }, [histRows]);

  // Per-student attendance summary over the filtered history. Attendance rate
  // counts Present + Late as attended (only Absent lowers it).
  const histByStudent = useMemo(() => {
    const m = new Map<string, { name: string; present: number; late: number; absent: number; total: number }>();
    for (const c of histRows) {
      const name = c.studentName || '—';
      const e = m.get(name) ?? { name, present: 0, late: 0, absent: 0, total: 0 };
      e.total++;
      if (c.attendanceStatus === 'present') e.present++;
      else if (c.attendanceStatus === 'late') e.late++;
      else if (c.attendanceStatus === 'absent') e.absent++;
      m.set(name, e);
    }
    return Array.from(m.values())
      .map((e) => ({ ...e, rate: e.total ? Math.round(((e.present + e.late) / e.total) * 100) : 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [histRows]);
  const rateCls = (r: number) => (r >= 90 ? 'text-emerald-600' : r >= 75 ? 'text-amber-600' : 'text-rose-600');
  const exportHistory = () => {
    if (histRows.length === 0) { showToast('Nothing to export for these filters.', 'info'); return; }
    downloadCsv(
      'Thinkerzz_Attendance_History',
      ['Date', 'Time', 'Student', 'Program', 'Subject', 'Teacher', 'Mark'],
      histRows.map((c) => [c.date, `${c.startAt} - ${c.endAt}`, c.studentName ?? '', c.program ?? '', c.subject ?? '', c.teacherName ?? '', MARK_FROM_STATUS[c.attendanceStatus ?? ''] ?? ''])
    );
  };
  const markBadgeCls = (status?: string) =>
    status === 'present' ? 'bg-emerald-100 text-emerald-700' : status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';

  const handleSave = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    const res = await bulkMarkAttendance({
      items: rows
        .filter((c) => c.studentId)
        .map((c) => ({ sessionId: c.id, studentId: c.studentId as string, attendance: choices[c.id] ?? 'Present' })),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh();
      showToast(`Attendance saved for ${res.count} class${res.count === 1 ? '' : 'es'}.`, 'success');
    } else {
      showToast(res.error ?? 'Failed to save attendance.', 'error');
    }
  };

  const prettyDate = date
    ? new Date(`${date}T12:00:00+05:00`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-[#5B47D6]" /> Attendance
            </h1>
            <p className="text-sm text-[#6B7185]">
              {view === 'register'
                ? 'Mark a whole day at once, or correct an earlier mark. Saving records attendance and marks each class completed.'
                : 'Every recorded attendance mark across all dates. Filter, review, or export it.'}
            </p>
          </div>
          {/* REGISTER / HISTORY TOGGLE */}
          <div className="flex items-center gap-1 bg-[#F6F7FB] dark:bg-slate-800 p-1 rounded-xl w-max shrink-0">
            <button
              onClick={() => setView('register')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${view === 'register' ? 'bg-[#5B47D6] text-white shadow-sm' : 'text-[#6B7185] hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              <ListChecks className="w-3.5 h-3.5" /> Register
            </button>
            <button
              onClick={() => setView('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${view === 'history' ? 'bg-[#5B47D6] text-white shadow-sm' : 'text-[#6B7185] hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              <ClipboardList className="w-3.5 h-3.5" /> History
            </button>
          </div>
        </div>

        {view === 'register' && (
        <>
        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]"
            />
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Teacher</label>
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm pl-3 pr-8 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]"
            >
              <option>All Teachers</option>
              {teachers.map((t) => (<option key={t.id} value={t.name}>{t.name}</option>))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 bottom-2.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="sm:ml-auto flex items-center gap-2">
            <button
              onClick={markAllPresent}
              disabled={rows.length === 0}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" /> Mark all present
            </button>
            <button
              onClick={handleSave}
              disabled={saving || rows.length === 0}
              className="px-5 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl text-xs font-medium shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Register'}
            </button>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="text-xs text-[#6B7185]">
          <span className="font-medium text-slate-900 dark:text-white">{prettyDate}</span> · {rows.length} class{rows.length === 1 ? '' : 'es'}
          {rows.length > 0 && <> · {markedCount} already recorded</>}
        </div>

        {/* REGISTER TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-left text-[#6B7185]">
                <tr>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Time</th>
                  <th className="py-3 px-4 font-medium">Student</th>
                  <th className="py-3 px-4 font-medium">Program</th>
                  <th className="py-3 px-4 font-medium">Subject</th>
                  <th className="py-3 px-4 font-medium">Teacher</th>
                  <th className="py-3 px-4 font-medium text-center">Attendance</th>
                  <th className="py-3 px-4 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#6B7185]">
                      <div>No classes on this day{teacherFilter !== 'All Teachers' ? ' for this teacher' : ''}.</div>
                      {nearbyDates.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                          <span className="text-xs">Jump to a day with classes:</span>
                          {nearbyDates.map((d) => (
                            <button
                              key={d}
                              onClick={() => setDate(d)}
                              className="px-3 py-1 rounded-lg text-xs font-medium border border-[#5B47D6]/30 text-[#5B47D6] hover:bg-[#5B47D6]/5 transition-colors"
                            >
                              {chipLabel(d)}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">{c.date}</td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{c.startAt} - {c.endAt}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {c.studentName || '—'}
                        {c.attendanceStatus && <span className="ml-2 text-[10px] font-medium text-emerald-600">✓ recorded</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{c.program || '—'}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{c.subject || '—'}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{c.teacherName || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1.5 justify-center">
                          {(['Present', 'Late', 'Absent'] as const).map((m) => {
                            const active = (choices[c.id] ?? 'Present') === m;
                            const activeCls =
                              m === 'Present' ? 'bg-emerald-600 text-white' : m === 'Late' ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white';
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => handleMarkClick(c, m)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                  active ? `${activeCls} border-transparent` : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {c.attendanceStatus ? (
                          <button
                            onClick={() => handleClearMark(c)}
                            disabled={clearingId === c.id}
                            title="Delete recorded attendance"
                            aria-label="Delete recorded attendance"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD LIST (phones) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? (
              <div className="py-12 text-center text-[#6B7185] text-sm">
                <div>No classes on this day{teacherFilter !== 'All Teachers' ? ' for this teacher' : ''}.</div>
                {nearbyDates.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <span className="text-xs">Jump to a day with classes:</span>
                    {nearbyDates.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDate(d)}
                        className="px-3 py-1 rounded-lg text-xs font-medium border border-[#5B47D6]/30 text-[#5B47D6] hover:bg-[#5B47D6]/5 transition-colors"
                      >
                        {chipLabel(d)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              rows.map((c) => (
                <div key={c.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {c.studentName || '—'}
                        {c.attendanceStatus && <span className="ml-2 text-[10px] font-medium text-emerald-600">✓ recorded</span>}
                      </div>
                      <div className="text-xs text-[#6B7185] truncate">{c.subject || '—'}{c.program ? ` · ${c.program}` : ''} · {c.teacherName || '—'}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-slate-600 dark:text-slate-300">{c.date}</div>
                      <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{c.startAt} - {c.endAt}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {(['Present', 'Late', 'Absent'] as const).map((m) => {
                      const active = (choices[c.id] ?? 'Present') === m;
                      const activeCls = m === 'Present' ? 'bg-emerald-600 text-white' : m === 'Late' ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white';
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleMarkClick(c, m)}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${active ? `${activeCls} border-transparent` : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                        >
                          {m}
                        </button>
                      );
                    })}
                    {c.attendanceStatus && (
                      <button
                        onClick={() => handleClearMark(c)}
                        disabled={clearingId === c.id}
                        aria-label="Delete recorded attendance"
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </>
        )}

        {view === 'history' && (
        <>
          {/* HISTORY FILTERS */}
          <div className="flex flex-col gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Search</label>
                <Search className="w-4 h-4 absolute left-3 bottom-2.5 text-slate-400 pointer-events-none" />
                <input
                  value={histSearch}
                  onChange={(e) => setHistSearch(e.target.value)}
                  placeholder="Student, subject or teacher…"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                />
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Student</label>
                <select value={histStudent} onChange={(e) => setHistStudent(e.target.value)} className="appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm pl-3 pr-8 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]">
                  <option>All Students</option>
                  {students.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2.5 bottom-2.5 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Teacher</label>
                <select value={histTeacher} onChange={(e) => setHistTeacher(e.target.value)} className="appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm pl-3 pr-8 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]">
                  <option>All Teachers</option>
                  {teachers.map((t) => (<option key={t.id} value={t.name}>{t.name}</option>))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2.5 bottom-2.5 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Mark</label>
                <select value={histMark} onChange={(e) => setHistMark(e.target.value as typeof histMark)} className="appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm pl-3 pr-8 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]">
                  <option value="All">All marks</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Absent">Absent</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2.5 bottom-2.5 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Period</label>
                <select value={histRange} onChange={(e) => setHistRange(e.target.value as typeof histRange)} className="appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm pl-3 pr-8 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6]">
                  <option value="all">All time</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2.5 bottom-2.5 text-slate-400 pointer-events-none" />
              </div>
              <button
                onClick={exportHistory}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
            {/* COUNTS */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-slate-900 dark:text-white">{histCounts.total} record{histCounts.total === 1 ? '' : 's'}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{histCounts.present} present</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{histCounts.late} late</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">{histCounts.absent} absent</span>
            </div>
          </div>

          {/* PER-STUDENT SUMMARY */}
          {histByStudent.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#EBEDF3] dark:border-slate-800 flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white">Per-student summary</span>
                <span className="text-xs text-[#6B7185]">· attendance rate counts present + late as attended</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-left text-[#6B7185]">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Student</th>
                      <th className="py-2.5 px-4 font-medium text-center">Classes</th>
                      <th className="py-2.5 px-4 font-medium text-center">Present</th>
                      <th className="py-2.5 px-4 font-medium text-center">Late</th>
                      <th className="py-2.5 px-4 font-medium text-center">Absent</th>
                      <th className="py-2.5 px-4 font-medium text-center">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {histByStudent.map((s) => (
                      <tr key={s.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                        <td className="py-2.5 px-4 text-center text-slate-700 dark:text-slate-300">{s.total}</td>
                        <td className="py-2.5 px-4 text-center text-emerald-700">{s.present}</td>
                        <td className="py-2.5 px-4 text-center text-amber-700">{s.late}</td>
                        <td className="py-2.5 px-4 text-center text-rose-700">{s.absent}</td>
                        <td className={`py-2.5 px-4 text-center font-semibold ${rateCls(s.rate)}`}>{s.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HISTORY TABLE */}
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-left text-[#6B7185]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Time</th>
                    <th className="py-3 px-4 font-medium">Student</th>
                    <th className="py-3 px-4 font-medium">Program</th>
                    <th className="py-3 px-4 font-medium">Subject</th>
                    <th className="py-3 px-4 font-medium">Teacher</th>
                    <th className="py-3 px-4 font-medium text-center">Mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {histRows.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-[#6B7185]">No attendance recorded yet for these filters.</td></tr>
                  ) : (
                    histRows.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">{c.date}</td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{c.startAt} - {c.endAt}</td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{c.studentName || '—'}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{c.program || '—'}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{c.subject || '—'}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{c.teacherName || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${markBadgeCls(c.attendanceStatus)}`}>
                            {MARK_FROM_STATUS[c.attendanceStatus ?? ''] ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD LIST */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {histRows.length === 0 ? (
                <div className="py-12 text-center text-[#6B7185] text-sm">No attendance recorded yet for these filters.</div>
              ) : (
                histRows.map((c) => (
                  <div key={c.id} className="p-4 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{c.studentName || '—'}</div>
                      <div className="text-xs text-[#6B7185] truncate">{c.subject || '—'}{c.program ? ` · ${c.program}` : ''} · {c.teacherName || '—'}</div>
                      <div className="text-xs text-[#6B7185]">{c.date} · {c.startAt} - {c.endAt}</div>
                    </div>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${markBadgeCls(c.attendanceStatus)}`}>
                      {MARK_FROM_STATUS[c.attendanceStatus ?? ''] ?? '—'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
        )}
      </div>
    </PortalLayout>
  );
}
