'use server';

// Schedule (class_sessions) write actions — one student per session (schema/plan
// model). RLS decides permission. Teacher time overlaps are blocked by the DB
// `no_overlapping_teacher_sessions` EXCLUDE constraint (btree_gist); we catch it
// and return a friendly conflict. Times are entered in PKT (+05:00) and stored
// as UTC.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ActionResult {
  ok: boolean;
  error?: string;
  conflict?: boolean;
}

const TYPE_DB: Record<string, string> = { Class: 'class', Makeup: 'makeup', Test: 'test' };
const ATT_DB: Record<string, string> = { Present: 'present', Late: 'late', Absent: 'absent' };

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null as string | null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  return { supabase, user, orgId: (profile?.org_id as string) ?? null };
}

/** Build a UTC ISO timestamp from a PKT date + HH:MM time. */
function pktToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:00`).toISOString();
}

export async function createClassSession(input: {
  studentId: string;
  subjectId: string;
  teacherId: string;
  type: 'Class' | 'Makeup' | 'Test';
  date: string; // YYYY-MM-DD (PKT)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}): Promise<ActionResult> {
  if (!input.studentId) return { ok: false, error: 'Select a student.' };
  if (!input.subjectId) return { ok: false, error: 'Select a subject.' };
  if (!input.teacherId) return { ok: false, error: 'Select a teacher.' };
  if (!input.date || !input.startTime || !input.endTime) {
    return { ok: false, error: 'Date, start time, and end time are required.' };
  }

  const startIso = pktToIso(input.date, input.startTime);
  const endIso = pktToIso(input.date, input.endTime);
  if (new Date(endIso) <= new Date(startIso)) {
    return { ok: false, error: 'End time must be after the start time.' };
  }

  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase.from('class_sessions').insert({
    org_id: orgId,
    student_id: input.studentId,
    subject_id: input.subjectId,
    teacher_id: input.teacherId,
    type: TYPE_DB[input.type] ?? 'class',
    start_at: startIso,
    end_at: endIso,
    status: 'scheduled',
  });

  if (error) {
    // 23P01 = exclusion_violation (teacher already booked in that window).
    if ((error as any).code === '23P01') {
      return {
        ok: false,
        conflict: true,
        error: 'Conflict: this teacher already has a session overlapping that time. Blocked by the overlap constraint.',
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/schedule');
  revalidatePath('/');
  return { ok: true };
}

export async function completeClassWithAttendance(input: {
  sessionId: string;
  studentId: string;
  attendance: 'Present' | 'Late' | 'Absent';
}): Promise<ActionResult> {
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { error: statusErr } = await supabase
    .from('class_sessions')
    .update({ status: 'completed' })
    .eq('id', input.sessionId);
  if (statusErr) return { ok: false, error: statusErr.message };

  const { error: attErr } = await supabase.from('attendance').insert({
    org_id: orgId,
    session_id: input.sessionId,
    student_id: input.studentId,
    status: ATT_DB[input.attendance] ?? 'present',
  });
  if (attErr) return { ok: false, error: attErr.message };

  revalidatePath('/schedule');
  revalidatePath('/');
  return { ok: true };
}
