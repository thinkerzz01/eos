import 'server-only';

// Per-student billing generator. Runs on the same cron as reminders. For every
// active MONTHLY student, it cuts the next month's voucher a few days before that
// student's own next_due_date - so vouchers roll forward automatically on each
// student's own cadence, instead of an admin running one dated batch for everyone.
//
// Upfront / crash-course students (billing_mode = 'upfront') are skipped entirely:
// their single block voucher is created and paid at enrolment, and no monthly
// voucher or fee reminder is generated during the block.
//
// Idempotent: a student is skipped if a voucher already exists for the period we
// are about to cut (one voucher per student per month), so overlapping cron runs
// never double-bill. next_due_date is advanced when the voucher is PAID
// (recordPayment / convertLead), not here, so an unpaid cycle keeps its due date
// and the reminder engine can chase it.
import { monthLabelYMD, addDaysYMD, todayYMD } from '@/lib/date/ymd';
import type { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

// Cut the voucher this many days before it is due, so the family sees it ahead of
// the deadline. Must be >= the gap between cron runs; a few days is plenty.
const LEAD_DAYS = 5;
// Grace window after the due date before a voucher is overdue (matches finance).
const GRACE_DAYS = 3;

export interface BillingResult {
  created: number;
  skipped: number;
  errored: number;
}

export async function runBilling(admin: Admin): Promise<BillingResult> {
  const today = todayYMD();
  const horizon = addDaysYMD(today, LEAD_DAYS); // cut anything due on/before this

  let created = 0;
  let skipped = 0;
  let errored = 0;

  // Active monthly students whose next voucher is due within the lead window, who
  // still have fee to bill, and who have not passed their billing end (session).
  const { data: due } = await admin
    .from('students')
    .select('id,org_id,monthly_fee,next_due_date,billing_end_date')
    .eq('status', 'active')
    .eq('billing_mode', 'monthly')
    .gt('monthly_fee', 0)
    .lte('next_due_date', horizon)
    .is('deleted_at', null);

  for (const s of due ?? []) {
    const nextDue = (s as any).next_due_date as string | null;
    if (!nextDue) { skipped++; continue; }
    const end = (s as any).billing_end_date as string | null;
    // Past the session end -> billing is finished for this student.
    if (end && nextDue > end) { skipped++; continue; }

    const period = monthLabelYMD(nextDue);

    // Idempotency: one voucher per student per period. Skip if it already exists.
    const { data: existing } = await admin
      .from('vouchers')
      .select('id')
      .eq('student_id', (s as any).id)
      .eq('period', period)
      .is('deleted_at', null)
      .limit(1);
    if (existing && existing.length > 0) { skipped++; continue; }

    const { error } = await admin.from('vouchers').insert({
      org_id: (s as any).org_id,
      student_id: (s as any).id,
      period,
      amount: Number((s as any).monthly_fee),
      due_date: nextDue,
      grace_deadline: addDaysYMD(nextDue, GRACE_DAYS),
      status: 'due',
    });
    if (error) errored++;
    else created++;
  }

  return { created, skipped, errored };
}
