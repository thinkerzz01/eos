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

function mapRow(r: any): HomeworkAssignment {
  const subject = one<any>(r.subjects);
  const teacher = one<any>(r.teachers);
  return {
    id: r.id,
    homeworkCode: `HW-${String(r.id).split('-')[0].toUpperCase()}`,
    subject: subject?.name ?? '',
    program: '',
    title: r.title,
    assignedDate: r.created_at,
    dueDate: r.deadline,
    teacherName: teacher?.name ?? '',
    totalSubmissions: r.status === 'submitted' || r.status === 'graded' ? 1 : 0,
    gradedCount: r.status === 'graded' ? 1 : 0,
    status: STATUS_UI[r.status as string] ?? 'Assigned',
  };
}

export async function getHomework(): Promise<HomeworkAssignment[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('homework')
    .select('id,title,deadline,status,score,created_at,subjects(name),teachers(name)')
    .is('deleted_at', null)
    .order('deadline', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
