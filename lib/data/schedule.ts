// Schedule (class_sessions) data-access - RLS-enforced, server-only.
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

function mapRow(r: any, attendance?: Map<string, string>, notes?: Map<string, string>): ScheduledClass {
  const subject = one<any>(r.subjects);
  const teacher = one<any>(r.teachers);
  const student = one<any>(r.students);
  return {
    id: r.id,
    classCode: `CLS-${String(r.id).split('-')[0].toUpperCase()}`,
    studentId: r.student_id ?? '',
    studentName: student?.name ?? '',
    subject: subject?.name ?? '',
    subjectId: r.subject_id ?? '',
    program: student?.program ?? '',
    grade: '',
    teacherId: r.teacher_id ?? '',
    teacherName: teacher?.name ?? 'Unassigned',
    classType: TYPE_UI[r.type as string] ?? 'Class',
    startAt: fmtTime(r.start_at),
    endAt: fmtTime(r.end_at),
    date: fmtDate(r.start_at),
    startAtISO: r.start_at,
    endAtISO: r.end_at,
    status: STATUS_UI[r.status as string] ?? 'Scheduled',
    room: '',
    isCharged: r.type !== 'makeup', // Makeups are never charged again
    enrolledStudentsCount: 1,
    meetingLink: r.meeting_link ?? '',
    attendanceStatus: (attendance?.get(r.id) as ScheduledClass['attendanceStatus']) ?? '',
    classNote: notes?.get(r.id) ?? '',
  };
}

export async function getSchedule(): Promise<ScheduledClass[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('class_sessions')
    .select('id,student_id,subject_id,teacher_id,type,start_at,end_at,status,meeting_link,subjects(name),teachers(name),students(name,program)')
    .is('deleted_at', null)
    .order('start_at', { ascending: true });

  if (error || !data) return [];

  // Recorded attendance per session (RLS-scoped). Latest row wins if the old
  // duplicate-insert bug left more than one per session.
  const { data: attRows } = await supabase
    .from('attendance')
    .select('session_id,status,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  const attBy = new Map<string, string>();
  for (const a of (attRows as any[]) ?? []) {
    if (a.session_id) attBy.set(a.session_id, a.status); // ascending order -> last set is newest
  }

  // Teacher class notes per session (latest wins).
  const { data: noteRows } = await supabase
    .from('class_notes')
    .select('session_id,note,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  const noteBy = new Map<string, string>();
  for (const n of (noteRows as any[]) ?? []) {
    if (n.session_id) noteBy.set(n.session_id, n.note);
  }

  return (data as any[]).map((r) => mapRow(r, attBy, noteBy));
}
