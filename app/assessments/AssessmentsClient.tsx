'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { AssessmentRecord } from '@/lib/mockAcademicsData';
import type { SubjectOption } from '@/lib/data/subjects';
import { recordTest, updateTest, deleteTest } from './actions';
import {
  Award,
  Plus,
  Search,
  CheckCircle2,
  FileText,
  X,
  Printer,
  Sparkles,
  TrendingUp,
  Edit3,
  Trash2,
  Check,
} from 'lucide-react';

// CAIE-style grade band from a percentage (used for the result-slip average).
function gradeFromPct(p: number): string {
  return p >= 90 ? 'A*' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : p >= 40 ? 'E' : 'U';
}

export function AssessmentsClient({
  initialAssessments,
  students,
  subjects,
}: {
  initialAssessments: AssessmentRecord[];
  students: { id: string; name: string }[];
  subjects: SubjectOption[];
}) {
  const { role } = useRole();
  const router = useRouter();
  const [assessments, setAssessments] = useState<AssessmentRecord[]>(initialAssessments);
  const [selectedAssessmentForSlip, setSelectedAssessmentForSlip] = useState<AssessmentRecord | null>(initialAssessments[0] ?? null);
  const [showResultSlipModal, setShowResultSlipModal] = useState<boolean>(false);

  useEffect(() => { setAssessments(initialAssessments); }, [initialAssessments]);

  // EDIT / DELETE a single recorded score (from the result slip)
  const canManageTests = role !== 'student';
  const [editTestId, setEditTestId] = useState<string | null>(null);
  const [egScore, setEgScore] = useState('');
  const [egBusy, setEgBusy] = useState(false);
  const startEditGrade = (testId: string, score: number) => { setEditTestId(testId); setEgScore(String(score)); };
  const saveEditGrade = async (max?: number) => {
    if (!editTestId) return;
    setEgBusy(true);
    const res = await updateTest({ testId: editTestId, score: Number(egScore), maxScore: max });
    setEgBusy(false);
    if (res.ok) { setEditTestId(null); setShowResultSlipModal(false); router.refresh(); }
    else alert(res.error ?? 'Failed to update the score.');
  };
  const deleteGrade = async (testId: string, studentName: string) => {
    if (!confirm(`Delete ${studentName}'s score for this test? This cannot be undone.`)) return;
    const res = await deleteTest(testId);
    if (res.ok) { setShowResultSlipModal(false); router.refresh(); }
    else alert(res.error ?? 'Failed to delete the score.');
  };

  // RECORD TEST MODAL
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [tStudent, setTStudent] = useState('');
  const [tSubject, setTSubject] = useState('');
  const [tName, setTName] = useState('');
  const [tDate, setTDate] = useState('');
  const [tScore, setTScore] = useState('');
  const [tMax, setTMax] = useState('100');
  const [recording, setRecording] = useState(false);

  const handleRecordTest = async () => {
    if (!tName || !tStudent || !tSubject || !tDate || !tScore) {
      alert('Test name, student, subject, date, and score are required.');
      return;
    }
    setRecording(true);
    const res = await recordTest({
      studentId: tStudent, subjectId: tSubject, name: tName, date: tDate,
      score: Number(tScore), maxScore: Number(tMax) || 100,
    });
    setRecording(false);
    if (res.ok) {
      setShowRecordModal(false);
      setTStudent(''); setTSubject(''); setTName(''); setTDate(''); setTScore(''); setTMax('100');
      router.refresh();
    } else {
      alert(res.error ?? 'Failed to record test.');
    }
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher', 'student']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Assessments</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Grade monthly tests on the Cambridge/CAIE scale (A*, A, B, C, D, E, U) & generate official Result Slips.
            </p>
          </div>
          {role !== 'student' && (
            <button
              onClick={() => setShowRecordModal(true)}
              className="h-[38px] px-4 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Record Test</span>
            </button>
          )}
        </div>

        {/* ASSESSMENTS DATA TABLE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#EBEDF3] font-heading font-medium text-sm text-slate-900 dark:text-white">
              Recent Conducted Assessments
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                    <th className="py-3.5 px-3">Test Title & Code</th>
                    <th className="py-3.5 px-3">Subject & Date</th>
                    <th className="py-3.5 px-3">Total Marks</th>
                    <th className="py-3.5 px-3 text-center">Result Slip</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                  {assessments.map((ast) => (
                    <tr key={ast.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{ast.testTitle}</div>
                        <div className="text-xs text-[#6B7185] font-mono">{ast.testCode}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{ast.subject}</div>
                        <div className="text-xs text-[#6B7185]">{ast.dateConducted}</div>
                      </td>

                      <td className="py-3.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                        {ast.totalMarks} Marks
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedAssessmentForSlip(ast);
                            setShowResultSlipModal(true);
                          }}
                          className="px-3 py-1.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          Generate Result Slip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CAIE GRADE SCALE POLICY CARD */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-gradient-to-br from-[#0B0E23] to-[#1D2145] text-white rounded-[20px] p-5 shadow-lg space-y-3">
              <div className="flex items-center gap-2 font-heading font-medium text-xs text-purple-300 uppercase tracking-wider">
                <Award className="w-4 h-4 text-purple-400" />
                <span>Cambridge / CAIE Locked Grade Scale</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs font-medium pt-1">
                <span className="px-3 py-1 bg-emerald-500 text-white rounded-lg">A* (90-100%)</span>
                <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg">A (80-89%)</span>
                <span className="px-3 py-1 bg-blue-600 text-white rounded-lg">B (70-79%)</span>
                <span className="px-3 py-1 bg-purple-600 text-white rounded-lg">C (60-69%)</span>
                <span className="px-3 py-1 bg-amber-600 text-white rounded-lg">D (50-59%)</span>
                <span className="px-3 py-1 bg-orange-600 text-white rounded-lg">E (40-49%)</span>
                <span className="px-3 py-1 bg-rose-600 text-white rounded-lg">U (&lt;40%)</span>
              </div>
              <p className="text-xs text-purple-200 leading-relaxed pt-2 border-t border-white/10">
                Per Master Plan §4: Result Slips show 3 separately labelled items: <strong>Internal Average</strong>, <strong>Assessed Grade</strong>, and <strong>Target Grade (Defaults to A*)</strong>.
              </p>
            </div>
          </div>

        </div>

        {/* OFFICIAL RESULT SLIP MODAL */}
        {showResultSlipModal && selectedAssessmentForSlip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5">
              
              {/* RESULT SLIP HEADER */}
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <div className="font-heading font-medium text-xl text-slate-900 dark:text-white">THINKERZZ</div>
                  <div className="text-xs text-[#5B47D6] font-medium">OFFICIAL CAIE RESULT SLIP</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">{selectedAssessmentForSlip.testTitle} ({selectedAssessmentForSlip.dateConducted})</div>
                </div>
                <button onClick={() => setShowResultSlipModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>

              {/* 3 SEPARATELY LABELLED ITEMS REQUIRED BY AGENTS.MD §4 -
                  computed from the real grades on this assessment. */}
              {(() => {
                const total = selectedAssessmentForSlip.totalMarks || 100;
                const pcts = selectedAssessmentForSlip.grades.map((g) => (g.marksObtained / total) * 100);
                const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
                const assessed = pcts.length ? gradeFromPct(avg) : '-';
                return (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div className="text-xs font-medium text-slate-500 uppercase">Internal Average</div>
                      <div className="font-heading font-medium text-xl text-slate-900 mt-1">{avg.toFixed(1)}%</div>
                    </div>

                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl">
                      <div className="text-xs font-medium text-[#5B47D6] uppercase">Assessed Grade</div>
                      <div className="font-heading font-medium text-2xl text-[#5B47D6] mt-1">{assessed}</div>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <div className="text-xs font-medium text-emerald-700 uppercase">Target Grade</div>
                      <div className="font-heading font-medium text-2xl text-emerald-600 mt-1">-</div>
                    </div>
                  </div>
                );
              })()}

              {/* STUDENT SCORES TABLE */}
              <div className="border rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-medium">
                    <tr>
                      <th className="p-2.5">Student Name</th>
                      <th className="p-2.5">Marks Obtained</th>
                      <th className="p-2.5">Assessed Grade</th>
                      {canManageTests && <th className="p-2.5 text-center print:hidden">Edit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium">
                    {selectedAssessmentForSlip.grades.map((g) => (
                      <tr key={g.testId ?? g.studentId}>
                        <td className="p-2.5 text-slate-900">{g.studentName}</td>
                        <td className="p-2.5 font-mono text-slate-900">
                          {editTestId && editTestId === g.testId ? (
                            <span className="flex items-center gap-1">
                              <input
                                type="number"
                                value={egScore}
                                onChange={(e) => setEgScore(e.target.value)}
                                className="w-16 bg-white border border-slate-300 rounded-lg px-1.5 py-1 text-slate-900"
                              />
                              <span className="text-slate-400">/ {g.maxScore ?? selectedAssessmentForSlip.totalMarks}</span>
                            </span>
                          ) : (
                            <>{g.marksObtained} / {g.maxScore ?? selectedAssessmentForSlip.totalMarks}</>
                          )}
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 bg-purple-100 text-[#5B47D6] font-medium rounded-md">
                            {g.assessedGrade}
                          </span>
                        </td>
                        {canManageTests && (
                          <td className="p-2.5 print:hidden">
                            {editTestId && editTestId === g.testId ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => saveEditGrade(g.maxScore)} disabled={egBusy} title="Save" className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setEditTestId(null)} title="Cancel" className="w-6 h-6 rounded-lg border border-slate-200 text-slate-500 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => g.testId && startEditGrade(g.testId, g.marksObtained)} disabled={!g.testId} title="Edit score" className="w-6 h-6 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center disabled:opacity-40"><Edit3 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => g.testId && deleteGrade(g.testId, g.studentName)} disabled={!g.testId} title="Delete score" className="w-6 h-6 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-xs text-slate-400 font-medium">Issued by Thinkerzz Examination Board</span>
                <button onClick={() => window.print()} className="px-4 py-2 bg-slate-900 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 cursor-pointer">
                  <Printer className="w-4 h-4" />
                  <span>Print Result Slip</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* RECORD TEST MODAL */}
        {showRecordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Record Test</h3>
                <button onClick={() => setShowRecordModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs font-medium">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Test Name</label>
                  <input type="text" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="e.g. Unit Test 3" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Student</label>
                  <select value={tStudent} onChange={(e) => setTStudent(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                    <option value="">Select a student...</option>
                    {students.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Subject</label>
                  <select value={tSubject} onChange={(e) => setTSubject(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                    <option value="">Select...</option>
                    {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.program})</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Date</label>
                    <input type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Score</label>
                    <input type="number" value={tScore} onChange={(e) => setTScore(e.target.value)} placeholder="e.g. 85" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 font-mono text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Out of</label>
                    <input type="number" value={tMax} onChange={(e) => setTMax(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 font-mono text-slate-900 dark:text-slate-100" />
                  </div>
                </div>
                {(students.length === 0 || subjects.length === 0) && (
                  <p className="text-xs text-amber-600 font-medium">Add students and subjects first (run supabase/seed_subjects.sql).</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setShowRecordModal(false)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
                <button onClick={handleRecordTest} disabled={recording} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">{recording ? 'Saving...' : 'Record Test'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
