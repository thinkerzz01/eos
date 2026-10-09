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
      .update({ status: 'cancelled', deleted_at: now, calendar_event_id: null })
      .in('student_id', ids)
      .is('deleted_at', null);
  } catch {
    /* best-effort */
  }
}

// Start-of-day UTC instant for a PKT (YYYY-MM-DD) date, for comparing against
// class_sessions.start_at (timestamptz).
function pktDayStartISO(ymd: string): string {
  return new Date(`${ymd}T00:00:00+05:00`).toISOString();
}

/**
 * Cancel a student's FUTURE classes (and their Google Calendar invites) from a
 * cutoff instant onward, without touching the attended history before it. Used
 * when a student leaves or passes out: fees/salary stop at the end date, and the
 * classes scheduled on/after it must not keep emailing/inviting the family.
 * cutoffISO is the earliest start_at to cancel (pass "now" for passout-today, or
 * the leaving date for a future end). Service-role so it runs for admin + manager.
 */
export async function cancelFutureClassesForStudents(studentIds: string[], cutoffISO: string): Promise<void> {
  const ids = (studentIds ?? []).filter(Boolean);
  if (ids.length === 0 || !cutoffISO) return;
  let admin: Admin;
  try { admin = createAdminClient(); } catch { return; }
  const now = new Date().toISOString();
  try {
    const { data: sessions } = await admin
      .from('class_sessions')
      .select('id,calendar_event_id')
      .in('student_id', ids)
      .gte('start_at', cutoffISO)
      .is('deleted_at', null);
    await cancelEvents(admin, sessions as any[]);
    await admin
      .from('class_sessions')
      .update({ status: 'cancelled', deleted_at: now, calendar_event_id: null })
      .in('student_id', ids)
      .gte('start_at', cutoffISO)
      .is('deleted_at', null);
  } catch {
    /* best-effort */
  }
}

/**
 * Soft-delete a student's NOT-YET-DUE unpaid vouchers (due on/after onOrAfter,
 * status != paid, with NO payment recorded against them) - the fees for periods
 * they will not attend after leaving/passout. Real debt (already-due vouchers, or
 * any voucher with a payment on it) is left untouched. Service-role.
 */
export async function cancelFutureVouchersForStudents(studentIds: string[], onOrAfterYMD: string): Promise<void> {
  const ids = (studentIds ?? []).filter(Boolean);
  if (ids.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(onOrAfterYMD || '')) return;
  let admin: Admin;
  try { admin = createAdminClient(); } catch { return; }
  const now = new Date().toISOString();
  try {
    const { data: vrows } = await admin
      .from('vouchers')
      .select('id,payments(amount,deleted_at)')
      .in('student_id', ids)
      .neq('status', 'paid')
      .gte('due_date', onOrAfterYMD)
      .is('deleted_at', null);
    // Keep any voucher that already has money against it (partial pay = real debt).
    const cancelIds = ((vrows as any[]) ?? [])
      .filter((v) => !((v.payments as any[]) ?? []).some((p) => !p.deleted_at))
      .map((v) => v.id)
      .filter(Boolean);
    if (cancelIds.length > 0) {
      await admin.from('vouchers').update({ deleted_at: now }).in('id', cancelIds);
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Full finance + enrollment wipe for DELETED students: soft-delete their vouchers,
 * the payments against them, and their subject enrollments (student_subjects, so a
 * removed student stops counting toward teacher load/salary). Service-role so it
 * runs even when a Manager (denied on finance) triggered the delete.
 */
export async function cancelFinanceForStudents(studentIds: string[]): Promise<void> {
  const ids = (studentIds ?? []).filter(Boolean);
  if (ids.length === 0) return;
  let admin: Admin;
  try { admin = createAdminClient(); } catch { return; }
  const now = new Date().toISOString();
  try {
    const { data: vrows } = await admin
      .from('vouchers').select('id').in('student_id', ids).is('deleted_at', null);
    const vids = ((vrows as any[]) ?? []).map((v) => v.id).filter(Boolean);
    if (vids.length > 0) {
      await admin.from('payments').update({ deleted_at: now }).in('voucher_id', vids);
      await admin.from('vouchers').update({ deleted_at: now }).in('id', vids);
    }
    await admin.from('student_subjects').update({ deleted_at: now }).in('student_id', ids).is('deleted_at', null);
  } catch {
    /* best-effort */
  }
}

// Re-export for callers that want to build a PKT-day cutoff.
export { pktDayStartISO };

/**
 * ONE-TIME / RECURRING CLEANUP. Finds people who were already soft-deleted BEFORE
 * the cascade existed (their class sessions/demos are still live with a Google
 * Calendar event) and cancels those events + clears the schedule. Also sweeps any
 * ALREADY-cancelled class session that still carries a live calendar_event_id -
 * e.g. classes cancelled in SQL for a stopped student / left teacher, where the DB
 * row was cleared but the Google invite was never removed. Safe to run repeatedly:
 * once everything is cancelled + cleared it finds nothing. Returns counts.
 */
export async function cleanupOrphanSchedule(): Promise<{ sessions: number; demos: number; invites: number }> {
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { sessions: 0, demos: 0, invites: 0 };
  }
  const now = new Date().toISOString();
  let sessions = 0;
  let demos = 0;
  let invites = 0;

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
      await admin.from('class_sessions').update({ status: 'cancelled', deleted_at: now, calendar_event_id: null }).in('id', ids);
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

  // Already-cancelled class sessions (soft-deleted) that still carry a live Google
  // Calendar event - e.g. classes cancelled in SQL for a stopped student or a left
  // teacher, where the row was removed but the invite was never cancelled. Cancel
  // the event and clear the id so Google stops inviting and we never re-process it.
  // Paged so a large backlog does not time out the single cron call.
  try {
    while (true) {
      const { data } = await admin
        .from('class_sessions')
        .select('id,calendar_event_id')
        .not('deleted_at', 'is', null)
        .not('calendar_event_id', 'is', null)
        .limit(200);
      const rows = (data as any[]) ?? [];
      if (rows.length === 0) break;
      await cancelEvents(admin, rows);
      const ids = rows.map((r) => r.id).filter(Boolean);
      await admin.from('class_sessions').update({ calendar_event_id: null }).in('id', ids);
      invites += ids.length;
      if (rows.length < 200) break;
    }
  } catch {
    /* best-effort */
  }

  return { sessions, demos, invites };
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
      .update({ status: 'cancelled', deleted_at: now, calendar_event_id: null })
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
