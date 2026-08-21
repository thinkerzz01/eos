// Demos data-access (RLS-enforced, server-only). Joins lead + subject + teacher.
import { createClient } from '@/lib/supabase/server';
import type { DemoSession } from '@/lib/mockAdmissionsData';

const STATUS_UI: Record<string, DemoSession['status']> = {
  needs_teacher: 'Scheduled',
  scheduled: 'Scheduled',
  awaiting_outcome: 'Scheduled',
  done: 'Completed',
};

const OUTCOME_UI: Record<string, NonNullable<DemoSession['outcome']>> = {
  won: 'Won',
  lost: 'Lost',
  follow_up: 'No-show',
};

// Supabase can return an embedded relation as an object or a 1-element array.
function one<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

// Human-readable PKT time, e.g. "Mon, 11 Aug, 4:30 PM".
function fmtPkt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi',
  });
}

function mapRow(r: any): DemoSession {
  const lead = one<any>(r.leads);
  const subject = one<any>(r.subjects);
  const teacher = one<any>(r.teachers);
  return {
    id: r.id,
    demoId: `DM-${String(r.id).split('-')[0].toUpperCase()}`,
    leadId: r.lead_id,
    studentName: lead?.name ?? '',
    parentName: lead?.parent_name ?? '',
    parentPhone: lead?.phone ?? '',
    program: lead?.program ?? '',
    subject: subject?.name ?? '',
    teacherId: r.teacher_id ?? null,
    teacherName: teacher?.name ?? null,
    scheduledTime: fmtPkt(r.scheduled_at),
    scheduledISO: r.scheduled_at,
    durationMinutes: 60,
    meetingLink: r.meeting_link ?? '',
    status: STATUS_UI[r.status as string] ?? 'Scheduled',
    outcome: r.outcome ? OUTCOME_UI[r.outcome as string] : 'Pending',
    feedback: r.reason ?? '',
  };
}

export async function getDemos(): Promise<DemoSession[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('demos')
    .select(
      'id,lead_id,teacher_id,scheduled_at,meeting_link,status,outcome,reason,leads(name,parent_name,phone,program),subjects(name),teachers(name)'
    )
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
