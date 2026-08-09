// GET /api/cron/reminders  (cPanel Custom cron, every 10-15 min)
// Auth: `Authorization: Bearer <CRON_SECRET_TOKEN>` header (never query string).
// Enqueues time-critical reminders into the notifications queue. Idempotent by
// unique_key, so running it every few minutes never double-sends. It does NOT
// send anything — /api/cron/send drains the queue.
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronBearerHeader } from '@/lib/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueNotification } from '@/lib/notifications/enqueue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!verifyCronBearerHeader(req.headers.get('authorization'), process.env.CRON_SECRET_TOKEN ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const today = isoDate(now);
  const tomorrow = isoDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const in15 = new Date(now.getTime() + 15 * 60 * 1000);

  let queued = 0;
  let duplicate = 0;
  let errored = 0;
  const tally = (r: string) => {
    if (r === 'queued') queued++;
    else if (r === 'duplicate') duplicate++;
    else errored++;
  };

  // 0) Advance the fee lifecycle by time (Master Plan §2): an unpaid voucher whose
  //    due date has passed but whose grace deadline has NOT is 'in grace'. Mirror
  //    it to students.fee_status so the health engine + fee badge stay in sync.
  const { data: toGrace } = await admin
    .from('vouchers')
    .select('id,student_id')
    .eq('status', 'due')
    .lte('due_date', today)
    .gte('grace_deadline', today)
    .is('deleted_at', null);
  for (const v of toGrace ?? []) {
    await admin.from('vouchers').update({ status: 'in_grace' }).eq('id', (v as any).id);
    if ((v as any).student_id) {
      await admin.from('students').update({ fee_status: 'in_grace' }).eq('id', (v as any).student_id);
    }
  }

  // 1) Fees due today (priority 1)
  const { data: dueVouchers } = await admin
    .from('vouchers')
    .select('id,org_id,voucher_no,due_date,status,students(name,parent_name,email,gender)')
    .eq('due_date', today)
    .neq('status', 'paid')
    .is('deleted_at', null);
  for (const v of dueVouchers ?? []) {
    const s = one<any>((v as any).students);
    tally(
      await enqueueNotification(admin, {
        orgId: (v as any).org_id,
        type: 'fee_due',
        priority: 1,
        uniqueKey: `fee_due:${(v as any).id}:${today}`,
        payload: {
          student_name: s?.name ?? '',
          parent_name: s?.parent_name ?? '',
          email: s?.email ?? '',
          gender: s?.gender ?? '',
          voucher_no: (v as any).voucher_no,
          due_date: (v as any).due_date,
        },
      })
    );
  }

  // 2) Grace ending tomorrow (priority 1)
  const { data: graceVouchers } = await admin
    .from('vouchers')
    .select('id,org_id,voucher_no,grace_deadline,status,students(name,parent_name,email,gender)')
    .eq('grace_deadline', tomorrow)
    .in('status', ['due', 'in_grace'])
    .is('deleted_at', null);
  for (const v of graceVouchers ?? []) {
    const s = one<any>((v as any).students);
    tally(
      await enqueueNotification(admin, {
        orgId: (v as any).org_id,
        type: 'grace_ending',
        priority: 1,
        uniqueKey: `grace_ending:${(v as any).id}:${tomorrow}`,
        payload: {
          student_name: s?.name ?? '',
          parent_name: s?.parent_name ?? '',
          email: s?.email ?? '',
          gender: s?.gender ?? '',
          voucher_no: (v as any).voucher_no,
          grace_deadline: (v as any).grace_deadline,
        },
      })
    );
  }

  // 3) Classes starting within 15 minutes (priority 1)
  const { data: soonClasses } = await admin
    .from('class_sessions')
    .select('id,org_id,start_at,status,students(name,parent_name,email,gender),subjects(name)')
    .eq('status', 'scheduled')
    .gte('start_at', now.toISOString())
    .lte('start_at', in15.toISOString())
    .is('deleted_at', null);
  for (const c of soonClasses ?? []) {
    const s = one<any>((c as any).students);
    const subj = one<any>((c as any).subjects);
    tally(
      await enqueueNotification(admin, {
        orgId: (c as any).org_id,
        type: 'class_reminder',
        priority: 1,
        uniqueKey: `class_reminder:${(c as any).id}`,
        payload: {
          student_name: s?.name ?? '',
          parent_name: s?.parent_name ?? '',
          email: s?.email ?? '',
          gender: s?.gender ?? '',
          class_subject: subj?.name ?? 'class',
          class_time: new Date((c as any).start_at).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }),
        },
      })
    );
  }

  // 4) Lead follow-ups due today (priority 2) — Master Plan §3.3
  const { data: followLeads } = await admin
    .from('leads')
    .select('id,org_id,name,parent_name,email')
    .eq('next_follow_up', today)
    .is('deleted_at', null);
  for (const l of followLeads ?? []) {
    tally(
      await enqueueNotification(admin, {
        orgId: (l as any).org_id,
        type: 'follow_up',
        priority: 2,
        uniqueKey: `follow_up:${(l as any).id}:${today}`,
        payload: {
          student_name: (l as any).name ?? '',
          parent_name: (l as any).parent_name ?? '',
          email: (l as any).email ?? '',
        },
      })
    );
  }

  // 5) Admin alert: grace period EXPIRED and still unpaid (Master Plan §7) — push
  //    the Stop/Extend/Mark-Paid decision to the org's admin (once per voucher).
  const { data: adminProfiles } = await admin
    .from('profiles')
    .select('org_id,email')
    .eq('role', 'admin')
    .is('deleted_at', null);
  const adminEmailByOrg = new Map<string, string>();
  for (const p of adminProfiles ?? []) {
    const org = (p as any).org_id as string;
    if (!adminEmailByOrg.has(org) && (p as any).email) adminEmailByOrg.set(org, (p as any).email);
  }
  const { data: expiredVouchers } = await admin
    .from('vouchers')
    .select('id,org_id,voucher_no,grace_deadline,students(name)')
    .lt('grace_deadline', today) // grace ended before today -> overdue (day AFTER deadline)
    .in('status', ['due', 'in_grace'])
    .is('deleted_at', null);
  for (const v of expiredVouchers ?? []) {
    const adminEmail = adminEmailByOrg.get((v as any).org_id);
    if (!adminEmail) continue;
    const s = one<any>((v as any).students);
    tally(
      await enqueueNotification(admin, {
        orgId: (v as any).org_id,
        type: 'grace_expired_admin',
        priority: 1,
        uniqueKey: `grace_expired_admin:${(v as any).id}`, // once per voucher
        payload: {
          email: adminEmail,
          student_name: s?.name ?? '',
          voucher_no: (v as any).voucher_no,
          grace_deadline: (v as any).grace_deadline,
        },
      })
    );
  }

  return NextResponse.json({ ok: true, queued, duplicate, errored });
}
