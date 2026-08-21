'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AddTeacherModal } from '@/components/teachers/AddTeacherModal';
import { SetPayRateModal } from '@/components/teachers/SetPayRateModal';
import { updateTeacher, softDeleteTeacher, markTeacherLeft } from './actions';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { ResetPasswordControl } from '@/components/account/ResetPasswordControl';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ALL_SUBJECTS, ALL_PROGRAMS } from '@/lib/syllabiSeed';
import { KeyRound } from 'lucide-react';
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
  SlidersHorizontal,
  X,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  Download,
  Upload,
  Settings,
  Plus,
  CheckSquare,
  Star,
  ArrowUpRight,
  TrendingUp,
  Clock,
  DollarSign,
  BookOpen,
  Tag,
  Trash2,
  Archive,
  Paperclip,
  ExternalLink,
  Eye,
  User,
  UserCog,
  Edit3,
  Video,
  FilePlus,
  CalendarPlus,
  CreditCard,
  PenTool,
  Award,
  CheckCircle2,
  Flame,
  Wallet,
  ShieldCheck,
  RefreshCw,
  QrCode,
  HardDrive,
  Check,
  RotateCcw,
  Save,
  FileSpreadsheet,
  CheckCircle,
  HelpCircle,
  Briefcase,
  GraduationCap,
} from 'lucide-react';

export interface Teacher {
  id: string;
  empId: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  subjects: string[];
  programs: string[];
  capacity: number;
  currentLoad: number;
  perClassPay: number; // Per Class Payment in PKR
  score: number | null; // null for New Teachers
  rating: number;
  ratingCount: number;
  status: 'Teaching' | 'At Capacity' | 'Onboarding' | 'On Leave' | 'Left';
  experience: string;
  qualification: string;
  todaysClassesCount: number;
  pendingReviewsCount: number;
  payrollStatus: 'Ready' | 'Paid' | 'Processing';
  alertsCount: number;
  schedule: { time: string; title: string; grade: string; tag: 'Live' | 'Scheduled' | 'Review' }[];
}


const AVATAR_COLORS = [
  'bg-purple-100 text-purple-700',
  'bg-teal-100 text-teal-700',
  'bg-blue-100 text-blue-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-emerald-100 text-emerald-700',
];

