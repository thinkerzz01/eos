// Homework data-access - RLS-enforced, server-only.
import { createClient } from '@/lib/supabase/server';
import type { HomeworkAssignment } from '@/lib/mockAcademicsData';

const STATUS_UI: Record<string, HomeworkAssignment['status']> = {
  assigned: 'Assigned',
  submitted: 'Assigned',
  late: 'Assigned',
  graded: 'Graded',
};

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

const SUBMISSION_UI: Record<string, HomeworkAssignment['submissionStatus']> = {
  assigned: 'Not submitted',
  submitted: 'Submitted',
  late: 'Submitted',
  graded: 'Graded',
};

function mapRow(r: any): HomeworkAssignment {
  const subject = one<any>(r.subjects);
  const teacher = one<any>(r.teachers);
  const student = one<any>(r.students);
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
    teacherName: teacher?.name ?? '',
    teacherId: r.teacher_id ?? '',
    totalSubmissions: r.status === 'submitted' || r.status === 'graded' ? 1 : 0,
    gradedCount: r.status === 'graded' ? 1 : 0,
    submissionStatus: SUBMISSION_UI[r.status as string] ?? 'Not submitted',
    status: STATUS_UI[r.status as string] ?? 'Assigned',
  };
}

export async function getHomework(): Promise<HomeworkAssignment[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('homework')
    .select('id,title,deadline,status,score,created_at,student_id,subject_id,teacher_id,subjects(name),teachers(name),students(name)')
    .is('deleted_at', null)
    .order('deadline', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
