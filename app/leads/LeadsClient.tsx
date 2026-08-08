'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { Lead } from '@/lib/mockAdmissionsData';
import { createLead, convertLead, updateLead } from './actions';
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
  MoreHorizontal,
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

  // MODAL & DRAWER STATES
  const [selectedLeadDrawer, setSelectedLeadDrawer] = useState<Lead | null>(null);
  const [convertModalLead, setConvertModalLead] = useState<Lead | null>(null);

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
    temperature: 'Hot' as 'Hot' | 'Warm' | 'Cold',
    notes: '',
  });

  const router = useRouter();

  // Keep the table + open drawer in sync when the server refetches after a write.
  useEffect(() => {
    setLeadsList(initialLeads);
    setSelectedLeadDrawer((prev) => (prev ? initialLeads.find((l) => l.id === prev.id) ?? null : null));
  }, [initialLeads]);

  // CONVERT MODAL — student fee fields (students table requires these)
  const [convertFee, setConvertFee] = useState('');
  const [convertSession, setConvertSession] = useState('');
  const [convertDueDate, setConvertDueDate] = useState('');
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

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = l.studentName.toLowerCase().includes(q) || l.parentName.toLowerCase().includes(q);
        const matchesId = l.leadId.toLowerCase().includes(q);
        const matchesPhone = l.parentPhone.includes(q);
        if (!matchesName && !matchesId && !matchesPhone) return false;
      }

      return true;
    });
  }, [leadsList, activeStageTab, selectedProgram, selectedTemperature, searchQuery]);

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
        temperature: 'Hot',
        notes: '',
      });
      router.refresh();
    } else {
      alert(res.error ?? 'Failed to add lead.');
    }
  };

  // CONVERT LEAD -> STUDENT (creates a real student, links + marks Won)
  const handleConvertLeadToStudent = async () => {
    if (!convertModalLead) return;
    const feeNum = parseFloat(convertFee);
    if (!convertSession.trim()) { alert('Please enter the exam session.'); return; }
    if (isNaN(feeNum) || feeNum <= 0) { alert('Please enter a valid monthly fee.'); return; }
    if (!convertDueDate) { alert('Please select the first due date.'); return; }

    setConverting(true);
    const res = await convertLead({
      leadId: convertModalLead.id,
      examSession: convertSession,
      monthlyFee: feeNum,
      nextDueDate: convertDueDate,
    });
    setConverting(false);

    if (res.ok) {
      const name = convertModalLead.studentName;
      setConvertModalLead(null);
      setConvertFee('');
      setConvertSession('');
      setConvertDueDate('');
      router.refresh();
      alert(`${name} was enrolled as an active student and the lead marked Won.`);
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
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Leads CRM & Admissions Pipeline</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Track student inquiries, manage conversion stages, and convert leads into active enrollments.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/demos"
              className="h-[38px] px-3.5 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#5B47D6]" />
              <span>Demos Management →</span>
            </Link>

            <button
              onClick={() => setShowAddLeadModal(true)}
              className="h-[38px] px-4 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-[#5B47D6]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Add New Lead</span>
            </button>
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
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
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
              <span className="text-xs font-bold text-slate-500">Pipeline Conversion Rate:</span>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-extrabold text-xs rounded-full">
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
              <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs">
                <option value="All Programs">All Programs</option>
                {Array.from(new Set(leadsList.map((l) => l.program).filter(Boolean))).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Temperature</span>
              <select value={selectedTemperature} onChange={(e) => setSelectedTemperature(e.target.value)} className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs">
                <option value="All Temperatures">All Temperatures</option>
                <option value="Hot">🔥 Hot</option>
                <option value="Warm">🟡 Warm</option>
                <option value="Cold">❄️ Cold</option>
              </select>
            </div>
          </div>
        </div>

        {/* MAIN LEADS DATA TABLE & STAGE PIPELINE CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* LEADS LIST TABLE (8 COLS) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-xs">
                    <th className="py-3.5 px-3">LEAD ID & STUDENT</th>
                    <th className="py-3.5 px-3">PARENT & CONTACT</th>
                    <th className="py-3.5 px-3">PROGRAM & GRADE</th>
                    <th className="py-3.5 px-3">SOURCE</th>
                    <th className="py-3.5 px-3">TEMP</th>
                    <th className="py-3.5 px-3">STAGE</th>
                    <th className="py-3.5 px-3 text-center">ACTIONS</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#6B7185]">
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
                        <td className="py-3.5 px-3">
                          <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{l.studentName}</div>
                          <div className="text-xs text-[#6B7185] font-mono">{l.leadId}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-extrabold text-slate-900 dark:text-slate-100">{l.parentName}</div>
                          <div className="text-xs text-[#6B7185] font-mono">{l.parentPhone}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-extrabold text-slate-900 dark:text-slate-100">{l.program}</div>
                          <div className="text-xs text-[#6B7185]">{l.grade} · {l.subjects.join(', ')}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                            {l.source}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                              l.temperature === 'Hot'
                                ? 'bg-rose-100 text-rose-700'
                                : l.temperature === 'Warm'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {l.temperature === 'Hot' ? '🔥 Hot' : l.temperature === 'Warm' ? '🟡 Warm' : '❄️ Cold'}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                              l.stage === 'Won'
                                ? 'bg-emerald-100 text-emerald-700'
                                : l.stage === 'Lost'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-purple-100 text-[#5B47D6]'
                            }`}
                          >
                            {l.stage}
                          </span>
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
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
                              >
                                Convert →
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t flex justify-between items-center text-xs font-bold text-slate-600">
              <div>Showing {filteredLeads.length} of {leadsList.length} leads</div>
            </div>
          </div>

          {/* LEAD DETAIL DRAWER (RIGHT 4 COLS) */}
          {selectedLeadDrawer && (
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm space-y-5 animate-in fade-in">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading font-extrabold text-lg text-slate-900 dark:text-white">{selectedLeadDrawer.studentName}</h2>
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-[#5B47D6]">
                      {selectedLeadDrawer.stage}
                    </span>
                  </div>
                  <div className="text-xs text-[#6B7185] font-medium mt-0.5">
                    Lead ID: <span className="font-mono font-bold text-slate-800">{selectedLeadDrawer.leadId}</span> · Created {selectedLeadDrawer.createdDate}
                  </div>
                </div>
                <button onClick={() => setSelectedLeadDrawer(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>

              {/* QUICK ACTIONS */}
              <div className="flex items-center gap-2 text-xs font-bold">
                <a href={`https://wa.me/${selectedLeadDrawer.parentPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-[#E7F9EE] text-[#12A150] rounded-xl flex items-center justify-center gap-1.5 border border-[#BDE8CC]">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a href={`tel:${selectedLeadDrawer.parentPhone}`} className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Parent</span>
                </a>
              </div>

              {/* INLINE EDIT — stage & temperature (persists) */}
              {role !== 'student' && role !== 'teacher' && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Stage</label>
                    <select
                      value={selectedLeadDrawer.stage}
                      onChange={async (e) => {
                        const res = await updateLead({ leadId: selectedLeadDrawer.id, stage: e.target.value });
                        if (res.ok) router.refresh();
                        else alert(res.error ?? 'Failed to update.');
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-bold text-slate-900 dark:text-slate-100"
                    >
                      {['New', 'Contacted', 'Demo Set', 'Won', 'Lost'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Temperature</label>
                    <select
                      value={selectedLeadDrawer.temperature}
                      onChange={async (e) => {
                        const res = await updateLead({ leadId: selectedLeadDrawer.id, temperature: e.target.value });
                        if (res.ok) router.refresh();
                        else alert(res.error ?? 'Failed to update.');
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-bold text-slate-900 dark:text-slate-100"
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
                  <div className="flex justify-between items-center font-extrabold text-xs text-emerald-900">
                    <span>Ready to Enroll Student?</span>
                    <span className="text-emerald-700 text-xs">Default Target Grade: A*</span>
                  </div>
                  <button
                    onClick={() => setConvertModalLead(selectedLeadDrawer)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs shadow-md transition-all cursor-pointer"
                  >
                    Convert {selectedLeadDrawer.studentName} to Active Student →
                  </button>
                </div>
              )}

              {/* LEAD DETAILS */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Parent Name</span><span className="font-extrabold text-slate-900">{selectedLeadDrawer.parentName}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Parent Phone</span><span className="font-mono font-bold text-slate-900">{selectedLeadDrawer.parentPhone}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Parent Email</span><span className="font-mono font-bold text-slate-900">{selectedLeadDrawer.parentEmail}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Program & Grade</span><span className="font-extrabold text-slate-900">{selectedLeadDrawer.program} · {selectedLeadDrawer.grade}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Interested Subjects</span><span className="font-extrabold text-slate-900">{selectedLeadDrawer.subjects.join(', ')}</span></div>
                <div className="flex justify-between py-1"><span className="text-[#6B7185]">Lead Source</span><span className="font-bold text-purple-600">{selectedLeadDrawer.source}</span></div>
              </div>

              {/* NOTES & RECENT TIMELINE */}
              <div className="space-y-2 text-xs">
                <div className="font-extrabold text-slate-900 uppercase">Lead Notes & History</div>
                <div className="p-3 bg-slate-50 border rounded-xl font-medium text-slate-700 leading-relaxed">
                  {selectedLeadDrawer.notes}
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
                    <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-lg">Convert Lead to Student</h3>
                    <p className="text-xs text-[#6B7185]">Enroll {convertModalLead.studentName} into the official active student roster.</p>
                  </div>
                </div>
                <button onClick={() => setConvertModalLead(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>

              {/* PRE-FILLED STUDENT FORM DETAILS */}
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between font-bold"><span className="text-slate-500">Student Name:</span><span className="text-slate-900">{convertModalLead.studentName}</span></div>
                  <div className="flex justify-between font-bold"><span className="text-slate-500">Program & Grade:</span><span className="text-slate-900">{convertModalLead.program} · {convertModalLead.grade}</span></div>
                  <div className="flex justify-between font-bold"><span className="text-slate-500">Parent Name:</span><span className="text-slate-900">{convertModalLead.parentName} ({convertModalLead.parentPhone})</span></div>
                </div>

                <div className="space-y-1 bg-purple-50 p-3 rounded-xl border border-purple-200">
                  <label className="font-extrabold text-purple-900 block">Default Target Grade (Locked Policy)</label>
                  <div className="w-full bg-white border border-purple-300 rounded-lg p-2 font-extrabold text-purple-900">
                    A* (Default per Master Plan §4)
                  </div>
                  <p className="text-xs text-purple-700 font-medium mt-1">
                    Note: Per Master Plan §4, target_grade defaults to A* at enrollment. Assessed grade remains blank until the first test is graded.
                  </p>
                </div>

                {/* Enrollment fee fields (required by the students table) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Exam Session</label>
                    <input type="text" value={convertSession} onChange={(e) => setConvertSession(e.target.value)} placeholder="e.g. May/June 2027" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-bold text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Monthly Fee (PKR)</label>
                    <input type="number" value={convertFee} onChange={(e) => setConvertFee(e.target.value)} placeholder="e.g. 20000" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-mono font-extrabold text-slate-900 dark:text-slate-100" />
                  </div>
                  <div className="col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">First Fee Due Date</label>
                    <input type="date" value={convertDueDate} onChange={(e) => setConvertDueDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-lg p-2 font-bold text-slate-900 dark:text-slate-100" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setConvertModalLead(null)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
                <button onClick={handleConvertLeadToStudent} disabled={converting} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs shadow-md disabled:opacity-50">
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
                <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">+ Add New Lead</h3>
                <button onClick={() => setShowAddLeadModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Student Name</label>
                  <input type="text" value={newLeadData.studentName} onChange={(e) => setNewLeadData({ ...newLeadData, studentName: e.target.value })} placeholder="e.g. Hamza Khan" className="w-full bg-slate-50 border rounded-xl p-2 font-bold" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Parent Name</label>
                  <input type="text" value={newLeadData.parentName} onChange={(e) => setNewLeadData({ ...newLeadData, parentName: e.target.value })} placeholder="e.g. Mr. Shahzaib Khan" className="w-full bg-slate-50 border rounded-xl p-2 font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Parent Phone</label>
                    <input type="text" value={newLeadData.parentPhone} onChange={(e) => setNewLeadData({ ...newLeadData, parentPhone: e.target.value })} placeholder="+92 300..." className="w-full bg-slate-50 border rounded-xl p-2 font-bold" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Program</label>
                    <select value={newLeadData.program} onChange={(e) => setNewLeadData({ ...newLeadData, program: e.target.value })} className="w-full bg-slate-50 border rounded-xl p-2 font-bold">
                      <option value="O Level">O Level</option>
                      <option value="A Level">A Level</option>
                      <option value="IGCSE">IGCSE</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setShowAddLeadModal(false)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
                <button onClick={handleAddNewLead} disabled={addingLead} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-bold text-xs shadow-md disabled:opacity-50">{addingLead ? 'Adding...' : 'Add Lead'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
