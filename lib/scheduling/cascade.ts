import 'server-only';

// When a student or teacher is deleted we must stop every future email AND every
// Google Calendar invite/reminder tied to them. A soft-delete on the person row
// alone does not do that: their class_sessions/demos stay live (so the reminder
// cron still emails them) and their Google Calendar events keep firing invites on
// Google's side. These helpers cancel those calendar events and clear the linked
// schedule. All best-effort: the person is already removed, so a Google/API miss
// must never throw.
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteCalendarEvent } from '@/lib/google/calendar';

type Admin = ReturnType<typeof createAdminClient>;

async function cancelEvents(admin: Admin, rows: Array<{ calendar_event_id?: string | null }> | null | undefined): Promise<void> {
  for (const r of rows ?? []) {
    const id = (r as any)?.calendar_event_id as string | undefined;
    if (id) {
      try {
        await deleteCalendarEvent(id); // sendUpdates=all -> drops it off their calendars
      } catch {
        /* best-effort */
      }
    }
  }
}

/**
 * Cancel all Google Calendar events and soft-delete the class sessions + demos of
 * the given students. Call AFTER the student rows are soft-deleted.
 */
export async function cancelScheduleForStudents(studentIds: string[]): Promise<void> {
  const ids = (studentIds ?? []).filter(Boolean);
  if (ids.length === 0) return;
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return; // no service-role -> cannot cascade; person is already removed
  }
  const now = new Date().toISOString();
  try {
    const { data: sessions } = await admin
      .from('class_sessions')
      .select('id,calendar_event_id')
      .in('student_id', ids)
      .is('deleted_at', null);
    await cancelEvents(admin, sessions as any[]);
    await admin
      .from('class_sessions')
      .update({ status: 'cancelled', deleted_at: now })
      .in('student_id', ids)
      .is('deleted_at', null);
  } catch {
    /* best-effort */
  }
}

/**
 * ONE-TIME / RECURRING CLEANUP. Finds people who were already soft-deleted BEFORE
 * the cascade existed (their class sessions/demos are still live with a Google
 * Calendar event) and cancels those events + clears the schedule. Safe to run
 * repeatedly: once everything is cancelled it finds nothing. Returns counts.
 */
export async function cleanupOrphanSchedule(): Promise<{ sessions: number; demos: number }> {
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { sessions: 0, demos: 0 };
  }
  const now = new Date().toISOString();
  let sessions = 0;
  let demos = 0;

  const clearSessions = async (rel: 'students' | 'teachers', col: 'student_id' | 'teacher_id') => {
    const { data } = await admin
      .from('class_sessions')
      .select(`id,calendar_event_id,${rel}!inner(deleted_at)`)
      .is('deleted_at', null)
      .not(`${rel}.deleted_at`, 'is', null);
    const rows = (data as any[]) ?? [];
    if (rows.length === 0) return;
    await cancelEvents(admin, rows);
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length) {
      await admin.from('class_sessions').update({ status: 'cancelled', deleted_at: now }).in('id', ids);
      sessions += ids.length;
    }
  };
  try {
    await clearSessions('students', 'student_id');
    await clearSessions('teachers', 'teacher_id');
  } catch {
    /* best-effort */
  }

  // Live demos still assigned to a deleted teacher: cancel the invite + unassign.
  try {
    const { data } = await admin
      .from('demos')
      .select('id,calendar_event_id,teachers!inner(deleted_at)')
      .is('deleted_at', null)
      .not('teachers.deleted_at', 'is', null);
    const rows = (data as any[]) ?? [];
    if (rows.length) {
      await cancelEvents(admin, rows);
      const ids = rows.map((r) => r.id).filter(Boolean);
      await admin
        .from('demos')
        .update({ teacher_id: null, status: 'needs_teacher', meeting_link: null, calendar_event_id: null })
        .in('id', ids);
      demos += ids.length;
    }
  } catch {
    /* best-effort */
  }

  // Already-removed demos (soft-deleted) that still carry a live calendar event -
  // e.g. a student deleted before the cascade existed. Cancel the event and clear
  // the id so Google stops inviting and we never re-process it.
  try {
    const { data } = await admin
      .from('demos')
      .select('id,calendar_event_id')
      .not('deleted_at', 'is', null)
      .not('calendar_event_id', 'is', null);
    const rows = (data as any[]) ?? [];
    if (rows.length) {
      await cancelEvents(admin, rows);
      const ids = rows.map((r) => r.id).filter(Boolean);
      await admin.from('demos').update({ calendar_event_id: null }).in('id', ids);
      demos += ids.length;
    }
  } catch {
    /* best-effort */
  }

  return { sessions, demos };
}

/**
 * Cancel the Google Calendar events of the demos linked to the given leads. The
 * student cascade already soft-deletes the demos; this stops Google still inviting.
 */
export async function cancelDemoCalendarForLeads(leadIds: string[]): Promise<void> {
  const ids = (leadIds ?? []).filter(Boolean);
  if (ids.length === 0) return;
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }
  try {
    const { data: demos } = await admin
      .from('demos')
      .select('calendar_event_id')
      .in('lead_id', ids);
    await cancelEvents(admin, demos as any[]);
  } catch {
    /* best-effort */
  }
}

/**
 * Cancel all Google Calendar events tied to the given teachers, then clear the
 * schedule that referenced them: their class sessions are cancelled (a deleted
 * teacher cannot teach them; the admin re-creates on reassignment) and their
 * assigned demos are returned to 'needs_teacher' so they can be reassigned.
 * Call AFTER the teacher rows are soft-deleted.
 */
export async function cancelScheduleForTeachers(teacherIds: string[]): Promise<void> {
  const ids = (teacherIds ?? []).filter(Boolean);
  if (ids.length === 0) return;
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }
  const now = new Date().toISOString();
  try {
    // Class sessions taught by the teacher: cancel the calendar invite + the session.
    const { data: sessions } = await admin
      .from('class_sessions')
      .select('id,calendar_event_id')
      .in('teacher_id', ids)
      .is('deleted_at', null);
    await cancelEvents(admin, sessions as any[]);
    await admin
      .from('class_sessions')
      .update({ status: 'cancelled', deleted_at: now })
      .in('teacher_id', ids)
      .is('deleted_at', null);

    // Demos assigned to the teacher: cancel the invite, then unassign so the demo
    // (for a student who still exists) can be given to another teacher.
    const { data: demos } = await admin
      .from('demos')
      .select('id,calendar_event_id')
      .in('teacher_id', ids)
      .is('deleted_at', null);
    await cancelEvents(admin, demos as any[]);
    await admin
      .from('demos')
      .update({ teacher_id: null, status: 'needs_teacher', meeting_link: null, calendar_event_id: null })
      .in('teacher_id', ids)
      .is('deleted_at', null);
  } catch {
    /* best-effort */
  }
}
