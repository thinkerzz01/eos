// GET /api/cron/send  (external cron / cPanel, every 10-15 min)
// Drains the notifications queue: priority 1 fully, then 2, then 3, up to the
// Resend free-tier cap of 100 emails/day. A failed send increments retry_count
// and stays queued (retried next run) until it exhausts retries, then flips to
// `failed` for the admin panel. Failures are never dropped silently. See also
// /api/cron/tick which runs the reminders enqueue AND this sender in one call.
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronBearerHeader, cronSecret } from '@/lib/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSend } from '@/lib/cron/send';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!verifyCronBearerHeader(req.headers.get('authorization'), cronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSend(createAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'send failed' }, { status: 500 });
  }
}
