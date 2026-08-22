'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { Lead } from '@/lib/mockAdmissionsData';
import { ALL_PROGRAMS } from '@/lib/syllabiSeed';
import { createLead, convertLead, updateLead, softDeleteLead, markLeadNotConverted, listLeadCommunications, logLeadCommunication, bulkDeleteLeads, bulkSetLeadStage, type LeadCommunication } from './actions';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { downloadCsv } from '@/lib/export/csv';
import {
  Users,
  UserCheck,
  AlertTriangle,
  Receipt,
  Calendar,
  UserPlus,
  Sparkles,
  Search,
  Filter,
  X,
  ChevronDown,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  Plus,
  CheckSquare,
  Clock,
  CheckCircle2,
  Flame,
  User,
  Edit3,
  Trash2,
  ExternalLink,
  ArrowRight,
  GraduationCap,
  Award,
} from 'lucide-react';

export function LeadsClient({ initialLeads }: { initialLeads: Lead[] }) {
  const { role } = useRole();

  // LOCAL LEADS STATE (seeded from server, RLS-authorized)
  const [leadsList, setLeadsList] = useState<Lead[]>(initialLeads);
  const [activeStageTab, setActiveStageTab] = useState<string>('All Leads');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProgram, setSelectedProgram] = useState<string>('All Programs');
  const [selectedTemperature, setSelectedTemperature] = useState<string>('All Temperatures');
  const [dateRange, setDateRange] = useState<'all' | '7' | '30' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // MODAL & DRAWER STATES
  const [selectedLeadDrawer, setSelectedLeadDrawer] = useState<Lead | null>(null);
  const [convertModalLead, setConvertModalLead] = useState<Lead | null>(null);

  // LEAD COMMUNICATIONS (call / note log) for the open drawer
  const [comms, setComms] = useState<LeadCommunication[]>([]);
  const [commChannel, setCommChannel] = useState('call');
  const [commNote, setCommNote] = useState('');
  const [commSaving, setCommSaving] = useState(false);

  useEffect(() => {
    if (!selectedLeadDrawer) { setComms([]); return; }
    let alive = true;
    listLeadCommunications(selectedLeadDrawer.id)
      .then((c) => { if (alive) setComms(c); })
      .catch(() => { if (alive) setComms([]); });
    return () => { alive = false; };
  }, [selectedLeadDrawer]);

  const handleLogComm = async () => {
    if (!selectedLeadDrawer || !commNote.trim()) return;
    setCommSaving(true);
    const res = await logLeadCommunication({ leadId: selectedLeadDrawer.id, channel: commChannel, note: commNote });
    setCommSaving(false);
    if (res.ok) {
      setCommNote('');
      const c = await listLeadCommunications(selectedLeadDrawer.id);
      setComms(c);
    } else {
      alert(res.error ?? 'Failed to log the note.');
    }
  };

  const commTimeAgo = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // ADD NEW LEAD MODAL
  const [showAddLeadModal, setShowAddLeadModal] = useState<boolean>(false);
  const [newLeadData, setNewLeadData] = useState({
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    studentName: '',
    program: 'O Level',
    grade: 'Grade 10',
    subjects: 'Mathematics',
    source: 'Walk-in',
    temperature: 'Hot' as 'Hot' | 'Warm' | 'Cold',
    notes: '',
  });

  const router = useRouter();

  // BULK SELECTION STATE
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Keep the table + open drawer in sync when the server refetches after a write.
  useEffect(() => {
    setLeadsList(initialLeads);
    setSelectedLeadDrawer((prev) => (prev ? initialLeads.find((l) => l.id === prev.id) ?? null : null));
  }, [initialLeads]);

  // CONVERT MODAL - student fee fields (students table requires these)
  const [convertFee, setConvertFee] = useState('');
  const [convertSession, setConvertSession] = useState('');
  const [convertPaidDate, setConvertPaidDate] = useState(''); // date first month was paid
  const [convertMethod, setConvertMethod] = useState('Bank Transfer');
  const [converting, setConverting] = useState(false);
  const [addingLead, setAddingLead] = useState(false);

  const stageCounts = useMemo(() => {
    return {
      all: leadsList.length,
      new: leadsList.filter((l) => l.stage === 'New').length,
      contacted: leadsList.filter((l) => l.stage === 'Contacted').length,
      demoSet: leadsList.filter((l) => l.stage === 'Demo Set').length,
      won: leadsList.filter((l) => l.stage === 'Won').length,
      lost: leadsList.filter((l) => l.stage === 'Lost').length,
    };
  }, [leadsList]);

  const filteredLeads = useMemo(() => {
    return leadsList.filter((l) => {
      if (activeStageTab === 'New' && l.stage !== 'New') return false;
      if (activeStageTab === 'Contacted' && l.stage !== 'Contacted') return false;
      if (activeStageTab === 'Demo Set' && l.stage !== 'Demo Set') return false;
      if (activeStageTab === 'Demo Done' && l.stage !== 'Demo Done') return false;
      if (activeStageTab === 'Won' && l.stage !== 'Won') return false;
      if (activeStageTab === 'Lost' && l.stage !== 'Lost') return false;

      if (selectedProgram !== 'All Programs' && l.program !== selectedProgram) return false;
      if (selectedTemperature !== 'All Temperatures' && l.temperature !== selectedTemperature) return false;

      // Date range (by lead created date)
      if (dateRange !== 'all' && l.createdDate) {
        const t = new Date(l.createdDate).getTime();
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
        const matchesName = l.studentName.toLowerCase().includes(q) || l.parentName.toLowerCase().includes(q);
        const matchesId = l.leadId.toLowerCase().includes(q);
        const matchesPhone = l.parentPhone.includes(q);
        if (!matchesName && !matchesId && !matchesPhone) return false;
      }

      return true;
    });
  }, [leadsList, activeStageTab, selectedProgram, selectedTemperature, searchQuery, dateRange, fromDate, toDate]);

  // ADD LEAD (persists via server action, RLS-enforced)
  const handleAddNewLead = async () => {
    if (!newLeadData.parentName || !newLeadData.studentName) {
      alert('Student name and parent name are required.');
      return;
    }
    setAddingLead(true);
    const res = await createLead({
      studentName: newLeadData.studentName,
      parentName: newLeadData.parentName,
      parentPhone: newLeadData.parentPhone,
      parentEmail: newLeadData.parentEmail,
      program: newLeadData.program,
      subjects: newLeadData.subjects,
      source: newLeadData.source,
      temperature: newLeadData.temperature,
    });
    setAddingLead(false);

    if (res.ok) {
      setShowAddLeadModal(false);
      setNewLeadData({
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        studentName: '',
        program: 'O Level',
        grade: 'Grade 10',
        subjects: 'Mathematics',
        source: 'Walk-in',
        temperature: 'Hot',
        notes: '',
      });
      router.refresh();
    } else {
      alert(res.error ?? 'Failed to add lead.');
    }
  };

  // CONVERT LEAD -> STUDENT (creates a real student, links + marks Won)
  const handleDeleteLead = async (leadId: string, name: string) => {
    if (!confirm(`Delete lead "${name}"? This removes it from the pipeline.`)) return;
    const res = await softDeleteLead(leadId);
    if (res.ok) {
      setSelectedLeadDrawer(null);
      router.refresh();
    } else {
      alert(res.error ?? 'Failed to delete lead.');
    }
  };

  // "Not converted" (Lost) with a reason
  const NOT_CONVERTED_REASONS = ['Fee issue', 'Timing issue', 'Distance / location', 'Not interested', 'Chose another academy'];
  const [notConvLead, setNotConvLead] = useState<Lead | null>(null);
  const [notConvReason, setNotConvReason] = useState('');
  const [notConvCustom, setNotConvCustom] = useState('');
  const [notConvSaving, setNotConvSaving] = useState(false);
  const [notConvError, setNotConvError] = useState<string | null>(null);

  const openNotConverted = (l: Lead) => {
    setNotConvLead(l); setNotConvReason(''); setNotConvCustom(''); setNotConvError(null);
  };
  const handleMarkNotConverted = async () => {
    if (!notConvLead) return;
    const reason = notConvReason === 'Other' ? notConvCustom.trim() : notConvReason;
    if (!reason) { setNotConvError('Please choose a reason or write one.'); return; }
    setNotConvSaving(true);
    const res = await markLeadNotConverted({ leadId: notConvLead.id, reason });
    setNotConvSaving(false);
    if (res.ok) { setNotConvLead(null); router.refresh(); }
    else setNotConvError(res.error ?? 'Failed to update the lead.');
  };

  // BULK SELECTION helpers (operate on the current filtered view)
  const toggleSelectAllLeads = () => {
    if (selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    }
  };
  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const handleBulkDeleteLeads = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!confirm(`Delete ${selectedLeadIds.length} selected lead${selectedLeadIds.length === 1 ? '' : 's'}? This removes them from the pipeline.`)) return;
    setBulkBusy(true);
    const res = await bulkDeleteLeads(selectedLeadIds);
    setBulkBusy(false);
    if (res.ok) { setSelectedLeadIds([]); router.refresh(); }
    else alert(res.error ?? 'Failed to delete the selected leads.');
  };
  const handleBulkLeadStage = async (stage: string) => {
    if (selectedLeadIds.length === 0 || !stage) return;
    setBulkBusy(true);
    const res = await bulkSetLeadStage(selectedLeadIds, stage);
    setBulkBusy(false);
    if (res.ok) { setSelectedLeadIds([]); router.refresh(); }
    else alert(res.error ?? 'Failed to update stage.');
  };
  const handleBulkExportLeads = () => {
    const rows = leadsList.filter((l) => selectedLeadIds.includes(l.id));
    downloadCsv(
      'Thinkerzz_Leads',
      ['Lead ID', 'Student', 'Parent', 'Phone', 'Program', 'Stage', 'Temperature', 'Source'],
      rows.map((l) => [l.leadId, l.studentName, l.parentName, l.parentPhone, l.program, l.stage, l.temperature, l.source])
    );
  };

  const handleConvertLeadToStudent = async () => {
    if (!convertModalLead) return;
    const feeNum = parseFloat(convertFee);
    if (!convertSession.trim()) { alert('Please enter the exam session.'); return; }
    if (isNaN(feeNum) || feeNum <= 0) { alert('Please enter a valid monthly fee.'); return; }
    if (!convertPaidDate) { alert('Please select the date the first fee was paid.'); return; }

    setConverting(true);
    const res = await convertLead({
      leadId: convertModalLead.id,
      examSession: convertSession,
      monthlyFee: feeNum,
      firstFeePaidDate: convertPaidDate,
      paymentMethod: convertMethod,
    });
    setConverting(false);

    if (res.ok) {
      const name = convertModalLead.studentName;
      setConvertModalLead(null);
      setConvertFee('');
      setConvertSession('');
      setConvertPaidDate('');
      setConvertMethod('Bank Transfer');
      router.refresh();
      alert(res.warning
        ? `${name} was enrolled. Note: ${res.warning}`
        : `${name} was enrolled - first month recorded as paid, next fee due in 30 days.`);
    } else {
      alert(res.error ?? 'Failed to convert lead.');
    }
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Leads CRM & Admissions Pipeline</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Track student inquiries, manage conversion stages, and convert leads into active enrollments.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/demos"
              className="h-[38px] px-3.5 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#5B47D6]" />
              <span>Demos Management</span>
            </Link>

            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  'Thinkerzz_Leads',
                  ['Lead ID', 'Student', 'Parent', 'Phone', 'Email', 'Program', 'Subjects', 'Stage', 'Temperature', 'Source', 'Teacher', 'Created'],
                  filteredLeads.map((l) => [
                    l.leadId, l.studentName, l.parentName, l.parentPhone, l.parentEmail, l.program,
                    (l.subjects ?? []).join('; '), l.stage, l.temperature, l.source, l.assignedTeacherName ?? '', l.createdDate,
                  ])
                )
              }
              title="Export the current view to CSV"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </Button>

            <Button variant="primary" onClick={() => setShowAddLeadModal(true)}>
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add New Lead</span>
            </Button>
          </div>
        </div>

        {/* 5 CONVERSION STAGE TABS & PIPELINE SUMMARY */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-[#EBEDF3] dark:border-slate-800 pb-3">
            <div className="flex items-center gap-1 bg-[#F6F7FB] dark:bg-slate-800 p-1 rounded-xl flex-wrap">
              {[
                { name: 'All Leads', count: stageCounts.all },
                { name: 'New', count: stageCounts.new },
                { name: 'Contacted', count: stageCounts.contacted },
                { name: 'Demo Set', count: stageCounts.demoSet },
                { name: 'Won', count: stageCounts.won },
                { name: 'Lost', count: stageCounts.lost },
              ].map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveStageTab(tab.name)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeStageTab === tab.name
                      ? tab.name === 'Won'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : tab.name === 'Lost'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'bg-[#5B47D6] text-white shadow-sm'
                      : 'text-[#6B7185] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-xs ${activeStageTab === tab.name ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-[#6B7185]'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Pipeline Conversion Rate:</span>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-medium text-xs rounded-full">
                {Math.round((stageCounts.won / (stageCounts.all || 1)) * 100)}%
              </span>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-[260px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search lead name, parent, phone..."
                className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]"
              />
            </div>

            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Program</span>
              <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs">
                <option value="All Programs">All Programs</option>
                {Array.from(new Set(leadsList.map((l) => l.program).filter(Boolean))).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Temperature</span>
              <select value={selectedTemperature} onChange={(e) => setSelectedTemperature(e.target.value)} className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs">
                <option value="All Temperatures">All Temperatures</option>
                <option value="Hot">🔥 Hot</option>
                <option value="Warm">🟡 Warm</option>
                <option value="Cold">❄️ Cold</option>
              </select>
            </div>

            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Date</span>
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs">
                <option value="all">All Time</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-1.5 text-xs">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100" />
                <span className="text-[#6B7185]">to</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100" />
              </div>
            )}
          </div>
        </div>

        {/* BULK ACTION BAR — appears when rows are selected */}
        {selectedLeadIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-[#EEEBFB] dark:bg-[#5B47D6]/15 border border-[#5B47D6]/30 rounded-[14px] px-4 py-2.5 text-sm">
            <span className="font-medium text-[#5B47D6] dark:text-[#b9adf2]">
              {selectedLeadIds.length} selected
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>

            <select
              value=""
              disabled={bulkBusy}
              title="Set stage"
              onChange={(e) => { if (e.target.value) handleBulkLeadStage(e.target.value); }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-[#5B47D6]"
            >
              <option value="">Set stage…</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Demo Set">Demo Set</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>

            <button
              onClick={handleBulkExportLeads}
              disabled={bulkBusy}
              className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
            </button>

            <button
              onClick={handleBulkDeleteLeads}
              disabled={bulkBusy}
              className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> {bulkBusy ? 'Working…' : 'Delete'}
            </button>

            <button
              onClick={() => setSelectedLeadIds([])}
              disabled={bulkBusy}
              className="ml-auto h-8 px-3 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        )}

        {/* MAIN LEADS DATA TABLE & STAGE PIPELINE CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* LEADS LIST TABLE (8 COLS) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                    <th className="py-3.5 px-3 w-[40px] text-center">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                        onChange={toggleSelectAllLeads}
                        className="rounded accent-[#5B47D6] cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 px-3">Lead ID & Student</th>
                    <th className="py-3.5 px-3">Parent & Contact</th>
                    <th className="py-3.5 px-3">Program & Grade</th>
                    <th className="py-3.5 px-3">Source</th>
                    <th className="py-3.5 px-3">Temp</th>
                    <th className="py-3.5 px-3">Stage</th>
                    <th className="py-3.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#6B7185]">
                        No leads match the selected stage filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((l) => (
                      <tr
                        key={l.id}
                        onClick={() => setSelectedLeadDrawer(l)}
                        className={`transition-colors cursor-pointer ${
                          selectedLeadDrawer?.id === l.id ? 'bg-purple-50/70 border-l-4 border-l-[#5B47D6]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(l.id)}
                            onChange={() => toggleSelectLead(l.id)}
                            className="rounded accent-[#5B47D6]"
                          />
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{l.studentName}</div>
                          <div className="text-xs text-[#6B7185] font-mono">{l.leadId}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{l.parentName}</div>
                          <div className="text-xs text-[#6B7185] font-mono">{l.parentPhone}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{l.program}</div>
                          <div className="text-xs text-[#6B7185]">{l.grade} · {l.subjects.join(', ')}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <Badge tone="neutral">{l.source}</Badge>
                        </td>

                        <td className="py-3.5 px-3">
                          <Badge tone={l.temperature === 'Hot' ? 'danger' : l.temperature === 'Warm' ? 'warning' : 'info'}>
                            {l.temperature === 'Hot' ? '🔥 Hot' : l.temperature === 'Warm' ? '🟡 Warm' : '❄️ Cold'}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-3">
                          <Badge tone={l.stage === 'Won' ? 'success' : l.stage === 'Lost' ? 'neutral' : 'brand'}>
                            {l.stage}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <a href={`https://wa.me/${l.parentPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp Lead" className="w-7 h-7 rounded-lg bg-[#E7F9EE] text-[#12A150] flex items-center justify-center border border-[#BDE8CC]">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>

                            {l.stage !== 'Won' && (
                              <button
                                onClick={() => setConvertModalLead(l)}
                                title="Convert Lead to Active Student"
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[13px] rounded-lg shadow-xs transition-all cursor-pointer"
                              >
                                Convert
                              </button>
                            )}

                            <RowActionsMenu
                              actions={[
                                { label: 'Edit Lead', icon: <Edit3 className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => setSelectedLeadDrawer(l) },
                                { label: 'Mark Not Converted', icon: <AlertTriangle className="w-3.5 h-3.5" />, tone: 'warning', hidden: l.stage === 'Won' || l.stage === 'Lost', onClick: () => openNotConverted(l) },
                                { label: 'Delete Lead', icon: <Trash2 className="w-3.5 h-3.5" />, tone: 'danger', hidden: role !== 'admin', onClick: () => handleDeleteLead(l.id, l.studentName) },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t flex justify-between items-center text-xs font-medium text-slate-600">
              <div>Showing {filteredLeads.length} of {leadsList.length} leads</div>
            </div>
          </div>

          {/* LEAD DETAIL DRAWER (RIGHT 4 COLS) */}
          {selectedLeadDrawer && (
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm space-y-5 animate-in fade-in">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading font-medium text-lg text-slate-900 dark:text-white">{selectedLeadDrawer.studentName}</h2>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-[#5B47D6]">
                      {selectedLeadDrawer.stage}
                    </span>
                  </div>
                  <div className="text-xs text-[#6B7185] font-medium mt-0.5">
                    Lead ID: <span className="font-mono font-medium text-slate-800">{selectedLeadDrawer.leadId}</span> · Created {selectedLeadDrawer.createdDate}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {role === 'admin' && (
                    <button
                      onClick={() => handleDeleteLead(selectedLeadDrawer.id, selectedLeadDrawer.studentName)}
                      className="px-2.5 py-1 bg-rose-50 text-rose-600 font-medium text-xs rounded-lg border border-rose-200 hover:bg-rose-100 cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                  <button onClick={() => setSelectedLeadDrawer(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </div>
              </div>

              {/* QUICK ACTIONS */}
              <div className="flex items-center gap-2 text-xs font-medium">
                <a href={`https://wa.me/${selectedLeadDrawer.parentPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-[#E7F9EE] text-[#12A150] rounded-xl flex items-center justify-center gap-1.5 border border-[#BDE8CC]">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a href={`tel:${selectedLeadDrawer.parentPhone}`} className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Parent</span>
                </a>
              </div>

              {/* INLINE EDIT - stage & temperature (persists) */}
              {role !== 'student' && role !== 'teacher' && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="font-medium text-slate-500 block mb-1">Stage</label>
                    <select
                      value={selectedLeadDrawer.stage}
                      onChange={async (e) => {
                        const res = await updateLead({ leadId: selectedLeadDrawer.id, stage: e.target.value });
                        if (res.ok) router.refresh();
                        else alert(res.error ?? 'Failed to update.');
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-medium text-slate-900 dark:text-slate-100"
                    >
                      {['New', 'Contacted', 'Demo Set', 'Won', 'Lost'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-slate-500 block mb-1">Temperature</label>
                    <select
                      value={selectedLeadDrawer.temperature}
                      onChange={async (e) => {
                        const res = await updateLead({ leadId: selectedLeadDrawer.id, temperature: e.target.value });
                        if (res.ok) router.refresh();
                        else alert(res.error ?? 'Failed to update.');
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-medium text-slate-900 dark:text-slate-100"
                    >
                      {['Hot', 'Warm', 'Cold'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* CONVERT BUTTON BANNER */}
              {selectedLeadDrawer.stage !== 'Won' && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center font-medium text-xs text-emerald-900">
                    <span>Ready to Enroll Student?</span>
                    <span className="text-emerald-700 text-xs">Default Target Grade: A*</span>
                  </div>
                  <button
                    onClick={() => setConvertModalLead(selectedLeadDrawer)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-xs shadow-md transition-all cursor-pointer"
                  >
                    Convert {selectedLeadDrawer.studentName} to Active Student
                  </button>
                </div>
              )}

              {/* LEAD DETAILS */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Parent Name</span><span className="font-medium text-slate-900">{selectedLeadDrawer.parentName}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Parent Phone</span><span className="font-mono font-medium text-slate-900">{selectedLeadDrawer.parentPhone}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Parent Email</span><span className="font-mono font-medium text-slate-900">{selectedLeadDrawer.parentEmail}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Program & Grade</span><span className="font-medium text-slate-900">{selectedLeadDrawer.program} · {selectedLeadDrawer.grade}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Interested Subjects</span><span className="font-medium text-slate-900">{selectedLeadDrawer.subjects.join(', ')}</span></div>
                <div className="flex justify-between py-1"><span className="text-[#6B7185]">Lead Source</span><span className="font-medium text-purple-600">{selectedLeadDrawer.source}</span></div>
              </div>

              {/* NOTES & RECENT TIMELINE */}
              <div className="space-y-2 text-xs">
                <div className="font-medium text-slate-900 uppercase">Lead Notes &amp; History</div>
                {selectedLeadDrawer.notes && (
                  <div className="p-3 bg-slate-50 border rounded-xl font-medium text-slate-700 leading-relaxed">
                    {selectedLeadDrawer.notes}
                  </div>
                )}

                {/* Log a call / WhatsApp / note */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={commChannel}
                      onChange={(e) => setCommChannel(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-[#5B47D6]"
                    >
                      <option value="call">Call</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                      <option value="meeting">Meeting</option>
                      <option value="note">Note</option>
                    </select>
                    <input
                      value={commNote}
                      onChange={(e) => setCommNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleLogComm(); }}
                      placeholder="What happened? (e.g. called, will decide by Friday)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#5B47D6]"
                    />
                    <button
                      onClick={handleLogComm}
                      disabled={commSaving || !commNote.trim()}
                      className="px-3 py-1.5 bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-50 text-white rounded-lg text-xs font-medium"
                    >
                      {commSaving ? '…' : 'Log'}
                    </button>
                  </div>
                </div>

                {/* History */}
                <div className="space-y-1.5">
                  {comms.length === 0 ? (
                    <p className="text-[11px] text-slate-400 px-1">No calls or notes logged yet.</p>
                  ) : (
                    comms.map((c) => (
                      <div key={c.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-[#5B47D6]">{c.channel}</span>
                          <span className="text-[10px] text-slate-400">{commTimeAgo(c.at)}</span>
                        </div>
                        <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{c.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* CONVERT LEAD TO STUDENT MODAL (DEFAULTS target_grade TO A*) */}
        {convertModalLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 relative">
              <div className="flex justify-between items-center border-b pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-medium text-slate-900 dark:text-white text-lg">Convert Lead to Student</h3>
                    <p className="text-xs text-[#6B7185]">Enroll {convertModalLead.studentName} into the official active student roster.</p>
                  </div>
                </div>
                <button onClick={() => setConvertModalLead(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>

              {/* PRE-FILLED STUDENT FORM DETAILS */}
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between font-medium"><span className="text-slate-500">Student Name:</span><span className="text-slate-900">{convertModalLead.studentName}</span></div>
                  <div className="flex justify-between font-medium"><span className="text-slate-500">Program & Grade:</span><span className="text-slate-900">{convertModalLead.program} · {convertModalLead.grade}</span></div>
                  <div className="flex justify-between font-medium"><span className="text-slate-500">Parent Name:</span><span className="text-slate-900">{convertModalLead.parentName} ({convertModalLead.parentPhone})</span></div>
                </div>

                <div className="space-y-1 bg-purple-50 p-3 rounded-xl border border-purple-200">
                  <label className="font-medium text-purple-900 block">Default Target Grade (Locked Policy)</label>
                  <div className="w-full bg-white border border-purple-300 rounded-lg p-2 font-medium text-purple-900">
                    A* (Default per Master Plan §4)
                  </div>
                  <p className="text-xs text-purple-700 font-medium mt-1">
                    Note: Per Master Plan §4, target_grade defaults to A* at enrollment. Assessed grade remains blank until the first test is graded.
                  </p>
                </div>

                {/* Enrollment fee fields (required by the students table) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Exam Session</label>
                    <input type="text" value={convertSession} onChange={(e) => setConvertSession(e.target.value)} placeholder="e.g. May/June 2027" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-medium text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Monthly Fee (PKR)</label>
                    <input type="number" value={convertFee} onChange={(e) => setConvertFee(e.target.value)} placeholder="e.g. 20000" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-mono font-medium text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Date First Fee Paid</label>
                    <input type="date" value={convertPaidDate} onChange={(e) => setConvertPaidDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-medium text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Payment Method</label>
                    <select value={convertMethod} onChange={(e) => setConvertMethod(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-medium text-slate-900 dark:text-slate-100">
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="JazzCash">JazzCash</option>
                    </select>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 font-medium">
                  Converting records the <strong>first month as paid</strong>. The next fee will be due <strong>30 days after</strong> the paid date, and a paid voucher is created automatically.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setConvertModalLead(null)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
                <button onClick={handleConvertLeadToStudent} disabled={converting} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">
                  {converting ? 'Converting...' : 'Confirm Conversion & Create Student'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD NEW LEAD MODAL */}
        {showAddLeadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Add New Lead</h3>
                <button onClick={() => setShowAddLeadModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Student Name</label>
                  <input type="text" value={newLeadData.studentName} onChange={(e) => setNewLeadData({ ...newLeadData, studentName: e.target.value })} placeholder="e.g. Hamza Khan" className="w-full bg-slate-50 border rounded-xl p-2 font-medium" />
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Parent Name</label>
                  <input type="text" value={newLeadData.parentName} onChange={(e) => setNewLeadData({ ...newLeadData, parentName: e.target.value })} placeholder="e.g. Mr. Shahzaib Khan" className="w-full bg-slate-50 border rounded-xl p-2 font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Parent Phone</label>
                    <input type="text" value={newLeadData.parentPhone} onChange={(e) => setNewLeadData({ ...newLeadData, parentPhone: e.target.value })} placeholder="+92 300..." className="w-full bg-slate-50 border rounded-xl p-2 font-medium" />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Parent Email</label>
                    <input type="email" value={newLeadData.parentEmail} onChange={(e) => setNewLeadData({ ...newLeadData, parentEmail: e.target.value })} placeholder="parent@example.com" className="w-full bg-slate-50 border rounded-xl p-2 font-medium" />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Program</label>
                    <select value={newLeadData.program} onChange={(e) => setNewLeadData({ ...newLeadData, program: e.target.value })} className="w-full bg-slate-50 border rounded-xl p-2 font-medium">
                      {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Subject(s)</label>
                    <input type="text" value={newLeadData.subjects} onChange={(e) => setNewLeadData({ ...newLeadData, subjects: e.target.value })} placeholder="e.g. Physics, Maths" className="w-full bg-slate-50 border rounded-xl p-2 font-medium" />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">How did they find us?</label>
                    <select value={newLeadData.source} onChange={(e) => setNewLeadData({ ...newLeadData, source: e.target.value })} className="w-full bg-slate-50 border rounded-xl p-2 font-medium">
                      {['Google', 'Facebook', 'Instagram', 'WhatsApp', 'Referral', 'Walk-in'].map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Interest (Temperature)</label>
                    <select value={newLeadData.temperature} onChange={(e) => setNewLeadData({ ...newLeadData, temperature: e.target.value as 'Hot' | 'Warm' | 'Cold' })} className="w-full bg-slate-50 border rounded-xl p-2 font-medium">
                      <option value="Hot">Hot (very interested)</option>
                      <option value="Warm">Warm (considering)</option>
                      <option value="Cold">Cold (just inquiring)</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Temperature = how likely this lead is to enroll: Hot (ready), Warm (considering), Cold (just asking). It helps prioritize follow-ups.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setShowAddLeadModal(false)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
                <button onClick={handleAddNewLead} disabled={addingLead} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">{addingLead ? 'Adding...' : 'Add Lead'}</button>
              </div>
            </div>
          </div>
        )}

        {/* MARK NOT CONVERTED (LOST) MODAL */}
        {notConvLead && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 my-6 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-medium text-lg text-slate-900 dark:text-white">Mark as not converted</h3>
                  <p className="text-xs text-[#6B7185] mt-0.5">{notConvLead.studentName} moves to Lost. The reason is saved on the lead.</p>
                </div>
                <button onClick={() => setNotConvLead(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="space-y-2">
                <label className="block font-medium text-xs text-slate-700 dark:text-slate-300">Reason</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[...NOT_CONVERTED_REASONS, 'Other'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setNotConvReason(r)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                        notConvReason === r ? 'bg-[#5B47D6] text-white border-[#5B47D6]' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {r === 'Other' ? 'Other (write your own)' : r}
                    </button>
                  ))}
                </div>
                {notConvReason === 'Other' && (
                  <input
                    value={notConvCustom}
                    onChange={(e) => setNotConvCustom(e.target.value)}
                    placeholder="Type the reason..."
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                  />
                )}
                {notConvError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2 rounded-xl">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{notConvError}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setNotConvLead(null)} className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button onClick={handleMarkNotConverted} disabled={notConvSaving} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-medium rounded-xl shadow-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /><span>{notConvSaving ? 'Saving...' : 'Confirm'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
