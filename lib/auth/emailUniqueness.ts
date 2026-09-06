import 'server-only';

// One email = one account. A teacher and a student (or two of either) must never
// share an email address, because a Supabase Auth email is GLOBALLY unique: a
// shared email collapses both people onto the same auth user, and provisioning
// the second login overwrites the first one's role on the `profiles` upsert. So
// before we create/link any login - and at the admin create/edit points - we
// reject an email that already belongs to a different teacher or student.
//
// The check runs with the service-role client so it can see across BOTH tables
// regardless of the caller's RLS. Scoped by org (multi-tenant): the same email
// may legitimately exist in a different academy, but never twice within one.
import { createAdminClient } from '@/lib/supabase/admin';

export interface EmailOwner {
  role: 'teacher' | 'student';
  name: string;
}

/**
 * Find a teacher or student in `orgId` already using `email`, excluding the
 * record currently being created/edited. Returns the owner (role + name) if the
 * email is taken, else null. Empty email or a missing service-role key -> null
 * (best-effort: never blocks a write just because the check could not run).
 */
export async function findEmailAccountOwner(
  orgId: string,
  email: string | null | undefined,
  exclude?: { teacherId?: string; studentId?: string }
): Promise<EmailOwner | null> {
  const e = email?.trim();
  if (!e || !orgId) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null; // no service-role key configured -> skip (best-effort)
  }

  // ilike with no wildcards = a case-insensitive exact match.
  let tq = admin.from('teachers').select('id,name').eq('org_id', orgId).ilike('email', e).is('deleted_at', null);
  if (exclude?.teacherId) tq = tq.neq('id', exclude.teacherId);
  const { data: teachers } = await tq.limit(1);
  if (teachers && teachers.length) return { role: 'teacher', name: (teachers[0] as any).name ?? '' };

  let sq = admin.from('students').select('id,name').eq('org_id', orgId).ilike('email', e).is('deleted_at', null);
  if (exclude?.studentId) sq = sq.neq('id', exclude.studentId);
  const { data: students } = await sq.limit(1);
  if (students && students.length) return { role: 'student', name: (students[0] as any).name ?? '' };

  return null;
}

/** Friendly, admin-facing message for a taken email. */
export function emailTakenMessage(owner: EmailOwner): string {
  const who = owner.role === 'teacher' ? 'a teacher' : 'a student';
  const named = owner.name ? ` (${owner.name})` : '';
  return `This email is already used by ${who}${named}. Each teacher and student must have their own unique email - please use a different address.`;
}
