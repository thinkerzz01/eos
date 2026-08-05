'use client';

import React, { useState } from 'react';
import { Drawer, DrawerTab } from '@/components/ui/Drawer';
import { ResultSlip, GradeEntry } from './ResultSlip';
import { CAIE_MASTER_SYLLABI } from '@/lib/syllabiSeed';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Award,
  FileText,
  BookOpen,
  Receipt,
  MessageCircle,
  Mail,
  UserCheck,
} from 'lucide-react';

interface StudentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    name: string;
    parent_name: string;
    phone: string;
    email?: string;
    program: string;
    exam_session: string;
    subjects: string[];
    att: number;
    hw: number;
    fee_status: 'paid' | 'due' | 'in_grace' | 'stopped';
    completed_classes: number;
    enrolled_at?: string;
    months_committed?: number;
    monthly_fee?: number;
    next_due_date?: string;
    city?: string;
  };
}

export function StudentDrawer({
  isOpen,
  onClose,
  student,
}: StudentDrawerProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs: DrawerTab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'syllabus', label: 'Syllabus Checklist' },
    { id: 'classes', label: 'Classes & Attendance' },
    { id: 'fees', label: 'Fees History' },
    { id: 'result_slip', label: 'Result Slip' },
  ];

  // Health Score Calculation per Formula: Health = 0.50 att + 0.30 hw + 0.20 fee
  const feeScore = (student.fee_status === 'paid' || student.fee_status === 'in_grace') ? 100 : 0;
  const isColdStart = student.completed_classes < 4;
  const healthScore = Math.round(student.att * 0.5 + student.hw * 0.3 + feeScore * 0.2);

  // Exam Countdown calculation
  const getExamCountdown = (sessionStr: string) => {
    const targetDate = new Date('2027-05-01');
    const now = new Date();
    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Session complete';
    return `${diffDays} days remaining`;
  };

  const dummyGrades: GradeEntry[] = student.subjects.map((subj) => ({
    subjectName: subj,
    internalAverage: student.att >= 90 ? 'A' : student.att >= 75 ? 'B' : 'C',
    assessedGrade: isColdStart ? null : student.att >= 90 ? 'A*' : student.att >= 80 ? 'A' : 'B',
    targetGrade: 'A*',
  }));

  const dummyClasses = [
    { date: '2026-08-03', time: '15:00 PKT', subject: 'Physics', teacher: 'Sir Kamran Ali', status: 'Present', topic: 'Kinematics & Motion' },
    { date: '2026-08-01', time: '15:00 PKT', subject: 'Physics', teacher: 'Sir Kamran Ali', status: 'Present', topic: 'Physical Quantities' },
    { date: '2026-07-29', time: '16:00 PKT', subject: 'Mathematics', teacher: 'Sir Kamran Ali', status: 'Late', topic: 'Quadratics & Functions' },
    { date: '2026-07-27', time: '15:00 PKT', subject: 'Physics', teacher: 'Sir Kamran Ali', status: 'Present', topic: 'Units & Measurement' },
  ];

  const dummyVouchers = [
    { id: 'TZ-0231', month: 'August 2026', due: student.next_due_date || '2026-08-15', amount: student.monthly_fee || 20000, status: student.fee_status },
    { id: 'TZ-0198', month: 'July 2026', due: '2026-07-15', amount: student.monthly_fee || 20000, status: 'paid' },
    { id: 'TZ-0164', month: 'June 2026', due: '2026-06-15', amount: student.monthly_fee || 20000, status: 'paid' },
  ];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={student.name}
      subtitle={`${student.program} · Parent: ${student.parent_name} · Phone: ${student.phone}`}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId)}
    >
      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6 text-sm">
          {/* Health & Exam Countdown Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Health Score Card */}
            <div className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <span className="font-bold uppercase tracking-wider text-xs text-slate-400">
                  Retention Health Score
                </span>
                {isColdStart ? (
                  <div className="font-heading text-lg font-bold text-amber-500 mt-1">
                    Not enough data
                  </div>
                ) : (
                  <div className="font-heading text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {healthScore} <span className="text-sm text-slate-400 font-normal">/ 100</span>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  0.50 Att ({student.att}%) + 0.30 HW ({student.hw}%) + 0.20 Fee
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#5A31F4]/10 text-[#5A31F4] flex items-center justify-center font-heading font-bold text-xl shrink-0">
                {isColdStart ? '?' : healthScore}
              </div>
            </div>

            {/* Exam Countdown Card */}
            <div className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <span className="font-bold uppercase tracking-wider text-xs text-slate-400">
                Exam Session Countdown
              </span>
              <div className="font-heading text-2xl font-bold text-[#5A31F4] dark:text-purple-300 mt-1">
                {getExamCountdown(student.exam_session)}
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Target Session: <span className="font-bold text-slate-700 dark:text-slate-300">{student.exam_session}</span>
              </p>
            </div>
          </div>

          {/* Student Detailed Properties List */}
          <div className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm">
            <h4 className="font-heading font-bold text-slate-900 dark:text-slate-100 text-base border-b border-slate-100 dark:border-slate-800 pb-3">
              Profile Data Specifications
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs font-medium">
              <div>
                <span className="text-slate-400 block font-bold uppercase tracking-wider">City</span>
                <span className="text-slate-800 dark:text-slate-200 text-sm font-semibold">{student.city || 'Karachi'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase tracking-wider">Enrollment Date</span>
                <span className="text-slate-800 dark:text-slate-200 text-sm font-semibold">{student.enrolled_at || '2026-03-15'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase tracking-wider">Months Committed</span>
                <span className="text-slate-800 dark:text-slate-200 text-sm font-semibold">{student.months_committed || 6} Months</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase tracking-wider">Monthly Fee</span>
                <span className="text-slate-800 dark:text-slate-200 text-sm font-mono font-bold">PKR {(student.monthly_fee || 20000).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Enrolled Subjects List */}
          <div className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm">
            <h4 className="font-heading font-bold text-slate-900 dark:text-slate-100 text-base">
              Enrolled CAIE Subjects
            </h4>
            <div className="space-y-2.5">
              {student.subjects.map((subj, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{subj}</span>
                  <span className="px-3 py-1 bg-purple-50 dark:bg-purple-950/60 text-[#5A31F4] border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold">
                    Template 2026 Linked
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Syllabus Progress Checklist */}
      {activeTab === 'syllabus' && (
        <div className="space-y-4 text-sm">
          <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <h4 className="font-heading font-bold text-slate-900 dark:text-slate-100 text-base mb-1">
              Physics (9702) Master Syllabus Progress
            </h4>
            <p className="text-slate-500 text-xs">
              Master syllabus version 2026 · Ticked by subject teacher
            </p>
            <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
              <div className="h-full bg-gradient-to-r from-[#5A31F4] to-[#7C55F7] rounded-full w-[45%]" />
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-500 mt-2">
              <span>45% Topics Covered</span>
              <span>11 / 25 Topics Completed</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {(CAIE_MASTER_SYLLABI['Physics']?.topics || []).slice(0, 8).map((topicName, idx) => (
              <div key={idx} className="p-3.5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-heading font-bold flex items-center justify-center text-xs">
                    {idx + 1}
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{topicName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${idx < 4 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-purple-50 text-[#5A31F4] border border-purple-200'}`}>
                    {idx < 4 ? 'Covered' : 'Plan'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Classes & Attendance */}
      {activeTab === 'classes' && (
        <div className="space-y-4 text-sm">
          <div className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm">
            <h4 className="font-heading font-bold text-slate-900 dark:text-slate-100 text-base border-b border-slate-100 dark:border-slate-800 pb-3">
              Attendance History ({student.att}% Overall)
            </h4>

            <div className="space-y-2.5">
              {dummyClasses.map((cl, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{cl.subject} — {cl.topic}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{cl.date} at {cl.time} · {cl.teacher}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold ${cl.status === 'Present' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                    {cl.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Fees History */}
      {activeTab === 'fees' && (
        <div className="space-y-4 text-sm">
          <div className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm">
            <h4 className="font-heading font-bold text-slate-900 dark:text-slate-100 text-base border-b border-slate-100 dark:border-slate-800 pb-3">
              Vouchers & Payments History
            </h4>

            <div className="space-y-2.5">
              {dummyVouchers.map((v, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{v.month} ({v.id})</div>
                    <div className="text-xs text-slate-400 mt-0.5">Due Date: {v.due} · Amount: PKR {v.amount.toLocaleString()}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase ${v.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                    {v.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Result Slip */}
      {activeTab === 'result_slip' && (
        <ResultSlip
          studentName={student.name}
          program={student.program}
          examSession={student.exam_session}
          grades={dummyGrades}
        />
      )}
    </Drawer>
  );
}
