'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { DemoSession } from '@/lib/mockAdmissionsData';
import type { SubjectOption } from '@/lib/data/subjects';
import { ALL_PROGRAMS, LEAD_SOURCES } from '@/lib/syllabiSeed';
import { createClient } from '@/lib/supabase/client';
import { assignTeacher, recordOutcome, deleteDemo, createDemo, updateDemo } from './actions';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Calendar,
  Clock,
  UserCheck,
  Video,
  Plus,
  Search,
  Filter,
  X,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageSquare,
  ExternalLink,
  ChevronDown,
  UserPlus,
  RefreshCw,
  Sparkles,
  Eye,
  Edit3,
  Trash2,
  Check,
} from 'lucide-react';

export function DemosClient({
  initialDemos,
  teachers,
  subjects,
}: {
  initialDemos: DemoSession[];
  teachers: { id: string; name: string }[];
  subjects: SubjectOption[];
}) {
  const { role } = useRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canManage = role === 'admin' || role === 'manager';

  // LOCAL DEMOS STATE STORE (seeded from server, RLS-authorized)
  const [demosList, setDemosList] = useState<DemoSession[]>(initialDemos);
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('All Demos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<'all' | '7' | '30' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Keep the table in sync when the server refetches after a write (router.refresh()).
  useEffect(() => { setDemosList(initialDemos); }, [initialDemos]);

  // Realtime: when a new public booking lands (demo/lead insert), refresh the list
  // automatically - no manual page refresh needed. Requires the tables to be in the
  // supabase_realtime publication (schema.sql adds them).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('demos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demos' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  // ASSIGN TEACHER MODAL WITH doAssign TIME OVERLAP RE-CHECK
  const [assignModalDemo, setAssignModalDemo] = useState<DemoSession | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [conflictErrorMessage, setConflictErrorMessage] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);

  // NEW DEMO (staff-created, e.g. a phone booking) - creates lead + needs_teacher demo.
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const [showNewDemo, setShowNewDemo] = useState(false);
  const [ndName, setNdName] = useState('');
  const [ndParent, setNdParent] = useState('');
  const [ndPhone, setNdPhone] = useState('');
  const [ndEmail, setNdEmail] = useState('');
  const [ndProgram, setNdProgram] = useState('');
  const [ndSubjectId, setNdSubjectId] = useState('');
  const [ndSource, setNdSource] = useState('');
  const [ndDate, setNdDate] = useState(todayStr);
  const [ndTime, setNdTime] = useState('');
  const [ndSaving, setNdSaving] = useState(false);
  const [ndError, setNdError] = useState<string | null>(null);

  const ndSubjects = ndProgram ? subjects.filter((s) => s.program === ndProgram) : subjects;

  const resetNewDemo = () => {
    setNdName(''); setNdParent(''); setNdPhone(''); setNdEmail('');
    setNdProgram(''); setNdSubjectId(''); setNdSource(''); setNdDate(todayStr); setNdTime('');
    setNdError(null);
  };

  const handleCreateDemo = async () => {
    setNdError(null);
    if (!ndName || !ndParent || !ndPhone) { setNdError('Student name, parent name, and phone are required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ndEmail.trim())) { setNdError('A valid email is required - the demo invite is sent to it.'); return; }
    if (!ndDate || !ndTime) { setNdError('Pick a date and time.'); return; }
    setNdSaving(true);
    const res = await createDemo({
      studentName: ndName, parentName: ndParent, phone: ndPhone, email: ndEmail,
      program: ndProgram || undefined, subjectId: ndSubjectId || undefined, source: ndSource || undefined,
      date: ndDate, time: ndTime,
    });
    setNdSaving(false);
    if (res.ok) {
      setShowNewDemo(false);
      resetNewDemo();
      router.refresh();
      alert('Demo created. Assign a teacher to send the Google Meet invite.');
    } else {
      setNdError(res.error ?? 'Failed to create the demo.');
    }
  };

  // Open the New Demo modal when arrived here via the TopBar "+ Book Demo" quick action.
  useEffect(() => {
    if (searchParams.get('new') === '1' && canManage) {
      resetNewDemo();
      setShowNewDemo(true);
      router.replace('/demos'); // clear the query so it does not re-open on refresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canManage]);

  // LOG OUTCOME MODAL
  const [outcomeModalDemo, setOutcomeModalDemo] = useState<DemoSession | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<'Won' | 'Lost' | 'No-show' | 'Pending'>('Won');
  const [outcomeFeedback, setOutcomeFeedback] = useState<string>('');
  const [enrollLink, setEnrollLink] = useState<string | null>(null);

  const filteredDemos = useMemo(() => {
    return demosList.filter((d) => {
      if (selectedStatusTab === 'Needs Teacher' && d.teacherId !== null) return false;
      if (selectedStatusTab === 'Scheduled' && d.status !== 'Scheduled') return false;
      if (selectedStatusTab === 'Completed' && d.status !== 'Completed') return false;

      // Date range (by demo scheduled date)
      if (dateRange !== 'all' && d.scheduledISO) {
        const t = new Date(d.scheduledISO).getTime();
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

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesStudent = d.studentName.toLowerCase().includes(q);
        const matchesSubject = d.subject.toLowerCase().includes(q);
        const matchesId = d.demoId.toLowerCase().includes(q);
        if (!matchesStudent && !matchesSubject && !matchesId) return false;
      }

      return true;
    });
  }, [demosList, selectedStatusTab, searchQuery, dateRange, fromDate, toDate]);

  // APPLICATION-LEVEL TIME OVERLAP RE-CHECK AT ASSIGNMENT TIME (doAssign)
  // The real overlap check runs server-side against the teacher's other demos
  // and class sessions (see app/demos/actions.ts).
  const handleDoAssignTeacher = async () => {
    if (!assignModalDemo) return;
    if (!selectedTeacherId) { setConflictErrorMessage('Please select a teacher.'); return; }
    setConflictErrorMessage(null);
    setAssigning(true);

    const res = await assignTeacher({ demoId: assignModalDemo.id, teacherId: selectedTeacherId });
    setAssigning(false);

    if (res.ok) {
      const studentName = assignModalDemo.studentName;
      setAssignModalDemo(null);
      setSelectedTeacherId('');
      router.refresh();
      alert(
        res.warning
          ? `Teacher assigned to ${studentName}'s demo.\n\n⚠ ${res.warning}`
          : `Teacher assigned to ${studentName}'s demo.`
      );
    } else if (res.conflict) {
      setConflictErrorMessage(res.error ?? 'Scheduling conflict - assignment blocked.');
    } else {
      setConflictErrorMessage(res.error ?? 'Failed to assign teacher.');
    }
  };

  const handleSaveOutcome = async () => {
    if (!outcomeModalDemo) return;
    setSavingOutcome(true);

    const res = await recordOutcome({
      demoId: outcomeModalDemo.id,
      outcome: selectedOutcome,
      reason: outcomeFeedback,
    });
    setSavingOutcome(false);

    if (res.ok) {
      const leadId = outcomeModalDemo.leadId;
      const won = selectedOutcome === 'Won';
      setOutcomeModalDemo(null);
      setOutcomeFeedback('');
      router.refresh();
      // On a win, surface the enrollment-form link for the admin to send instead of
      // a separate "convert" step (the student self-completes their record).
      if (won && leadId) {
        setEnrollLink(`${window.location.origin}/enroll/${leadId}`);
      } else {
        alert(`Demo outcome saved: ${selectedOutcome}.`);
      }
    } else {
      alert(res.error ?? 'Failed to save outcome.');
    }
  };

  const handleDeleteDemo = async (d: DemoSession) => {
    if (!confirm(`Delete the demo for ${d.studentName}? This removes it from the list.`)) return;
    const res = await deleteDemo(d.id);
    if (res.ok) router.refresh();
    else alert(res.error ?? 'Failed to delete demo.');
  };

  // View / Edit(reschedule)
  const [viewDemo, setViewDemo] = useState<DemoSession | null>(null);

  const isoToPktDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }) : todayStr);
  const isoToPktTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false }) : '');

  const [editDemo, setEditDemo] = useState<DemoSession | null>(null);
  const [edDate, setEdDate] = useState('');
  const [edTime, setEdTime] = useState('');
  const [edSaving, setEdSaving] = useState(false);
  const [edError, setEdError] = useState<string | null>(null);

  const openEditDemo = (d: DemoSession) => {
    setEditDemo(d);
    setEdDate(isoToPktDate(d.scheduledISO));
    setEdTime(isoToPktTime(d.scheduledISO));
    setEdError(null);
  };
  const handleUpdateDemo = async () => {
    if (!editDemo) return;
    setEdError(null);
    if (!edDate || !edTime) { setEdError('Pick a date and time.'); return; }
    setEdSaving(true);
    const res = await updateDemo({ demoId: editDemo.id, date: edDate, time: edTime });
    setEdSaving(false);
    if (res.ok) {
      setEditDemo(null);
      router.refresh();
      if (res.warning) alert(`Demo rescheduled.\n\n⚠ ${res.warning}`);
    } else setEdError(res.error ?? 'Failed to reschedule the demo.');
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* WON -> ENROLLMENT LINK MODAL */}
        {enrollLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 font-heading font-extrabold text-lg">
                <CheckCircle2 className="w-5 h-5" />
                <span>Student Won - Send Enrollment Form</span>
              </div>
              <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium leading-relaxed">
                Share this link with the parent on WhatsApp. When they submit it, the student record is created automatically - no separate convert step needed.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs break-all text-slate-800 dark:text-slate-200">
                {enrollLink}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEnrollLink(null)} className="px-4 py-2 border rounded-xl font-bold text-xs">Close</button>
                <button
                  onClick={() => { try { navigator.clipboard?.writeText(enrollLink); } catch {} }}
                  className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-extrabold text-xs shadow-md"
                >
                  Copy link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Demos &amp; Schedule</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Schedule demos, assign teachers with overlap re-checks, and track conversion outcomes.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/book"
              target="_blank"
              className="h-[38px] px-3.5 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 text-xs font-extrabold text-[#5B47D6] rounded-xl flex items-center gap-1.5 hover:bg-purple-100 transition-all shadow-sm cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Preview Booking Page ↗</span>
            </Link>
            {canManage && (
              <Button variant="primary" onClick={() => { resetNewDemo(); setShowNewDemo(true); }} className="shadow-[#5B47D6]/20">
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ New Demo</span>
              </Button>
            )}
          </div>
        </div>

        {/* DEMOS KPI STRIP & TABS */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-[#EBEDF3] dark:border-slate-800 pb-3">
            <div className="flex items-center gap-1 bg-[#F6F7FB] dark:bg-slate-800 p-1 rounded-xl flex-wrap">
              {[
                { name: 'All Demos', count: demosList.length },
                { name: 'Needs Teacher', count: demosList.filter((d) => d.teacherId === null).length },
                { name: 'Scheduled', count: demosList.filter((d) => d.status === 'Scheduled').length },
                { name: 'Completed', count: demosList.filter((d) => d.status === 'Completed').length },
              ].map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => setSelectedStatusTab(tab.name)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedStatusTab === tab.name
                      ? tab.name === 'Needs Teacher'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-[#5B47D6] text-white shadow-sm'
                      : 'text-[#6B7185] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-xs ${selectedStatusTab === tab.name ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-[#6B7185]'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-xs text-[#6B7185] block font-medium">Date</span>
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs">
                  <option value="all">All Time</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              {dateRange === 'custom' && (
                <div className="flex items-center gap-1.5 text-xs">
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2 py-1.5 font-bold text-slate-800 dark:text-slate-100" />
                  <span className="text-[#6B7185]">to</span>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2 py-1.5 font-bold text-slate-800 dark:text-slate-100" />
                </div>
              )}
              <div className="relative w-full sm:w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search demo student or subject..."
                  className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* DEMOS DATA TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                  <th className="py-3.5 px-3">Demo ID & Student</th>
                  <th className="py-3.5 px-3">Parent Contact</th>
                  <th className="py-3.5 px-3">Program & Subject</th>
                  <th className="py-3.5 px-3">Assigned Teacher</th>
                  <th className="py-3.5 px-3">Scheduled Time</th>
                  <th className="py-3.5 px-3">Meeting Link</th>
                  <th className="py-3.5 px-3">Outcome</th>
                  <th className="py-3.5 px-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                {filteredDemos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#6B7185]">
                      No demo sessions match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDemos.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{d.studentName}</div>
                        <div className="text-xs text-[#6B7185] font-mono">{d.demoId}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{d.parentName}</div>
                        <div className="text-xs text-[#6B7185] font-mono">{d.parentPhone}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{d.subject}</div>
                        <div className="text-xs text-[#6B7185]">{d.program}</div>
                      </td>

                      {/* ASSIGNED TEACHER COLUMN */}
                      <td className="py-3.5 px-3">
                        {d.teacherName ? (
                          <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{d.teacherName}</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => setAssignModalDemo(d)}
                            className="px-2.5 py-1 bg-orange-100 text-orange-700 font-extrabold text-xs rounded-lg flex items-center gap-1 hover:bg-orange-200 transition-all cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>Assign Teacher</span>
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {d.scheduledTime}
                      </td>

                      <td className="py-3.5 px-3">
                        {d.meetingLink ? (
                          <a
                            href={d.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 inline-flex items-center gap-1 hover:bg-blue-100"
                          >
                            <Video className="w-3 h-3 text-blue-600" />
                            <span>Join Link ↗</span>
                          </a>
                        ) : (
                          <span
                            title="No Google Calendar invite / Meet link for this demo. Assign a teacher (with student & teacher emails on file) or reconnect Google."
                            className="px-2.5 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-lg border border-amber-200 inline-flex items-center gap-1"
                          >
                            ⚠ No invite
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <Badge tone={d.outcome === 'Won' ? 'success' : d.outcome === 'Lost' ? 'danger' : d.outcome === 'No-show' ? 'warning' : 'neutral'}>
                          {d.outcome || 'Pending'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setOutcomeModalDemo(d)}
                            className="px-2.5 py-1 bg-purple-50 text-[#5B47D6] font-bold text-[13px] rounded-lg border border-purple-200 hover:bg-purple-100 cursor-pointer"
                          >
                            Log Outcome
                          </button>
                          {canManage && (
                            <RowActionsMenu
                              actions={[
                                { label: 'View Demo', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setViewDemo(d) },
                                { label: 'Edit / Reschedule', icon: <Edit3 className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => openEditDemo(d) },
                                { label: 'Delete Demo', icon: <Trash2 className="w-3.5 h-3.5" />, tone: 'danger', onClick: () => handleDeleteDemo(d) },
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
        </div>

        {/* NEW DEMO MODAL (staff-created lead + needs_teacher demo) */}
        {showNewDemo && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 my-6 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-900 dark:text-white">Book a New Demo</h3>
                  <p className="text-xs text-[#6B7185] mt-0.5">Creates the lead + a demo needing a teacher. Assign a teacher afterwards to send the Google Meet invite.</p>
                </div>
                <button onClick={() => setShowNewDemo(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Student Name *</label>
                    <input value={ndName} onChange={(e) => setNdName(e.target.value)} placeholder="e.g. Ahmed Raza" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                  </div>
                  <div>
                    <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Parent Name *</label>
                    <input value={ndParent} onChange={(e) => setNdParent(e.target.value)} placeholder="e.g. Mr. Raza Khan" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                  </div>
                  <div>
                    <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Phone *</label>
                    <input value={ndPhone} onChange={(e) => setNdPhone(e.target.value)} placeholder="+92 300 1234567" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                  </div>
                  <div>
                    <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                    <input type="email" value={ndEmail} onChange={(e) => setNdEmail(e.target.value)} placeholder="parent@gmail.com" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Program</label>
                    <select value={ndProgram} onChange={(e) => { setNdProgram(e.target.value); setNdSubjectId(''); }} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]">
                      <option value="">Select program...</option>
                      {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                    <select value={ndSubjectId} onChange={(e) => setNdSubjectId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]">
                      <option value="">{ndProgram ? 'Select subject...' : 'Any (pick program first)'}</option>
                      {ndSubjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                    <input type="date" value={ndDate} onChange={(e) => setNdDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                  </div>
                  <div>
                    <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Time *</label>
                    <input type="time" value={ndTime} onChange={(e) => setNdTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                  </div>
                  <div>
                    <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Source</label>
                    <select value={ndSource} onChange={(e) => setNdSource(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]">
                      <option value="">Walk-in</option>
                      {LEAD_SOURCES.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                </div>

                {ndError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-2 rounded-xl">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{ndError}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowNewDemo(false)} className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button onClick={handleCreateDemo} disabled={ndSaving} className="px-5 py-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{ndSaving ? 'Creating...' : 'Create Demo'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ASSIGN TEACHER MODAL WITH doAssign TIME OVERLAP RE-CHECK */}
        {assignModalDemo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">
                  Assign Teacher (doAssign Conflict Re-Check)
                </h3>
                <button onClick={() => setAssignModalDemo(null)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1 font-medium">
                  <div><span className="text-[#6B7185]">Student:</span> <strong className="text-slate-900">{assignModalDemo.studentName}</strong></div>
                  <div><span className="text-[#6B7185]">Subject & Time:</span> <strong className="text-slate-900">{assignModalDemo.subject} ({assignModalDemo.scheduledTime})</strong></div>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Select Available Teacher</label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full bg-slate-50 border rounded-xl p-2.5 font-bold text-slate-900"
                  >
                    <option value="">Select a teacher...</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {teachers.length === 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-1">No teachers yet. Add a teacher first.</p>
                  )}
                </div>

                {conflictErrorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs font-bold leading-relaxed">
                    {conflictErrorMessage}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setAssignModalDemo(null)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
                <button onClick={handleDoAssignTeacher} disabled={assigning} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-extrabold text-xs shadow-md disabled:opacity-50">
                  {assigning ? 'Checking...' : 'Verify & Assign Teacher'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOG OUTCOME MODAL */}
        {outcomeModalDemo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">
                  Log Demo Outcome - {outcomeModalDemo.studentName}
                </h3>
                <button onClick={() => setOutcomeModalDemo(null)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-slate-700 block mb-1">Demo Outcome Status</label>
                  <select
                    value={selectedOutcome}
                    onChange={(e) => setSelectedOutcome(e.target.value as any)}
                    className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900"
                  >
                    <option value="Won">🟢 Won (Student Ready to Enroll)</option>
                    <option value="Lost">🔴 Lost (Not Interested)</option>
                    <option value="No-show">🟡 No-show (Student/Parent Absent)</option>
                    <option value="Pending">🕒 Pending Decision</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1">Teacher / Admin Feedback Notes</label>
                  <textarea
                    rows={3}
                    value={outcomeFeedback}
                    onChange={(e) => setOutcomeFeedback(e.target.value)}
                    placeholder="Enter teacher feedback regarding demo performance..."
                    className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setOutcomeModalDemo(null)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
                <button onClick={handleSaveOutcome} disabled={savingOutcome} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-extrabold text-xs shadow-md disabled:opacity-50">
                  {savingOutcome ? 'Saving...' : 'Save Demo Outcome'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT / RESCHEDULE DEMO MODAL */}
        {editDemo && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 my-6 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-900 dark:text-white">Reschedule Demo</h3>
                  <p className="text-xs text-[#6B7185] mt-0.5">{editDemo.studentName} · {editDemo.demoId}. If a teacher is assigned, the calendar invite moves too.</p>
                </div>
                <button onClick={() => setEditDemo(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                  <input type="date" value={edDate} onChange={(e) => setEdDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                </div>
                <div>
                  <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Time *</label>
                  <input type="time" value={edTime} onChange={(e) => setEdTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                </div>
              </div>
              {edError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-2 rounded-xl">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{edError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditDemo(null)} className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button onClick={handleUpdateDemo} disabled={edSaving} className="px-5 py-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2">
                  <Check className="w-4 h-4" /><span>{edSaving ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW DEMO MODAL */}
        {viewDemo && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-3 my-6 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-extrabold text-lg text-slate-900 dark:text-white">Demo Details</h3>
                <button onClick={() => setViewDemo(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                {[
                  ['Student', viewDemo.studentName],
                  ['Parent', viewDemo.parentName],
                  ['Phone', viewDemo.parentPhone],
                  ['Program', viewDemo.program || '-'],
                  ['Subject', viewDemo.subject || '-'],
                  ['Teacher', viewDemo.teacherName || 'Unassigned'],
                  ['Scheduled', viewDemo.scheduledTime],
                  ['Status', viewDemo.status],
                  ['Outcome', viewDemo.outcome || 'Pending'],
                  ['Demo ID', viewDemo.demoId],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#6B7185]">{k}</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 break-words">{v}</div>
                  </div>
                ))}
              </div>
              {viewDemo.feedback && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 text-[13px]">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#6B7185]">Notes / Reason</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{viewDemo.feedback}</div>
                </div>
              )}
              {viewDemo.meetingLink && (
                <a href={viewDemo.meetingLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 text-xs font-bold hover:bg-blue-100">
                  <Video className="w-4 h-4" /> Join Meet Link
                </a>
              )}
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
