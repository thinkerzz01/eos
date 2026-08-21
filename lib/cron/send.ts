import 'server-only';

// Core of the send cron: drains the notifications queue: priority 1 fully, then 2,
// then 3, up to the Resend free-tier cap of 100 emails/day. A failed send
// increments retry_count with exponential backoff and stays queued until it
// exhausts retries, then flips to `failed` (never dropped silently). Extracted
// from the route so both /api/cron/send and /api/cron/tick can call it.
import { TEMPLATES, buildVars, renderTemplate, type NotificationType } from '@/lib/notifications/templates';
import { sendViaResend } from '@/lib/notifications/resend';
import { renderEmailHtml } from '@/lib/notifications/emailLayout';
import type { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

const DAILY_CAP = 100;
const MAX_RETRIES = 5;

export interface SendResult {
  sent: number;
  failed: number;
  remainingBudget: number;
  note?: string;
}

export async function runSend(admin: Admin): Promise<SendResult> {
  // How many emails have already gone out today (UTC)?
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: sentToday } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('updated_at', startOfDay.toISOString());

  let budget = DAILY_CAP - (sentToday ?? 0);
  if (budget <= 0) {
    return { sent: 0, failed: 0, remainingBudget: 0, note: 'daily cap reached' };
  }

  // Drain oldest-first within ascending priority (1 before 2 before 3).
  const { data: queue } = await admin
    .from('notifications')
    .select('id,type,priority,payload,retry_count,unique_key,next_retry_at')
    .eq('status', 'queued')
    .is('deleted_at', null)
    .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(budget);

  let sent = 0;
  let failed = 0;

  for (const n of queue ?? []) {
    if (budget <= 0) break;
    const row = n as any;
    const tpl = TEMPLATES[row.type as NotificationType];
    const payload = row.payload ?? {};
    const to = payload.email as string | undefined;

    const markFailed = async (reason: string) => {
      const nextRetry = (row.retry_count ?? 0) + 1;
      // Exponential backoff (AGENTS §3.5): 1, 2, 4, 8, 16 minutes before re-eligible.
      const backoffMin = Math.pow(2, row.retry_count ?? 0);
      await admin
        .from('notifications')
        .update({
          status: nextRetry >= MAX_RETRIES ? 'failed' : 'queued',
          retry_count: nextRetry,
          next_retry_at: new Date(Date.now() + backoffMin * 60 * 1000).toISOString(),
          payload: { ...payload, last_error: reason },
        })
        .eq('id', row.id);
      failed++;
    };

    if (!tpl) {
      await markFailed(`no template for type ${row.type}`);
      continue;
    }
    if (!to) {
      await markFailed('no recipient email in payload');
      continue;
    }

    const vars = buildVars(payload);
    const subject = renderTemplate(tpl.subject, vars);
    const body = renderTemplate(tpl.body, vars);

    // Direct-action button: a Meet link (from the payload) or a portal page.
    let cta: { label: string; url: string } | undefined;
    if (tpl.cta) {
      const portal = (process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://portal.thinkerzz.com').replace(/\/$/, '');
      const meet = (payload.meeting_link as string | undefined) || '';
      const url = tpl.cta.useMeet && meet ? meet : tpl.cta.path ? `${portal}${tpl.cta.path}` : '';
      if (url) cta = { label: tpl.cta.label, url };
    }
    const html = renderEmailHtml({ bodyText: body, preheader: subject, cta, hideCtaLinkFallback: true });

    const result = await sendViaResend(to, subject, body, html);
    if (result.ok) {
      await admin.from('notifications').update({ status: 'sent' }).eq('id', row.id);
      sent++;
      budget--;
    } else {
      await markFailed(result.error ?? 'send failed');
    }
  }

  return { sent, failed, remainingBudget: budget };
}
