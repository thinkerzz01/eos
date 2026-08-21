'use client';

import React from 'react';
import { Award, Target, FileSpreadsheet, AlertCircle } from 'lucide-react';

export interface GradeEntry {
  subjectName: string;
  internalAverage: string; // A / B / C
  assessedGrade: string | null; // Teacher assigned after test: A* / A / B / C / D / E / U or null/blank
  targetGrade: string; // Default A*, set by Admin
}

interface ResultSlipProps {
  studentName: string;
  program: string;
  examSession: string;
  grades: GradeEntry[];
}

export function ResultSlip({
  studentName,
  program,
  examSession,
  grades,
}: ResultSlipProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header Slip Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#5B47D6]" />
            <h3 className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100">
              CAIE Academic Result Slip
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Student: <span className="font-bold text-slate-900 dark:text-slate-200">{studentName}</span> · {program} ({examSession})
          </p>
        </div>

        <div className="px-3 py-1 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold text-[#5B47D6] dark:text-purple-300 self-start sm:self-auto">
          Cambridge Scale (A*-U)
        </div>
      </div>

      {/* Grade Table Breakdown */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-medium text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                  <span>Internal Test Avg</span>
                </div>
              </th>
              <th className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Award className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Cambridge Assessed Grade</span>
                </div>
              </th>
              <th className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Target className="w-3.5 h-3.5 text-[#5B47D6]" />
                  <span>Target Grade</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {grades.map((g, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                  {g.subjectName}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className="font-heading font-bold text-slate-700 dark:text-slate-300 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {g.internalAverage || '-'}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  {g.assessedGrade ? (
                    <span className="font-heading font-bold text-emerald-600 dark:text-emerald-400 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm">
                      {g.assessedGrade}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400 italic bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg">
                      Blank (Not yet tested)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className="font-heading font-bold text-[#5B47D6] dark:text-purple-300 px-3 py-1 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 rounded-lg text-sm">
                    {g.targetGrade || 'A*'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Policy Note Footer */}
      <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-700 dark:text-slate-300">Policy Note:</strong> Target Grade defaults to <span className="font-bold text-[#5B47D6]">A*</span> at enrollment. Assessed Grade is assigned by the subject teacher after each formal test cycle. The monthly parent report references only the assessed-grade trend (up / same / down), keeping raw scores separate.
        </p>
      </div>
    </div>
  );
}
