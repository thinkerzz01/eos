'use server';

// Finance write actions (Admin only - RLS denies Manager on every finance table).
// Runs server-side with the user's session; Postgres RLS enforces permission.
// Locked policy (AGENTS.md §4): partial payment keeps the voucher Due with a
// running balance; a refund is a NEGATIVE payment linked to the voucher (the
// original payment is never edited/deleted); grace expiry never auto-stops -
// the Admin decides (Stop / Extend / Mark paid), and every choice is audited.
// The health engine and the fee badge both read students.fee_status, so we keep
// it in sync here.
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueNotification } from '@/lib/notifications/enqueue';
import { revalidatePath } from 'next/cache';

const METHOD_DB: Record<string, string> = {
  'Bank Transfer': 'bank_transfer',
  Cash: 'cash',
  JazzCash: 'jazzcash',
  Easypaisa: 'easypaisa',
  Cheque: 'other',
};

export interface ActionResult {
  ok: boolean;
  error?: string;
  fullyPaid?: boolean;
  balance?: number;
}

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null as string | null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  return { supabase, user, orgId: (profile?.org_id as string) ?? null };
}

function revalidateFinance() {
  revalidatePath('/vouchers');
  revalidatePath('/payments');
  revalidatePath('/');
}

/** Modify a voucher's amount and/or due date (grace = due + 3 days). Admin only. */
export async function updateVoucher(input: {
  voucherId: string;
  amount?: number;
  dueDate?: string; // YYYY-MM-DD (PKT)
}): Promise<ActionResult> {
  if (!input.voucherId) return { ok: false, error: 'Missing voucher id.' };
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const patch: Record<string, any> = {};
  if (input.amount != null && input.amount > 0) patch.amount = input.amount;
  if (input.dueDate) {
    patch.due_date = input.dueDate;
    const g = new Date(`${input.dueDate}T00:00:00+05:00`);
    g.setDate(g.getDate() + 3);
    patch.grace_deadline = g.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to update.' };

  const { error } = await supabase.from('vouchers').update(patch).eq('id', input.voucherId);
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true };
}

/** Record a (possibly partial) payment against a voucher. */
export async function recordPayment(input: {
  voucherId: string;
  amount: number;
  method: string;
  reference?: string;
}): Promise<ActionResult> {
  if (!(input.amount > 0)) return { ok: false, error: 'Enter a valid amount greater than zero.' };
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { data: voucher } = await supabase
    .from('vouchers')
    .select('id,amount,student_id,status,students(name,parent_name,email,gender)')
    .eq('id', input.voucherId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!voucher) return { ok: false, error: 'Voucher not found.' };

  const { data: newPayment, error: payErr } = await supabase
    .from('payments')
    .insert({
      org_id: orgId,
      voucher_id: input.voucherId,
      amount: input.amount,
      method: METHOD_DB[input.method] ?? 'other',
      reference: input.reference?.trim() || null,
      reconciled_by: user.id,
    })
    .select('id')
    .single();
  if (payErr) return { ok: false, error: payErr.message };

  // Email the parent a "payment received" note (best-effort; queued, not sent here).
  const stu = Array.isArray((voucher as any).students) ? (voucher as any).students[0] : (voucher as any).students;
  if (stu?.email) {
    try {
      await enqueueNotification(createAdminClient(), {
        orgId,
        type: 'payment_received',
        priority: 2,
        uniqueKey: `payment_received:${(newPayment as any).id}`,
        payload: {
          student_name: stu.name ?? '',
          parent_name: stu.parent_name ?? '',
          email: stu.email,
          gender: stu.gender ?? '',
          amount: input.amount,
        },
      });
    } catch {
      /* never block a recorded payment on the notification queue */
    }
  }

  const { data: pays } = await supabase
    .from('payments')
    .select('amount')
    .eq('voucher_id', input.voucherId)
    .is('deleted_at', null);
  const totalPaid = (pays ?? []).reduce((s, p: any) => s + Number(p.amount || 0), 0);
  const total = Number((voucher as any).amount || 0);
  const fullyPaid = totalPaid >= total;

  if (fullyPaid && (voucher as any).status !== 'paid') {
    await supabase.from('vouchers').update({ status: 'paid' }).eq('id', input.voucherId);
    await supabase.from('students').update({ fee_status: 'paid' }).eq('id', (voucher as any).student_id);
  }

  revalidateFinance();
  return { ok: true, fullyPaid, balance: Math.max(0, total - totalPaid) };
}

