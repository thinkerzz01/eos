'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { HomeworkAssignment } from '@/lib/mockAcademicsData';
import type { SubjectOption } from '@/lib/data/subjects';
import { createHomework, gradeHomework, updateHomework, deleteHomework, submitHomework, bulkDeleteHomework } from './actions';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
  const canManage = role !== 'student';
  const [homeworks, setHomeworks] = useState<HomeworkAssignment[]>(initialHomeworks);
  const [showAddHomeworkModal, setShowAddHomeworkModal] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => { setHomeworks(initialHomeworks); }, [initialHomeworks]);

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
    if (!title || !studentId || !subjectId || !teacherId || !deadline) {
      alert('Title, student, subject, teacher, and deadline are all required.');
      return;
    }
    setAssigning(true);
    const res = await createHomework({ studentId, subjectId, teacherId, title, deadline });
    setAssigning(false);
    if (res.ok) {
      setShowAddHomeworkModal(false);
      setTitle(''); setStudentId(''); setSubjectId(''); setTeacherId(''); setDeadline('');
      router.refresh();
    } else {
      alert(res.error ?? 'Failed to assign homework.');
    }
  };

  // View + Edit
  const [viewHw, setViewHw] = useState<HomeworkAssignment | null>(null);

  const isoToPktDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }) : '');
  const [editHw, setEditHw] = useState<HomeworkAssignment | null>(null);
  const [edTitle, setEdTitle] = useState('');
  const [edDeadline, setEdDeadline] = useState('');
  const [edSaving, setEdSaving] = useState(false);
  const [edError, setEdError] = useState<string | null>(null);

  const openEdit = (hw: HomeworkAssignment) => {
    setEditHw(hw); setEdTitle(hw.title); setEdDeadline(isoToPktDate(hw.dueISO)); setEdError(null);
  };
  const handleUpdate = async () => {
    if (!editHw) return;
    setEdError(null);
    if (!edTitle.trim()) { setEdError('Title is required.'); return; }
    setEdSaving(true);
    const res = await updateHomework({ homeworkId: editHw.id, title: edTitle, deadline: edDeadline || undefined });
    setEdSaving(false);
    if (res.ok) { setEditHw(null); router.refresh(); }
    else setEdError(res.error ?? 'Failed to update the homework.');
  };
  const handleCheck = async (hw: HomeworkAssignment) => {
    const res = await gradeHomework({ homeworkId: hw.id });
    if (res.ok) router.refresh();
    else alert(res.error ?? 'Failed to grade.');
  };
  const handleDelete = async (hw: HomeworkAssignment) => {
    if (!confirm(`Delete homework "${hw.title}"? This removes it from the list.`)) return;
    const res = await deleteHomework(hw.id);
    if (res.ok) router.refresh();
    else alert(res.error ?? 'Failed to delete.');
  };
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const handleSubmitHomework = async (hw: HomeworkAssignment) => {
    setSubmittingId(hw.id);
    const res = await submitHomework({ homeworkId: hw.id });
    setSubmittingId(null);
    if (res.ok) { if (res.warning) alert(res.warning); router.refresh(); }
    else alert(res.error ?? 'Failed to submit.');
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
    if (!confirm(`Delete ${selectedHwIds.length} selected homework${selectedHwIds.length === 1 ? '' : 's'}? This removes them from the list.`)) return;
    setBulkBusy(true);
    const res = await bulkDeleteHomework(selectedHwIds);
    setBulkBusy(false);
    if (res.ok) { setSelectedHwIds([]); router.refresh(); }
    else alert(res.error ?? 'Failed to delete the selected homework.');
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
              Assign homework and track submissions (feeds the 30% homework-completion health metric).
            </p>
          </div>

          {canManage && (
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
              {Array.from(new Set(homeworks.map((h) => h.subject).filter(Boolean))).map((s) => (<option key={s} value={s}>{s}</option>))}
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
              <option value="Graded">Graded</option>
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
          <div className="overflow-x-auto">
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
                  <th className="py-3.5 px-3">Homework Code & Title</th>
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
                        <div className="text-xs text-[#6B7185] font-mono">{hw.homeworkCode}</div>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">{hw.studentName || '-'}</td>
                      <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">{hw.subject || '-'}</td>
                      <td className="py-3.5 px-3 font-medium text-slate-900 dark:text-slate-100">{hw.teacherName || '-'}</td>
                      <td className="py-3.5 px-3">
                        <div className="text-slate-700">Assigned: {fdate(hw.assignedDate)}</div>
                        <div className="text-rose-600 font-medium">Due: {fdate(hw.dueISO)}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <Badge tone={hw.submissionStatus === 'Graded' ? 'success' : hw.submissionStatus === 'Submitted' ? 'info' : 'neutral'}>{hw.submissionStatus}</Badge>
                      </td>
                      <td className="py-3.5 px-3">
                        <Badge tone={hw.status === 'Graded' ? 'success' : 'brand'}>{hw.status}</Badge>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => setViewHw(hw)} title="View" className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center"><Eye className="w-4 h-4" /></button>
                          {!canManage && hw.submissionStatus === 'Not submitted' && (
                            <button
                              onClick={() => handleSubmitHomework(hw)}
                              disabled={submittingId === hw.id}
                              className="h-7 px-3 rounded-lg bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-medium flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{submittingId === hw.id ? 'Submitting…' : 'Submit'}</span>
                            </button>
                          )}
                          {!canManage && hw.submissionStatus !== 'Not submitted' && (
                            <span className="text-xs font-medium text-emerald-600">✓ {hw.submissionStatus}</span>
                          )}
                          {canManage && (
                            <RowActionsMenu
                              actions={[
                                { label: 'View', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setViewHw(hw) },
                                { label: 'Modify', icon: <Edit3 className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => openEdit(hw) },
                                { label: 'Check (Grade)', icon: <CheckCircle2 className="w-3.5 h-3.5" />, tone: 'success', hidden: hw.status === 'Graded', onClick: () => handleCheck(hw) },
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
          <div className="p-3 bg-slate-50 border-t text-[13px] font-medium text-slate-600">Showing {filtered.length} of {homeworks.length} homework</div>
        </div>

        {/* VIEW MODAL */}
        {viewHw && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-3 my-6 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-medium text-lg text-slate-900 dark:text-white">Homework Details</h3>
                <button onClick={() => setViewHw(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                {[
                  ['Title', viewHw.title],
                  ['Code', viewHw.homeworkCode],
                  ['Student', viewHw.studentName || '-'],
                  ['Subject', viewHw.subject || '-'],
                  ['Teacher', viewHw.teacherName || '-'],
                  ['Assigned', fdate(viewHw.assignedDate)],
                  ['Due', fdate(viewHw.dueISO)],
                  ['Submission', viewHw.submissionStatus || '-'],
                  ['Status', viewHw.status],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-[#6B7185]">{k}</div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5 break-words">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* EDIT MODAL */}
        {editHw && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 my-6 text-sm">
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
            <div className="bg-white dark:bg-slate-900 border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
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
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Student</label>
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                    <option value="">Select a student...</option>
                    {students.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Subject</label>
                    <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                      <option value="">Select...</option>
                      {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.program})</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Teacher</label>
                    <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                      <option value="">Select...</option>
                      {teachers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Deadline</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                </div>
                {(students.length === 0 || subjects.length === 0 || teachers.length === 0) && (
                  <p className="text-xs text-amber-600 font-medium">Add students, subjects, and teachers first (run supabase/seed_subjects.sql for subjects).</p>
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
