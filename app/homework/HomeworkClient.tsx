'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { HomeworkAssignment } from '@/lib/mockAcademicsData';
import { subjectLabel, labelWithCode } from '@/lib/syllabiSeed';
import type { SubjectOption } from '@/lib/data/subjects';
import { createHomework, gradeHomework, updateHomework, deleteHomework, submitHomework, bulkDeleteHomework } from './actions';
import { listStudentEnrollments } from '@/app/schedule/actions';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { downloadCsv } from '@/lib/export/csv';
import {
  Plus,
  Search,
  X,
  Eye,
  Edit3,
  Trash2,
  CheckCircle2,
  FileText,
} from 'lucide-react';

export function HomeworkClient({
  initialHomeworks,
  students,
  teachers,
  subjects,
}: {
  initialHomeworks: HomeworkAssignment[];
  students: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  subjects: SubjectOption[];
}) {
  const { role } = useRole();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  // Assigning / modifying / deleting homework is staff-only (admin/manager).
  // Teachers act on their own students' work (grading), like attendance; students
  // only submit. This keeps the roster of other teachers off a teacher's screen.
  const canManage = role === 'admin' || role === 'manager';
  // Teachers can assign homework too (as themselves); editing/deleting stays staff-only.
  const canAssign = canManage || role === 'teacher';
  // Teachers can also modify/regrade/delete their OWN homework (RLS enforces
  // teacher_id = them); admins/managers can do all. Students never.
  const canModify = canManage || role === 'teacher';
  const isStudent = role === 'student';
  const [homeworks, setHomeworks] = useState<HomeworkAssignment[]>(initialHomeworks);
  const [showAddHomeworkModal, setShowAddHomeworkModal] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assigning, setAssigning] = useState(false);

  // GRADE MODAL (enter an actual mark + optional feedback when checking work)
  const [gradeHw, setGradeHw] = useState<HomeworkAssignment | null>(null);
  const [gPct, setGPct] = useState(70);
  const [gFeedback, setGFeedback] = useState('');
  const [grading, setGrading] = useState(false);
  // Homework is graded as a percentage (0-100). We store it in `score` with
  // max_score = 100, so score IS the percentage; older rows with a different max
  // are normalised here for display.
  const pctOf = (hw: HomeworkAssignment): number | null =>
    hw.score == null ? null : hw.maxScore ? Math.round((hw.score / hw.maxScore) * 100) : Math.round(hw.score);
  const gradeBarColor = (p: number) => (p >= 75 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-500' : 'bg-rose-500');
  const gradeTextColor = (p: number) => (p >= 75 ? 'text-emerald-700 dark:text-emerald-400' : p >= 50 ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400');
  const renderGradeBar = (hw: HomeworkAssignment, opts?: { min?: string; full?: boolean }) => {
    const p = pctOf(hw);
    if (p == null) return null;
    return (
      <div className={`flex items-center gap-2 ${opts?.full ? 'w-full' : opts?.min ?? 'min-w-[104px]'}`}>
        <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div className={`h-full rounded-full ${gradeBarColor(p)}`} style={{ width: `${p}%` }} />
        </div>
        <span className={`text-xs font-semibold tabular-nums ${gradeTextColor(p)}`}>{p}%</span>
      </div>
    );
  };
  const openGrade = (hw: HomeworkAssignment) => {
    setGradeHw(hw);
    const p = pctOf(hw);
    setGPct(p != null ? p : 70);
    setGFeedback(hw.feedback ?? '');
  };
  const handleSubmitGrade = async () => {
    if (!gradeHw) return;
    const pct = Math.max(0, Math.min(100, Math.round(gPct)));
    setGrading(true);
    const res = await gradeHomework({ homeworkId: gradeHw.id, score: pct, maxScore: 100, feedback: gFeedback });
    setGrading(false);
    if (res.ok) {
      setGradeHw(null);
      router.refresh();
      showToast('Homework graded', 'success', { description: `${gradeHw.studentName || 'Student'} · ${pct}%` });
    } else {
      showToast(res.error ?? 'Failed to grade.', 'error');
    }
  };

  useEffect(() => { setHomeworks(initialHomeworks); }, [initialHomeworks]);

  // Scope the Subject picker to the chosen student's enrollment. For a teacher
  // that's RLS-limited to the subjects THEY teach that student; admins get the
  // student's whole enrollment. `null` = not loaded yet.
  const [enrollSubjectIds, setEnrollSubjectIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!studentId) { setEnrollSubjectIds(null); return; }
    let alive = true;
    setEnrollSubjectIds(null);
    listStudentEnrollments(studentId)
      .then((es) => {
        if (!alive) return;
        const ids = Array.from(new Set(es.map((e) => e.subjectId)));
        setEnrollSubjectIds(ids);
        setSubjectId((cur) => (ids.length === 1 ? ids[0] : ids.includes(cur) ? cur : ''));
      })
      .catch(() => { if (alive) setEnrollSubjectIds([]); });
    return () => { alive = false; };
  }, [studentId]);
  const hwSubjectOptions = useMemo(
    () => (enrollSubjectIds ? subjects.filter((s) => enrollSubjectIds.includes(s.id)) : []),
    [subjects, enrollSubjectIds]
  );

  // FILTERS (one per column + a search bar)
  const [search, setSearch] = useState('');
  const [fSubject, setFSubject] = useState('All Subjects');
  const [fTeacher, setFTeacher] = useState('All Teachers');
  const [fStatus, setFStatus] = useState('All Statuses');
  const [fSubmission, setFSubmission] = useState('All Submissions');
  const [dateRange, setDateRange] = useState<'all' | '7' | '30' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const resetFilters = () => {
    setSearch(''); setFSubject('All Subjects'); setFTeacher('All Teachers');
    setFStatus('All Statuses'); setFSubmission('All Submissions'); setDateRange('all'); setFromDate(''); setToDate('');
  };

  const filtered = useMemo(() => {
    return homeworks.filter((hw) => {
      if (fSubject !== 'All Subjects' && hw.subject !== fSubject) return false;
      if (fTeacher !== 'All Teachers' && hw.teacherName !== fTeacher) return false;
      if (fStatus !== 'All Statuses' && hw.status !== fStatus) return false;
      if (fSubmission !== 'All Submissions' && hw.submissionStatus !== fSubmission) return false;
      if (dateRange !== 'all' && hw.dueISO) {
        const t = new Date(hw.dueISO).getTime();
        if (!Number.isNaN(t)) {
          const now = Date.now();
          if (dateRange === '7' && t < now - 7 * 864e5) return false;
          if (dateRange === '30' && t < now - 30 * 864e5) return false;
          if (dateRange === 'custom') {
            if (fromDate && t < new Date(`${fromDate}T00:00:00`).getTime()) return false;
            if (toDate && t > new Date(`${toDate}T23:59:59`).getTime()) return false;
          }
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit = hw.title.toLowerCase().includes(q) || hw.homeworkCode.toLowerCase().includes(q) || (hw.studentName ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [homeworks, fSubject, fTeacher, fStatus, fSubmission, dateRange, fromDate, toDate, search]);

  const handleAddHomework = async () => {
    if (!title || !studentId || !subjectId || (canManage && !teacherId) || !deadline) {
      showToast(
        canManage
          ? 'Title, student, subject, teacher, and deadline are all required.'
          : 'Title, student, subject, and deadline are all required.',
        'error'
      );
      return;
    }
    setAssigning(true);
    const res = await createHomework({ studentId, subjectId, teacherId, title, description, deadline });
    setAssigning(false);
    if (res.ok) {
      setShowAddHomeworkModal(false);
      setTitle(''); setDescription(''); setStudentId(''); setSubjectId(''); setTeacherId(''); setDeadline('');
      router.refresh();
    } else {
      showToast(res.error ?? 'Failed to assign homework.', 'error');
    }
  };

  // View + Edit
  const [viewHw, setViewHw] = useState<HomeworkAssignment | null>(null);

  const isoToPktDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }) : '');
  const [editHw, setEditHw] = useState<HomeworkAssignment | null>(null);
  const [edTitle, setEdTitle] = useState('');
  const [edDescription, setEdDescription] = useState('');
  const [edDeadline, setEdDeadline] = useState('');
  const [edSaving, setEdSaving] = useState(false);
  const [edError, setEdError] = useState<string | null>(null);

  const openEdit = (hw: HomeworkAssignment) => {
    setEditHw(hw); setEdTitle(hw.title); setEdDescription(hw.description ?? ''); setEdDeadline(isoToPktDate(hw.dueISO)); setEdError(null);
  };
  const handleUpdate = async () => {
    if (!editHw) return;
    setEdError(null);
    if (!edTitle.trim()) { setEdError('Title is required.'); return; }
    setEdSaving(true);
    const res = await updateHomework({ homeworkId: editHw.id, title: edTitle, description: edDescription, deadline: edDeadline || undefined });
    setEdSaving(false);
    if (res.ok) { setEditHw(null); router.refresh(); }
    else setEdError(res.error ?? 'Failed to update the homework.');
  };
  const handleCheck = (hw: HomeworkAssignment) => openGrade(hw);
  const handleDelete = async (hw: HomeworkAssignment) => {
    if (!(await confirm({ title: 'Delete this homework?', message: `Delete homework "${hw.title}"? This removes it from the list.`, confirmLabel: 'Delete', danger: true }))) return;
    const res = await deleteHomework(hw.id);
    if (res.ok) router.refresh();
    else showToast(res.error ?? 'Failed to delete.', 'error');
  };
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  // Submit confirmation modal: the student says what they completed and where they
  // uploaded the file (e.g. WhatsApp / Google Drive link). No file storage.
  const [submitHw, setSubmitHw] = useState<HomeworkAssignment | null>(null);
  const [submitNote, setSubmitNote] = useState('');
  const openSubmit = (hw: HomeworkAssignment) => { setSubmitHw(hw); setSubmitNote(''); };
  const handleConfirmSubmit = async () => {
    if (!submitHw) return;
    setSubmittingId(submitHw.id);
    const res = await submitHomework({ homeworkId: submitHw.id, note: submitNote });
    setSubmittingId(null);
    if (res.ok) {
      setSubmitHw(null);
      if (res.warning) showToast(res.warning, 'info');
      showToast('Homework submitted', 'success', { description: 'Your teacher can now see it and grade it.' });
      router.refresh();
    } else {
      showToast(res.error ?? 'Failed to submit.', 'error');
    }
  };

  // BULK SELECTION STATE + handlers (staff only; operate on the filtered view)
  const [selectedHwIds, setSelectedHwIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleSelectAllHw = () => {
    if (selectedHwIds.length === filtered.length && filtered.length > 0) setSelectedHwIds([]);
    else setSelectedHwIds(filtered.map((h) => h.id));
  };
  const toggleSelectHw = (id: string) => {
    setSelectedHwIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const handleBulkDeleteHw = async () => {
    if (selectedHwIds.length === 0) return;
    if (!(await confirm({ title: `Delete ${selectedHwIds.length} selected homework${selectedHwIds.length === 1 ? '' : 's'}?`, message: 'This removes them from the list.', confirmLabel: 'Delete', danger: true }))) return;
    setBulkBusy(true);
    const res = await bulkDeleteHomework(selectedHwIds);
    setBulkBusy(false);
    if (res.ok) { setSelectedHwIds([]); router.refresh(); }
    else showToast(res.error ?? 'Failed to delete the selected homework.', 'error');
  };
  const fdateShort = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }) : '');
  const handleBulkExportHw = () => {
    const rows = homeworks.filter((h) => selectedHwIds.includes(h.id));
    downloadCsv(
      'Thinkerzz_Homework',
      ['Subject', 'Title', 'Student', 'Teacher', 'Due Date', 'Submission', 'Status'],
      rows.map((h) => [h.subject ?? '', h.title, h.studentName ?? '', h.teacherName ?? '', fdateShort(h.dueISO), h.submissionStatus ?? '', h.status])
    );
  };

  const fdate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric' }) : '-');
  const selCls = 'bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-[13px]';
  const boxCls = 'bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs';

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher', 'student']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-sm">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Homework & Assignments</span>
            </h1>
            <p className="text-[13px] text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Assign homework and track submissions.
            </p>
          </div>

          {canAssign && (
            <Button variant="primary" onClick={() => setShowAddHomeworkModal(true)}>
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Assign Homework</span>
            </Button>
          )}
        </div>

        {/* FILTER BAR */}
        <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 p-3 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px]">
          <div className="relative w-full sm:w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search homework, code or student..." className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-[13px] font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]" />
          </div>
          <div className={boxCls}>
            <span className="text-[11px] text-[#6B7185] block font-medium">Subject</span>
            <select value={fSubject} onChange={(e) => setFSubject(e.target.value)} className={selCls}>
              <option>All Subjects</option>
              {Array.from(new Set(homeworks.map((h) => h.subject).filter(Boolean))).map((s) => (<option key={s} value={s}>{subjectLabel(s)}</option>))}
            </select>
          </div>
          <div className={boxCls}>
            <span className="text-[11px] text-[#6B7185] block font-medium">Teacher</span>
            <select value={fTeacher} onChange={(e) => setFTeacher(e.target.value)} className={selCls}>
              <option>All Teachers</option>
              {Array.from(new Set(homeworks.map((h) => h.teacherName).filter(Boolean))).map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div className={boxCls}>
            <span className="text-[11px] text-[#6B7185] block font-medium">Status</span>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selCls}>
              <option>All Statuses</option>
              <option value="Assigned">Assigned</option>
              <option value="Graded">Graded</option>
            </select>
          </div>
          <div className={boxCls}>
            <span className="text-[11px] text-[#6B7185] block font-medium">Submission</span>
            <select value={fSubmission} onChange={(e) => setFSubmission(e.target.value)} className={selCls}>
              <option>All Submissions</option>
              <option value="Not submitted">Not submitted</option>
              <option value="Submitted">Submitted</option>
            </select>
          </div>
          <div className={boxCls}>
            <span className="text-[11px] text-[#6B7185] block font-medium">Due Date</span>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className={selCls}>
              <option value="all">All Time</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5 text-[13px]">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100" />
              <span className="text-[#6B7185]">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100" />
            </div>
          )}
          <button onClick={resetFilters} className="ml-auto text-[13px] font-medium text-[#5B47D6] hover:underline">Reset</button>
        </div>

        {/* BULK ACTION BAR — appears when rows are selected (staff only) */}
        {canManage && selectedHwIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-[#EEEBFB] dark:bg-[#5B47D6]/15 border border-[#5B47D6]/30 rounded-[14px] px-4 py-2.5 text-sm">
            <span className="font-medium text-[#5B47D6] dark:text-[#b9adf2]">
              {selectedHwIds.length} selected
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>

            <button
              onClick={handleBulkExportHw}
              disabled={bulkBusy}
              className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
            </button>

            <button
              onClick={handleBulkDeleteHw}
              disabled={bulkBusy}
              className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> {bulkBusy ? 'Working…' : 'Delete'}
            </button>

            <button
              onClick={() => setSelectedHwIds([])}
              disabled={bulkBusy}
              className="ml-auto h-8 px-3 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        )}

        {/* HOMEWORK DATA TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left text-sm border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                  {canManage && (
                    <th className="py-3.5 px-3 w-[40px] text-center">
                      <input
                        type="checkbox"
                        checked={selectedHwIds.length === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAllHw}
                        className="rounded accent-[#5B47D6] cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3.5 px-3">Title</th>
                  <th className="py-3.5 px-3">Student</th>
                  <th className="py-3.5 px-3">Subject</th>
                  <th className="py-3.5 px-3">Teacher</th>
                  <th className="py-3.5 px-3">Assigned & Due Date</th>
                  <th className="py-3.5 px-3">Submission</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                {filtered.length === 0 ? (
                  <tr><td colSpan={canManage ? 9 : 8} className="py-8 text-center text-[#6B7185]">No homework matches these filters.</td></tr>
                ) : (
                  filtered.map((hw) => (
                    <tr key={hw.id} className="hover:bg-slate-50 transition-colors">
                      {canManage && (
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedHwIds.includes(hw.id)}
                            onChange={() => toggleSelectHw(hw.id)}
                            className="rounded accent-[#5B47D6]"
                          />
                        </td>
                      )}
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{hw.title}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <button onClick={() => setViewHw(hw)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#EEEBFB] text-[#5B47D6] hover:bg-[#5B47D6] hover:text-white px-3 py-1.5 text-xs font-medium transition-colors">
                            <Eye className="w-3.5 h-3.5" /> View task
                          </button>
                          {hw.submissionNote && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium"><FileText className="w-3 h-3" /> note</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">{hw.studentName || '-'}</td>
                      <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">{hw.subject || '-'}</td>
                      <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">{hw.teacherName || '-'}</td>
                      <td className="py-3.5 px-3">
                        <div className="text-slate-700">Assigned: {fdate(hw.assignedDate)}</div>
                        <div className="text-rose-600 font-medium">Due: {fdate(hw.dueISO)}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <Badge tone={hw.submissionStatus === 'Submitted' ? 'success' : 'neutral'}>{hw.submissionStatus}</Badge>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="space-y-1.5">
                          <Badge tone={hw.status === 'Graded' ? 'success' : 'brand'}>{hw.status}</Badge>
                          {hw.status === 'Graded' && renderGradeBar(hw)}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => setViewHw(hw)} title="View" className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center"><Eye className="w-4 h-4" /></button>
                          {isStudent && hw.submissionStatus === 'Not submitted' && (
                            <button
                              onClick={() => openSubmit(hw)}
                              disabled={submittingId === hw.id}
                              className="h-7 px-3 rounded-lg bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-medium flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{submittingId === hw.id ? 'Submitting…' : 'Submit'}</span>
                            </button>
                          )}
                          {isStudent && hw.submissionStatus !== 'Not submitted' && (
                            <span className="text-xs font-medium text-emerald-600">✓ {hw.submissionStatus}</span>
                          )}
                          {/* Quick grade for ungraded work; full menu (regrade/edit/delete) below. */}
                          {canModify && hw.status !== 'Graded' && (
                            <button
                              onClick={() => handleCheck(hw)}
                              className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Grade</span>
                            </button>
                          )}
                          {canModify && (
                            <RowActionsMenu
                              actions={[
                                { label: 'View', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setViewHw(hw) },
                                { label: hw.status === 'Graded' ? 'Regrade' : 'Grade', icon: <CheckCircle2 className="w-3.5 h-3.5" />, tone: 'success', onClick: () => handleCheck(hw) },
                                { label: 'Edit', icon: <Edit3 className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => openEdit(hw) },
                                { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, tone: 'danger', onClick: () => handleDelete(hw) },
                              ]}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD LIST (phones) */}
          <div className="md:hidden divide-y divide-[#F1F2F7] dark:divide-slate-800">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[#6B7185] text-sm">No homework matches these filters.</div>
            ) : (
              filtered.map((hw) => (
                <div key={hw.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{hw.title}</div>
                      <div className="text-xs text-[#6B7185] truncate">{hw.subject || '-'}{hw.studentName ? ` · ${hw.studentName}` : ''}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 w-[120px]">
                      <Badge tone={hw.status === 'Graded' ? 'success' : 'brand'}>{hw.status}</Badge>
                      {hw.status === 'Graded' && renderGradeBar(hw, { full: true })}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="text-slate-700 dark:text-slate-200">Due: <span className="text-rose-600 font-medium">{fdate(hw.dueISO)}</span></span>
                    {hw.teacherName && <span className="text-[#6B7185]">{hw.teacherName}</span>}
                    <Badge tone={hw.submissionStatus === 'Submitted' ? 'success' : 'neutral'}>{hw.submissionStatus}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button onClick={() => setViewHw(hw)} className="px-3 py-2 rounded-xl bg-[#EEEBFB] text-[#5B47D6] text-xs font-medium flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> View task</button>
                    {isStudent && hw.submissionStatus === 'Not submitted' && (
                      <button onClick={() => openSubmit(hw)} disabled={submittingId === hw.id} className="flex-1 min-w-[110px] px-3 py-2 rounded-xl bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-medium flex items-center justify-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{submittingId === hw.id ? 'Submitting…' : 'Submit'}</button>
                    )}
                    {canModify && (
                      <>
                        <button onClick={() => handleCheck(hw)} className="flex-1 min-w-[110px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center justify-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {hw.status === 'Graded' ? 'Regrade' : 'Grade'}</button>
                        <button onClick={() => openEdit(hw)} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                        <button onClick={() => handleDelete(hw)} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 bg-slate-50 border-t text-[13px] font-medium text-slate-600">Showing {filtered.length} of {homeworks.length} homework</div>
        </div>

        {/* SUBMIT MODAL (student) — say what you did + where you uploaded the file */}
        {submitHw && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Submit Homework</h3>
                  <p className="text-xs text-[#6B7185] mt-0.5">{submitHw.title}{submitHw.subject ? ` · ${submitHw.subject}` : ''}</p>
                </div>
                <button onClick={() => setSubmitHw(null)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <div className="space-y-2 text-xs font-medium">
                <label className="text-slate-700 dark:text-slate-300 block">What did you complete, and where did you upload it?</label>
                <textarea
                  value={submitNote}
                  onChange={(e) => setSubmitNote(e.target.value)}
                  rows={4}
                  placeholder="e.g. Completed all 12 questions. Photos of my work sent on WhatsApp. / Google Drive link: …"
                  className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 resize-y"
                />
                <p className="text-[11px] text-[#6B7185]">Your teacher sees this note. There's no file upload here. Share the file on WhatsApp/Google Drive and update to your teacher.</p>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setSubmitHw(null)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
                <button onClick={handleConfirmSubmit} disabled={submittingId === submitHw.id} className="px-4 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />{submittingId === submitHw.id ? 'Submitting…' : 'Submit Homework'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GRADE MODAL — enter an actual mark + optional feedback */}
        {gradeHw && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Grade Homework</h3>
                  <p className="text-xs text-[#6B7185] mt-0.5">{gradeHw.title} · {gradeHw.studentName || 'Student'}</p>
                  <p className={`text-[11px] mt-1 font-medium ${gradeHw.submittedAt ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {gradeHw.submittedAt ? `Student submitted ${fdate(gradeHw.submittedAt)}${gradeHw.submittedLate ? ' (late)' : ''}` : 'Student hasn’t submitted this yet'}
                  </p>
                </div>
                <button onClick={() => setGradeHw(null)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              {gradeHw.submissionNote && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[#6B7185] mb-0.5">Student's submission note</div>
                  <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line break-words">{gradeHw.submissionNote}</div>
                </div>
              )}
              <div className="space-y-3 text-xs font-medium">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-700 dark:text-slate-300">Grade</label>
                    <span className={`text-lg font-heading font-semibold tabular-nums ${gradeTextColor(gPct)}`}>{gPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={gPct}
                    onChange={(e) => setGPct(Number(e.target.value))}
                    className="w-full accent-[#5B47D6] cursor-pointer"
                  />
                  <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${gradeBarColor(gPct)}`} style={{ width: `${gPct}%` }} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Or type it:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={gPct}
                      onChange={(e) => setGPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-16 bg-slate-50 dark:bg-slate-950 border rounded-xl p-1.5 font-mono text-center text-slate-900 dark:text-slate-100"
                    />
                    <span className="text-slate-500 dark:text-slate-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Feedback <span className="text-slate-400 font-medium normal-case">(optional)</span></label>
                  <textarea value={gFeedback} onChange={(e) => setGFeedback(e.target.value)} rows={3} placeholder="What was good, what to improve…" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 resize-y" />
                </div>
                <p className="text-[11px] text-[#6B7185]">Saving marks this homework Graded and records the percentage. The student is notified and can see it.</p>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setGradeHw(null)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
                <button onClick={handleSubmitGrade} disabled={grading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">{grading ? 'Saving…' : 'Save Grade'}</button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW MODAL */}
        {viewHw && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-3 my-6 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-medium text-lg text-slate-900 dark:text-white">Homework Details</h3>
                <button onClick={() => setViewHw(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                {[
                  ['Title', viewHw.title],
                  ['Student', viewHw.studentName || '-'],
                  ['Subject', viewHw.subject || '-'],
                  ['Teacher', viewHw.teacherName || '-'],
                  ['Assigned', fdate(viewHw.assignedDate)],
                  ['Due', fdate(viewHw.dueISO)],
                  ['Submission', viewHw.submittedAt ? `Submitted ${fdate(viewHw.submittedAt)}${viewHw.submittedLate ? ' · late' : ''}` : 'Not submitted'],
                  ['Status', viewHw.status],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-[#6B7185]">{k}</div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5 break-words">{v}</div>
                  </div>
                ))}
              </div>
              {viewHw.status === 'Graded' && pctOf(viewHw) != null && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[#6B7185] mb-1.5">Grade</div>
                  {renderGradeBar(viewHw, { full: true })}
                </div>
              )}
              {viewHw.description && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[#6B7185]">Task / Instructions</div>
                  <div className="text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-line break-words">{viewHw.description}</div>
                </div>
              )}
              {viewHw.submissionNote && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[#6B7185]">Student's submission note</div>
                  <div className="text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-line break-words">{viewHw.submissionNote}</div>
                </div>
              )}
              {viewHw.feedback && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Teacher feedback</div>
                  <div className="text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-line break-words">{viewHw.feedback}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EDIT MODAL */}
        {editHw && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 my-6 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-medium text-lg text-slate-900 dark:text-white">Modify Homework</h3>
                <button onClick={() => setEditHw(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Title</label>
                  <input value={edTitle} onChange={(e) => setEdTitle(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                </div>
                <div>
                  <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Description <span className="text-slate-400 font-medium normal-case">(optional)</span></label>
                  <textarea value={edDescription} onChange={(e) => setEdDescription(e.target.value)} rows={3} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6] resize-y" />
                </div>
                <div>
                  <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Deadline</label>
                  <input type="date" value={edDeadline} onChange={(e) => setEdDeadline(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                </div>
                {edError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2 rounded-xl"><span>{edError}</span></div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditHw(null)} className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button onClick={handleUpdate} disabled={edSaving} className="px-5 py-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-medium rounded-xl shadow-sm">{edSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ADD HOMEWORK MODAL */}
        {showAddHomeworkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Assign New Homework</h3>
                <button onClick={() => setShowAddHomeworkModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <div className="space-y-3 text-xs font-medium">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Homework Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Vectors & Calculus Worksheet" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Description <span className="text-slate-400 font-medium normal-case">(optional)</span></label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Full instructions: questions, pages, what to submit…" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 resize-y" />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Student</label>
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                    <option value="">Select a student...</option>
                    {students.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
                <div className={`grid gap-2 ${canManage ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Subject</label>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      disabled={!studentId || enrollSubjectIds === null}
                      className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                    >
                      <option value="">
                        {!studentId ? 'Pick a student first' : enrollSubjectIds === null ? 'Loading subjects…' : hwSubjectOptions.length === 0 ? 'No subjects assigned to this student' : 'Select...'}
                      </option>
                      {hwSubjectOptions.map((s) => (<option key={s.id} value={s.id}>{labelWithCode(s.name, s.code)} · {s.program}</option>))}
                    </select>
                  </div>
                  {canManage && (
                    <div>
                      <label className="text-slate-700 dark:text-slate-300 block mb-1">Teacher</label>
                      <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                        <option value="">Select...</option>
                        {teachers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Deadline</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                </div>
                {(students.length === 0 || subjects.length === 0 || (canManage && teachers.length === 0)) && (
                  <p className="text-xs text-amber-600 font-medium">Add students and subjects first (run supabase/seed_subjects.sql for subjects).</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setShowAddHomeworkModal(false)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
                <button onClick={handleAddHomework} disabled={assigning} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">{assigning ? 'Assigning...' : 'Assign Homework'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
