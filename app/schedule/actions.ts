'use server';

// Schedule (class_sessions) write actions — one student per session (schema/plan
// model). RLS decides permission. Teacher time overlaps are blocked by the DB
// `no_overlapping_teacher_sessions` EXCLUDE constraint (btree_gist); we catch it
// and return a friendly conflict. Times are entered in PKT (+05:00) and stored
// as UTC.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createMeetEvent, weeklyRecurrence } from '@/lib/google/calendar';

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

/**
 * Bulk-schedule a qualified student's timetable: for each subject row (its own
 * teacher, weekdays and time), generate class_sessions across `weeks` weeks from
 * `startDate`, only on the selected weekdays (weekends are simply not selected).
 * Teacher time conflicts are skipped (EXCLUDE 23P01) and counted, not fatal.
 * weekdays use JS convention: 0=Sun .. 6=Sat.
 */
export async function bulkScheduleClasses(input: {
  studentId: string;
  startDate: string; // YYYY-MM-DD (PKT)
  weeks: number;
  type: 'Class' | 'Makeup' | 'Test';
  rows: { subjectId: string; teacherId: string; weekdays: number[]; startTime: string; endTime: string }[];
}): Promise<{ ok: boolean; created: number; conflicts: number; error?: string }> {
  if (!input.studentId) return { ok: false, created: 0, conflicts: 0, error: 'Select a student.' };
  if (!input.startDate) return { ok: false, created: 0, conflicts: 0, error: 'Pick a start date.' };
  const rows = (input.rows ?? []).filter(
    (r) => r.subjectId && r.teacherId && Array.isArray(r.weekdays) && r.weekdays.length > 0 && r.startTime && r.endTime
  );
  if (rows.length === 0) {
    return { ok: false, created: 0, conflicts: 0, error: 'Add at least one subject with a teacher, day(s), and a time.' };
  }
  const weeks = Math.max(1, Math.min(12, Math.floor(input.weeks || 4)));
  const type = TYPE_DB[input.type] ?? 'class';

  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, created: 0, conflicts: 0, error: 'You are not signed in.' };

  const start = new Date(`${input.startDate}T00:00:00+05:00`);
  const totalDays = weeks * 7;
  let created = 0;
  let conflicts = 0;

  // Student (for calendar invites) - best-effort.
  const { data: student } = await supabase
    .from('students')
    .select('name,email')
    .eq('id', input.studentId)
    .maybeSingle();
  const studentName = (student as any)?.name ?? 'Student';
  const studentEmail = (student as any)?.email as string | undefined;

  for (const r of rows) {
    // Collect the concrete class dates for this subject across the window.
    const occ: { startIso: string; endIso: string }[] = [];
    for (let d = 0; d < totalDays; d++) {
      const pktDate = new Date(start.getTime() + d * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      const dow = new Date(`${pktDate}T12:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
      if (!r.weekdays.includes(dow)) continue;
      const startIso = new Date(`${pktDate}T${r.startTime}:00+05:00`).toISOString();
      const endIso = new Date(`${pktDate}T${r.endTime}:00+05:00`).toISOString();
      if (new Date(endIso) <= new Date(startIso)) continue;
      occ.push({ startIso, endIso });
    }
    if (occ.length === 0) continue;

    // One recurring Google Meet + calendar series per subject (best-effort). The
    // same Meet link is shared by every session in the series.
    let meetLink: string | null = null;
    let eventId: string | null = null;
    try {
      const [{ data: teacher }, { data: subject }] = await Promise.all([
        supabase.from('teachers').select('email').eq('id', r.teacherId).maybeSingle(),
        supabase.from('subjects').select('name').eq('id', r.subjectId).maybeSingle(),
      ]);
      const attendees = [studentEmail, (teacher as any)?.email].filter(Boolean) as string[];
      const meet = await createMeetEvent({
        summary: `${(subject as any)?.name ?? 'Class'} - ${studentName}`,
        description: 'Thinkerzz Academy class. The teacher will start the meeting.',
        startISO: occ[0].startIso,
        endISO: occ[0].endIso,
        attendees,
        recurrence: weeklyRecurrence(r.weekdays, occ.length),
      });
      if (meet) {
        meetLink = meet.meetLink;
        eventId = meet.eventId;
      }
    } catch {
      /* non-fatal */
    }

    // Insert each individual session (for the timetable + attendance), sharing the
    // series' Meet link.
    for (const o of occ) {
      const { error } = await supabase.from('class_sessions').insert({
        org_id: orgId,
        student_id: input.studentId,
        subject_id: r.subjectId,
        teacher_id: r.teacherId,
        type,
        start_at: o.startIso,
        end_at: o.endIso,
        status: 'scheduled',
        meeting_link: meetLink,
        calendar_event_id: eventId,
      });
      if (!error) created++;
      else if ((error as any).code === '23P01') conflicts++;
      else return { ok: false, created, conflicts, error: error.message };
    }
  }

  revalidatePath('/schedule');
  revalidatePath('/');
  return { ok: true, created, conflicts };
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
