'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { ScheduledClass } from '@/lib/mockAcademicsData';
import type { SubjectOption } from '@/lib/data/subjects';
import { bulkScheduleClasses, completeClassWithAttendance } from './actions';
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
  students: { id: string; name: string; program?: string }[];
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

  // SCHEDULE WIZARD (set up a qualified student's whole timetable at once)
  type WizRow = { subjectId: string; teacherId: string; weekdays: number[]; startTime: string; endTime: string };
  const emptyRow = (): WizRow => ({ subjectId: '', teacherId: '', weekdays: [1, 2, 3, 4, 5], startTime: '', endTime: '' });
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const [showAddClassModal, setShowAddClassModal] = useState<boolean>(false);
  const [studentTab, setStudentTab] = useState<'new' | 'scheduled'>('new');
  const [wizStudentId, setWizStudentId] = useState('');
  const [wizType, setWizType] = useState<'Class' | 'Makeup' | 'Test'>('Class');
  const [wizStartDate, setWizStartDate] = useState(todayStr);
  const [wizWeeks, setWizWeeks] = useState(4);
  const [wizRows, setWizRows] = useState<WizRow[]>([emptyRow()]);
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

  // Split students into "new" (no class sessions yet) vs "already scheduled".
  const scheduledStudentIds = useMemo(
    () => new Set(classesList.map((c) => c.studentId).filter(Boolean) as string[]),
    [classesList]
  );
  const wizStudentList = useMemo(
    () => students.filter((s) => (studentTab === 'scheduled' ? scheduledStudentIds.has(s.id) : !scheduledStudentIds.has(s.id))),
    [students, studentTab, scheduledStudentIds]
  );
  const wizStudent = students.find((s) => s.id === wizStudentId);
  const wizProgram = wizStudent?.program;
  const wizSubjects = wizProgram ? subjects.filter((s) => s.program === wizProgram) : subjects;

  const updateRow = (i: number, patch: Partial<WizRow>) =>
    setWizRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const toggleWeekday = (i: number, day: number) =>
    setWizRows((rows) =>
      rows.map((r, idx) =>
        idx === i
          ? { ...r, weekdays: r.weekdays.includes(day) ? r.weekdays.filter((d) => d !== day) : [...r.weekdays, day].sort() }
          : r
      )
    );
  const addRow = () => setWizRows((rows) => [...rows, emptyRow()]);
  const removeRow = (i: number) => setWizRows((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));
  const resetWizard = () => {
    setWizStudentId(''); setWizType('Class'); setWizStartDate(todayStr); setWizWeeks(4); setWizRows([emptyRow()]); setOverlapWarning(null);
  };

  // Bulk-generate the student's timetable. Teacher time conflicts are skipped by
  // the DB EXCLUDE constraint and reported back as a count.
  const handleBulkSchedule = async () => {
    setOverlapWarning(null);
    if (!wizStudentId) { setOverlapWarning('Please select a student.'); return; }
    if (!wizStartDate) { setOverlapWarning('Pick a start date.'); return; }
    const rows = wizRows.filter((r) => r.subjectId && r.teacherId && r.weekdays.length && r.startTime && r.endTime);
    if (rows.length === 0) { setOverlapWarning('Add at least one subject with a teacher, day(s), and a time.'); return; }

    setScheduling(true);
    const res = await bulkScheduleClasses({ studentId: wizStudentId, startDate: wizStartDate, weeks: wizWeeks, type: wizType, rows });
    setScheduling(false);

    if (res.ok) {
      setShowAddClassModal(false);
      resetWizard();
      router.refresh();
      alert(`Scheduled ${res.created} class${res.created === 1 ? '' : 'es'}${res.conflicts ? ` · ${res.conflicts} skipped (teacher time conflict)` : ''}.`);
    } else {
      setOverlapWarning(res.error ?? 'Failed to schedule.');
    }
  };

  const handleSaveClassCompletion = async () => {
    if (!selectedClassForCompletion) return;
    if (selectedClassForCompletion.status === 'Completed') {
      alert('This class is already completed - attendance was already recorded.');
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
                          <div className="font-extrabold text-slate-900 dark:text-slate-100">{cls.studentName || '-'}</div>
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
                            <span className="text-slate-400 text-xs font-semibold">-</span>
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
                    Class Completion - {selectedClassForCompletion.subject}
                  </h3>
                  <div className="text-xs text-[#6B7185]">
                    {selectedClassForCompletion.studentName || 'Student'} · {selectedClassForCompletion.startAt}
                  </div>
                </div>
                <button onClick={() => setSelectedClassForCompletion(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>

              {/* ATTENDANCE - one student per session */}
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
                  <span className="px-4 py-2 text-emerald-600 font-extrabold text-xs">Already completed - attendance recorded</span>
                ) : (
                  <button onClick={handleSaveClassCompletion} disabled={savingCompletion} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-extrabold text-xs shadow-md disabled:opacity-50">
                    {savingCompletion ? 'Saving...' : 'Complete & Save Attendance'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SCHEDULE WIZARD MODAL */}
        {showAddClassModal && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-5 my-6 text-sm">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-xl">Schedule a Student's Classes</h3>
                  <p className="text-xs text-[#6B7185] mt-1 leading-relaxed">Pick the student, add each subject with its teacher, days and time. A month of classes is generated on the selected weekdays (weekends stay off unless you tick them).</p>
                </div>
                <button onClick={() => setShowAddClassModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              {/* STUDENT FILTER TABS + PICKER */}
              <div className="space-y-2">
                <div className="flex items-center gap-1 bg-[#F6F7FB] dark:bg-slate-800 p-1 rounded-xl w-max">
                  {(['new', 'scheduled'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setStudentTab(t); setWizStudentId(''); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all ${studentTab === t ? 'bg-[#5B47D6] text-white shadow-sm' : 'text-[#6B7185]'}`}
                    >
                      {t === 'new' ? 'New (no classes)' : 'Already scheduled'}
                    </button>
                  ))}
                </div>
                <label className="text-slate-700 dark:text-slate-300 block font-bold">Student</label>
                <select value={wizStudentId} onChange={(e) => setWizStudentId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-3 text-slate-900 dark:text-slate-100 font-bold">
                  <option value="">Select a student...</option>
                  {wizStudentList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.program ? ` - ${s.program}` : ''}</option>))}
                </select>
                {wizStudentList.length === 0 && (
                  <p className="text-xs text-amber-600 font-medium">No {studentTab === 'new' ? 'unscheduled' : 'scheduled'} students in this list.</p>
                )}
                {wizProgram && (
                  <p className="text-xs text-[#6B7185]">Program: <strong className="text-slate-800 dark:text-slate-200">{wizProgram}</strong> - subjects below are filtered to it.</p>
                )}
              </div>

              {/* SUBJECT ROWS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">Subjects, teachers, days &amp; time</label>
                  <button onClick={addRow} className="text-xs font-extrabold text-[#5B47D6] hover:underline">+ Add subject</button>
                </div>
                {wizRows.map((r, i) => (
                  <div key={i} className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-[#6B7185] font-bold block mb-1">Subject</label>
                        <select value={r.subjectId} onChange={(e) => updateRow(i, { subjectId: e.target.value })} className="w-full bg-white dark:bg-slate-900 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-bold">
                          <option value="">Select subject...</option>
                          {wizSubjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#6B7185] font-bold block mb-1">Teacher</label>
                        <select value={r.teacherId} onChange={(e) => updateRow(i, { teacherId: e.target.value })} className="w-full bg-white dark:bg-slate-900 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-bold">
                          <option value="">Select teacher...</option>
                          {teachers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#6B7185] font-bold block mb-1">Days (Sat/Sun off by default)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[{ d: 1, l: 'Mon' }, { d: 2, l: 'Tue' }, { d: 3, l: 'Wed' }, { d: 4, l: 'Thu' }, { d: 5, l: 'Fri' }, { d: 6, l: 'Sat' }, { d: 0, l: 'Sun' }].map(({ d, l }) => (
                          <button
                            key={d}
                            onClick={() => toggleWeekday(i, d)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${r.weekdays.includes(d) ? 'bg-[#5B47D6] text-white border-[#5B47D6]' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-[#6B7185] font-bold block mb-1">Start (PKT)</label>
                        <input type="time" value={r.startTime} onChange={(e) => updateRow(i, { startTime: e.target.value })} className="w-full bg-white dark:bg-slate-900 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-bold" />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#6B7185] font-bold block mb-1">End (PKT)</label>
                        <input type="time" value={r.endTime} onChange={(e) => updateRow(i, { endTime: e.target.value })} className="w-full bg-white dark:bg-slate-900 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-bold" />
                      </div>
                    </div>
                    {wizRows.length > 1 && (
                      <button onClick={() => removeRow(i)} className="text-xs font-bold text-rose-600 hover:underline">Remove this subject</button>
                    )}
                  </div>
                ))}
              </div>

              {/* TYPE + DURATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Class type</label>
                  <select value={wizType} onChange={(e) => setWizType(e.target.value as any)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-bold">
                    <option value="Class">Regular class</option>
                    <option value="Makeup">Makeup (free replacement)</option>
                    <option value="Test">Test / assessment</option>
                  </select>
                  <p className="text-[11px] text-[#6B7185] mt-1 leading-relaxed">Regular = normal teaching class · Makeup = a free replacement for a missed class · Test = an assessment session.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Start date</label>
                    <input type="date" value={wizStartDate} min={todayStr} onChange={(e) => setWizStartDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-bold" />
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Generate for</label>
                    <select value={wizWeeks} onChange={(e) => setWizWeeks(Number(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-bold">
                      <option value={1}>1 week</option>
                      <option value={2}>2 weeks</option>
                      <option value={4}>1 month</option>
                      <option value={8}>2 months</option>
                    </select>
                  </div>
                </div>
              </div>

              {(subjects.length === 0 || teachers.length === 0) && (
                <p className="text-xs text-amber-600 font-medium">Add subjects and teachers first. (Run supabase/seed_subjects.sql for subjects.)</p>
              )}
              {overlapWarning && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs font-bold leading-relaxed">{overlapWarning}</div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button onClick={() => setShowAddClassModal(false)} className="px-5 py-2.5 border rounded-xl font-bold">Cancel</button>
                <button onClick={handleBulkSchedule} disabled={scheduling} className="px-5 py-2.5 bg-[#5B47D6] text-white rounded-xl font-extrabold shadow-md disabled:opacity-50">{scheduling ? 'Scheduling...' : 'Confirm & Schedule'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
