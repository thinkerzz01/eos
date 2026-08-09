import 'server-only';

// Auto-provision a portal login for a teacher or student.
//
// The `profiles` table is the bridge between an Auth account and a role. Adding a
// teacher / enrolling a student creates their DATA row; this creates their LOGIN:
//   1. create (or find) the Supabase Auth user for their email  (service-role)
//   2. create/refresh their `profiles` row with the right role + teacher/student id
//   3. generate a "set your password" link and email it via Resend
//
// Best-effort by contract: callers use this AFTER the core write has succeeded, so
// a mail/quota failure returns { ok:false } with a reason but never throws. The
// admin can re-send later. Never import this into client code - it uses the
// service-role key (server-only).
import { createAdminClient } from '@/lib/supabase/admin';
import { sendViaResend } from '@/lib/notifications/resend';
import { renderEmailHtml } from '@/lib/notifications/emailLayout';

export interface ProvisionResult {
  ok: boolean;
  skipped?: boolean; // no email on file -> nothing to send
  error?: string;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

const ROLE_COPY: Record<'teacher' | 'student', { subject: string; intro: string }> = {
  teacher: {
    subject: 'Your Thinkerzz teacher portal - set your password',
    intro:
      'You have been added as a teacher at Thinkerzz Academy. Set your password to access your portal, where you can see your classes and students.',
  },
  student: {
    subject: 'Welcome to Thinkerzz - set your portal password',
    intro:
      'You have been enrolled at Thinkerzz Academy. Set your password to access your student portal, where you can see your schedule, fees, and vouchers.',
  },
};

/**
 * Create/refresh a login for a teacher or student and email them a set-password
 * link. Safe to call more than once for the same email (idempotent).
 */
export async function provisionLogin(opts: {
  email?: string | null;
  name: string;
  role: 'teacher' | 'student';
  orgId: string;
  teacherId?: string;
  studentId?: string;
}): Promise<ProvisionResult> {
  const email = opts.email?.trim().toLowerCase();
  if (!email) return { ok: true, skipped: true }; // no email -> cannot invite; not an error

  let admin;
  try {
    admin = createAdminClient();
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Service-role client not configured.' };
  }

  const redirectTo = `${siteUrl()}/set-password`;

  // Step 1 - get an Auth user + a set-password action link.
  // `generateLink` does NOT send mail (we send via Resend), and it creates the
  // user for an invite. If the user already exists, fall back to a recovery link.
  let userId: string | null = null;
  let actionLink: string | null = null;

  const invite = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });

  if (!invite.error && invite.data?.user) {
    userId = invite.data.user.id;
    actionLink = invite.data.properties?.action_link ?? null;
  } else {
    const recovery = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (recovery.error || !recovery.data?.user) {
      return {
        ok: false,
        error: `Could not create login link: ${invite.error?.message ?? recovery.error?.message ?? 'unknown'}`,
      };
    }
    userId = recovery.data.user.id;
    actionLink = recovery.data.properties?.action_link ?? null;
  }

  if (!userId) return { ok: false, error: 'Auth user id missing after link generation.' };

  // Step 2 - link the login to a role via `profiles` (service-role bypasses RLS).
  // Remove any stale profile for this email under a different user id first.
  await admin.from('profiles').delete().eq('email', email).neq('user_id', userId);

  const profileRow: Record<string, any> = {
    org_id: opts.orgId,
    user_id: userId,
    role: opts.role,
    name: opts.name,
    email,
    deleted_at: null,
    updated_at: new Date().toISOString(),
  };
  if (opts.role === 'teacher') profileRow.teacher_id = opts.teacherId ?? null;
  if (opts.role === 'student') profileRow.student_id = opts.studentId ?? null;

  const { error: profileErr } = await admin
    .from('profiles')
    .upsert(profileRow, { onConflict: 'user_id' });
  if (profileErr) {
    return { ok: false, error: `Login created but profile link failed: ${profileErr.message}` };
  }

  // Step 3 - email the set-password link.
  if (!actionLink) {
    return { ok: false, error: 'Login created but no set-password link was returned.' };
  }
  const copy = ROLE_COPY[opts.role];
  const bodyText =
    `Hi ${opts.name},\n\n` +
    `${copy.intro}\n\n` +
    `Set your password here (single-use link):\n${actionLink}\n\n` +
    `After setting it, sign in at ${siteUrl()}/login with this email.\n\n` +
    `- Thinkerzz Academy`;
  const html = renderEmailHtml({
    heading: opts.role === 'teacher' ? 'Welcome to Thinkerzz' : 'Welcome to Thinkerzz',
    preheader: 'Set your password to access your Thinkerzz portal.',
    bodyText: `Hi ${opts.name},\n\n${copy.intro}\n\nAfter you set your password, sign in at ${siteUrl()}/login using this email address.`,
    cta: { label: 'Set your password', url: actionLink },
  });

  const sent = await sendViaResend(email, copy.subject, bodyText, html);
  if (!sent.ok) {
    return { ok: false, error: `Login ready but email failed to send: ${sent.error ?? 'unknown'}` };
  }

  return { ok: true };
}
