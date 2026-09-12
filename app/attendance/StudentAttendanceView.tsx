'use client';

// STUDENT attendance - READ ONLY. A student sees only their own recorded
// attendance (RLS-scoped upstream): date, time, subject, teacher NAME and the
// mark. There are no marking controls, no filters for other people, and no
// server actions - a student can view but never edit. Writes are additionally
// blocked by RLS (students have no insert/update policy on attendance).
import React, { useMemo } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { ScheduledClass } from '@/lib/mockAcademicsData';
import { CalendarCheck } from 'lucide-react';

type Mark = 'Present' | 'Late' | 'Absent';
const MARK_FROM_STATUS: Record<string, Mark> = { present: 'Present', late: 'Late', absent: 'Absent' };

export function StudentAttendanceView({ initialClasses }: { initialClasses: ScheduledClass[] }) {
  // Only this student's classes that have a recorded mark, oldest first.
  const rows = useMemo(
    () =>
      initialClasses
        .filter((c) => c.attendanceStatus)
        .sort((a, b) => (a.startAtISO ?? '').localeCompare(b.startAtISO ?? '')),
    [initialClasses]
  );

  const stats = useMemo(() => {
    let present = 0, late = 0, absent = 0;
    for (const c of rows) {
      if (c.attendanceStatus === 'present') present++;
      else if (c.attendanceStatus === 'late') late++;
      else if (c.attendanceStatus === 'absent') absent++;
    }
    const total = rows.length;
    const rate = total ? Math.round(((present + late) / total) * 100) : 0;
    return { present, late, absent, total, rate };
  }, [rows]);

  const rateCls = stats.rate >= 90 ? 'text-emerald-600' : stats.rate >= 75 ? 'text-amber-600' : 'text-rose-600';
  const badgeCls = (status?: string) =>
    status === 'present' ? 'bg-emerald-100 text-emerald-700' : status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['student', 'admin', 'manager', 'teacher']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">
        {/* HEADER */}
        <div className="flex flex-col gap-1">
          <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-[#5B47D6]" /> My Attendance
          </h1>
          <p className="text-sm text-[#6B7185]">Your recorded attendance for each class. This is view-only — your teacher records it.</p>
        </div>

        {/* SUMMARY */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-[#6B7185] font-medium">Attendance rate</div>
              <div className={`text-2xl font-heading font-semibold ${rateCls}`}>{stats.rate}%</div>
              <div className="text-[11px] text-[#6B7185]">present + late counted</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-[#6B7185] font-medium">Present</div>
              <div className="text-2xl font-heading font-semibold text-emerald-600">{stats.present}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-[#6B7185] font-medium">Late</div>
              <div className="text-2xl font-heading font-semibold text-amber-600">{stats.late}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-[#6B7185] font-medium">Absent</div>
              <div className="text-2xl font-heading font-semibold text-rose-600">{stats.absent}</div>
            </div>
          </div>
        )}

        {/* TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-left text-[#6B7185]">
                <tr>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Time</th>
                  <th className="py-3 px-4 font-medium">Subject</th>
                  <th className="py-3 px-4 font-medium">Teacher</th>
                  <th className="py-3 px-4 font-medium text-center">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-[#6B7185]">No attendance recorded yet.</td></tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">{c.date}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{c.startAt} - {c.endAt}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{c.subject || '—'}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{c.teacherName || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeCls(c.attendanceStatus)}`}>
                          {MARK_FROM_STATUS[c.attendanceStatus ?? ''] ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? (
              <div className="py-12 text-center text-[#6B7185] text-sm">No attendance recorded yet.</div>
            ) : (
              rows.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{c.subject || '—'}</div>
                    <div className="text-xs text-[#6B7185] truncate">{c.teacherName || '—'}</div>
                    <div className="text-xs text-[#6B7185]">{c.date} · {c.startAt} - {c.endAt}</div>
                  </div>
                  <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeCls(c.attendanceStatus)}`}>
                    {MARK_FROM_STATUS[c.attendanceStatus ?? ''] ?? '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