/** Issue a refund as a NEGATIVE payment linked to the original voucher. */
export async function issueRefund(input: {
  voucherId: string;
  amount: number;
  reason: string;
}): Promise<ActionResult> {
  if (!(input.amount > 0)) return { ok: false, error: 'Enter a valid refund amount.' };
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { data: voucher } = await supabase
    .from('vouchers')
    .select('id,amount,student_id,status')
    .eq('id', input.voucherId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!voucher) return { ok: false, error: 'Voucher not found.' };

  const { error: refErr } = await supabase.from('payments').insert({
    org_id: orgId,
    voucher_id: input.voucherId,
    amount: -Math.abs(input.amount), // negative payment
    method: 'bank_transfer',
    reference: input.reason?.trim() || 'Admin approved refund',
    reconciled_by: user.id,
  });
  if (refErr) return { ok: false, error: refErr.message };

  // A refund can drop a Paid voucher back below its total -> becomes Due again.
  const { data: pays } = await supabase
    .from('payments')
    .select('amount')
    .eq('voucher_id', input.voucherId)
    .is('deleted_at', null);
  const totalPaid = (pays ?? []).reduce((s, p: any) => s + Number(p.amount || 0), 0);
  const total = Number((voucher as any).amount || 0);
  if (totalPaid < total && (voucher as any).status === 'paid') {
    await supabase.from('vouchers').update({ status: 'due' }).eq('id', input.voucherId);
    await supabase.from('students').update({ fee_status: 'due' }).eq('id', (voucher as any).student_id);
  }

  revalidateFinance();
  return { ok: true };
}

/** Admin grace decision: Stop / Extend / Mark Paid - audited to fee_decisions. */
export async function adminFeeDecision(input: {
  voucherId: string;
  choice: 'Stop' | 'Extend' | 'Mark Paid';
}): Promise<ActionResult> {
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { data: voucher } = await supabase
    .from('vouchers')
    .select('id,student_id')
    .eq('id', input.voucherId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!voucher) return { ok: false, error: 'Voucher not found.' };

  const decision = input.choice === 'Stop' ? 'stop' : input.choice === 'Extend' ? 'extend' : 'paid';

  const { error: decErr } = await supabase.from('fee_decisions').insert({
    org_id: orgId,
    voucher_id: input.voucherId,
    decision,
    by_user_id: user.id,
  });
  if (decErr) return { ok: false, error: decErr.message };

  const studentId = (voucher as any).student_id;
  if (input.choice === 'Stop') {
    await supabase.from('vouchers').update({ status: 'stopped' }).eq('id', input.voucherId);
    await supabase.from('students').update({ fee_status: 'stopped' }).eq('id', studentId);
  } else if (input.choice === 'Extend') {
    const newGrace = new Date();
    newGrace.setDate(newGrace.getDate() + 3);
    await supabase
      .from('vouchers')
      .update({ status: 'in_grace', grace_deadline: newGrace.toISOString().slice(0, 10) })
      .eq('id', input.voucherId);
    await supabase.from('students').update({ fee_status: 'in_grace' }).eq('id', studentId);
  } else {
    await supabase.from('vouchers').update({ status: 'paid' }).eq('id', input.voucherId);
    await supabase.from('students').update({ fee_status: 'paid' }).eq('id', studentId);
  }

  revalidatePath('/vouchers');
  revalidatePath('/');
  return { ok: true };
}

