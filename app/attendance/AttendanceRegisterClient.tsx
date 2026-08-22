'use client';

// Attendance Register: mark (or correct) a whole day of classes at once. Each
// class_session is one student, so a "day register" is the list of that day's
// sessions with a quick Present/Late/Absent per row + a "mark all present" bulk.
// Prefilled from the already-recorded mark so it doubles as a correction view.
import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { ScheduledClass } from '@/lib/mockAcademicsData';
import { bulkMarkAttendance } from '@/app/schedule/actions';
import { CalendarCheck, Check, Users, ChevronDown } from 'lucide-react';

type Mark = 'Present' | 'Late' | 'Absent';

const isoToPktDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }) : '';

const MARK_FROM_STATUS: Record<string, Mark> = { present: 'Present', late: 'Late', absent: 'Absent' };

export function AttendanceRegisterClient({ initialClasses }: { initialClasses: ScheduledClass[] }) {
  const router = useRouter();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const [date, setDate] = useState(today);
  const [teacherFilter, setTeacherFilter] = useState('All Teachers');
  const [choices, setChoices] = useState<Record<string, Mark>>({});
  const [saving, setSaving] = useState(false);

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
  const markAllPresent = () => setChoices((p) => {
    const next = { ...p };
    for (const c of rows) next[c.id] = 'Present';
    return next;
  });

  const markedCount = rows.filter((c) => c.attendanceStatus).length;

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
      alert(`Attendance saved for ${res.count} class${res.count === 1 ? '' : 'es'}.`);
    } else {
      alert(res.error ?? 'Failed to save attendance.');
    }
  };

  const prettyDate = date
    ? new Date(`${date}T12:00:00+05:00`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">
        {/* HEADER */}
        <div className="flex flex-col gap-1">
          <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-[#5B47D6]" /> Attendance Register
          </h1>
          <p className="text-sm text-[#6B7185]">Mark a whole day at once, or correct an earlier mark. Saving records attendance and marks each class completed.</p>
        </div>

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-left text-[#6B7185]">
                <tr>
                  <th className="py-3 px-4 font-medium">Time</th>
                  <th className="py-3 px-4 font-medium">Student</th>
                  <th className="py-3 px-4 font-medium">Subject</th>
                  <th className="py-3 px-4 font-medium">Teacher</th>
                  <th className="py-3 px-4 font-medium text-center">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#6B7185]">
                      No classes on this day{teacherFilter !== 'All Teachers' ? ' for this teacher' : ''}.
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{c.startAt}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {c.studentName || '—'}
                        {c.attendanceStatus && <span className="ml-2 text-[10px] font-medium text-emerald-600">✓ recorded</span>}
                      </td>
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
                                onClick={() => setMark(c.id, m)}
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
