'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { AssessmentRecord } from '@/lib/mockAcademicsData';
import type { SubjectOption } from '@/lib/data/subjects';
import { labelWithCode } from '@/lib/syllabiSeed';
import { Logo } from '@/components/ui/Logo';
import { recordTest, updateTest, deleteTest } from './actions';
import { listStudentEnrollments } from '@/app/schedule/actions';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  Award,
  Plus,
  Search,
  CheckCircle2,
  FileText,
  X,
  Printer,
  TrendingUp,
  Edit3,
  Trash2,
  Check,
  Trophy,
  Sprout,
  Target,
  BookOpen,
  Compass,
  GraduationCap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// CAIE-style grade band from a percentage (used for the result-slip average).
function gradeFromPct(p: number): string {
  return p >= 90 ? 'A*' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : p >= 40 ? 'E' : 'U';
}

// One data-driven grade-state system. Each assessed grade renders the same
// Thinkerzz result-slip component with its own encouraging copy, icon and
// restrained accent colour. Boundaries stay in the backend (gradeFromPct) - they
// are never shown to the student.
interface GradeState {
  headline: string;   // performance headline in the grade area (Title Case)
  praise: string;     // personalised message title, e.g. "Excellent Work"
  message: string;    // supportive explanation
  Icon: LucideIcon;
  accent: string;     // grade character + accent line
  iconColor: string;  // icon tint (gold touch for A*)
  panelBg: string;    // soft hero panel fill
  iconBg: string;     // icon chip fill
  border: string;     // panel border
}
const GRADE_STATES: Record<string, GradeState> = {
  'A*': { headline: 'Outstanding Performance', praise: 'Excellent Work', message: 'You have demonstrated exceptional understanding of the subject. Keep challenging yourself and aim even higher.', Icon: Trophy, accent: '#5A31F4', iconColor: '#E0A62B', panelBg: '#F5F2FE', iconBg: '#EDE8FD', border: '#E4DCFB' },
  'A':  { headline: 'Excellent Performance', praise: 'Great Work', message: 'You have demonstrated strong understanding of the subject. Keep building on this performance and continue aiming high.', Icon: Award, accent: '#5A31F4', iconColor: '#5A31F4', panelBg: '#F5F2FE', iconBg: '#EDE8FD', border: '#E4DCFB' },
  'B':  { headline: 'Strong Performance', praise: 'Strong Performance', message: 'You have a solid understanding of the subject. With a little more focus, you can push your performance even further.', Icon: TrendingUp, accent: '#0E9F6E', iconColor: '#0E9F6E', panelBg: '#ECFBF3', iconBg: '#D6F5E6', border: '#BFEAD4' },
  'C':  { headline: 'Good Progress', praise: 'Good Progress', message: 'You are developing a good understanding of the subject. Keep practising and focus on the areas that need more attention.', Icon: Sprout, accent: '#2563EB', iconColor: '#2563EB', panelBg: '#EEF4FF', iconBg: '#DCE8FE', border: '#C7DBFB' },
  'D':  { headline: 'More Practice Needed', praise: 'More Practice Will Help', message: 'Some key areas need more attention. Review the difficult topics and work with your teacher to strengthen your understanding.', Icon: Target, accent: '#B7791F', iconColor: '#D69E2E', panelBg: '#FEF7E9', iconBg: '#FCEFCD', border: '#F6E2A8' },
  'E':  { headline: 'Focus On Improvement', praise: 'Let’s Work On This Together', message: 'Several areas need improvement. Review the key concepts, practise regularly, and use your teacher’s guidance to improve.', Icon: BookOpen, accent: '#C2410C', iconColor: '#EA6A2E', panelBg: '#FEF3EC', iconBg: '#FBE0CE', border: '#F6CBA9' },
  'U':  { headline: 'More Preparation Needed', praise: 'Keep Going', message: 'This result shows that the subject needs more preparation. Review the core concepts and discuss a focused study plan with your teacher.', Icon: Compass, accent: '#D5566E', iconColor: '#D5566E', panelBg: '#FDEFF1', iconBg: '#FADDE2', border: '#F5C6CE' },
};

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
  const { showToast } = useToast();
  const { confirm } = useConfirm();
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
    else showToast(res.error ?? 'Failed to update the score.', 'error');
  };
  const deleteGrade = async (testId: string, studentName: string) => {
    if (!(await confirm({ title: 'Delete this score?', message: `Delete ${studentName}'s score for this test? This cannot be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    const res = await deleteTest(testId);
    if (res.ok) { setShowResultSlipModal(false); router.refresh(); }
    else showToast(res.error ?? 'Failed to delete the score.', 'error');
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

  // When a student is picked, load their enrolled subjects and limit the Subject
  // dropdown to those. For a teacher this is RLS-scoped to the subjects THEY teach
  // that student; for admin/manager it's the student's whole enrollment. `null`
  // means "not loaded yet" so we don't flash an empty list.
  const [enrollSubjectIds, setEnrollSubjectIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!tStudent) { setEnrollSubjectIds(null); return; }
    let alive = true;
    setEnrollSubjectIds(null);
    listStudentEnrollments(tStudent)
      .then((es) => {
        if (!alive) return;
        const ids = Array.from(new Set(es.map((e) => e.subjectId)));
        setEnrollSubjectIds(ids);
        setTSubject((cur) => (ids.length === 1 ? ids[0] : ids.includes(cur) ? cur : ''));
      })
      .catch(() => { if (alive) setEnrollSubjectIds([]); });
    return () => { alive = false; };
  }, [tStudent]);
  const tSubjectOptions = useMemo(
    () => (enrollSubjectIds ? subjects.filter((s) => enrollSubjectIds.includes(s.id)) : []),
    [subjects, enrollSubjectIds]
  );

  const handleRecordTest = async () => {
    if (!tName || !tStudent || !tSubject || !tDate || !tScore) {
      showToast('Test name, student, subject, date, and score are required.', 'error');
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
      showToast(res.error ?? 'Failed to record test.', 'error');
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
              Record monthly test results on the A*–U grade scale and generate Thinkerzz result slips.
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

            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                    <th className="py-3.5 px-3">Test Title</th>
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

            {/* MOBILE CARD LIST (phones) */}
            <div className="md:hidden divide-y divide-[#F1F2F7] dark:divide-slate-800">
              {assessments.length === 0 ? (
                <div className="py-8 text-center text-[#6B7185] text-sm">No assessments yet.</div>
              ) : (
                assessments.map((ast) => (
                  <div key={ast.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{ast.testTitle}</div>
                      <div className="text-xs text-[#6B7185] truncate">{ast.subject} · {ast.dateConducted} · {ast.totalMarks} marks</div>
                    </div>
                    <button
                      onClick={() => { setSelectedAssessmentForSlip(ast); setShowResultSlipModal(true); }}
                      className="shrink-0 px-3 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white font-medium text-xs rounded-xl"
                    >
                      Result Slip
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* CAIE GRADE SCALE reference — admin only */}
          {role === 'admin' && (
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-gradient-to-br from-[#0B0E23] to-[#1D2145] text-white rounded-[20px] p-5 shadow-lg space-y-3">
              <div className="flex items-center gap-2 font-heading font-medium text-xs text-purple-300 uppercase tracking-wider">
                <Award className="w-4 h-4 text-purple-400" />
                <span>Cambridge / CAIE Grade Scale</span>
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
                Result slips show three separately labelled items: <strong>Internal Average</strong>, <strong>Assessed Grade</strong>, and <strong>Target Grade (defaults to A*)</strong>.
              </p>
            </div>
          </div>
          )}

        </div>

        {/* OFFICIAL RESULT SLIP MODAL */}
        {showResultSlipModal && selectedAssessmentForSlip && (
          <>
            <style>{`
              @media print {
                @page { margin: 0; }
                html, body { background: #ffffff !important; }
                body * { visibility: hidden !important; }
                #result-slip-print, #result-slip-print * {
                  visibility: visible !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #result-slip-print {
                  position: absolute; left: 0; top: 0; width: 100%;
                  max-width: 100% !important; max-height: none !important;
                  box-shadow: none !important; border: none !important; overflow: visible !important;
                  padding: 32px !important; border-radius: 0 !important;
                }
              }
            `}</style>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div id="result-slip-print" className="bg-white text-slate-900 border border-[#EBEDF3] rounded-3xl p-5 sm:p-7 w-full max-w-[860px] max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">

              {/* HEADER: logo + Test Result chip + close */}
              <div className="flex items-start justify-between gap-3">
                <Logo variant="light" size="md" showTagline={true} />
                <div className="flex items-center gap-2 print:hidden">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F2FE] text-[#5A31F4] px-3 py-1 text-xs font-medium"><GraduationCap className="w-3.5 h-3.5" /> Test Result</span>
                  <button onClick={() => setShowResultSlipModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </div>
              </div>

              {/* SUBJECT + META */}
              <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-[#F5F2FE] text-[#5A31F4] grid place-items-center"><BookOpen className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-semibold text-slate-900">
                    {selectedAssessmentForSlip.subject}
                    {selectedAssessmentForSlip.subjectCode ? <span className="text-slate-500"> ({selectedAssessmentForSlip.subjectCode})</span> : null}
                    {selectedAssessmentForSlip.program ? <span className="text-slate-500"> · {selectedAssessmentForSlip.program}</span> : null}
                  </div>
                  {selectedAssessmentForSlip.testTitle && (
                    <div className="text-sm font-medium text-slate-700 mt-0.5 break-words">{selectedAssessmentForSlip.testTitle}</div>
                  )}
                  <div className="text-xs text-slate-500 mt-0.5 font-medium">
                    {(() => { const d = new Date(selectedAssessmentForSlip.dateConducted); return isNaN(d.getTime()) ? selectedAssessmentForSlip.dateConducted : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); })()}
                    {selectedAssessmentForSlip.grades.length === 1 ? ` · Candidate: ${selectedAssessmentForSlip.grades[0].studentName || 'Student'}` : ` · ${selectedAssessmentForSlip.grades.length} candidates`}
                  </div>
                </div>
              </div>

              {/* GRADE HERO — the strongest element */}
              {(() => {
                const total = selectedAssessmentForSlip.totalMarks || 100;
                const pcts = selectedAssessmentForSlip.grades.map((g) => (g.marksObtained / ((g.maxScore ?? total) || 100)) * 100);
                const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
                const heroGrade = pcts.length ? gradeFromPct(avg) : 'U';
                const cfg = GRADE_STATES[heroGrade] ?? GRADE_STATES['U'];
                const HeroIcon = cfg.Icon;
                const many = selectedAssessmentForSlip.grades.length > 1;
                return (
                  <div className="rounded-2xl border p-5 sm:p-6 flex items-center justify-between gap-4" style={{ backgroundColor: cfg.panelBg, borderColor: cfg.border }}>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: cfg.accent }}>{many ? 'Class Assessed Grade' : 'Assessed Grade'}</div>
                      <div className="font-heading font-bold leading-none mt-1" style={{ color: cfg.accent, fontSize: 'clamp(3.5rem, 11vw, 4.75rem)' }}>{heroGrade}</div>
                      <div className="mt-2 text-lg sm:text-xl font-semibold text-slate-900">{cfg.headline}</div>
                      <div className="mt-2 h-1 w-12 rounded-full" style={{ backgroundColor: cfg.accent }} />
                    </div>
                    <div className="shrink-0 grid place-items-center rounded-2xl w-20 h-20 sm:w-24 sm:h-24" style={{ backgroundColor: cfg.iconBg }}>
                      <HeroIcon className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={1.75} style={{ color: cfg.iconColor }} />
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
                      <th className="p-2.5 text-center">Percentage</th>
                      <th className="p-2.5 text-center">Assessed Grade</th>
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
                        <td className="p-2.5 text-center font-mono text-slate-700">
                          {(() => { const mx = (g.maxScore ?? selectedAssessmentForSlip.totalMarks) || 100; return mx > 0 ? Math.round((g.marksObtained / mx) * 100) : 0; })()}%
                        </td>
                        <td className="p-2.5 text-center">
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

              {/* PERSONALISED MESSAGE */}
              {(() => {
                const total = selectedAssessmentForSlip.totalMarks || 100;
                const pcts = selectedAssessmentForSlip.grades.map((g) => (g.marksObtained / ((g.maxScore ?? total) || 100)) * 100);
                const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
                const heroGrade = pcts.length ? gradeFromPct(avg) : 'U';
                const cfg = GRADE_STATES[heroGrade] ?? GRADE_STATES['U'];
                const MsgIcon = cfg.Icon;
                const single = selectedAssessmentForSlip.grades.length === 1;
                const firstName = single ? (selectedAssessmentForSlip.grades[0].studentName || 'Student').split(' ')[0] : '';
                return (
                  <div className="rounded-2xl border p-4 flex items-start gap-3" style={{ backgroundColor: cfg.panelBg, borderColor: cfg.border }}>
                    <div className="shrink-0 w-9 h-9 rounded-xl grid place-items-center" style={{ backgroundColor: cfg.iconBg }}>
                      <MsgIcon className="w-5 h-5" style={{ color: cfg.iconColor }} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm" style={{ color: cfg.accent }}>{cfg.praise}{single ? `, ${firstName}!` : '!'}</div>
                      <div className="text-sm text-slate-600 mt-0.5 leading-relaxed">{cfg.message}</div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-400 font-medium">This is a Thinkerzz internal assessment result. For questions, please contact Thinkerzz.</span>
                <button onClick={() => window.print()} className="print:hidden shrink-0 inline-flex items-center justify-center gap-2 bg-[#0F172A] hover:bg-[#0b1120] text-white font-medium text-sm rounded-xl px-4 py-2.5 cursor-pointer transition-colors">
                  <Printer className="w-4 h-4" />
                  <span>Print Result Slip</span>
                </button>
              </div>

            </div>
          </div>
          </>
        )}

        {/* RECORD TEST MODAL */}
        {showRecordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
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
                  <select
                    value={tSubject}
                    onChange={(e) => setTSubject(e.target.value)}
                    disabled={!tStudent || enrollSubjectIds === null}
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                  >
                    <option value="">
                      {!tStudent ? 'Pick a student first' : enrollSubjectIds === null ? 'Loading subjects…' : tSubjectOptions.length === 0 ? 'No subjects assigned to this student' : 'Select...'}
                    </option>
                    {tSubjectOptions.map((s) => (<option key={s.id} value={s.id}>{labelWithCode(s.name, s.code)} · {s.program}</option>))}
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
                {(() => {
                  const mx = Number(tMax) || 0;
                  const sc = Number(tScore);
                  if (!tScore.trim() || Number.isNaN(sc) || mx <= 0) return null;
                  const pct = Math.max(0, Math.min(100, Math.round((sc / mx) * 100)));
                  const grade = gradeFromPct(pct);
                  return (
                    <div className="flex items-center justify-between rounded-xl bg-[#F3F1FC] dark:bg-[#5B47D6]/15 border border-[#E4DFF8] dark:border-[#5B47D6]/25 px-3 py-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-[#5B47D6]">CAIE grade</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Grade {grade}</span>
                    </div>
                  );
                })()}
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
