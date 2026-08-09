import 'server-only';

// Password RESET helpers (never RETRIEVAL - stored passwords are one-way hashed and
// cannot be read). Targets a user by their linked teacher_id/student_id (stable),
// resolving the login + email from `profiles`. Two admin-initiated paths:
//   sendResetById  - emails a single-use "set a new password" link (via Resend)
//   setTempById    - sets a random temporary password and returns it ONCE so the
//                    admin can relay it (nothing is stored in readable form)
// Server-only: uses the service-role key. Never import into client code.
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendViaResend } from '@/lib/notifications/resend';

type Kind = 'teacher' | 'student';

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

// Resolve the login (user_id + email) for a teacher/student record. Returns null
// if that person has no portal login yet (e.g. created without an email).
async function resolveTarget(
  admin: ReturnType<typeof createAdminClient>,
  kind: Kind,
  id: string
): Promise<{ userId: string; email: string } | null> {
  const col = kind === 'teacher' ? 'teacher_id' : 'student_id';
  const { data } = await admin
    .from('profiles')
    .select('user_id,email')
    .eq(col, id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data?.user_id || !data?.email) return null;
  return { userId: data.user_id, email: data.email };
}

const NO_LOGIN =
  'No portal login exists for this person yet. Make sure they have an email on file so a login can be created.';

export async function sendResetById(
  kind: Kind,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  let admin;
  try {
    admin = createAdminClient();
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Service-role client not configured.' };
  }

  const target = await resolveTarget(admin, kind, id);
  if (!target) return { ok: false, error: NO_LOGIN };

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: target.email,
    options: { redirectTo: `${siteUrl()}/set-password` },
  });
  const link = data?.properties?.action_link;
  if (error || !link) return { ok: false, error: error?.message ?? 'Could not create a reset link.' };

  const body =
    `A password reset was requested for your Thinkerzz account.\n\n` +
    `Username: ${target.email}\n\n` +
    `Set a new password (single-use link):\n${link}\n\n` +
    `If you did not request this, you can ignore this email.\n\n- Thinkerzz Academy`;
  const sent = await sendViaResend(target.email, 'Reset your Thinkerzz password', body);
  if (!sent.ok) return { ok: false, error: `Reset link created but the email failed to send: ${sent.error}` };
  return { ok: true };
}

export async function setTempById(
  kind: Kind,
  id: string
): Promise<{ ok: boolean; password?: string; email?: string; error?: string }> {
  let admin;
  try {
    admin = createAdminClient();
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Service-role client not configured.' };
  }

  const target = await resolveTarget(admin, kind, id);
  if (!target) return { ok: false, error: NO_LOGIN };

  // Random, readable temp password (letters + digits + a separator).
  const temp = 'Tz-' + crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const { error } = await admin.auth.admin.updateUserById(target.userId, { password: temp });
  if (error) return { ok: false, error: error.message };
  return { ok: true, password: temp, email: target.email };
}
