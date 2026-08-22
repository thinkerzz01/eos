'use client';

import React, { useState, useMemo } from 'react';
import { formatPKR } from '@/lib/format';
import { AdminDashboard } from './_components/AdminDashboard';
import type { AdminData } from '@/lib/data/adminDashboard';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { Student } from '@/lib/mockStudentsData';
import type { DashboardMetrics } from '@/lib/data/dashboard';
import type { TeacherDashboard } from '@/lib/data/teacherDashboard';
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

export function DashboardClient({
  initialStudents,
  metrics,
  teacherStats,
  adminData,
}: {
  initialStudents: Student[];
  metrics?: DashboardMetrics;
  teacherStats?: TeacherDashboard | null;
  adminData: AdminData;
}) {
  const { role } = useRole();
  const fmtPkr = (n: number) => formatPKR(n);

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

  // 1. STUDENT DYNAMIC PORTAL DASHBOARD VIEW - bound to the logged-in student's own
  //    record (RLS scopes getStudents to just their row for the student role).
  if (role === 'student') {
    const me = initialStudents[0];
    const studentTiles = me
      ? [
          { label: 'My Attendance Rate', value: `${Math.round(me.attendancePct)}%` },
          { label: 'Homework On-Time', value: `${Math.round(me.homeworkPct)}%` },
          { label: 'Health', value: me.healthBand },
          { label: 'Fee Voucher Status', value: me.feeStatus },
        ]
      : [
          { label: 'My Attendance Rate', value: '-' },
          { label: 'Homework On-Time', value: '-' },
          { label: 'Health', value: '-' },
          { label: 'Fee Voucher Status', value: '-' },
        ];
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['student']}>
        <div className="space-y-6 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-xs">
          <div className="bg-gradient-to-r from-[#5B47D6] via-[#7C6BF0] to-[#8B7BF0] text-white p-6 rounded-[24px] shadow-lg">
            <span className="px-3 py-1 bg-white/20 text-white font-medium text-xs rounded-full">🎓 Student Portal</span>
            <h1 className="font-heading font-medium text-2xl sm:text-3xl mt-2">{me ? `Welcome, ${me.name}` : 'Welcome to your portal'}</h1>
            <p className="text-xs text-purple-100 mt-1 font-medium">
              {me?.nextClassSubject
                ? `Next class: ${me.nextClassSubject}${me.nextClassTime ? ` at ${me.nextClassTime}` : ''}`
                : 'Your progress summary appears here once your enrolment is set up.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-medium">
            {studentTiles.map((k) => (
              <div key={k.label} className="bg-white border border-[#EBEDF3] rounded-[18px] p-4 shadow-sm space-y-1">
                <div className="text-xs text-slate-500 uppercase">{k.label}</div>
                <div className="font-heading font-medium text-3xl text-slate-900">{k.value}</div>
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
        <div className="space-y-6 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-xs font-medium">
          <div className="bg-gradient-to-r from-purple-900 to-[#1D1B48] text-white p-6 rounded-[24px] shadow-lg flex justify-between items-center">
            <div>
              <span className="px-3 py-1 bg-white/20 text-white font-medium text-xs rounded-full">👨‍🏫 Faculty Portal</span>
              <h1 className="font-heading font-medium text-2xl sm:text-3xl mt-2">Welcome to the Faculty Portal</h1>
              <p className="text-xs text-purple-200 mt-1 font-medium">
                {teacherStats?.nextClass
                  ? `Next class: ${teacherStats.nextClass.label} (${teacherStats.nextClass.time})`
                  : 'Your classes and reviews appear here once you are assigned students.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { label: 'Classes Today', value: String(teacherStats?.classesToday ?? 0) },
              { label: 'Classes This Week', value: String(teacherStats?.classesThisWeek ?? 0) },
              { label: 'My Students', value: String(teacherStats?.studentsCount ?? 0) },
              { label: 'Homework To Review', value: String(teacherStats?.pendingReviews ?? 0) },
            ].map((k) => (
              <div key={k.label} className="bg-white border rounded-2xl p-4 shadow-sm space-y-1">
                <div className="text-xs text-slate-500 uppercase">{k.label}</div>
                <div className="font-heading font-medium text-3xl text-slate-900">{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  // 3. MANAGER DASHBOARD (reuses the admin dashboard component; finance hidden)
  if (role === 'manager') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['manager']}>
        <AdminDashboard data={adminData} role="manager" />
      </PortalLayout>
    );
  }


  // 4. ADMIN DASHBOARD (new component; app sidebar via PortalLayout stays untouched)
  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
      <AdminDashboard data={adminData} />
    </PortalLayout>
  );
}
