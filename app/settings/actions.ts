'use server';

// Settings write action. Admin-only (RLS denies Manager on `settings`). Persists
// the fields that map to the schema: academy name / academic year (orgs) and the
// fee grace-period days (settings, one row per org). Other form fields on the UI
// (tagline, currency, cron secret, Resend cap) are not schema-backed and are not
// persisted here.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendViaResend } from '@/lib/notifications/resend';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Send a one-off test email to confirm Resend is delivering (admin-only). Use it
 * after verifying a Resend domain + setting RESEND_FROM to confirm real delivery.
 */
export async function sendTestEmail(toEmail: string): Promise<{ ok: boolean; error?: string; info?: string }> {
  const email = toEmail?.trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (profile?.role !== 'admin') return { ok: false, error: 'Only an admin can send a test email.' };

  const from = process.env.RESEND_FROM ?? 'onboarding@resend.dev';
  const res = await sendViaResend(
    email,
    'Thinkerzz EOS - test email',
    `This is a test email from Thinkerzz EOS.\n\nFrom: ${from}\n\nIf you received this, Resend is delivering correctly. If not, verify your sending domain in Resend and set RESEND_FROM to an address on it.\n\n- Thinkerzz`
  );
  if (!res.ok) return { ok: false, error: res.error ?? 'Send failed.' };
  return {
    ok: true,
    info: `Sent from ${from}. If it does not arrive, your domain is not verified yet (or RESEND_FROM is unset).`,
  };
}

export async function saveSettings(input: {
  academyName: string;
  academicYear: string;
  gracePeriodDays: number;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };
  if (profile.role !== 'admin') return { ok: false, error: 'Only an Admin can change settings.' };

  const orgId = profile.org_id as string;
  const grace = Math.max(0, Math.floor(Number(input.gracePeriodDays) || 0));

  const { error: orgErr } = await supabase
    .from('orgs')
    .update({ name: input.academyName?.trim() || 'Academy', academic_year: input.academicYear?.trim() || '' })
    .eq('id', orgId);
  if (orgErr) return { ok: false, error: orgErr.message };

  // settings has one row per org (org_id UNIQUE) — update if present, else insert.
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  const settingsErr = existing
    ? (await supabase.from('settings').update({ grace_days: grace }).eq('org_id', orgId)).error
    : (await supabase.from('settings').insert({ org_id: orgId, grace_days: grace })).error;
  if (settingsErr) return { ok: false, error: settingsErr.message };

  revalidatePath('/settings');
  return { ok: true };
}