export function TeachersClient({ initialTeachers }: { initialTeachers: Teacher[] }) {
  const { role } = useRole();
  const router = useRouter();

  // LOCAL TEACHERS DATA STORE (seeded from server, RLS-authorized)
  const [teachersList, setTeachersList] = useState<Teacher[]>(initialTeachers);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [payRateTeacher, setPayRateTeacher] = useState<Teacher | null>(null);

  // Keep the table in sync when the server refetches after a write (router.refresh()).
  useEffect(() => { setTeachersList(initialTeachers); }, [initialTeachers]);
  
  // TABS & FILTERS STATE
  const [activeTabStatus, setActiveTabStatus] = useState<string>('All Teachers');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');
  const [selectedProgram, setSelectedProgram] = useState<string>('All Programs');
  const [selectedLoadLevel, setSelectedLoadLevel] = useState<string>('All Load Levels');
  const [selectedPayRange, setSelectedPayRange] = useState<string>('All Pay Ranges');

  // SELECTED TEACHER FOR RIGHT SIDEBAR DRAWER
  const [selectedDrawerTeacher, setSelectedDrawerTeacher] = useState<Teacher | null>(initialTeachers[0] ?? null);
  const [drawerActiveTab, setDrawerActiveTab] = useState<'Overview' | 'Academics' | 'Classes' | 'Attendance' | 'Payroll' | 'More'>('Overview');

  // SELECTION STATE
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  // FULLY FUNCTIONAL FILTERING LOGIC
  const filteredTeachers = useMemo(() => {
    return teachersList.filter((t) => {
      // 1. Status Tab Filter
      if (activeTabStatus === 'Active' && t.status !== 'Teaching' && t.status !== 'At Capacity') return false;
      if (activeTabStatus === 'Inactive' && t.status !== 'Onboarding' && t.status !== 'On Leave' && t.status !== 'Left') return false;
      if (activeTabStatus === 'On Leave' && t.status !== 'On Leave') return false;
      if (activeTabStatus === 'Left' && t.status !== 'Left') return false;

      // 2. Subject Filter
      if (selectedSubject !== 'All Subjects' && !t.subjects.some(s => s.toLowerCase().includes(selectedSubject.toLowerCase()))) return false;

      // 2b. Program Filter
      if (selectedProgram !== 'All Programs' && !t.programs.some(p => p === selectedProgram)) return false;

      // 3. Load Capacity Filter
      const loadPct = (t.currentLoad / t.capacity) * 100;
      if (selectedLoadLevel === 'Available (<90%)' && loadPct >= 90) return false;
      if (selectedLoadLevel === 'Near Capacity (90-99%)' && (loadPct < 90 || loadPct >= 100)) return false;
      if (selectedLoadLevel === 'At Capacity (100%)' && loadPct < 100) return false;

      // 4. Per Class Pay Filter
      if (selectedPayRange === '< PKR 2,500' && t.perClassPay >= 2500) return false;
      if (selectedPayRange === 'PKR 2,500 - 3,500' && (t.perClassPay < 2500 || t.perClassPay > 3500)) return false;
      if (selectedPayRange === '> PKR 3,500' && t.perClassPay <= 3500) return false;

      // 5. Search Query Filter (Name, Subject, Program)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesSub = t.subjects.some(s => s.toLowerCase().includes(q));
        const matchesProg = t.programs.some(p => p.toLowerCase().includes(q));
        if (!matchesName && !matchesSub && !matchesProg) return false;
      }

      return true;
    });
  }, [teachersList, activeTabStatus, selectedSubject, selectedProgram, selectedLoadLevel, selectedPayRange, searchQuery]);

  const resetAllFilters = () => {
    setActiveTabStatus('All Teachers');
    setSelectedSubject('All Subjects');
    setSelectedProgram('All Programs');
    setSelectedLoadLevel('All Load Levels');
    setSelectedPayRange('All Pay Ranges');
    setSearchQuery('');
  };

  // EDIT / DELETE / LEFT-ACADEMY state + handlers
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const [resetTeacher, setResetTeacher] = useState<Teacher | null>(null);
  const [edName, setEdName] = useState('');
  const [edEmail, setEdEmail] = useState('');
  const [edPhone, setEdPhone] = useState('');
  const [edCity, setEdCity] = useState('');
  const [edCapacity, setEdCapacity] = useState('');
  const [edJoin, setEdJoin] = useState('');
  const [edSubjects, setEdSubjects] = useState<string[]>([]);
  const [edPrograms, setEdPrograms] = useState<string[]>([]);
  const [edSaving, setEdSaving] = useState(false);
  const [edError, setEdError] = useState<string | null>(null);

  const openEditTeacher = (t: Teacher) => {
    setEditTeacher(t);
    setEdName(t.name); setEdEmail(t.email); setEdPhone(t.phone);
    setEdCity(''); setEdCapacity(String(t.capacity ?? '')); setEdJoin('');
    setEdSubjects(Array.isArray(t.subjects) ? [...t.subjects] : []);
    setEdPrograms(Array.isArray(t.programs) ? [...t.programs] : []);
    setEdError(null);
  };
  const toggleEdSubject = (s: string) =>
    setEdSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const toggleEdProgram = (p: string) =>
    setEdPrograms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  const handleUpdateTeacher = async () => {
    if (!editTeacher) return;
    setEdError(null);
    if (!edName.trim() || !edEmail.trim() || !edPhone.trim()) {
      setEdError('Name, email and phone are required.'); return;
    }
    setEdSaving(true);
    const res = await updateTeacher({
      id: editTeacher.id, name: edName, email: edEmail, phone: edPhone,
      city: edCity, capacity: edCapacity, joinDate: edJoin,
      subjects: edSubjects, programs: edPrograms,
    });
    setEdSaving(false);
    if (res.ok) { setEditTeacher(null); router.refresh(); }
    else setEdError(res.error ?? 'Failed to update the teacher.');
  };

  const handleDeleteTeacher = async (t: Teacher) => {
    if (!confirm(`Delete ${t.name}? This removes them from the teacher list. This action is logged.`)) return;
    const res = await softDeleteTeacher(t.id);
    if (!res.ok) { alert(res.error ?? 'Failed to delete the teacher.'); return; }
    router.refresh();
  };

  // "Left the academy" modal (5 common reasons + a custom one)
  const LEAVE_REASONS = ['Resigned', 'Contract ended', 'Relocated', 'Performance', 'Better opportunity'];
  const [leaveTeacher, setLeaveTeacher] = useState<Teacher | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveCustom, setLeaveCustom] = useState('');
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const openLeaveTeacher = (t: Teacher) => {
    setLeaveTeacher(t); setLeaveReason(''); setLeaveCustom(''); setLeaveError(null);
  };
  const handleMarkLeft = async () => {
    if (!leaveTeacher) return;
    const reason = leaveReason === 'Other' ? leaveCustom.trim() : leaveReason;
    if (!reason) { setLeaveError('Please choose a reason or enter a custom one.'); return; }
    setLeaveSaving(true);
    const res = await markTeacherLeft({ id: leaveTeacher.id, reason });
    setLeaveSaving(false);
    if (res.ok) { setLeaveTeacher(null); router.refresh(); }
    else setLeaveError(res.error ?? 'Failed to record. Make sure the leaving-reason columns were added.');
  };

  const toggleSelectAll = () => {
    if (selectedTeacherIds.length === filteredTeachers.length) {
      setSelectedTeacherIds([]);
    } else {
      setSelectedTeacherIds(filteredTeachers.map(t => t.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedTeacherIds.includes(id)) {
      setSelectedTeacherIds(selectedTeacherIds.filter(item => item !== id));
    } else {
      setSelectedTeacherIds([...selectedTeacherIds, id]);
    }
  };

  const getInitials = (name: string) => {
    return name
      .replace(/^(Sir|Miss|Dr|Mr|Mrs)\s+/i, '')
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* TOP PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Teachers Management</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Manage all {teachersList.length} academy teachers, workloads, and per-class pay rates.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative w-full sm:w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teachers, subjects, programs..."
                className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">⌘K</span>
            </div>

            {role === 'admin' && (
              <Button variant="primary" onClick={() => setShowAddTeacher(true)} className="shadow-[#5B47D6]/20">
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Teacher</span>
              </Button>
            )}
          </div>
        </div>

        {/* 5 KPI CARDS STRIP + AI INSIGHTS CARD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-[#EEEBFB] text-[#5B47D6] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <span className="font-heading font-extrabold text-[12.5px] text-[#3D4157] dark:text-slate-200">Total Teachers</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white leading-none">{teachersList.length}</div>
              <div className="text-xs font-bold text-emerald-600 mt-1">Active staff</div>
            </div>
            <span className="text-xs font-bold text-[#5B47D6] hover:underline inline-flex items-center gap-0.5">View all →</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <span className="font-heading font-extrabold text-[12.5px] text-[#3D4157] dark:text-slate-200">Active Teaching</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white leading-none">{teachersList.filter((t) => t.status === 'Teaching').length}</div>
              <div className="text-xs font-bold text-emerald-600 mt-1">of total</div>
            </div>
            <span className="text-xs font-bold text-emerald-600 hover:underline inline-flex items-center gap-0.5">View active →</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="font-heading font-extrabold text-[12.5px] text-[#3D4157] dark:text-slate-200">At Capacity</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-extrabold text-2xl text-amber-600 leading-none">{teachersList.filter((t) => t.capacity > 0 && t.currentLoad >= t.capacity).length}</div>
              <div className="text-xs font-bold text-amber-600 mt-1">at capacity</div>
            </div>
            <span className="text-xs font-bold text-amber-600 hover:underline inline-flex items-center gap-0.5">View details →</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="font-heading font-extrabold text-[12.5px] text-[#3D4157] dark:text-slate-200">Avg. Load Capacity</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white leading-none">{teachersList.length ? `${Math.round(teachersList.reduce((s, t) => s + (t.capacity ? (t.currentLoad / t.capacity) * 100 : 0), 0) / teachersList.length)}%` : '-'}</div>
              <div className="text-xs font-bold text-blue-600 mt-1">Avg load</div>
            </div>
            <span className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5">View report →</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="font-heading font-extrabold text-[12.5px] text-[#3D4157] dark:text-slate-200">Avg Per Class Pay</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white leading-none">{teachersList.length ? `PKR ${Math.round(teachersList.reduce((s, t) => s + t.perClassPay, 0) / teachersList.length).toLocaleString()}` : 'PKR 0'}</div>
              <div className="text-xs font-bold text-emerald-600 mt-1">Per class rate</div>
            </div>
            <span className="text-xs font-bold text-purple-600 hover:underline inline-flex items-center gap-0.5">View rates →</span>
          </div>

          <div className="bg-gradient-to-br from-[#1B1E38] to-[#2E285C] text-white rounded-[16px] p-3.5 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1 font-heading font-extrabold text-xs text-purple-200">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Staff Summary</span>
                </div>
              </div>
              <div className="space-y-0.5 text-xs text-purple-100 font-medium leading-tight">
                {teachersList.length === 0 ? (
                  <div>• No teachers on staff yet</div>
                ) : (
                  <>
                    <div>• {teachersList.filter((t) => t.status === 'Teaching').length} actively teaching</div>
                    <div>• {teachersList.filter((t) => t.capacity > 0 && t.currentLoad >= t.capacity).length} at full capacity</div>
                    <div>• {teachersList.filter((t) => t.status === 'Onboarding').length} onboarding</div>
                  </>
                )}
              </div>
            </div>
            <span className="text-xs font-bold text-purple-300 hover:text-white mt-1 inline-flex items-center gap-0.5">View insights →</span>
          </div>
        </div>

        {/* STATUS TABS & INTERACTIVE FILTER BAR */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-[#EBEDF3] dark:border-slate-800 pb-3">
            <div className="flex items-center gap-1 bg-[#F6F7FB] dark:bg-slate-800 p-1 rounded-xl flex-wrap">
              {[
                { name: 'All Teachers', count: teachersList.length },
                { name: 'Active', count: teachersList.filter(t => t.status === 'Teaching' || t.status === 'At Capacity').length },
                { name: 'On Leave', count: teachersList.filter(t => t.status === 'On Leave').length },
                { name: 'Left', count: teachersList.filter(t => t.status === 'Left').length },
              ].map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTabStatus(tab.name)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTabStatus === tab.name
                      ? 'bg-[#5B47D6] text-white shadow-sm'
                      : 'text-[#6B7185] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-xs ${activeTabStatus === tab.name ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-[#6B7185]'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={resetAllFilters}
                className="text-xs font-bold text-[#5B47D6] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            </div>
          </div>

          {/* FILTER ROW DROPDOWNS */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Subject Filter</span>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
              >
                <option value="All Subjects">All Subjects</option>
                {Array.from(new Set(teachersList.flatMap((t) => t.subjects).filter(Boolean))).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Program Filter</span>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
              >
                <option value="All Programs">All Programs</option>
                {Array.from(new Set(teachersList.flatMap((t) => t.programs).filter(Boolean))).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Load Capacity Filter</span>
              <select
                value={selectedLoadLevel}
                onChange={(e) => setSelectedLoadLevel(e.target.value)}
                className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
              >
                <option value="All Load Levels">All Load Levels</option>
                <option value="Available (<90%)">Available (&lt;90%)</option>
                <option value="Near Capacity (90-99%)">Near Capacity (90-99%)</option>
                <option value="At Capacity (100%)">At Capacity (100%)</option>
              </select>
            </div>

            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Per Class Pay Filter</span>
              <select
                value={selectedPayRange}
                onChange={(e) => setSelectedPayRange(e.target.value)}
                className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
              >
                <option value="All Pay Ranges">All Pay Ranges</option>
                <option value="< PKR 2,500">&lt; PKR 2,500 / class</option>
                <option value="PKR 2,500 - 3,500">PKR 2,500 - 3,500 / class</option>
                <option value="> PKR 3,500">&gt; PKR 3,500 / class</option>
              </select>
            </div>
          </div>
        </div>

        {/* MAIN TWO-COLUMN SPLIT: CLEAN 10 TEACHERS TABLE (LEFT 8 COLS) + PROFILE DRAWER (RIGHT 4 COLS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* CLEAN TEACHERS DATA TABLE (8 COLS) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                    <th className="py-3.5 px-3 w-[36px] text-center">
                      <input type="checkbox" checked={selectedTeacherIds.length === filteredTeachers.length && filteredTeachers.length > 0} onChange={toggleSelectAll} className="rounded accent-[#5B47D6]" />
                    </th>
                    <th className="py-3.5 px-3 font-extrabold">Teacher Name</th>
                    <th className="py-3.5 px-3 font-extrabold">Subjects & Programs</th>
                    <th className="py-3.5 px-3 font-extrabold">Joined Date</th>
                    <th className="py-3.5 px-3 font-extrabold">Load / Capacity</th>
                    {role === 'admin' && <th className="py-3.5 px-3 font-extrabold">Per Class Pay</th>}
                    <th className="py-3.5 px-3 font-extrabold">Status</th>
                    <th className="py-3.5 px-3 text-center font-extrabold">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px]">
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#6B7185]">
                        No teachers match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((t, idx) => {
                      const isSelected = selectedTeacherIds.includes(t.id);
                      const isCurrentDrawer = selectedDrawerTeacher?.id === t.id;
                      const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                      const loadPct = Math.round((t.currentLoad / t.capacity) * 100);

                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedDrawerTeacher(t)}
                          className={`transition-colors cursor-pointer ${
                            isCurrentDrawer
                              ? 'bg-purple-50/70 border-l-4 border-l-[#5B47D6]'
                              : isSelected
                              ? 'bg-purple-50/30'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelectRow(t.id)} className="rounded accent-[#5B47D6]" />
                          </td>

                          {/* CLEAN TEACHER NAME (NO CONTACT SUBTEXT) */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm ${avatarColor}`}>
                                {getInitials(t.name)}
                              </div>
                              <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{t.name}</div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{t.subjects.join(' · ')}</div>
                            <div className="text-xs text-[#6B7185] font-medium mt-0.5">{t.programs.join(' · ')}</div>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{t.joinDate}</div>
                            <div className="text-xs text-[#6B7185] font-medium mt-0.5">Emp ID: {t.empId}</div>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="space-y-1 w-24">
                              <div className="flex justify-between items-center text-xs font-mono">
                                <span className="font-extrabold text-slate-900 dark:text-slate-100">{t.currentLoad} / {t.capacity}</span>
                                <span className="text-[#6B7185] font-bold">{loadPct}%</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div style={{ width: `${loadPct}%` }} className={`h-full rounded-full ${loadPct >= 100 ? 'bg-rose-500' : loadPct >= 80 ? 'bg-emerald-500' : 'bg-emerald-400'}`} />
                              </div>
                              {loadPct >= 100 && (
                                <span className="text-xs font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 inline-block">
                                  At Capacity
                                </span>
                              )}
                            </div>
                          </td>

                          {/* PER CLASS PAY COLUMN */}
                          {role === 'admin' && (
                            <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                              <div className="font-extrabold text-slate-900 dark:text-slate-100 font-mono text-sm">PKR {t.perClassPay.toLocaleString()}</div>
                              <button
                                onClick={() => setPayRateTeacher(t)}
                                className="text-xs text-[#5B47D6] font-bold hover:underline cursor-pointer"
                              >
                                Set rate →
                              </button>
                            </td>
                          )}

                          <td className="py-3.5 px-3">
                            <Badge tone={t.status === 'Teaching' ? 'success' : t.status === 'At Capacity' ? 'danger' : 'brand'}>
                              {t.status}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <a href={`https://wa.me/${t.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp Teacher" className="w-7 h-7 rounded-lg bg-[#E7F9EE] text-[#12A150] flex items-center justify-center border border-[#BDE8CC]">
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                              <a href={`mailto:${t.email}`} title="Email Teacher" className="w-7 h-7 rounded-lg bg-[#E9F1FE] text-[#2E7BEE] flex items-center justify-center border border-[#CBE0FE]">
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                              <button onClick={() => setSelectedDrawerTeacher(t)} title="View Teacher Profile" className="h-7 px-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white font-bold text-[13px] rounded-lg transition-all cursor-pointer">
                                View
                              </button>

                              {role === 'admin' && (
                                <RowActionsMenu
                                  actions={[
                                    { label: 'View Profile', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setSelectedDrawerTeacher(t) },
                                    { label: 'Edit Teacher', icon: <Edit3 className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => openEditTeacher(t) },
                                    { label: 'Reset Password', icon: <KeyRound className="w-3.5 h-3.5" />, onClick: () => setResetTeacher(t) },
                                    { label: 'Left the Academy', icon: <Archive className="w-3.5 h-3.5" />, tone: 'warning', hidden: t.status === 'Left', onClick: () => openLeaveTeacher(t) },
                                    { label: 'Delete Teacher', icon: <Trash2 className="w-3.5 h-3.5" />, tone: 'danger', onClick: () => handleDeleteTeacher(t) },
                                  ]}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t flex justify-between items-center text-xs font-bold text-slate-600">
              <div>Showing {filteredTeachers.length} of {teachersList.length} teachers</div>
            </div>
          </div>

          {/* RICH TEACHER MAIN PROFILE DRAWER (RIGHT 4 COLS) WITH SCORE & RATING */}
          {selectedDrawerTeacher && (
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm space-y-5 animate-in fade-in">
              {/* DRAWER TOP HEADER */}
              <div className="flex justify-between items-start border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5B47D6] to-[#8B7BF0] text-white font-extrabold text-base flex items-center justify-center shrink-0 shadow-md">
                    {getInitials(selectedDrawerTeacher.name)}
                  </div>
                  <div>
                    <h2 className="font-heading font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{selectedDrawerTeacher.name}</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          selectedDrawerTeacher.status === 'Teaching'
                            ? 'bg-[#E7F6EC] text-[#12A150]'
                            : selectedDrawerTeacher.status === 'At Capacity'
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {selectedDrawerTeacher.status}
                      </span>
                    </h2>
                    <div className="text-xs text-[#6B7185] font-medium mt-0.5">
                      {selectedDrawerTeacher.subjects.join(' · ')}
                    </div>
                    <div className="text-xs text-[#5B47D6] font-bold">
                      {selectedDrawerTeacher.programs.join(' · ')}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedDrawerTeacher(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>

              {/* DRAWER QUICK CONTACT BUTTONS */}
              <div className="flex items-center gap-2 text-xs font-bold">
                <a href={`https://wa.me/${selectedDrawerTeacher.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-[#E7F9EE] text-[#12A150] rounded-xl flex items-center justify-center gap-1.5 border border-[#BDE8CC]">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a href={`tel:${selectedDrawerTeacher.phone}`} className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call</span>
                </a>
                <a href={`mailto:${selectedDrawerTeacher.email}`} className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>Email</span>
                </a>
              </div>

              {/* SCORE & RATING CARD MOVED INTO TEACHER PROFILE DRAWER */}
              <div className="bg-gradient-to-br from-purple-50 to-[#EEEBFB] border border-purple-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="font-extrabold text-xs text-[#5B47D6] uppercase tracking-wider">Teacher Performance Score & Rating</div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    {selectedDrawerTeacher.score === null ? (
                      <span className="font-extrabold text-slate-500 text-base">New Teacher (Building Record)</span>
                    ) : (
                      <div>
                        <div className="font-heading font-extrabold text-3xl text-slate-900">{selectedDrawerTeacher.score} <span className="text-xs font-normal text-slate-500">/ 100</span></div>
                        <div className="text-xs font-bold text-amber-500 flex items-center gap-1 mt-1">
                          <span>
                            {'★'.repeat(Math.max(0, Math.min(5, Math.round(selectedDrawerTeacher.rating))))}
                            {'☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(selectedDrawerTeacher.rating))))}
                          </span>
                          <span className="text-slate-800">{selectedDrawerTeacher.rating} ({selectedDrawerTeacher.ratingCount} reviews)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-[#6B7185] block font-medium">Per Class Rate</span>
                    <span className="font-extrabold text-base text-[#5B47D6] font-mono">PKR {selectedDrawerTeacher.perClassPay.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* TEACHER INFO DETAILS */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Employee ID</span><span className="font-extrabold text-slate-900">{selectedDrawerTeacher.empId}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Joining Date</span><span className="font-extrabold text-slate-900">{selectedDrawerTeacher.joinDate}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Experience</span><span className="font-extrabold text-slate-900">{selectedDrawerTeacher.experience}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Qualification</span><span className="font-extrabold text-slate-900">{selectedDrawerTeacher.qualification}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-[#6B7185]">Phone Number</span><span className="font-mono font-bold text-slate-900">{selectedDrawerTeacher.phone}</span></div>
                <div className="flex justify-between py-1"><span className="text-[#6B7185]">Email Address</span><span className="font-mono font-bold text-slate-900">{selectedDrawerTeacher.email}</span></div>
              </div>

              {/* TODAY'S SCHEDULE */}
              <div className="space-y-2.5 text-xs">
                <div className="font-extrabold text-slate-900 uppercase">Today's Class Schedule</div>
                {selectedDrawerTeacher.schedule.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl text-center text-[#6B7185]">No classes scheduled for today.</div>
                ) : (
                  selectedDrawerTeacher.schedule.map((item, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 border rounded-xl flex items-center justify-between font-bold">
                      <div>
                        <div className="font-mono text-xs text-slate-400">{item.time}</div>
                        <div className="text-slate-900 font-extrabold">{item.title}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${item.tag === 'Live' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {item.tag}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {showAddTeacher && (
        <AddTeacherModal isOpen={showAddTeacher} onClose={() => setShowAddTeacher(false)} />
      )}
      {resetTeacher && (
        <ResetPasswordControl id={resetTeacher.id} kind="teacher" autoOpen onClose={() => setResetTeacher(null)} />
      )}
      {payRateTeacher && (
        <SetPayRateModal
          isOpen={!!payRateTeacher}
          onClose={() => setPayRateTeacher(null)}
          teacherId={payRateTeacher.id}
          teacherName={payRateTeacher.name}
          currentRate={payRateTeacher.perClassPay}
        />
      )}

      {/* EDIT TEACHER MODAL */}
      {editTeacher && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 my-6 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-extrabold text-lg text-slate-900 dark:text-white">Edit Teacher</h3>
                <p className="text-xs text-[#6B7185] mt-0.5">{editTeacher.empId} · edit profile, teaching programs &amp; subjects.</p>
              </div>
              <button onClick={() => setEditTeacher(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                  <input value={edName} onChange={(e) => setEdName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                </div>
                <div>
                  <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                  <input type="email" value={edEmail} onChange={(e) => setEdEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                </div>
                <div>
                  <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Phone *</label>
                  <input value={edPhone} onChange={(e) => setEdPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                </div>
                <div>
                  <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">City</label>
                  <input value={edCity} onChange={(e) => setEdCity(e.target.value)} placeholder="Leave blank to keep unchanged" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                </div>
                <div>
                  <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Capacity *</label>
                  <input type="number" value={edCapacity} onChange={(e) => setEdCapacity(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6] font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Join Date <span className="text-slate-400 font-medium normal-case">(blank = keep)</span></label>
                  <input type="date" value={edJoin} onChange={(e) => setEdJoin(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]" />
                </div>
              </div>

              {/* Teaching Programs */}
              <div>
                <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-2">Teaching Programs</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PROGRAMS.map((prog) => {
                    const isSel = edPrograms.includes(prog);
                    return (
                      <button
                        type="button"
                        key={prog}
                        onClick={() => toggleEdProgram(prog)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          isSel
                            ? 'bg-[#5B47D6] text-white border-[#5B47D6] shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {prog}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Teaching Subjects */}
              <div>
                <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-2">Teaching Subjects</label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {ALL_SUBJECTS.map((subj) => {
                    const isSel = edSubjects.includes(subj);
                    return (
                      <button
                        type="button"
                        key={subj}
                        onClick={() => toggleEdSubject(subj)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          isSel
                            ? 'bg-[#5B47D6] text-white border-[#5B47D6] shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {subj}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Links are matched to subjects that exist for the selected programs.</p>
              </div>

              {edError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-2 rounded-xl">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{edError}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditTeacher(null)} className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
              <button onClick={handleUpdateTeacher} disabled={edSaving} className="px-5 py-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2">
                <Check className="w-4 h-4" /><span>{edSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER LEFT THE ACADEMY MODAL */}
      {leaveTeacher && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 my-6 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-extrabold text-lg text-slate-900 dark:text-white">Record teacher leaving</h3>
                <p className="text-xs text-[#6B7185] mt-0.5">{leaveTeacher.name} moves off the active roster. The reason is saved on their record.</p>
              </div>
              <button onClick={() => setLeaveTeacher(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="space-y-2">
              <label className="block font-bold text-xs text-slate-700 dark:text-slate-300">Reason</label>
              <div className="grid grid-cols-1 gap-1.5">
                {[...LEAVE_REASONS, 'Other'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setLeaveReason(r)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      leaveReason === r ? 'bg-[#5B47D6] text-white border-[#5B47D6]' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {r === 'Other' ? 'Other (write your own)' : r}
                  </button>
                ))}
              </div>
              {leaveReason === 'Other' && (
                <input
                  value={leaveCustom}
                  onChange={(e) => setLeaveCustom(e.target.value)}
                  placeholder="Type the reason..."
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
                />
              )}
              {leaveError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-2 rounded-xl">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{leaveError}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setLeaveTeacher(null)} className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
              <button onClick={handleMarkLeft} disabled={leaveSaving} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2">
                <Archive className="w-4 h-4" /><span>{leaveSaving ? 'Saving...' : 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
