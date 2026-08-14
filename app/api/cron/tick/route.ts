// GET /api/cron/tick  (external cron / cPanel, every 10-15 min) - RECOMMENDED.
// One call that does both jobs: enqueue time-critical reminders, then drain the
// send queue. This is the single URL a pinger should hit so automation "just runs"
// without configuring two separate cron entries. Auth: `Authorization: Bearer
// <CRON_SECRET_TOKEN>`. Each phase is isolated so a failure in one is reported but
// does not stop the other.
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronBearerHeader } from '@/lib/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { runReminders } from '@/lib/cron/reminders';
import { runSend } from '@/lib/cron/send';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!verifyCronBearerHeader(req.headers.get('authorization'), process.env.CRON_SECRET_TOKEN ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const out: any = { ok: true };

  // Phase 1: enqueue reminders (isolated).
  try {
    out.reminders = await runReminders(admin);
  } catch (e: any) {
    out.ok = false;
    out.reminders = { error: e?.message ?? 'reminders failed' };
  }

  // Phase 2: drain the send queue (isolated - still runs even if phase 1 threw).
  try {
    out.send = await runSend(admin);
  } catch (e: any) {
    out.ok = false;
    out.send = { error: e?.message ?? 'send failed' };
  }

  return NextResponse.json(out, { status: out.ok ? 200 : 500 });
}
