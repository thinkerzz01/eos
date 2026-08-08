'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { ScheduledClass } from '@/lib/mockAcademicsData';
import type { SubjectOption } from '@/lib/data/subjects';
import { createClassSession, completeClassWithAttendance } from './actions';
import {
  Calendar,
  Clock,
  UserCheck,
  Plus,
  Search,
  Filter,
  X,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Users,
  ChevronDown,
  RotateCcw,
  FileText,
  SlidersHorizontal,
  DollarSign,
  Check,
} from 'lucide-react';

export function ScheduleClient({
  initialClasses,
  students,
  teachers,
  subjects,
}: {
  initialClasses: ScheduledClass[];
  students: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  subjects: SubjectOption[];
}) {
  const { role } = useRole();
  const router = useRouter();

  // LOCAL SCHEDULE STATE STORE (seeded from server, RLS-authorized)
  const [classesList, setClassesList] = useState<ScheduledClass[]>(initialClasses);

  // Keep the list in sync when the server refetches after a write (router.refresh()).
  useEffect(() => { setClassesList(initialClasses); }, [initialClasses]);
  const [selectedClassType, setSelectedClassType] = useState<string>('All Types');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All Subjects');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // MOBILE CLASS COMPLETION DRAWER
  const [selectedClassForCompletion, setSelectedClassForCompletion] = useState<ScheduledClass | null>(null);
  const [attendanceChoice, setAttendanceChoice] = useState<'Present' | 'Late' | 'Absent'>('Present');
  const [savingCompletion, setSavingCompletion] = useState(false);

  // SCHEDULE NEW CLASS MODAL (one student per session — schema model)
  const [showAddClassModal, setShowAddClassModal] = useState<boolean>(false);
  const [newClassData, setNewClassData] = useState({
    studentId: '',
    subjectId: '',
    teacherId: '',
    classType: 'Class' as 'Class' | 'Makeup' | 'Test',
    date: '',
    startTime: '',
    endTime: '',
  });
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const filteredClasses = useMemo(() => {
    return classesList.filter((c) => {
      if (selectedClassType === 'Class' && c.classType !== 'Class') return false;
      if (selectedClassType === 'Makeup' && c.classType !== 'Makeup') return false;
      if (selectedClassType === 'Test' && c.classType !== 'Test') return false;

      if (selectedSubjectFilter !== 'All Subjects' && c.subject !== selectedSubjectFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSub = c.subject.toLowerCase().includes(q);
        const matchesTeacher = c.teacherName.toLowerCase().includes(q);
        const matchesCode = c.classCode.toLowerCase().includes(q);
        if (!matchesSub && !matchesTeacher && !matchesCode) return false;
      }

      return true;
    });
  }, [classesList, selectedClassType, selectedSubjectFilter, searchQuery]);

  // Create one class_session (real). Teacher overlaps are blocked by the DB
  // EXCLUDE constraint; the action returns a conflict flag we surface here.
  const handleCreateNewClass = async () => {
    setOverlapWarning(null);
    if (!newClassData.studentId) { setOverlapWarning('Please select a student.'); return; }
    if (!newClassData.subjectId) { setOverlapWarning('Please select a subject.'); return; }
    if (!newClassData.teacherId) { setOverlapWarning('Please select a teacher.'); return; }
    if (!newClassData.date || !newClassData.startTime || !newClassData.endTime) {
      setOverlapWarning('Please set the date, start time, and end time.');
      return;
    }

    setScheduling(true);
    const res = await createClassSession({
      studentId: newClassData.studentId,
      subjectId: newClassData.subjectId,
      teacherId: newClassData.teacherId,
      type: newClassData.classType,
      date: newClassData.date,
      startTime: newClassData.startTime,
      endTime: newClassData.endTime,
    });
    setScheduling(false);

    if (res.ok) {
      setShowAddClassModal(false);
      setNewClassData({ studentId: '', subjectId: '', teacherId: '', classType: 'Class', date: '', startTime: '', endTime: '' });
      router.refresh();
      alert('Class scheduled.');
    } else {
      setOverlapWarning(res.error ?? 'Failed to schedule class.');
    }
  };

  const handleSaveClassCompletion = async () => {
    if (!selectedClassForCompletion) return;
    if (selectedClassForCompletion.status === 'Completed') {
      alert('This class is already completed — attendance was already recorded.');
      return;
    }
    if (!selectedClassForCompletion.studentId) { alert('This session has no linked student.'); return; }

    setSavingCompletion(true);
    const res = await completeClassWithAttendance({
      sessionId: selectedClassForCompletion.id,
      studentId: selectedClassForCompletion.studentId,
      attendance: attendanceChoice,
    });
    setSavingCompletion(false);

    if (res.ok) {
      setSelectedClassForCompletion(null);
      setAttendanceChoice('Present');
      router.refresh();
      alert('Class completed and attendance recorded.');
    } else {
      alert(res.error ?? 'Failed to save.');
    }
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher', 'student']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Academic Schedule & Class Completion</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Manage classes, schedule free makeup sessions, and log attendance & syllabus progress.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/homework"
              className="h-[38px] px-3.5 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#5B47D6]" />
              <span>Homework →</span>
            </Link>

            <Link
              href="/assessments"
              className="h-[38px] px-3.5 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Assessments →</span>
            </Link>

            {role !== 'student' && (
              <button
                onClick={() => setShowAddClassModal(true)}
                className="h-[38px] px-4 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-[#5B47D6]/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Schedule Class</span>
              </button>
            )}
          </div>
        </div>

        {/* FILTERS BAR */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-end gap-3 flex-wrap border-b border-[#EBEDF3] dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-xs text-[#6B7185] block font-medium">Class Type Filter</span>
                <select
                  value={selectedClassType}
                  onChange={(e) => setSelectedClassType(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="All Types">All Class Types</option>
                  <option value="Class">Regular Class</option>
                  <option value="Makeup">Free Makeup Class</option>
                  <option value="Test">Test / Assessment</option>
                </select>
              </div>

              <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-xs text-[#6B7185] block font-medium">Subject</span>
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="All Subjects">All Subjects</option>
                  {Array.from(new Set(classesList.map((c) => c.subject).filter(Boolean))).map((subj) => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* SCHEDULE TIMETABLE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* CLASSES TIMETABLE LIST (8 COLS) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-xs">
                    <th className="py-3.5 px-3">TIME & ROOM</th>
                    <th className="py-3.5 px-3">CLASS CODE & SUBJECT</th>
                    <th className="py-3.5 px-3">PROGRAM & GRADE</th>
                    <th className="py-3.5 px-3">TEACHER</th>
                    <th className="py-3.5 px-3">TYPE</th>
                    <th className="py-3.5 px-3">STATUS</th>
                    <th className="py-3.5 px-3 text-center">ACTION</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                  {filteredClasses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#6B7185]">
                        No scheduled classes match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredClasses.map((cls) => (
                      <tr key={cls.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-extrabold font-mono text-slate-900 dark:text-slate-100">{cls.startAt} - {cls.endAt}</div>
                          <div className="text-xs text-[#6B7185]">{cls.room}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{cls.subject}</div>
                          <div className="text-xs text-[#6B7185] font-mono">{cls.classCode}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-extrabold text-slate-900 dark:text-slate-100">{cls.studentName || '—'}</div>
                          <div className="text-xs text-[#6B7185]">{cls.program}</div>
                        </td>

                        <td className="py-3.5 px-3 font-extrabold text-slate-900 dark:text-slate-100">
                          {cls.teacherName}
                        </td>

                        {/* CLASS TYPE COLUMN (WITH FREE MAKEUP BADGE) */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1 ${
                              cls.classType === 'Makeup'
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : cls.classType === 'Test'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            <span>{cls.classType}</span>
                            {!cls.isCharged && <span className="text-xs text-purple-900 bg-white px-1 rounded font-bold">(Free)</span>}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                              cls.status === 'Live'
                                ? 'bg-emerald-100 text-emerald-700 animate-pulse'
                                : cls.status === 'Completed'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {cls.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          {role !== 'student' ? (
                            <button
                              onClick={() => setSelectedClassForCompletion(cls)}
                              className="px-3 py-1.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                            >
                              {cls.status === 'Completed' ? 'View Attendance' : 'Complete Class →'}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs font-semibold">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MAKEUP CLASS INFORMATION CARD (RIGHT 4 COLS) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-gradient-to-br from-purple-900 to-[#1D1B48] text-white rounded-[20px] p-5 shadow-lg space-y-3">
              <div className="flex items-center gap-2 font-heading font-extrabold text-sm text-purple-200 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-purple-300" />
                <span>Makeup Class Invariant Policy</span>
              </div>
              <p className="text-xs text-purple-100 leading-relaxed">
                Per Master Plan §4, a <strong>Makeup Class</strong> replaces a missed session and is <strong>never charged again</strong> to the student's voucher balance.
              </p>
              <div className="p-3 bg-white/10 rounded-xl border border-white/15 text-xs font-mono">
                <div>• Charged: <strong className="text-emerald-300">NO (Free)</strong></div>
                <div>• Conflict Check: <strong className="text-purple-300">Active (EXCLUDE Constraint)</strong></div>
              </div>
            </div>
          </div>

        </div>

        {/* MOBILE-FIRST CLASS COMPLETION DRAWER */}
        {selectedClassForCompletion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
              <div className="flex justify-between items-center border-b pb-3.5">
                <div>
                  <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-lg">
                    Class Completion — {selectedClassForCompletion.subject}
                  </h3>
                  <div className="text-xs text-[#6B7185]">
                    {selectedClassForCompletion.studentName || 'Student'} · {selectedClassForCompletion.startAt}
                  </div>
                </div>
                <button onClick={() => setSelectedClassForCompletion(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>

              {/* ATTENDANCE — one student per session */}
              <div className="space-y-3 text-xs">
                <div className="font-extrabold text-slate-900 uppercase">Mark Attendance</div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border">
                  <span className="font-extrabold text-slate-900">{selectedClassForCompletion.studentName || 'Student'}</span>
                  <div className="flex gap-1.5">
                    {(['Present', 'Late', 'Absent'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setAttendanceChoice(st)}
                        className={`px-3 py-1 rounded-lg font-extrabold ${
                          attendanceChoice === st
                            ? st === 'Present'
                              ? 'bg-emerald-600 text-white'
                              : st === 'Late'
                              ? 'bg-amber-600 text-white'
                              : 'bg-rose-600 text-white'
                            : 'bg-white border text-slate-600'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 font-medium">Saving marks the class Completed and records this attendance (feeds the health score).</p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setSelectedClassForCompletion(null)} className="px-4 py-2 border rounded-xl font-bold text-xs">Close</button>
                {selectedClassForCompletion.status === 'Completed' ? (
                  <span className="px-4 py-2 text-emerald-600 font-extrabold text-xs">Already completed — attendance recorded</span>
                ) : (
                  <button onClick={handleSaveClassCompletion} disabled={savingCompletion} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-extrabold text-xs shadow-md disabled:opacity-50">
                    {savingCompletion ? 'Saving...' : 'Complete & Save Attendance'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SCHEDULE NEW CLASS MODAL */}
        {showAddClassModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">+ Schedule New Class Session</h3>
                <button onClick={() => setShowAddClassModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Student</label>
                  <select value={newClassData.studentId} onChange={(e) => setNewClassData({ ...newClassData, studentId: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                    <option value="">Select a student...</option>
                    {students.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Subject</label>
                    <select value={newClassData.subjectId} onChange={(e) => setNewClassData({ ...newClassData, subjectId: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                      <option value="">Select...</option>
                      {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.program})</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Teacher</label>
                    <select value={newClassData.teacherId} onChange={(e) => setNewClassData({ ...newClassData, teacherId: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                      <option value="">Select...</option>
                      {teachers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Type</label>
                    <select value={newClassData.classType} onChange={(e) => setNewClassData({ ...newClassData, classType: e.target.value as any })} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                      <option value="Class">Class</option>
                      <option value="Makeup">Makeup</option>
                      <option value="Test">Test</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Start (PKT)</label>
                    <input type="time" value={newClassData.startTime} onChange={(e) => setNewClassData({ ...newClassData, startTime: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">End (PKT)</label>
                    <input type="time" value={newClassData.endTime} onChange={(e) => setNewClassData({ ...newClassData, endTime: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Date</label>
                  <input type="date" value={newClassData.date} onChange={(e) => setNewClassData({ ...newClassData, date: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                </div>

                {(students.length === 0 || subjects.length === 0 || teachers.length === 0) && (
                  <p className="text-xs text-amber-600 font-medium">Add students, subjects, and teachers first. (Run supabase/seed_subjects.sql for subjects.)</p>
                )}

                {overlapWarning && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs font-bold leading-relaxed">
                    {overlapWarning}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setShowAddClassModal(false)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
                <button onClick={handleCreateNewClass} disabled={scheduling} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-extrabold text-xs shadow-md disabled:opacity-50">{scheduling ? 'Scheduling...' : 'Confirm & Schedule'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
