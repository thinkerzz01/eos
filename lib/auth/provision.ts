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

// The functional set-password redirect uses the deployment's own URL (env-driven,
// localhost in dev). The URL SHOWN to the user for signing in is the public portal.
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
function portalUrl(): string {
  return (process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://portal.thinkerzz.com').replace(/\/$/, '');
}

const ROLE_COPY: Record<'teacher' | 'student', { subject: string; intro: string }> = {
  teacher: {
    subject: 'Welcome to Thinkerzz - Set Your Portal Password',
    intro:
      'You have been added as a teacher at Thinkerzz. Set your password to access your portal, where you can view your class schedule, students, and more.',
  },
  student: {
    subject: 'Welcome to Thinkerzz - Set Your Portal Password',
    intro:
      'You have been enrolled at Thinkerzz. Set your password to access your student portal, where you can view your class schedule, fees, and more.',
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
  const waNumber = process.env.NEXT_PUBLIC_ACADEMY_WHATSAPP ?? '';
  const contactCardUrl = `${siteUrl()}/api/contact-card`;
  const saveContactNote =
    'Tip: Save the Thinkerzz contact below so your class invitations are trusted and appear automatically on your Google Calendar.';
  // Plain-text fallback keeps the single-use link (some text-only clients need it).
  const bodyText =
    `${copy.intro}\n\n` +
    `Set your password here (single-use link):\n${actionLink}\n\n` +
    `After setting it, sign in at ${portalUrl()}/login with this email.\n\n` +
    `${saveContactNote}\nSave contact: ${contactCardUrl}\n\n` +
    (waNumber ? `Need help? Contact us on WhatsApp: https://wa.me/${waNumber.replace(/\D/g, '')}\n\n` : '') +
    `- Thinkerzz Academy`;
  const html = renderEmailHtml({
    heading: `Welcome to Thinkerzz, ${opts.name}`,
    preheader: 'Set your password to access your Thinkerzz portal.',
    bodyText: `${copy.intro}\n\nAfter you set your password, sign in at ${portalUrl()}/login using this email address.\n\n${saveContactNote}`,
    cta: { label: 'Set Your Password', url: actionLink },
    hideCtaLinkFallback: true,
    secondaryButton: { label: 'Save Thinkerzz Contact', url: contactCardUrl },
    whatsapp: waNumber ? { number: waNumber, label: 'Need help? Message us on WhatsApp' } : undefined,
  });

  const sent = await sendViaResend(email, copy.subject, bodyText, html);
  if (!sent.ok) {
    return { ok: false, error: `Login ready but email failed to send: ${sent.error ?? 'unknown'}` };
  }

  return { ok: true };
}
