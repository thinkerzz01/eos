// GET /api/admin/backup - on-demand full backup for a logged-in ADMIN (not cron).
// Auth is the admin's own session (not the cron bearer token): verify the caller is
// signed in and has the admin role, then dump the core tables to a downloadable JSON.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TABLES = [
  'orgs', 'profiles', 'teachers', 'teacher_pay_rates', 'teacher_payouts', 'subjects',
  'teacher_subjects', 'syllabus_templates', 'syllabus_topics', 'students', 'student_subjects',
  'syllabus_progress', 'leads', 'lead_communications', 'demos', 'class_sessions', 'attendance',
  'class_notes', 'homework', 'tests', 'vouchers', 'voucher_lines', 'payments', 'refunds',
  'fee_decisions', 'payment_accounts', 'notifications', 'announcements', 'tickets',
  'ticket_messages', 'documents', 'referrals', 'ad_spend', 'settings', 'audit_log',
];

export async function GET() {
  // Verify the caller is a signed-in admin.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  }

  // Dump every core table via the service-role client (bypasses RLS for a full copy).
  const admin = createAdminClient();
  const dump: Record<string, any> = { exported_at: new Date().toISOString() };
  let totalRows = 0;
  for (const t of TABLES) {
    const { data, error } = await admin.from(t).select('*');
    if (error) dump[t] = { error: error.message };
    else {
      dump[t] = data ?? [];
      totalRows += (data ?? []).length;
    }
  }
  dump._meta = { tables: TABLES.length, totalRows };

  const filename = `thinkerzz-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