/**
 * Bulk-generate this month's vouchers: one per ACTIVE student who has a monthly
 * fee and does NOT already have a voucher for the given period. Skips students
 * already invoiced for the period (so it is safe to run more than once) and
 * those with no fee set. grace_deadline = due_date + 3 days. Admin only (RLS).
 */
export async function generateMonthlyVouchers(input: {
  period: string; // e.g. "September 2026"
  dueDate: string; // YYYY-MM-DD
}): Promise<{ ok: boolean; created: number; skipped: number; error?: string }> {
  const period = input.period?.trim();
  if (!period) return { ok: false, created: 0, skipped: 0, error: 'Pick the fee month.' };
  if (!input.dueDate) return { ok: false, created: 0, skipped: 0, error: 'Select a due date.' };

  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, created: 0, skipped: 0, error: 'You are not signed in.' };

  const [{ data: students }, { data: existing }] = await Promise.all([
    supabase.from('students').select('id,monthly_fee').eq('status', 'active').is('deleted_at', null),
    supabase.from('vouchers').select('student_id').eq('period', period).is('deleted_at', null),
  ]);
  const invoiced = new Set(((existing as any[]) ?? []).map((e) => e.student_id as string));

  const grace = new Date(`${input.dueDate}T00:00:00+05:00`);
  grace.setDate(grace.getDate() + 3);
  const graceStr = grace.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

  const eligible = ((students as any[]) ?? []).filter(
    (s) => !invoiced.has(s.id) && Number(s.monthly_fee) > 0
  );
  const skipped = (((students as any[]) ?? []).length) - eligible.length;
  if (eligible.length === 0) {
    return { ok: true, created: 0, skipped, error: undefined };
  }

  const rows = eligible.map((s) => ({
    org_id: orgId,
    student_id: s.id,
    period,
    amount: Number(s.monthly_fee),
    due_date: input.dueDate,
    grace_deadline: graceStr,
    status: 'due',
  }));

  const { data: inserted, error } = await supabase.from('vouchers').insert(rows).select('id');
  if (error) return { ok: false, created: 0, skipped, error: error.message };

  revalidateFinance();
  return { ok: true, created: inserted?.length ?? rows.length, skipped };
}

/** Soft-delete several vouchers at once. Admin only (RLS denies Manager on finance). */
export async function bulkDeleteVouchers(ids: string[]): Promise<ActionResult> {
  const clean = (ids ?? []).filter(Boolean);
  if (clean.length === 0) return { ok: false, error: 'No vouchers selected.' };
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase
    .from('vouchers')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', clean);
  if (error) return { ok: false, error: error.message };

  revalidateFinance();
  return { ok: true };
}

/** Create a new fee voucher for a student. grace_deadline = due_date + 3 days. */
export async function createVoucher(input: {
  studentId: string;
  period: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
}): Promise<ActionResult> {
  if (!input.studentId) return { ok: false, error: 'Select a student.' };
  if (!(input.amount > 0)) return { ok: false, error: 'Enter a valid amount greater than zero.' };
  if (!input.dueDate) return { ok: false, error: 'Select a due date.' };

  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const grace = new Date(input.dueDate);
  grace.setDate(grace.getDate() + 3); // locked: 3-day grace

  // voucher_no is legacy; the strategic TZ-VCH-#### `code` is set by the DB default.
  const { error } = await supabase.from('vouchers').insert({
    org_id: orgId,
    student_id: input.studentId,
    period: input.period?.trim() || input.dueDate.slice(0, 7),
    amount: input.amount,
    due_date: input.dueDate,
    grace_deadline: grace.toISOString().slice(0, 10),
    status: 'due',
  });
  if (error) return { ok: false, error: error.message };

  revalidateFinance();
  return { ok: true };
}
