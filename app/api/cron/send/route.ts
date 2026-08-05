// GET /api/cron/send  (cPanel Custom cron, every 10-15 min)
// Drains the notifications queue: priority 1 fully, then 2, then 3, up to the
// Resend free-tier cap of 100 emails/day. A failed send increments retry_count
// and stays queued (retried next run) until it exhausts retries, then flips to
// `failed` for the admin panel. Failures are never dropped silently.
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronBearerHeader } from '@/lib/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { TEMPLATES, buildVars, renderTemplate, type NotificationType } from '@/lib/notifications/templates';
import { sendViaResend } from '@/lib/notifications/resend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DAILY_CAP = 100;
const MAX_RETRIES = 5;

export async function GET(req: NextRequest) {
  if (!verifyCronBearerHeader(req.headers.get('authorization'), process.env.CRON_SECRET_TOKEN ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

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
    return NextResponse.json({ ok: true, sent: 0, failed: 0, note: 'daily cap reached' });
  }

  // Drain oldest-first within ascending priority (1 before 2 before 3).
  const { data: queue } = await admin
    .from('notifications')
    .select('id,type,priority,payload,retry_count,unique_key')
    .eq('status', 'queued')
    .is('deleted_at', null)
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
      await admin
        .from('notifications')
        .update({
          status: nextRetry >= MAX_RETRIES ? 'failed' : 'queued',
          retry_count: nextRetry,
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

    const result = await sendViaResend(to, subject, body);
    if (result.ok) {
      await admin.from('notifications').update({ status: 'sent' }).eq('id', row.id);
      sent++;
      budget--;
    } else {
      await markFailed(result.error ?? 'send failed');
    }
  }

  return NextResponse.json({ ok: true, sent, failed, remainingBudget: budget });
}
