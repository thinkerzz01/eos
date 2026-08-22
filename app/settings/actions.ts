'use server';

// Settings write action. Admin-only (RLS denies Manager on `settings`). Persists
// the fields that map to the schema: academy name / academic year (orgs) and the
// fee grace-period days (settings, one row per org). Other form fields on the UI
// (tagline, currency, cron secret, Resend cap) are not schema-backed and are not
// persisted here.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendViaResend } from '@/lib/notifications/resend';
import { renderEmailHtml } from '@/lib/notifications/emailLayout';

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
  const bodyText = `This is a test email from Thinkerzz EOS.\n\nFrom: ${from}\n\nIf you received this, Resend is delivering correctly.\n\n- Thinkerzz`;
  const html = renderEmailHtml({
    heading: 'Test email',
    preheader: 'Confirming Thinkerzz email delivery.',
    bodyText: `This is a test email from Thinkerzz EOS.\n\nFrom: ${from}\n\nIf you received this, your email delivery is working correctly.`,
  });
  const res = await sendViaResend(email, 'Thinkerzz EOS - test email', bodyText, html);
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
  bankTitle?: string;
  bankAccountNo?: string;
  bankIban?: string;
  walletInfo?: string;
  headingFont?: string;
  bodyFont?: string;
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

  const orgBase = {
    name: input.academyName?.trim() || 'Thinkerzz',
    academic_year: input.academicYear?.trim() || '',
  };
  const orgFull = {
    ...orgBase,
    heading_font: input.headingFont?.trim() || null,
    body_font: input.bodyFont?.trim() || null,
  };
  let { error: orgErr } = await supabase.from('orgs').update(orgFull).eq('id', orgId);
  // If the typography migration isn't applied yet (no heading_font/body_font
  // columns), retry with just the base fields so saving still works.
  if (orgErr && /heading_font|body_font|column .* does not exist|schema cache/i.test(orgErr.message)) {
    ({ error: orgErr } = await supabase.from('orgs').update(orgBase).eq('id', orgId));
  }
  if (orgErr) return { ok: false, error: orgErr.message };

  const bankPatch = {
    grace_days: grace,
    bank_title: input.bankTitle?.trim() || null,
    bank_account_no: input.bankAccountNo?.trim() || null,
    bank_iban: input.bankIban?.trim() || null,
    wallet_info: input.walletInfo?.trim() || null,
  };

  // settings has one row per org (org_id UNIQUE) - update if present, else insert.
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  const writeSettings = (patch: Record<string, any>) =>
    existing
      ? supabase.from('settings').update(patch).eq('org_id', orgId)
      : supabase.from('settings').insert({ org_id: orgId, ...patch });

  let { error: settingsErr } = await writeSettings(bankPatch);
  // If the settings_bank_info migration is not applied yet, the bank_* columns
  // do not exist - retry with just grace_days so saving still works.
  if (settingsErr && /bank_title|bank_account_no|bank_iban|wallet_info|column .* does not exist|schema cache/i.test(settingsErr.message)) {
    ({ error: settingsErr } = await writeSettings({ grace_days: grace }));
  }
  if (settingsErr) return { ok: false, error: settingsErr.message };

  revalidatePath('/settings');
  revalidatePath('/vouchers');
  revalidatePath('/fees');
  // Fonts live in the root layout - revalidate it so a typography change applies
  // across every page, not just /settings.
  revalidatePath('/', 'layout');
  return { ok: true };
}
