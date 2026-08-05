'use server';

// Finance write actions (Admin only — RLS denies Manager on every finance table).
// Runs server-side with the user's session; Postgres RLS enforces permission.
// Locked policy (AGENTS.md §4): partial payment keeps the voucher Due with a
// running balance; a refund is a NEGATIVE payment linked to the voucher (the
// original payment is never edited/deleted); grace expiry never auto-stops —
// the Admin decides (Stop / Extend / Mark paid), and every choice is audited.
// The health engine and the fee badge both read students.fee_status, so we keep
// it in sync here.
import { createClient } from '@/lib/supabase/server';
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
    .select('id,amount,student_id,status')
    .eq('id', input.voucherId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!voucher) return { ok: false, error: 'Voucher not found.' };

  const { error: payErr } = await supabase.from('payments').insert({
    org_id: orgId,
    voucher_id: input.voucherId,
    amount: input.amount,
    method: METHOD_DB[input.method] ?? 'other',
    reference: input.reference?.trim() || null,
    reconciled_by: user.id,
  });
  if (payErr) return { ok: false, error: payErr.message };

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

/** Admin grace decision: Stop / Extend / Mark Paid — audited to fee_decisions. */
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

  const yymm = input.dueDate.slice(0, 7).replace('-', '');
  const voucherNo = `VCH-${yymm}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { error } = await supabase.from('vouchers').insert({
    org_id: orgId,
    student_id: input.studentId,
    voucher_no: voucherNo,
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
