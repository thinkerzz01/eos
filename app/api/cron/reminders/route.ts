// GET /api/cron/reminders  (external cron / cPanel, every 10-15 min)
// Auth: `Authorization: Bearer <CRON_SECRET_TOKEN>` header (never query string).
// Enqueues time-critical reminders into the notifications queue. Idempotent by
// unique_key, so running it every few minutes never double-sends. It does NOT
// send anything - /api/cron/send drains the queue. See also /api/cron/tick which
// runs this AND the sender in one call (recommended for a single-URL pinger).
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronBearerHeader, cronSecret } from '@/lib/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { runReminders } from '@/lib/cron/reminders';
import { runBilling } from '@/lib/cron/billing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!verifyCronBearerHeader(req.headers.get('authorization'), cronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  try {
    // Cut this cycle's monthly vouchers first, then enqueue reminders.
    const billing = await runBilling(admin);
    const result = await runReminders(admin);
    return NextResponse.json({ ok: true, billing, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'reminders failed' }, { status: 500 });
  }
}
