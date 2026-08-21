// In-app notifications (the TopBar bell) - server-only write helpers.
//
// These create rows in app_notifications for a TARGET user (e.g. a student whose
// homework was just graded). Because the writer is usually NOT that user, we use
// the service-role client so RLS does not block the cross-user insert. Every
// function is BEST-EFFORT: a failure (missing service key in dev, unmigrated
// table) must never break the action that triggered it, so callers wrap in
// try/catch and we also swallow internally.
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface InAppNotice {
  title: string;
  body?: string;
  link?: string;
}

/** Insert one notice for each given user id. Best-effort. */
export async function notifyUserIds(orgId: string, userIds: string[], notice: InAppNotice): Promise<void> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!orgId || ids.length === 0) return;
  try {
    const admin = createAdminClient();
    const rows = ids.map((uid) => ({
      org_id: orgId,
      user_id: uid,
      title: notice.title,
      body: notice.body ?? '',
      link: notice.link ?? null,
    }));
    await admin.from('app_notifications').insert(rows);
  } catch {
    /* best-effort: never surface to the triggering action */
  }
}

/** Notify the student who owns `studentId` (resolves student_id -> user_id). */
export async function notifyStudentById(orgId: string, studentId: string, notice: InAppNotice): Promise<void> {
  if (!orgId || !studentId) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('profiles')
      .select('user_id')
      .eq('student_id', studentId)
      .eq('role', 'student')
      .is('deleted_at', null);
    const ids = ((data as any[]) ?? []).map((r) => r.user_id as string).filter(Boolean);
    await notifyUserIds(orgId, ids, notice);
  } catch {
    /* best-effort */
  }
}

/** Notify the teacher who owns `teacherId` (resolves teacher_id -> user_id). */
export async function notifyTeacherById(orgId: string, teacherId: string, notice: InAppNotice): Promise<void> {
  if (!orgId || !teacherId) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('profiles')
      .select('user_id')
      .eq('teacher_id', teacherId)
      .eq('role', 'teacher')
      .is('deleted_at', null);
    const ids = ((data as any[]) ?? []).map((r) => r.user_id as string).filter(Boolean);
    await notifyUserIds(orgId, ids, notice);
  } catch {
    /* best-effort */
  }
}

/** Notify every admin + manager in the org (e.g. a new booking arrived). */
export async function notifyStaff(orgId: string, notice: InAppNotice): Promise<void> {
  if (!orgId) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('profiles')
      .select('user_id')
      .eq('org_id', orgId)
      .in('role', ['admin', 'manager'])
      .is('deleted_at', null);
    const ids = ((data as any[]) ?? []).map((r) => r.user_id as string).filter(Boolean);
    await notifyUserIds(orgId, ids, notice);
  } catch {
    /* best-effort */
  }
}
