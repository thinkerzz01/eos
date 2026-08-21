// GET /api/cron/backup-export  (cPanel Custom cron, weekly)
// Auth: `Authorization: Bearer <CRON_SECRET_TOKEN>`. A weak but real free-tier
// backup (Master Plan §3.3/§3.5): dumps the core tables to a downloadable JSON
// the cron can capture, e.g.
//   curl -H "Authorization: Bearer $CRON_SECRET_TOKEN" https://<host>/api/cron/backup-export > backup.json
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronBearerHeader, cronSecret } from '@/lib/security';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TABLES = [
  'orgs', 'profiles', 'teachers', 'teacher_pay_rates', 'subjects', 'teacher_subjects',
  'syllabus_templates', 'syllabus_topics', 'students', 'student_subjects', 'syllabus_progress',
  'leads', 'lead_communications', 'demos', 'class_sessions', 'attendance', 'class_notes',
  'homework', 'tests', 'vouchers', 'voucher_lines', 'payments', 'refunds', 'fee_decisions',
  'payment_accounts', 'notifications', 'announcements', 'tickets', 'ticket_messages',
  'documents', 'referrals', 'ad_spend', 'settings', 'audit_log',
];

export async function GET(req: NextRequest) {
  if (!verifyCronBearerHeader(req.headers.get('authorization'), cronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const dump: Record<string, any> = { exported_at: new Date().toISOString() };
  let totalRows = 0;

  for (const t of TABLES) {
    const { data, error } = await admin.from(t).select('*');
    if (error) {
      dump[t] = { error: error.message };
    } else {
      dump[t] = data ?? [];
      totalRows += (data ?? []).length;
    }
  }
  dump._meta = { tables: TABLES.length, totalRows };

  const filename = `thinkerzz-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(dump), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
