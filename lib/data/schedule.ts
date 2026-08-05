// Schedule (class_sessions) data-access — RLS-enforced, server-only.
import { createClient } from '@/lib/supabase/server';
import type { ScheduledClass } from '@/lib/mockAcademicsData';

const TYPE_UI: Record<string, ScheduledClass['classType']> = {
  class: 'Class',
  makeup: 'Makeup',
  test: 'Test',
};
const STATUS_UI: Record<string, ScheduledClass['status']> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Cancelled',
};

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

// Store UTC, display PKT (Asia/Karachi).
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function mapRow(r: any): ScheduledClass {
  const subject = one<any>(r.subjects);
  const teacher = one<any>(r.teachers);
  const student = one<any>(r.students);
  return {
    id: r.id,
    classCode: `CLS-${String(r.id).split('-')[0].toUpperCase()}`,
    studentId: r.student_id ?? '',
    studentName: student?.name ?? '',
    subject: subject?.name ?? '',
    program: student?.program ?? '',
    grade: '',
    teacherId: r.teacher_id ?? '',
    teacherName: teacher?.name ?? 'Unassigned',
    classType: TYPE_UI[r.type as string] ?? 'Class',
    startAt: fmtTime(r.start_at),
    endAt: fmtTime(r.end_at),
    date: fmtDate(r.start_at),
    status: STATUS_UI[r.status as string] ?? 'Scheduled',
    room: '',
    isCharged: r.type !== 'makeup', // Makeups are never charged again
    enrolledStudentsCount: 1,
  };
}

export async function getSchedule(): Promise<ScheduledClass[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('class_sessions')
    .select('id,student_id,teacher_id,type,start_at,end_at,status,meeting_link,subjects(name),teachers(name),students(name,program)')
    .is('deleted_at', null)
    .order('start_at', { ascending: true });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
