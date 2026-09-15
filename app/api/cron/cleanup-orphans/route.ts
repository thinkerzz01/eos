// GET /api/cron/cleanup-orphans
// One-time (or occasional) maintenance: cancel the Google Calendar invites and
// clear the class sessions / demos that belong to students or teachers who were
// deleted BEFORE the delete-cascade existed. Safe to run repeatedly. Bearer-token
// protected like the other cron endpoints.
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronBearerHeader, cronSecret } from '@/lib/security';
import { cleanupOrphanSchedule } from '@/lib/scheduling/cascade';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!verifyCronBearerHeader(req.headers.get('authorization'), cronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await cleanupOrphanSchedule();
  return NextResponse.json({ ok: true, ...result });
}
