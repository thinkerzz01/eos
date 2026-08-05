'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { MonthlyReportData } from '@/lib/mockIntelligenceData';
import {
  Sparkles,
  FileText,
  TrendingUp,
  Award,
  CheckCircle2,
  Lock,
  Send,
  Eye,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';

export function ReportsClient({ initialReports }: { initialReports: MonthlyReportData[] }) {
  const { role } = useRole();
  const [reports, setReports] = useState<MonthlyReportData[]>(initialReports);
  const [selectedReport, setSelectedReport] = useState<MonthlyReportData | null>(initialReports[0] ?? null);
  const [isPhrasing, setIsPhrasing] = useState<boolean>(false);

  useEffect(() => {
    setReports(initialReports);
    setSelectedReport((prev) =>
      prev ? initialReports.find((r) => r.studentId === prev.studentId) ?? initialReports[0] ?? null : initialReports[0] ?? null
    );
  }, [initialReports]);

  const handleGenerateAiReportText = (rpt: MonthlyReportData) => {
    setIsPhrasing(true);
    setTimeout(() => {
      // LLM receives ONLY first name and facts (no surname, no phone, no raw test scores)
      const generatedText = `${rpt.firstName} completed ${rpt.topicsCovered.length} syllabus topics (${rpt.topicsCovered.join(', ')}) during ${rpt.month}. ${rpt.firstName} participated in ${rpt.testsConductedCount} assessments with an overall grade trend moving ${rpt.gradeTrend.toUpperCase()}, maintaining an assessed grade of ${rpt.assessedGrade}.`;
      
      const updated = reports.map((r) => {
        if (r.studentId === rpt.studentId) {
          return { ...r, phrasedReportText: generatedText };
        }
        return r;
      });

      setReports(updated);
      setSelectedReport({ ...rpt, phrasedReportText: generatedText });
      setIsPhrasing(false);
    }, 600);
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher', 'student']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Academy Intelligence & Monthly AI Reports</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Generate privacy-compliant monthly parent reports (first name & facts only, no raw test scores).
            </p>
          </div>

          <Link
            href="/email-queue"
            className="h-[38px] px-3.5 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-[#5B47D6]" />
            <span>Notification Queue & Cron →</span>
          </Link>
        </div>

        {/* PRIVACY & NUMBER INTEGRITY POLICY BANNER */}
        <div className="p-4 bg-gradient-to-r from-[#0B0E23] to-[#1D2145] text-white rounded-[20px] shadow-md space-y-2">
          <div className="flex items-center gap-2 font-heading font-extrabold text-xs text-purple-300 uppercase tracking-wider">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>AI Usage & Privacy Rules (AGENTS.md §3.6)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-purple-100 font-medium pt-1">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/15">
              <strong className="text-white block">1. First Name & Facts Only:</strong>
              No surname, no phone, no sensitive PII is ever sent to the LLM.
            </div>
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/15">
              <strong className="text-white block">2. No Raw Test Scores:</strong>
              Reports contain topics covered, test count, and grade trend (up/same/down) only.
            </div>
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/15">
              <strong className="text-white block">3. Code Assembles Numbers:</strong>
              LLM is strictly restricted to phrasing; it never invents or changes a number.
            </div>
          </div>
        </div>

        {/* REPORTS GENERATOR GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* STUDENT LIST (5 COLS) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm p-4 space-y-3">
            <div className="font-heading font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider border-b pb-2">
              Monthly Reports Queue (July 2026)
            </div>

            <div className="space-y-2">
              {reports.map((rpt) => (
                <div
                  key={rpt.studentId}
                  onClick={() => setSelectedReport(rpt)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedReport?.studentId === rpt.studentId
                      ? 'border-[#5B47D6] bg-purple-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">{rpt.firstName}</div>
                      <div className="text-xs text-[#6B7185] font-medium">{rpt.program} · {rpt.month}</div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-100 text-emerald-700">
                      Assessed: {rpt.assessedGrade}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 mt-2 border-t border-slate-100 font-bold">
                    <span className="text-slate-500">Trend: <strong className="text-emerald-600">{rpt.gradeTrend.toUpperCase()} 📈</strong></span>
                    <span className="text-purple-600">{rpt.testsConductedCount} Tests Conducted</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* REPORT PREVIEW & LLM PHRASING CARD (7 COLS) */}
          {selectedReport && (
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm p-6 space-y-5">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h3 className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                    Monthly Report Preview — {selectedReport.firstName}
                  </h3>
                  <p className="text-xs text-[#6B7185] font-medium">July 2026 Academic Summary</p>
                </div>
                <button
                  onClick={() => handleGenerateAiReportText(selectedReport)}
                  disabled={isPhrasing}
                  className="px-4 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>{isPhrasing ? 'Phrasing Report...' : 'Re-phrase with AI'}</span>
                </button>
              </div>

              {/* ASSEMBLED FACTS (PRESERVED MATH) */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[10.5px] font-bold text-slate-500 uppercase">Topics Covered</div>
                  <div className="font-heading font-extrabold text-xl text-slate-900 mt-1">{selectedReport.topicsCovered.length}</div>
                </div>

                <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200">
                  <div className="text-[10.5px] font-bold text-[#5B47D6] uppercase">Tests Conducted</div>
                  <div className="font-heading font-extrabold text-xl text-[#5B47D6] mt-1">{selectedReport.testsConductedCount}</div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <div className="text-[10.5px] font-bold text-emerald-700 uppercase">Grade Trend</div>
                  <div className="font-heading font-extrabold text-xl text-emerald-600 mt-1">{selectedReport.gradeTrend.toUpperCase()}</div>
                </div>
              </div>

              {/* TOPICS COVERED LIST */}
              <div className="space-y-1 text-xs">
                <div className="font-extrabold text-slate-900 uppercase">Topics Covered This Month</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedReport.topicsCovered.map((t, idx) => (
                    <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-800 font-bold rounded-xl border border-slate-200">
                      📖 {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* PHRASED REPORT OUTPUT */}
              <div className="space-y-2 pt-3 border-t">
                <div className="flex justify-between items-center font-extrabold text-xs text-slate-900 uppercase">
                  <span>Phrased Report Body</span>
                  <span className="text-[10.5px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    🟢 No Raw Scores Included
                  </span>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 leading-relaxed italic">
                  "{selectedReport.phrasedReportText}"
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button className="px-4 py-2 border rounded-xl font-bold text-xs">Print Report</button>
                <button className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-extrabold text-xs shadow-md">
                  Enqueue Notification Dispatch →
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </PortalLayout>
  );
}
