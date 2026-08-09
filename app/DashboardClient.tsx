'use client';

import React, { useState, useMemo } from 'react';
import { FinanceOverview } from '@/components/dashboard/FinanceOverview';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { Student } from '@/lib/mockStudentsData';
import type { DashboardMetrics } from '@/lib/data/dashboard';
import {
  Calendar,
  AlertTriangle,
  UserPlus,
  UserCheck,
  Clock,
  FileText,
  Users,
  CheckCircle2,
  TrendingUp,
  Plus,
  Sparkles,
  BookOpen,
  MessageSquare,
  Award,
  Wallet,
  Receipt,
  SlidersHorizontal,
  RotateCcw,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

export function DashboardClient({ initialStudents, metrics }: { initialStudents: Student[]; metrics?: DashboardMetrics }) {
  const { role } = useRole();
  const fmtPkr = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

  // DASHBOARD REACTIVE FILTER STATES
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('All Time');
  const [selectedProgram, setSelectedProgram] = useState<string>('All Programs');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('All Teachers');
  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');

  // RESET FILTERS HANDLER
  const handleResetFilters = () => {
    setSelectedTimeRange('All Time');
    setSelectedProgram('All Programs');
    setSelectedTeacher('All Teachers');
    setSelectedSubject('All Subjects');
  };

  // Is a student's enrollment (admission) date within the selected time range?
  const inTimeRange = (dateStr: string): boolean => {
    if (selectedTimeRange === 'All Time') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    if (selectedTimeRange === 'Today') return d.toDateString() === now.toDateString();
    if (selectedTimeRange === 'This Week') {
      const wk = new Date(now);
      wk.setDate(now.getDate() - 7);
      return d >= wk;
    }
    if (selectedTimeRange === 'This Month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  };

  // DYNAMIC REACTIVE FILTERED STUDENTS
  const filteredStudents = useMemo(() => {
    return initialStudents.filter((s) => {
      // Time range (by enrollment/admission date)
      if (!inTimeRange(s.admissionDate)) return false;
      // Program Filter
      if (selectedProgram !== 'All Programs' && s.program !== selectedProgram) {
        return false;
      }
      // Teacher Filter
      if (selectedTeacher !== 'All Teachers') {
        const hasTeacher = s.enrolledSubjects.some((sub) => sub.teacherName === selectedTeacher);
        if (!hasTeacher) return false;
      }
      // Subject Filter
      if (selectedSubject !== 'All Subjects') {
        const hasSubject = s.enrolledSubjects.some((sub) => sub.subject === selectedSubject);
        if (!hasSubject) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram, selectedTeacher, selectedSubject, selectedTimeRange]);

  // REACTIVE STATS COMPUTED FROM FILTERED STUDENTS
  const stats = useMemo(() => {
    const active = filteredStudents.filter((s) => s.status === 'active');
    const atRisk = filteredStudents.filter((s) => s.healthBand === 'Red' && s.status === 'active');
    const feesDue = filteredStudents.filter((s) => s.feeStatus === 'Due' || s.feeStatus === 'In Grace');

    // Calculate Average Health Score from filtered students
    const totalHealth = filteredStudents.reduce((acc, s) => {
      const feeScore = (s.feeStatus === 'Paid' || s.feeStatus === 'In Grace') ? 100 : 0;
      return acc + (s.attendancePct * 0.5 + s.homeworkPct * 0.3 + feeScore * 0.2);
    }, 0);
    const avgHealthPct = filteredStudents.length > 0 ? Math.round(totalHealth / filteredStudents.length) : 0;

    const totalAttendance = filteredStudents.reduce((acc, s) => acc + s.attendancePct, 0);
    const avgAttendancePct = filteredStudents.length > 0 ? Math.round(totalAttendance / filteredStudents.length) : 0;

    return {
      totalCount: filteredStudents.length,
      activeCount: active.length,
      atRiskCount: atRisk.length,
      feesDueCount: feesDue.length,
      avgHealthPct,
      avgAttendancePct,
    };
  }, [filteredStudents]);

  // 1. STUDENT DYNAMIC PORTAL DASHBOARD VIEW
  if (role === 'student') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['student']}>
        <div className="space-y-6 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-xs">
          <div className="bg-gradient-to-r from-[#5B47D6] via-[#7C6BF0] to-[#8B7BF0] text-white p-6 rounded-[24px] shadow-lg">
            <span className="px-3 py-1 bg-white/20 text-white font-extrabold text-xs rounded-full">🎓 Student Portal</span>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl mt-2">Welcome to your portal</h1>
            <p className="text-xs text-purple-100 mt-1 font-medium">Your progress summary appears here once your enrolment is set up.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-bold">
            {[
              { label: 'My Attendance Rate', value: '—' },
              { label: 'Target vs Assessed', value: '—' },
              { label: 'Pending Homework', value: '0' },
              { label: 'Fee Voucher Status', value: '—' },
            ].map((k) => (
              <div key={k.label} className="bg-white border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
                <div className="text-xs text-slate-500 uppercase">{k.label}</div>
                <div className="font-heading font-extrabold text-3xl text-slate-900">{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  // 2. TEACHER DYNAMIC PORTAL DASHBOARD VIEW
  if (role === 'teacher') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['teacher']}>
        <div className="space-y-6 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-xs font-bold">
          <div className="bg-gradient-to-r from-purple-900 to-[#1D1B48] text-white p-6 rounded-[24px] shadow-lg flex justify-between items-center">
            <div>
              <span className="px-3 py-1 bg-white/20 text-white font-extrabold text-xs rounded-full">👨‍🏫 Faculty Portal</span>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl mt-2">Welcome to the Faculty Portal</h1>
              <p className="text-xs text-purple-200 mt-1 font-medium">Your classes and reviews appear here once you are assigned students.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { label: 'Classes Today', value: '0' },
              { label: 'Pending Homework Reviews', value: '0' },
              { label: 'Load Capacity', value: '—' },
              { label: 'Monthly Payout Status', value: '—' },
            ].map((k) => (
              <div key={k.label} className="bg-white border rounded-2xl p-4 shadow-sm space-y-1">
                <div className="text-xs text-slate-500 uppercase">{k.label}</div>
                <div className="font-heading font-extrabold text-3xl text-slate-900">{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  // 3. MANAGER OPERATIONAL DASHBOARD VIEW
  if (role === 'manager') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['manager']}>
        <div className="space-y-6 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-xs font-bold">
          <div className="bg-gradient-to-r from-[#171A2B] to-[#3D4157] text-white p-6 rounded-[24px] shadow-lg flex justify-between items-center">
            <div>
              <span className="px-3 py-1 bg-white/20 text-white font-extrabold text-xs rounded-full">💼 Operations Portal</span>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl mt-2">Operational Command Center</h1>
              <p className="text-xs text-slate-300 mt-1 font-medium">Students, Admissions, Schedule & Support Tickets</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-xs text-slate-500 uppercase">Active Students</div>
              <div className="font-heading font-extrabold text-3xl text-slate-900">{stats.activeCount}</div>
            </div>
            <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-xs text-slate-500 uppercase">New Leads Today</div>
              <div className="font-heading font-extrabold text-3xl text-purple-600">0</div>
            </div>
            <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-xs text-slate-500 uppercase">Demos Needing Teacher</div>
              <div className="font-heading font-extrabold text-3xl text-orange-600">0</div>
            </div>
            <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-xs text-slate-500 uppercase">Urgent Tickets</div>
              <div className="font-heading font-extrabold text-3xl text-rose-600">0</div>
            </div>
          </div>
        </div>
      </PortalLayout>
    );
  }

  // 4. FULL EXECUTIVE DASHBOARD VIEW (ADMIN ROLE — MATCHING SCREENSHOT 100%)
  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-xs">

        {/* 1. REACTIVE FILTER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm font-bold">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-[#5B47D6] mr-1">
              <Filter className="w-4 h-4" />
              <span className="uppercase text-xs font-extrabold tracking-wider">Dashboard Filters:</span>
            </div>

            {/* Time Range Filter */}
            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-3 py-2 flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <Calendar className="w-3.5 h-3.5 text-[#5B47D6]" />
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer font-bold text-xs"
              >
                <option value="All Time">All Time</option>
                <option value="Today">Enrolled Today</option>
                <option value="This Week">Enrolled This Week</option>
                <option value="This Month">Enrolled This Month</option>
              </select>
            </div>

            {/* Program Filter */}
            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200">
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer font-bold text-xs"
              >
                <option value="All Programs">All Programs</option>
                {Array.from(new Set(initialStudents.map((s) => s.program).filter(Boolean))).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Teacher Filter */}
            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200">
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer font-bold text-xs"
              >
                <option value="All Teachers">All Teachers</option>
                {Array.from(new Set(initialStudents.flatMap((s) => s.enrolledSubjects.map((es) => es.teacherName)).filter(Boolean))).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Subject Filter */}
            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer font-bold text-xs"
              >
                <option value="All Subjects">All Subjects</option>
                {Array.from(new Set(initialStudents.flatMap((s) => s.enrolledSubjects.map((es) => es.subject)).filter(Boolean))).map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Reset Filters Button */}
            {(selectedProgram !== 'All Programs' || selectedTeacher !== 'All Teachers' || selectedSubject !== 'All Subjects') && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ({stats.totalCount} Students)</span>
              </button>
            )}
          </div>

          <div className="text-xs text-[#6B7185] font-bold">
            Showing <span className="text-[#5B47D6] font-extrabold">{stats.totalCount}</span> filtered students
          </div>
        </div>

        {/* 2. TOP 3 MAIN PANELS ROW (ACTION CENTER, ACADEMY HEALTH, KPI METRICS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 font-bold">
          
          {/* ACTION CENTER CARD (5 COLS) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm space-y-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">ACTION CENTER</span>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-extrabold rounded-full">Critical First</span>
              </div>
              <Link href="/students" className="text-xs font-bold text-[#5B47D6] hover:underline">View all &gt;</Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Link href="/vouchers" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-1 block hover:bg-rose-100 transition-colors">
                <div className="flex items-center gap-1.5 text-rose-600 font-heading font-extrabold text-xl">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{stats.feesDueCount}</span>
                </div>
                <div className="font-extrabold text-xs text-slate-900 leading-tight">Fees overdue</div>
                <div className="text-xs font-bold text-rose-600">Action required</div>
              </Link>

              <Link href="/students" className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-1 block hover:bg-amber-100 transition-colors">
                <div className="flex items-center gap-1.5 text-amber-600 font-heading font-extrabold text-xl">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{stats.atRiskCount}</span>
                </div>
                <div className="font-extrabold text-xs text-slate-900 leading-tight">Students at risk</div>
                <div className="text-xs font-bold text-amber-700">{stats.atRiskCount} critical</div>
              </Link>

              <Link href="/demos" className="p-3 bg-orange-50 border border-orange-200 rounded-2xl space-y-1 block hover:bg-orange-100 transition-colors">
                <div className="flex items-center gap-1.5 text-orange-600 font-heading font-extrabold text-xl">
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>{metrics?.demosNeedingTeacher ?? 0}</span>
                </div>
                <div className="font-extrabold text-xs text-slate-900 leading-tight">Demos need teacher</div>
                <div className="text-xs font-bold text-orange-700">Assign now</div>
              </Link>

              <Link href="/tickets" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-1 block hover:bg-rose-100 transition-colors">
                <div className="flex items-center gap-1.5 text-rose-600 font-heading font-extrabold text-xl">
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>{metrics?.urgentTickets ?? 0}</span>
                </div>
                <div className="font-extrabold text-xs text-slate-900 leading-tight">Tickets urgent</div>
                <div className="text-xs font-bold text-rose-600">Response needed</div>
              </Link>
            </div>
          </div>

          {/* ACADEMY HEALTH CARD (3 COLS) */}
          <div className="lg:col-span-3 bg-gradient-to-br from-[#0B0E23] to-[#1D2145] text-white rounded-[18px] p-5 shadow-md flex flex-col justify-between space-y-4">
            <div>
              <div className="font-heading font-extrabold text-xs text-purple-200 uppercase tracking-wider mb-2">ACADEMY HEALTH</div>
              <div className="flex items-center gap-4">
                <div className="font-heading font-extrabold text-5xl leading-none text-white">{stats.avgHealthPct}%</div>
                <div className="space-y-1">
                  <span className="px-3 py-1 bg-white/15 text-white font-extrabold text-xs rounded-full inline-block">Live</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs font-bold pt-3 border-t border-white/10">
              <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Attendance</span><span className="text-emerald-300">{stats.avgAttendancePct}%</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Fee Collection</span><span className="text-amber-300">{metrics ? `${metrics.feeCollectionPct}%` : '—'}</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400" /> Student Health</span><span className="text-purple-300">{stats.avgHealthPct}%</span></div>
            </div>

            <Link href="/students" className="text-xs font-bold text-purple-300 hover:text-white inline-flex items-center gap-1 pt-1">
              <span>View health breakdown →</span>
            </Link>
          </div>

          {/* KPI METRICS GRID (4 COLS) */}
          <div className="lg:col-span-4 space-y-3 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="text-xs font-bold text-[#6B7185]">Active Students</div>
                <div className="font-heading font-extrabold text-3xl text-slate-900 dark:text-white mt-1">{stats.activeCount}</div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="text-xs font-bold text-[#6B7185]">Active Teachers</div>
                <div className="font-heading font-extrabold text-3xl text-slate-900 dark:text-white mt-1">{metrics?.activeTeachers ?? 0}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-1">
                <div className="text-xs text-[#6B7185]">Classes Today</div>
                <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">{metrics?.classesToday ?? 0}</div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-1">
                <div className="text-xs text-[#6B7185]">Revenue (This Month)</div>
                <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">{fmtPkr(metrics?.revenueThisMonth ?? 0)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. MIDDLE 3-PANEL ROW (TODAY'S SCHEDULE, TEACHER CAPACITY, FINANCIAL SNAPSHOT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 font-bold">
          
          {/* TODAY'S SCHEDULE CARD (4 COLS) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">TODAY'S SCHEDULE</h3>
                <p className="text-xs text-[#6B7185] font-medium mt-0.5">Today</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              {(metrics?.todaysClasses ?? []).length === 0 ? (
                <div className="text-center text-[#6B7185] py-8 text-xs font-medium">No classes scheduled.</div>
              ) : (
                (metrics?.todaysClasses ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 dark:text-slate-100 truncate">{c.subject || 'Class'}</div>
                      <div className="text-[#6B7185] truncate">{c.student}</div>
                    </div>
                    <span className="font-mono font-bold text-[#5B47D6] shrink-0">{c.time}</span>
                  </div>
                ))
              )}
            </div>

            <Link href="/schedule" className="text-xs font-bold text-[#5B47D6] hover:underline block text-center border-t pt-3">
              View full calendar →
            </Link>
          </div>

          {/* TEACHER CAPACITY CARD (4 COLS) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">TEACHER CAPACITY</h3>
                <p className="text-xs text-[#6B7185] font-medium mt-0.5">Who can take another class?</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {(metrics?.teacherCapacity ?? []).length === 0 ? (
                <div className="text-center text-[#6B7185] py-8 text-xs font-medium">No teachers added yet.</div>
              ) : (
                (metrics?.teacherCapacity ?? []).map((t) => {
                  const pct = t.capacity > 0 ? Math.min(100, Math.round((t.load / t.capacity) * 100)) : 0;
                  return (
                    <div key={t.id} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate">{t.name}</span>
                        <span className="text-[#6B7185] font-bold shrink-0">{t.load}/{t.capacity}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div style={{ width: `${pct}%` }} className={`h-full rounded-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Link href="/teachers" className="text-xs font-bold text-[#5B47D6] hover:underline block text-center border-t pt-3">
              Manage teachers →
            </Link>
          </div>

          {/* FINANCIAL SNAPSHOT CARD (4 COLS) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">FINANCIAL SNAPSHOT</h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                <div className="text-xs font-bold text-emerald-800">Collected</div>
                <div className="font-extrabold text-sm text-emerald-600">{fmtPkr(metrics?.collected ?? 0)}</div>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
                <div className="text-xs font-bold text-rose-800">Outstanding</div>
                <div className="font-extrabold text-sm text-rose-600">{fmtPkr(metrics?.outstanding ?? 0)}</div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                <div className="text-xs font-bold text-amber-800">Pending Verify</div>
                <div className="font-extrabold text-sm text-amber-600">PKR 0</div>
              </div>
            </div>

            <div className="space-y-2 text-xs font-bold pt-2">
              <div className="flex justify-between py-1 border-b"><span>Refunds</span><span className="text-purple-600">{fmtPkr(metrics?.refunds ?? 0)}</span></div>
              <div className="flex justify-between py-1 border-b"><span>Forecast (30 Days)</span><span className="text-blue-600">{fmtPkr(metrics?.forecast30 ?? 0)}</span></div>
              <div className="flex justify-between py-1 items-center">
                <span>Collection Rate</span>
                <span className="text-emerald-600 flex items-center gap-1 font-extrabold">{metrics ? `${metrics.feeCollectionPct}%` : '0%'}</span>
              </div>
            </div>

            <Link href="/vouchers" className="text-xs font-bold text-[#5B47D6] hover:underline block text-center border-t pt-3">
              View fee vouchers →
            </Link>
          </div>

        </div>

        {/* FINANCE VISUAL OVERVIEW (charts) */}
        {metrics && (
          <FinanceOverview
            collected={metrics.collected}
            outstanding={metrics.outstanding}
            forecast30={metrics.forecast30}
            paidToTeachers={metrics.paidToTeachers}
            refunds={metrics.refunds}
            feeCollectionPct={metrics.feeCollectionPct}
          />
        )}

        {/* 4. BOTTOM ROW (AI INSIGHTS, RECENT SYSTEM ACTIVITY, SECURITY STATUS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 font-bold">
          
          {/* AI INSIGHTS CARD (5 COLS) */}
          <div className="lg:col-span-5 bg-gradient-to-r from-purple-900 to-indigo-950 text-white rounded-[18px] p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-purple-200 font-extrabold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span>AI Academy Insights</span>
            </div>
            <div className="space-y-2 text-xs font-medium">
              <div className="p-3 bg-white/10 rounded-xl text-slate-200 text-xs">Insights will appear here once there is enough activity to analyze.</div>
            </div>
          </div>

          {/* RECENT ACTIVITY LOG (7 COLS) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#5B47D6]" />
                <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">RECENT SYSTEM ACTIVITY</h3>
              </div>
              <Link href="/audit-log" className="text-xs font-bold text-[#5B47D6] hover:underline">Full audit log →</Link>
            </div>

            <div className="space-y-2.5 text-xs font-medium">
              <div className="text-center text-[#6B7185] py-6 text-xs">No recent activity.</div>
            </div>
          </div>

        </div>

      </div>
    </PortalLayout>
  );
}
