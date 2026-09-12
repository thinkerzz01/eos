'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { ScheduledClass } from '@/lib/mockAcademicsData';
import type { SubjectOption } from '@/lib/data/subjects';
import { subjectLabel, labelWithCode } from '@/lib/syllabiSeed';
import { bulkScheduleClasses, completeClassWithAttendance, createClassSession, updateClassSession, deleteClassSession, rescheduleClass, saveClassNote, bulkDeleteClasses, listStudentEnrollments } from './actions';
import { downloadCsv } from '@/lib/export/csv';
import { ClassCalendar } from './ClassCalendar';
import {
  Calendar,
  CalendarDays,
  List,
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
  ChevronRight,
  RotateCcw,
  FileText,
  SlidersHorizontal,
  DollarSign,
  Check,
  Pencil,
  Trash2,
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

  // LIST vs CALENDAR view. Teachers/students land on the calendar (they just want
  // to see their own timetable); admin/manager default to the list (they manage
  // classes there via bulk actions/edit). Both views share the same RLS-scoped
  // rows and the same filters below.
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(
    role === 'teacher' || role === 'student' ? 'calendar' : 'list'
  );

  // LOCAL SCHEDULE STATE STORE (seeded from server, RLS-authorized)
  const [classesList, setClassesList] = useState<ScheduledClass[]>(initialClasses);

  // Keep the list in sync when the server refetches after a write (router.refresh()).
  useEffect(() => { setClassesList(initialClasses); }, [initialClasses]);
  const [selectedClassType, setSelectedClassType] = useState<string>('All Types');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All Subjects');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Date window for the LIST view. Recurring timetables make the flat list run to
  // dozens of near-identical rows, so we default to "upcoming" (today onward) and
  // let the user widen it. The calendar view ignores this (it navigates by month).
  const [dateRange, setDateRange] = useState<'upcoming' | 'week' | 'month' | 'past' | 'all'>('upcoming');
  // Which recurring series (student+subject+teacher+time) are expanded in the list.
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());

  // MOBILE CLASS COMPLETION DRAWER
  const [selectedClassForCompletion, setSelectedClassForCompletion] = useState<ScheduledClass | null>(null);
  const [attendanceChoice, setAttendanceChoice] = useState<'Present' | 'Late' | 'Absent'>('Present');
  const [classNoteText, setClassNoteText] = useState('');
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
  const [wizDurCustom, setWizDurCustom] = useState(false); // "Custom" duration picker
  const [wizRows, setWizRows] = useState<WizRow[]>([emptyRow()]);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  // SINGLE-CLASS quick scheduler (one class at one time - uses createClassSession).
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [scStudentId, setScStudentId] = useState('');
  const [scSubjectId, setScSubjectId] = useState('');
  const [scTeacherId, setScTeacherId] = useState('');
  const [scType, setScType] = useState<'Class' | 'Makeup' | 'Test'>('Class');
  const [scDate, setScDate] = useState(todayStr);
  const [scStart, setScStart] = useState('');
  const [scEnd, setScEnd] = useState('');
  const [scSaving, setScSaving] = useState(false);
  const [scError, setScError] = useState<string | null>(null);

  // A student's enrolled subjects+teachers (from admission). Loaded when a student
  // is picked in either scheduling modal so the subject/teacher pre-fill instead
  // of asking the admin to re-select what was already chosen at enrollment.
  const [scEnrollments, setScEnrollments] = useState<{ subjectId: string; teacherId: string }[]>([]);

  const scStudent = students.find((s) => s.id === scStudentId);
  // The single-class subject list: the student's ENROLLED subjects when we have
  // them, else all program subjects (so nothing breaks if enrollment is empty).
  const scEnrolledSubjectIds = new Set(scEnrollments.map((e) => e.subjectId));
  const scTeacherBySubject = new Map(scEnrollments.map((e) => [e.subjectId, e.teacherId]));
  const scAllSubjects = scStudent?.program ? subjects.filter((s) => s.program === scStudent.program) : subjects;
  const scSubjects = scEnrollments.length > 0 ? scAllSubjects.filter((s) => scEnrolledSubjectIds.has(s.id)) : scAllSubjects;

  // Single modal: load the picked student's enrollment, auto-select subject+teacher.
  useEffect(() => {
    if (!scStudentId) { setScEnrollments([]); return; }
    let alive = true;
    listStudentEnrollments(scStudentId)
      .then((es) => {
        if (!alive) return;
        setScEnrollments(es);
        if (es.length > 0) { setScSubjectId(es[0].subjectId); setScTeacherId(es[0].teacherId); }
      })
      .catch(() => { if (alive) setScEnrollments([]); });
    return () => { alive = false; };
  }, [scStudentId]);

  // Timetable wizard: picking a student pre-fills one row per enrolled subject
  // with its teacher already selected (admin just adds days & times). Falls back
  // to a single blank row if the student has no recorded enrollment yet.
  useEffect(() => {
    if (!wizStudentId) return;
    let alive = true;
    listStudentEnrollments(wizStudentId)
      .then((es) => {
        if (!alive) return;
        setWizRows(
          es.length > 0
            ? es.map((e) => ({ subjectId: e.subjectId, teacherId: e.teacherId, weekdays: [1, 2, 3, 4, 5], startTime: '', endTime: '' }))
            : [emptyRow()]
        );
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [wizStudentId]);

  // Classes default to one hour: picking a start auto-fills end = start + 1h.
  const addOneHour = (hhmm: string): string => {
    if (!/^\d{2}:\d{2}$/.test(hhmm)) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(2000, 0, 1, h, m);
    d.setHours(d.getHours() + 1);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const resetSingle = () => {
    setScStudentId(''); setScSubjectId(''); setScTeacherId('');
    setScType('Class'); setScDate(todayStr); setScStart(''); setScEnd('');
    setScError(null);
  };

  const handleAddSingleClass = async () => {
    setScError(null);
    if (!scStudentId || !scSubjectId || !scTeacherId || !scDate || !scStart || !scEnd) {
      setScError('Student, subject, teacher, date, start and end time are all required.');
      return;
    }
    setScSaving(true);
    const res = await createClassSession({
      studentId: scStudentId, subjectId: scSubjectId, teacherId: scTeacherId,
      type: scType, date: scDate, startTime: scStart, endTime: scEnd,
    });
    setScSaving(false);
    if (res.ok) {
      setShowSingleModal(false);
      resetSingle();
      router.refresh();
      alert(res.calendarWarning ? `Class scheduled.\n\n${res.calendarWarning}` : 'Class scheduled.');
    } else {
      setScError(res.error ?? 'Failed to schedule the class.');
    }
  };

  // EDIT one existing class (subject / teacher / type / date / time).
  const canManage = role === 'admin' || role === 'manager';
  const [editClass, setEditClass] = useState<ScheduledClass | null>(null);
  const [edSubjectId, setEdSubjectId] = useState('');
  const [edTeacherId, setEdTeacherId] = useState('');
  const [edType, setEdType] = useState<'Class' | 'Makeup' | 'Test'>('Class');
  const [edDate, setEdDate] = useState('');
  const [edStart, setEdStart] = useState('');
  const [edEnd, setEdEnd] = useState('');
  const [edSaving, setEdSaving] = useState(false);
  const [edError, setEdError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Raw UTC ISO -> PKT date (YYYY-MM-DD) / time (HH:MM) for prefilling the inputs.
  const isoToPktDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }) : todayStr);
  const isoToPktTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false }) : '');

  const edStudent = editClass ? students.find((s) => s.id === editClass.studentId) : undefined;
  const edSubjects = edStudent?.program ? subjects.filter((s) => s.program === edStudent.program) : subjects;

  const openEdit = (cls: ScheduledClass) => {
    setEditClass(cls);
    setEdSubjectId(cls.subjectId ?? '');
    setEdTeacherId(cls.teacherId ?? '');
    setEdType(cls.classType);
    setEdDate(isoToPktDate(cls.startAtISO));
    setEdStart(isoToPktTime(cls.startAtISO));
    setEdEnd(isoToPktTime(cls.endAtISO));
    setEdError(null);
  };

  const handleUpdateClass = async () => {
    if (!editClass) return;
    setEdError(null);
    if (!edSubjectId || !edTeacherId || !edDate || !edStart || !edEnd) {
      setEdError('Subject, teacher, date, start and end time are all required.');
      return;
    }
    setEdSaving(true);
    const res = await updateClassSession({
      sessionId: editClass.id, subjectId: edSubjectId, teacherId: edTeacherId,
      type: edType, date: edDate, startTime: edStart, endTime: edEnd,
    });
    setEdSaving(false);
    if (res.ok) {
      setEditClass(null);
      router.refresh();
      alert(res.calendarWarning ? `Class updated.\n\n${res.calendarWarning}` : 'Class updated.');
    } else {
      setEdError(res.error ?? 'Failed to update the class.');
    }
  };

  const handleDeleteClass = async (cls: ScheduledClass) => {
    const when = `${cls.date}, ${cls.startAt}`;
    if (!window.confirm(`Delete this class?\n\n${cls.subject} - ${cls.studentName || 'student'}\n${when}\n\nThis cancels the class and its calendar invite. This cannot be undone.`)) return;
    setDeletingId(cls.id);
    const res = await deleteClassSession({ sessionId: cls.id });
    setDeletingId(null);
    if (res.ok) {
      router.refresh();
      if (res.calendarWarning) alert(`Class deleted.\n\n${res.calendarWarning}`);
    } else {
      alert(res.error ?? 'Failed to delete the class.');
    }
  };

  // TEACHER RESCHEDULE (moves the class time + auto-notifies the student).
  const [rsClass, setRsClass] = useState<ScheduledClass | null>(null);
  const [rsDate, setRsDate] = useState('');
  const [rsStart, setRsStart] = useState('');
  const [rsEnd, setRsEnd] = useState('');
  const [rsSaving, setRsSaving] = useState(false);
  const [rsError, setRsError] = useState<string | null>(null);

  const openReschedule = (cls: ScheduledClass) => {
    setRsClass(cls);
    setRsDate(isoToPktDate(cls.startAtISO));
    setRsStart(isoToPktTime(cls.startAtISO));
    setRsEnd(isoToPktTime(cls.endAtISO));
    setRsError(null);
  };
  const handleReschedule = async () => {
    if (!rsClass) return;
    setRsError(null);
    if (!rsDate || !rsStart || !rsEnd) { setRsError('Date, start and end time are all required.'); return; }
    setRsSaving(true);
    const res = await rescheduleClass({ sessionId: rsClass.id, date: rsDate, startTime: rsStart, endTime: rsEnd });
    setRsSaving(false);
    if (res.ok) {
      setRsClass(null);
      router.refresh();
      alert(res.calendarWarning ? `Class rescheduled. The student has been notified.\n\n${res.calendarWarning}` : 'Class rescheduled. The student has been notified.');
    } else {
      setRsError(res.error ?? 'Failed to reschedule the class.');
    }
  };

  // Open the completion drawer with attendance/note prefilled. Shared by the
  // list view's "Complete Class" button and the calendar's event detail.
  const openCompletion = (cls: ScheduledClass) => {
    const mark = cls.attendanceStatus;
    setAttendanceChoice(mark === 'late' ? 'Late' : mark === 'absent' ? 'Absent' : 'Present');
    setClassNoteText(cls.classNote ?? '');
    setSelectedClassForCompletion(cls);
  };

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

  // Shift a YYYY-MM-DD date by n days, staying in Pakistan time.
  const addDaysPkt = (base: string, n: number) => {
    const d = new Date(`${base}T00:00:00+05:00`);
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  };
  const weekEnd = useMemo(() => addDaysPkt(todayStr, 6), [todayStr]);
  const monthEnd = useMemo(() => addDaysPkt(todayStr, 30), [todayStr]);

  // The LIST view narrows filteredClasses to the chosen date window (calendar view
  // is unaffected - it has its own month navigation). YYYY-MM-DD strings compare
  // correctly with < / >=, so no Date maths is needed for the range test.
  const listClasses = useMemo(() => {
    if (dateRange === 'all') return filteredClasses;
    return filteredClasses.filter((c) => {
      const d = isoToPktDate(c.startAtISO);
      if (dateRange === 'upcoming') return d >= todayStr;
      if (dateRange === 'past') return d < todayStr;
      if (dateRange === 'week') return d >= todayStr && d <= weekEnd;
      if (dateRange === 'month') return d >= todayStr && d <= monthEnd;
      return true;
    });
  }, [filteredClasses, dateRange, todayStr, weekEnd, monthEnd]);

  // Collapse recurring sessions into ONE "series" row each. A series is the same
  // student + subject + teacher + time slot + type (e.g. "Ali · Maths · 7-8pm ·
  // Mon-Fri"); every date in it becomes a child row you can expand. A one-off
  // class is a series of size 1 and renders as a normal single row.
  type ClassSeries = {
    key: string;
    sessions: ScheduledClass[];
    sample: ScheduledClass;
    count: number;
    weekdayLabel: string;
    next?: ScheduledClass;
    doneCount: number;
  };
  const WD_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dowShort = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { timeZone: 'Asia/Karachi', weekday: 'short' }) : '';
  const seriesList = useMemo<ClassSeries[]>(() => {
    const map = new Map<string, ScheduledClass[]>();
    listClasses.forEach((c) => {
      const key = [c.studentId ?? c.studentName, c.subjectId ?? c.subject, c.teacherId ?? c.teacherName, c.startAt, c.endAt, c.classType].join('|');
      const bucket = map.get(key);
      if (bucket) bucket.push(c);
      else map.set(key, [c]);
    });
    const out: ClassSeries[] = [];
    Array.from(map.entries()).forEach(([key, sessions]) => {
      sessions.sort((a, b) => isoToPktDate(a.startAtISO).localeCompare(isoToPktDate(b.startAtISO)));
      const daySet = new Set(sessions.map((s) => dowShort(s.startAtISO)));
      const present = WD_ORDER.filter((d) => daySet.has(d));
      // Contiguous run of 3+ (e.g. Mon-Fri) is shown as a range; otherwise listed.
      let weekdayLabel = present.join(', ');
      if (present.length >= 3) {
        const startIdx = WD_ORDER.indexOf(present[0]);
        const contiguous = present.every((d, i) => WD_ORDER[startIdx + i] === d);
        if (contiguous) weekdayLabel = `${present[0]}–${present[present.length - 1]}`;
      }
      const next = sessions.find((s) => isoToPktDate(s.startAtISO) >= todayStr) ?? sessions[sessions.length - 1];
      const doneCount = sessions.filter((s) => s.status === 'Completed').length;
      out.push({ key, sessions, sample: sessions[0], count: sessions.length, weekdayLabel, next, doneCount });
    });
    // Order the list by each series' next (or last) class date, soonest first.
    out.sort((a, b) => isoToPktDate(a.next?.startAtISO).localeCompare(isoToPktDate(b.next?.startAtISO)));
    return out;
  }, [listClasses, todayStr]);

  const toggleSeries = (key: string) =>
    setExpandedSeries((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const handleDeleteSeries = async (s: ClassSeries) => {
    const ids = s.sessions.map((x) => x.id);
    if (!confirm(`Delete all ${ids.length} "${s.sample.subject}" classes for ${s.sample.studentName || 'this student'} (${s.sample.startAt}–${s.sample.endAt})? They are cancelled and removed from the timetable. This is logged.`)) return;
    setBulkBusy(true);
    const res = await bulkDeleteClasses({ sessionIds: ids });
    setBulkBusy(false);
    if (res.ok) { setSelectedClassIds((prev) => prev.filter((id) => !ids.includes(id))); router.refresh(); }
    else alert(res.error ?? 'Failed to delete the series.');
  };

  // BULK SELECTION on the class list (admin/manager; teachers see their own via RLS).
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleSelectAllClasses = () => {
    if (selectedClassIds.length === listClasses.length) setSelectedClassIds([]);
    else setSelectedClassIds(listClasses.map((c) => c.id));
  };
  const toggleSelectClass = (id: string) => {
    setSelectedClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  // Select / clear every session in one recurring series at once.
  const toggleSelectSeries = (ids: string[]) => {
    setSelectedClassIds((prev) => {
      const all = ids.every((id) => prev.includes(id));
      return all ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]));
    });
  };
  const bulkExportClasses = () => {
    const rows = listClasses.filter((c) => selectedClassIds.includes(c.id));
    downloadCsv(
      'Thinkerzz_Classes',
      ['Class Code', 'Date', 'Time', 'Subject', 'Student', 'Teacher', 'Type', 'Status'],
      rows.map((c) => [c.classCode, c.date, `${c.startAt} - ${c.endAt}`, c.subject, c.studentName ?? '', c.teacherName, c.classType, c.status])
    );
  };
  const handleBulkDeleteClasses = async () => {
    if (selectedClassIds.length === 0) return;
    if (!confirm(`Delete ${selectedClassIds.length} selected class${selectedClassIds.length === 1 ? '' : 'es'}? They are cancelled and removed from the timetable. This is logged.`)) return;
    setBulkBusy(true);
    const res = await bulkDeleteClasses({ sessionIds: selectedClassIds });
    setBulkBusy(false);
    if (res.ok) { setSelectedClassIds([]); router.refresh(); }
    else alert(res.error ?? 'Failed to delete the selected classes.');
  };

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
    setWizStudentId(''); setWizType('Class'); setWizStartDate(todayStr); setWizWeeks(4); setWizDurCustom(false); setWizRows([emptyRow()]); setOverlapWarning(null);
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
      const base = `Scheduled ${res.created} class${res.created === 1 ? '' : 'es'}${res.conflicts ? ` · ${res.conflicts} skipped (teacher time conflict)` : ''}.`;
      alert(res.calendarWarning ? `${base}\n\n${res.calendarWarning}` : base);
    } else {
      setOverlapWarning(res.error ?? 'Failed to schedule.');
    }
  };

  const handleSaveClassCompletion = async () => {
    if (!selectedClassForCompletion) return;
    if (!selectedClassForCompletion.studentId) { alert('This session has no linked student.'); return; }
    const wasCompleted = selectedClassForCompletion.status === 'Completed';

    setSavingCompletion(true);
    const res = await completeClassWithAttendance({
      sessionId: selectedClassForCompletion.id,
      studentId: selectedClassForCompletion.studentId,
      attendance: attendanceChoice,
    });
    // Save the class note too (best-effort - don't fail completion on a note error).
    if (res.ok && (classNoteText.trim() !== (selectedClassForCompletion.classNote ?? '').trim())) {
      await saveClassNote({ sessionId: selectedClassForCompletion.id, note: classNoteText });
    }
    setSavingCompletion(false);

    if (res.ok) {
      setSelectedClassForCompletion(null);
      setAttendanceChoice('Present');
      setClassNoteText('');
      router.refresh();
      alert(wasCompleted ? 'Attendance updated.' : 'Class completed and attendance recorded.');
    } else {
      alert(res.error ?? 'Failed to save.');
    }
  };

  // One class row for the list table. `child` renders it as an indented member of
  // an expanded recurring series (date-led, muted student cell). Single one-off
  // classes reuse this with `child` unset.
  const renderRow = (cls: ScheduledClass, child = false) => (
    <tr key={cls.id} className={`transition-colors ${child ? 'bg-slate-50/60 dark:bg-slate-800/30 hover:bg-slate-100/70' : 'hover:bg-slate-50'}`}>
      {canManage && (
        <td className={`py-3.5 px-3 text-center ${child ? 'pl-8' : ''}`} onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={selectedClassIds.includes(cls.id)} onChange={() => toggleSelectClass(cls.id)} className="rounded accent-[#5B47D6]" />
        </td>
      )}
      <td className={`py-3.5 px-3 ${child ? 'pl-6 text-[#6B7185]' : 'font-medium text-slate-900 dark:text-slate-100'}`}>
        {child ? <span className="text-slate-400">↳</span> : (cls.studentName || '-')}
      </td>
      <td className="py-3.5 px-3">
        <div className="font-medium text-slate-900 dark:text-slate-100">{cls.date}</div>
        <div className="font-mono text-xs text-[#6B7185]">{cls.startAt} - {cls.endAt}</div>
      </td>
      <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">{cls.teacherName}</td>
      <td className="py-3.5 px-3 text-[#6B7185]">{cls.program}</td>
      <td className="py-3.5 px-3">
        <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{cls.subject}</div>
        {cls.meetingLink ? (
          <a href={cls.meetingLink} target="_blank" rel="noreferrer" className="text-xs font-medium text-[#5B47D6] hover:underline">Join</a>
        ) : (
          <span title="No Google Calendar invite was sent for this class. Check the student/teacher email or reconnect Google, then reschedule - or add a Meet link manually." className="text-xs text-amber-600 font-medium">No invite</span>
        )}
      </td>
      <td className="py-3.5 px-3">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${cls.classType === 'Makeup' ? 'bg-purple-100 text-purple-700 border border-purple-200' : cls.classType === 'Test' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700'}`}>
          <span>{cls.classType}</span>
          {!cls.isCharged && <span className="text-xs text-purple-900 bg-white px-1 rounded font-medium">(Free)</span>}
        </span>
      </td>
      <td className="py-3.5 px-3">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cls.status === 'Live' ? 'bg-emerald-100 text-emerald-700' : cls.status === 'Completed' ? 'bg-slate-200 text-slate-700' : 'bg-blue-50 text-blue-600'}`}>{cls.status}</span>
      </td>
      <td className="py-3.5 px-3">
        {role !== 'student' ? (
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => openCompletion(cls)} className="px-3 py-1.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer">
              {cls.status === 'Completed' ? 'View Attendance' : 'Complete Class'}
            </button>
            {cls.status !== 'Completed' && cls.status !== 'Cancelled' && (
              <button onClick={() => openReschedule(cls)} className="px-2.5 py-1.5 bg-amber-50 text-amber-700 font-medium text-xs rounded-xl border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer">Reschedule</button>
            )}
            {canManage && (
              <>
                <button onClick={() => openEdit(cls)} title="Edit class" aria-label="Edit class" className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-[#5B47D6] transition-colors"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDeleteClass(cls)} disabled={deletingId === cls.id} title="Delete class" aria-label="Delete class" className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        ) : (
          <span className="text-slate-400 text-xs font-medium">-</span>
        )}
      </td>
    </tr>
  );

  // One class card for the mobile list. `child` renders the collapsed member of
  // an expanded series (date-led, indented).
  const renderCard = (cls: ScheduledClass, child = false) => (
    <div key={cls.id} className={`p-4 space-y-2.5 ${child ? 'pl-7 bg-slate-50/60 dark:bg-slate-800/30' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{child ? cls.date : (cls.subject || 'Class')}</div>
          <div className="text-xs text-[#6B7185] truncate">{child ? `${cls.startAt} - ${cls.endAt}` : `${cls.studentName || '-'}${cls.program ? ` · ${cls.program}` : ''}`}</div>
        </div>
        <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls.status === 'Live' ? 'bg-emerald-100 text-emerald-700' : cls.status === 'Completed' ? 'bg-slate-200 text-slate-700' : 'bg-blue-50 text-blue-600'}`}>{cls.status}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {!child && <span className="font-medium text-slate-700 dark:text-slate-200">{cls.date}, {cls.startAt} - {cls.endAt}</span>}
        <span className="text-[#6B7185]">{cls.teacherName}</span>
        <span className={`px-2 py-0.5 rounded-full font-medium ${cls.classType === 'Makeup' ? 'bg-purple-100 text-purple-700' : cls.classType === 'Test' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{cls.classType}{!cls.isCharged && ' (Free)'}</span>
        {cls.meetingLink ? (
          <a href={cls.meetingLink} target="_blank" rel="noreferrer" className="text-[#5B47D6] font-medium">Join</a>
        ) : (
          <span className="text-amber-600 font-medium">No invite</span>
        )}
      </div>
      {role !== 'student' && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button onClick={() => openCompletion(cls)} className="flex-1 min-w-[130px] px-3 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white font-medium text-xs rounded-xl">
            {cls.status === 'Completed' ? 'View Attendance' : 'Complete Class'}
          </button>
          {cls.status !== 'Completed' && cls.status !== 'Cancelled' && (
            <button onClick={() => openReschedule(cls)} className="px-3 py-2 bg-amber-50 text-amber-700 font-medium text-xs rounded-xl border border-amber-200">Reschedule</button>
          )}
          {canManage && (
            <>
              <button onClick={() => openEdit(cls)} aria-label="Edit class" className="p-2 rounded-lg border border-slate-200 text-slate-600"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDeleteClass(cls)} disabled={deletingId === cls.id} aria-label="Delete class" className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
            </>
          )}
        </div>
      )}
    </div>
  );

  const colCount = canManage ? 9 : 8;

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher', 'student']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>{role === 'student' || role === 'teacher' ? 'My Classes' : 'Academic Schedule & Class Completion'}</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              {role === 'student'
                ? 'Your upcoming classes and Google Meet links. Switch to the calendar to see your week at a glance.'
                : role === 'teacher'
                ? 'Your teaching timetable. Use the calendar to see your week, and complete or reschedule classes.'
                : 'Manage classes, schedule free makeup sessions, and log attendance & syllabus progress.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/homework"
              className="h-[38px] px-3.5 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#5B47D6]" />
              <span>Homework</span>
            </Link>

            <Link
              href="/assessments"
              className="h-[38px] px-3.5 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Assessments</span>
            </Link>

            {canManage && (
              <>
                <button
                  onClick={() => { resetSingle(); setShowSingleModal(true); }}
                  className="h-[38px] px-4 bg-white dark:bg-slate-900 border border-[#5B47D6] text-[#5B47D6] hover:bg-[#5B47D6]/5 text-xs font-medium rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Single Class</span>
                </button>
                <button
                  onClick={() => setShowAddClassModal(true)}
                  className="h-[38px] px-4 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium rounded-xl flex items-center gap-1.5 shadow-sm shadow-[#5B47D6]/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Schedule Timetable</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* FILTERS BAR */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-[#EBEDF3] dark:border-slate-800 pb-3">
            {/* LIST / CALENDAR VIEW TOGGLE */}
            <div className="flex items-center gap-1 bg-[#F6F7FB] dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  viewMode === 'list' ? 'bg-[#5B47D6] text-white shadow-sm' : 'text-[#6B7185] hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  viewMode === 'calendar' ? 'bg-[#5B47D6] text-white shadow-sm' : 'text-[#6B7185] hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" /> Calendar
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {viewMode === 'list' && (
                <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-xs text-[#6B7185] block font-medium">Show</span>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                    className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="upcoming">Upcoming (today on)</option>
                    <option value="week">Next 7 days</option>
                    <option value="month">Next 30 days</option>
                    <option value="past">Past classes</option>
                    <option value="all">All dates</option>
                  </select>
                </div>
              )}
              <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-xs text-[#6B7185] block font-medium">Class Type Filter</span>
                <select
                  value={selectedClassType}
                  onChange={(e) => setSelectedClassType(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
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
                  className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="All Subjects">All Subjects</option>
                  {Array.from(new Set(classesList.map((c) => c.subject).filter(Boolean))).map((subj) => (
                    <option key={subj} value={subj}>{subjectLabel(subj)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* BULK ACTION BAR — appears when classes are selected (list view only) */}
        {viewMode === 'list' && canManage && selectedClassIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-[#EEEBFB] dark:bg-[#5B47D6]/15 border border-[#5B47D6]/30 rounded-[14px] px-4 py-2.5 text-sm">
            <span className="font-medium text-[#5B47D6] dark:text-[#b9adf2]">{selectedClassIds.length} selected</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <button
              onClick={bulkExportClasses}
              disabled={bulkBusy}
              className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" /> Export
            </button>
            <button
              onClick={handleBulkDeleteClasses}
              disabled={bulkBusy}
              className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> {bulkBusy ? 'Working…' : 'Delete'}
            </button>
            <button
              onClick={() => setSelectedClassIds([])}
              disabled={bulkBusy}
              className="ml-auto h-8 px-3 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        )}

        {/* SCHEDULE TIMETABLE GRID / CALENDAR — same RLS-scoped rows, two views */}
        {viewMode === 'calendar' ? (
          <ClassCalendar
            classes={filteredClasses}
            canManage={canManage}
            role={role}
            onComplete={openCompletion}
            onReschedule={openReschedule}
            onEdit={openEdit}
            onDelete={handleDeleteClass}
          />
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* CLASSES TIMETABLE LIST (full width) */}
          <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                    {canManage && (
                      <th className="py-3.5 px-3 w-[36px] text-center">
                        <input type="checkbox" checked={selectedClassIds.length === listClasses.length && listClasses.length > 0} onChange={toggleSelectAllClasses} className="rounded accent-[#5B47D6]" />
                      </th>
                    )}
                    <th className="py-3.5 px-3">Student</th>
                    <th className="py-3.5 px-3">Time</th>
                    <th className="py-3.5 px-3">Teacher</th>
                    <th className="py-3.5 px-3">Program</th>
                    <th className="py-3.5 px-3">Subject</th>
                    <th className="py-3.5 px-3">Type</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                  {seriesList.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} className="py-8 text-center text-[#6B7185]">
                        No classes in this view. Try widening the “Show” range above.
                      </td>
                    </tr>
                  ) : (
                    seriesList.map((s) => {
                      // A one-off class (or a single leftover in this window) shows as a plain row.
                      if (s.count === 1) return renderRow(s.sample);

                      const open = expandedSeries.has(s.key);
                      const ids = s.sessions.map((x) => x.id);
                      const allSelected = ids.every((id) => selectedClassIds.includes(id));
                      return (
                        <React.Fragment key={s.key}>
                          {/* SERIES SUMMARY ROW — collapses a recurring timetable into one line */}
                          <tr className="bg-[#FAFAFE] dark:bg-slate-800/40 hover:bg-[#F3F1FC] dark:hover:bg-slate-800/70 transition-colors cursor-pointer" onClick={() => toggleSeries(s.key)}>
                            {canManage && (
                              <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={allSelected} onChange={() => toggleSelectSeries(ids)} className="rounded accent-[#5B47D6]" />
                              </td>
                            )}
                            <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-1.5">
                                {open ? <ChevronDown className="w-4 h-4 text-[#5B47D6]" /> : <ChevronRight className="w-4 h-4 text-[#6B7185]" />}
                                <span>{s.sample.studentName || '-'}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="font-mono text-xs text-slate-900 dark:text-slate-100">{s.sample.startAt} - {s.sample.endAt}</div>
                              <div className="text-xs text-[#6B7185]">{s.weekdayLabel}</div>
                            </td>
                            <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">{s.sample.teacherName}</td>
                            <td className="py-3.5 px-3 text-[#6B7185]">{s.sample.program}</td>
                            <td className="py-3.5 px-3 font-medium text-sm text-slate-900 dark:text-slate-100">{s.sample.subject}</td>
                            <td className="py-3.5 px-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${s.sample.classType === 'Makeup' ? 'bg-purple-100 text-purple-700 border border-purple-200' : s.sample.classType === 'Test' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700'}`}>
                                <span>{s.sample.classType}</span>
                                {!s.sample.isCharged && <span className="text-xs text-purple-900 bg-white px-1 rounded font-medium">(Free)</span>}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="text-slate-900 dark:text-slate-100 font-medium">{s.count} classes</div>
                              <div className="text-xs text-[#6B7185]">
                                {s.doneCount > 0 && `${s.doneCount} done · `}next {s.next?.date ?? '-'}
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => toggleSeries(s.key)} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-[#5B47D6] text-[#5B47D6] hover:bg-[#5B47D6]/5 font-medium text-xs rounded-xl transition-all cursor-pointer">
                                  {open ? 'Hide' : `View ${s.count}`}
                                </button>
                                {canManage && (
                                  <button onClick={() => handleDeleteSeries(s)} disabled={bulkBusy} title="Delete whole series" aria-label="Delete whole series" className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {open && s.sessions.map((cls) => renderRow(cls, true))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD LIST (phones) — same rows as the table above */}
            <div className="md:hidden divide-y divide-[#F1F2F7] dark:divide-slate-800">
              {seriesList.length === 0 ? (
                <div className="py-8 text-center text-[#6B7185] text-sm">No classes in this view. Try widening the “Show” range above.</div>
              ) : (
                seriesList.map((s) => {
                  if (s.count === 1) return renderCard(s.sample);
                  const open = expandedSeries.has(s.key);
                  return (
                    <div key={s.key}>
                      {/* SERIES SUMMARY CARD */}
                      <button onClick={() => toggleSeries(s.key)} className="w-full text-left p-4 flex items-center justify-between gap-2 bg-[#FAFAFE] dark:bg-slate-800/40">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{s.sample.subject} · {s.sample.studentName || '-'}</div>
                          <div className="text-xs text-[#6B7185] truncate">{s.sample.startAt}-{s.sample.endAt} · {s.weekdayLabel} · {s.count} classes{s.doneCount > 0 ? ` · ${s.doneCount} done` : ''}</div>
                          <div className="text-xs text-[#6B7185] truncate">{s.sample.teacherName} · next {s.next?.date ?? '-'}</div>
                        </div>
                        <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-[#5B47D6]">
                          {open ? 'Hide' : `View ${s.count}`}
                          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                      </button>
                      {open && <div className="divide-y divide-[#F1F2F7] dark:divide-slate-800">{s.sessions.map((cls) => renderCard(cls, true))}</div>}
                    </div>
                  );
                })
              )}
            </div>
          </div>


        </div>
        )}

        {/* MOBILE-FIRST CLASS COMPLETION DRAWER */}
        {selectedClassForCompletion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
              <div className="flex justify-between items-center border-b pb-3.5">
                <div>
                  <h3 className="font-heading font-medium text-slate-900 dark:text-white text-lg">
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
                <div className="font-medium text-slate-900 uppercase">Mark Attendance</div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border">
                  <span className="font-medium text-slate-900">{selectedClassForCompletion.studentName || 'Student'}</span>
                  <div className="flex gap-1.5">
                    {(['Present', 'Late', 'Absent'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setAttendanceChoice(st)}
                        className={`px-3 py-1 rounded-lg font-medium ${
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
                <p className="text-xs text-slate-500 font-medium">
                  {selectedClassForCompletion.status === 'Completed'
                    ? 'This class is already completed. Change the mark below to correct the recorded attendance.'
                    : 'Saving marks the class Completed and records this attendance (feeds the health score).'}
                </p>

                {/* Class note - what was covered / homework set */}
                <div className="pt-1">
                  <div className="font-medium text-slate-900 uppercase mb-1">Class Note <span className="text-slate-400 font-medium normal-case">(optional)</span></div>
                  <textarea
                    value={classNoteText}
                    onChange={(e) => setClassNoteText(e.target.value)}
                    rows={3}
                    placeholder="What was covered, homework set, how the student did…"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5B47D6]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setSelectedClassForCompletion(null)} className="px-4 py-2 border rounded-xl font-medium text-xs">Close</button>
                <button onClick={handleSaveClassCompletion} disabled={savingCompletion} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">
                  {savingCompletion
                    ? 'Saving...'
                    : selectedClassForCompletion.status === 'Completed'
                    ? 'Update Attendance'
                    : 'Complete & Save Attendance'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SINGLE-CLASS MODAL (one class at one date/time) */}
        {showSingleModal && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 my-6 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-medium text-lg text-slate-900 dark:text-white">Add a Single Class</h3>
                  <p className="text-xs text-[#6B7185] mt-0.5">One class at one date and time. A Google Meet invite is sent to the student and teacher.</p>
                </div>
                <button onClick={() => setShowSingleModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Student *</label>
                  <select
                    value={scStudentId}
                    onChange={(e) => { setScStudentId(e.target.value); setScSubjectId(''); setScTeacherId(''); }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                  >
                    <option value="">Select student...</option>
                    {students.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.program ? ` - ${s.program}` : ''}</option>))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
                    <select
                      value={scSubjectId}
                      onChange={(e) => {
                        const sid = e.target.value;
                        setScSubjectId(sid);
                        // Auto-select the teacher assigned to this subject at enrollment.
                        const tid = scTeacherBySubject.get(sid);
                        if (tid) setScTeacherId(tid);
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    >
                      <option value="">{scStudentId ? 'Select subject...' : 'Pick a student first'}</option>
                      {scSubjects.map((s) => (<option key={s.id} value={s.id}>{labelWithCode(s.name, s.code)}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Teacher *</label>
                    <select
                      value={scTeacherId}
                      onChange={(e) => setScTeacherId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    >
                      <option value="">Select teacher...</option>
                      {teachers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Class Type</label>
                    <select
                      value={scType}
                      onChange={(e) => setScType(e.target.value as 'Class' | 'Makeup' | 'Test')}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    >
                      <option value="Class">Regular</option>
                      <option value="Makeup">Makeup (free replacement)</option>
                      <option value="Test">Test</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                    <input
                      type="date"
                      value={scDate}
                      onChange={(e) => setScDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Start Time *</label>
                    <input
                      type="time"
                      value={scStart}
                      onChange={(e) => { setScStart(e.target.value); setScEnd(addOneHour(e.target.value)); }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">End Time * <span className="text-slate-400 font-medium normal-case">(auto +1h)</span></label>
                    <input
                      type="time"
                      value={scEnd}
                      onChange={(e) => setScEnd(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>
                </div>

                {scError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2 rounded-xl">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{scError}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowSingleModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSingleClass}
                  disabled={scSaving}
                  className="px-5 py-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-medium rounded-xl shadow-sm flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>{scSaving ? 'Scheduling...' : 'Schedule Class'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT SINGLE CLASS MODAL */}
        {editClass && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 my-6 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-medium text-lg text-slate-900 dark:text-white">Edit Class</h3>
                  <p className="text-xs text-[#6B7185] mt-0.5">{editClass.studentName || 'Student'} · {editClass.classCode}. Moving the time also updates the calendar invite.</p>
                </div>
                <button onClick={() => setEditClass(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
                    <select
                      value={edSubjectId}
                      onChange={(e) => setEdSubjectId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    >
                      <option value="">Select subject...</option>
                      {edSubjects.map((s) => (<option key={s.id} value={s.id}>{labelWithCode(s.name, s.code)}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Teacher *</label>
                    <select
                      value={edTeacherId}
                      onChange={(e) => setEdTeacherId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    >
                      <option value="">Select teacher...</option>
                      {teachers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Class Type</label>
                    <select
                      value={edType}
                      onChange={(e) => setEdType(e.target.value as 'Class' | 'Makeup' | 'Test')}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    >
                      <option value="Class">Regular</option>
                      <option value="Makeup">Makeup (free replacement)</option>
                      <option value="Test">Test</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                    <input
                      type="date"
                      value={edDate}
                      onChange={(e) => setEdDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Start Time *</label>
                    <input
                      type="time"
                      value={edStart}
                      onChange={(e) => { setEdStart(e.target.value); setEdEnd(addOneHour(e.target.value)); }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">End Time * <span className="text-slate-400 font-medium normal-case">(auto +1h)</span></label>
                    <input
                      type="time"
                      value={edEnd}
                      onChange={(e) => setEdEnd(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>
                </div>

                {edError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2 rounded-xl">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{edError}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setEditClass(null)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateClass}
                  disabled={edSaving}
                  className="px-5 py-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-medium rounded-xl shadow-sm flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{edSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TEACHER RESCHEDULE MODAL */}
        {rsClass && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 my-6 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-medium text-lg text-slate-900 dark:text-white">Reschedule Class</h3>
                  <p className="text-xs text-[#6B7185] mt-0.5">{rsClass.subject} · {rsClass.studentName || 'student'}. Pick a new time — the student is notified automatically.</p>
                </div>
                <button onClick={() => setRsClass(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div>
                <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">New Date *</label>
                <input
                  type="date"
                  value={rsDate}
                  min={todayStr}
                  onChange={(e) => setRsDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={rsStart}
                    onChange={(e) => { setRsStart(e.target.value); setRsEnd(addOneHour(e.target.value)); }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">End Time * <span className="text-slate-400 font-medium normal-case">(auto +1h)</span></label>
                  <input
                    type="time"
                    value={rsEnd}
                    onChange={(e) => setRsEnd(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                  />
                </div>
              </div>
              {rsError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2 rounded-xl">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{rsError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setRsClass(null)} className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button onClick={handleReschedule} disabled={rsSaving} className="px-5 py-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-medium rounded-xl shadow-sm flex items-center gap-2">
                  <Check className="w-4 h-4" /><span>{rsSaving ? 'Saving...' : 'Reschedule & Notify'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCHEDULE WIZARD MODAL */}
        {showAddClassModal && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 my-6 text-sm">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h3 className="font-heading font-medium text-slate-900 dark:text-white text-xl">Schedule a Student's Classes</h3>
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
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${studentTab === t ? 'bg-[#5B47D6] text-white shadow-sm' : 'text-[#6B7185]'}`}
                    >
                      {t === 'new' ? 'New (no classes)' : 'Already scheduled'}
                    </button>
                  ))}
                </div>
                <label className="text-slate-700 dark:text-slate-300 block font-medium">Student</label>
                <select value={wizStudentId} onChange={(e) => setWizStudentId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-3 text-slate-900 dark:text-slate-100 font-medium">
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
                  <label className="text-slate-700 dark:text-slate-300 font-medium">Subjects, teachers, days &amp; time</label>
                  <button onClick={addRow} className="text-xs font-medium text-[#5B47D6] hover:underline">Add subject</button>
                </div>
                {wizRows.map((r, i) => (
                  <div key={i} className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-[#6B7185] font-medium block mb-1">Subject</label>
                        <select value={r.subjectId} onChange={(e) => updateRow(i, { subjectId: e.target.value })} className="w-full bg-white dark:bg-slate-900 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-medium">
                          <option value="">Select subject...</option>
                          {wizSubjects.map((s) => (<option key={s.id} value={s.id}>{labelWithCode(s.name, s.code)}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#6B7185] font-medium block mb-1">Teacher</label>
                        <select value={r.teacherId} onChange={(e) => updateRow(i, { teacherId: e.target.value })} className="w-full bg-white dark:bg-slate-900 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-medium">
                          <option value="">Select teacher...</option>
                          {teachers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#6B7185] font-medium block mb-1">Days (Sat/Sun off by default)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[{ d: 1, l: 'Mon' }, { d: 2, l: 'Tue' }, { d: 3, l: 'Wed' }, { d: 4, l: 'Thu' }, { d: 5, l: 'Fri' }, { d: 6, l: 'Sat' }, { d: 0, l: 'Sun' }].map(({ d, l }) => (
                          <button
                            key={d}
                            onClick={() => toggleWeekday(i, d)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${r.weekdays.includes(d) ? 'bg-[#5B47D6] text-white border-[#5B47D6]' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-[#6B7185] font-medium block mb-1">Start (PKT)</label>
                        <input type="time" value={r.startTime} onChange={(e) => updateRow(i, { startTime: e.target.value, endTime: addOneHour(e.target.value) })} className="w-full bg-white dark:bg-slate-900 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-medium" />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#6B7185] font-medium block mb-1">End (PKT)</label>
                        <input type="time" value={r.endTime} onChange={(e) => updateRow(i, { endTime: e.target.value })} className="w-full bg-white dark:bg-slate-900 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-medium" />
                      </div>
                    </div>
                    {wizRows.length > 1 && (
                      <button onClick={() => removeRow(i)} className="text-xs font-medium text-rose-600 hover:underline">Remove this subject</button>
                    )}
                  </div>
                ))}
              </div>

              {/* TYPE + DURATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Class type</label>
                  <select value={wizType} onChange={(e) => setWizType(e.target.value as any)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-medium">
                    <option value="Class">Regular class</option>
                    <option value="Makeup">Makeup (free replacement)</option>
                    <option value="Test">Test / assessment</option>
                  </select>
                  <p className="text-[11px] text-[#6B7185] mt-1 leading-relaxed">Regular = normal teaching class · Makeup = a free replacement for a missed class · Test = an assessment session.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Start date</label>
                    <input type="date" value={wizStartDate} min={todayStr} onChange={(e) => setWizStartDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-medium" />
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Generate for</label>
                    <select
                      value={wizDurCustom ? 'custom' : wizWeeks}
                      onChange={(e) => {
                        if (e.target.value === 'custom') { setWizDurCustom(true); }
                        else { setWizDurCustom(false); setWizWeeks(Number(e.target.value)); }
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value={1}>1 week</option>
                      <option value={2}>2 weeks</option>
                      <option value={4}>1 month</option>
                      <option value={8}>2 months</option>
                      <option value={12}>3 months</option>
                      <option value="custom">Custom…</option>
                    </select>
                    {wizDurCustom && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={52}
                          value={wizWeeks}
                          onChange={(e) => setWizWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
                          className="w-20 bg-slate-50 dark:bg-slate-950 border rounded-xl p-2 text-slate-900 dark:text-slate-100 font-medium"
                        />
                        <span className="text-xs text-[#6B7185] font-medium">week(s)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(subjects.length === 0 || teachers.length === 0) && (
                <p className="text-xs text-amber-600 font-medium">Add subjects and teachers first. (Run supabase/seed_subjects.sql for subjects.)</p>
              )}
              {overlapWarning && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs font-medium leading-relaxed">{overlapWarning}</div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button onClick={() => setShowAddClassModal(false)} className="px-5 py-2.5 border rounded-xl font-medium">Cancel</button>
                <button onClick={handleBulkSchedule} disabled={scheduling} className="px-5 py-2.5 bg-[#5B47D6] text-white rounded-xl font-medium shadow-md disabled:opacity-50">{scheduling ? 'Scheduling...' : 'Confirm & Schedule'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
