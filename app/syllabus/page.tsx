'use client';

import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { ALL_PROGRAMS, ALL_SUBJECTS, MASTER_SYLLABI, getSyllabusTemplate } from '@/lib/syllabiSeed';
import { BookOpen, Layers, CheckCircle2, Clock, ShieldCheck, Filter } from 'lucide-react';

export default function SyllabusPage() {
  const [selectedProgram, setSelectedProgram] = useState<string>('A Level');
  const [selectedSubject, setSelectedSubject] = useState<string>('Physics');

  const template = getSyllabusTemplate(selectedSubject, selectedProgram);

  return (
    <PortalLayout
      title="Master Syllabus Engine (All 7 Programs & 17 Subjects)"
      subtitle="Official topic lists stored once per program + subject + academic year. Shared by all enrolled students without per-student copies or AI parsing."
      allowedRoles={['admin', 'manager', 'teacher', 'student']}
    >
      <div className="space-y-6">
        {/* Program & Subject Selector Bar */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs">
              <Filter className="w-4 h-4 text-[#5A31F4]" />
              <span>Syllabus Target:</span>
            </div>

            {/* Program Dropdown Selector */}
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            >
              {ALL_PROGRAMS.map((prog) => (
                <option key={prog} value={prog}>{prog}</option>
              ))}
            </select>

            {/* Subject Dropdown Selector */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            >
              {ALL_SUBJECTS.map((subj) => (
                <option key={subj} value={subj}>{subj}</option>
              ))}
            </select>
          </div>

          <div className="text-xs font-bold text-[#5A31F4] dark:text-purple-300 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 rounded-xl">
            Version: 2026 Academic Master
          </div>
        </div>

        {/* Master Template Banner */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5.5 h-5.5 text-[#5A31F4]" />
              <h3 className="font-heading text-xl font-bold text-slate-900 dark:text-slate-100">
                {template.program} — {template.subjectName} (Code: {template.cambridgeCode})
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Master Version: <span className="font-bold text-slate-800 dark:text-slate-200">{template.academicYear} Academic Year</span> · {template.topics.length} Official Topics
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold">
              Active Master Template
            </span>
          </div>
        </div>

        {/* Official Topic List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="font-heading font-bold text-slate-900 dark:text-slate-100 text-base border-b border-slate-100 dark:border-slate-800 pb-3">
            Official Topic Breakdown ({template.topics.length} Topics)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {template.topics.map((t) => (
              <div
                key={t.id}
                className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-[#5A31F4] dark:text-purple-300 font-heading font-bold flex items-center justify-center text-xs shrink-0">
                  {t.sort}
                </div>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {t.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
