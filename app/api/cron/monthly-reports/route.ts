// GET /api/cron/monthly-reports  (cPanel Custom cron, run at month-end)
// For each active student: assemble the month's facts (no raw scores), phrase
// them warmly (LLM optional, first-name + facts only), and enqueue a priority-3
// monthly_report notification. Idempotent per student per month.
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronBearerHeader, cronSecret } from '@/lib/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueNotification } from '@/lib/notifications/enqueue';
import { assembleReportFacts, phraseReport } from '@/lib/reports/monthlyReport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!verifyCronBearerHeader(req.headers.get('authorization'), cronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM

  const { data: students, error } = await admin
    .from('students')
    .select('id,org_id,name,parent_name,email,gender')
    .eq('status', 'active')
    .is('deleted_at', null);

  if (error) {
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  let queued = 0;
  let duplicate = 0;
  let errored = 0;

  for (const s of students ?? []) {
    const student = s as any;
    const facts = await assembleReportFacts(admin, { id: student.id, name: student.name });
    const body = await phraseReport(facts); // first-name + facts only; never sees surname/phone

    const r = await enqueueNotification(admin, {
      orgId: student.org_id,
      type: 'monthly_report',
      priority: 3,
      uniqueKey: `monthly_report:${student.id}:${month}`,
      payload: {
        student_name: student.name,
        parent_name: student.parent_name ?? '',
        email: student.email ?? '',
        gender: student.gender ?? '',
        body,
      },
    });
    if (r === 'queued') queued++;
    else if (r === 'duplicate') duplicate++;
    else errored++;
  }

  return NextResponse.json({ ok: true, month, students: (students ?? []).length, queued, duplicate, errored });
}
