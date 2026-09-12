// Homework data-access - RLS-enforced, server-only.
import { createClient } from '@/lib/supabase/server';
import type { HomeworkAssignment } from '@/lib/mockAcademicsData';
import { resolveTeacherNames } from '@/lib/data/teacherNames';

const STATUS_UI: Record<string, HomeworkAssignment['status']> = {
  assigned: 'Assigned',
  submitted: 'Assigned',
  late: 'Assigned',
  graded: 'Graded',
};

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

// Submission is a SEPARATE axis from grading. The DB collapses both into one
// `status`, so a graded row lost whether it was submitted; we treat graded work
// as submitted (the teacher reviewed it) rather than showing "Graded" in a
// Submission column, which read as a category error. Grading lives in `status`.
const SUBMISSION_UI: Record<string, HomeworkAssignment['submissionStatus']> = {
  assigned: 'Not submitted',
  submitted: 'Submitted',
  late: 'Submitted',
  graded: 'Submitted',
};

function mapRow(r: any, teacherNames?: Map<string, string>): HomeworkAssignment {
  const subject = one<any>(r.subjects);
  const teacher = one<any>(r.teachers);
  const student = one<any>(r.students);
  // Name-only fallback for students/teachers whose RLS blocks the teachers embed.
  const teacherName = teacherNames?.get(r.teacher_id) ?? teacher?.name ?? '';
  return {
    id: r.id,
    homeworkCode: `HW-${String(r.id).split('-')[0].toUpperCase()}`,
    subject: subject?.name ?? '',
    subjectId: r.subject_id ?? '',
    program: '',
    title: r.title,
    studentName: student?.name ?? '',
    studentId: r.student_id ?? '',
    assignedDate: r.created_at,
    dueDate: r.deadline,
    dueISO: r.deadline,
    teacherName,
    teacherId: r.teacher_id ?? '',
    totalSubmissions: r.status === 'submitted' || r.status === 'graded' ? 1 : 0,
    gradedCount: r.status === 'graded' ? 1 : 0,
    submissionStatus: SUBMISSION_UI[r.status as string] ?? 'Not submitted',
    status: STATUS_UI[r.status as string] ?? 'Assigned',
    description: r.description ?? '',
    score: r.score ?? null,
    maxScore: r.max_score ?? null,
    feedback: r.feedback ?? '',
  };
}

export async function getHomework(): Promise<HomeworkAssignment[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const FULL = 'id,title,description,deadline,status,score,max_score,feedback,created_at,student_id,subject_id,teacher_id,subjects(name),teachers(name),students(name)';
  const BASE = 'id,title,deadline,status,score,created_at,student_id,subject_id,teacher_id,subjects(name),teachers(name),students(name)';
  const run = (cols: string) =>
    supabase.from('homework').select(cols).is('deleted_at', null).order('deadline', { ascending: false });
  let { data, error }: { data: any[] | null; error: any } = await run(FULL);
  // Fall back gracefully if the description/grading columns migration hasn't run
  // yet, so the list never breaks during a deploy.
  if (error && /column|does not exist|description|max_score|feedback/i.test(error.message ?? '')) {
    ({ data, error } = await run(BASE));
  }

  if (error || !data) return [];
  const teacherNames = await resolveTeacherNames(
    supabase,
    (data as any[]).map((r) => r.teacher_id)
  );
  return (data as any[]).map((r) => mapRow(r, teacherNames));
}
