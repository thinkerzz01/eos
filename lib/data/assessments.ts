// Assessments (tests) data-access - RLS-enforced, server-only.
// Each `tests` row is one student's score. We group rows that belong to the
// same test (name + date + subject) into one AssessmentRecord with a grades[]
// list. The letter shown here is the INTERNAL grade derived from the raw score
// (A/B/C scale) - the Cambridge assessed_grade lives on student_subjects and is
// surfaced on the Result Slip, not invented here.
import { createClient } from '@/lib/supabase/server';
import type { AssessmentRecord } from '@/lib/mockAcademicsData';
import { codeForProgram } from '@/lib/syllabiSeed';

type Grade = 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';

// Cambridge (CAIE) grade from a percentage - the standard indicative A-Level
// boundaries used for internal monthly tests (real session thresholds vary per
// series). Kept in sync with gradeFromPct/CAIE_BOUNDARIES in AssessmentsClient.
function internalGrade(score: number, maxScore: number): Grade {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return 'A*';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  if (pct >= 40) return 'E';
  return 'U';
}

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

export async function getAssessments(): Promise<AssessmentRecord[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('tests')
    .select('id,student_id,name,date,score,max_score,students(name),subjects(name,program,code)')
    .is('deleted_at', null)
    .order('date', { ascending: false });

  if (error || !data) return [];

  // Group rows into one AssessmentRecord per (test name + date + subject).
  const groups = new Map<string, AssessmentRecord>();
  for (const r of data as any[]) {
    const subj = one<any>(r.subjects);
    const subjectName = subj?.name ?? '';
    const subjectProgram = subj?.program ?? '';
    // Prefer the subject row's stored syllabus code; else derive it per board/level.
    const subjectCode = subj?.code || codeForProgram(subjectName, subjectProgram) || '';
    const studentName = one<any>(r.students)?.name ?? '';
    const key = `${r.name}__${r.date}__${subjectName}`;
    let rec = groups.get(key);
    if (!rec) {
      rec = {
        id: key,
        testCode: `TST-${String(r.id).split('-')[0].toUpperCase()}`,
        testTitle: r.name,
        subject: subjectName,
        subjectCode,
        program: subjectProgram,
        dateConducted: r.date,
        totalMarks: Number(r.max_score || 100),
        teacherName: '',
        grades: [],
      };
      groups.set(key, rec);
    }
    rec.grades.push({
      testId: r.id,
      studentId: r.student_id,
      studentName,
      marksObtained: Number(r.score || 0),
      maxScore: Number(r.max_score || 100),
      assessedGrade: internalGrade(Number(r.score || 0), Number(r.max_score || 100)),
    });
  }
  return Array.from(groups.values());
}
