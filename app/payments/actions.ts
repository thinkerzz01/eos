'use server';

// Receipt (payment) write actions - Admin only (RLS denies Manager on finance).
// Editing/deleting a receipt is allowed for the admin, but the voucher's paid
// total is DERIVED from the sum of its non-deleted payments, so both stay in sync.
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
}

async function adminCtx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const, error: 'You are not signed in.' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (profile?.role !== 'admin') return { supabase, ok: false as const, error: 'Only an admin can change receipts.' };
  return { supabase, ok: true as const };
}

/** Edit a receipt's amount / method / reference. */
export async function updatePayment(input: {
  paymentId: string;
  amount?: number;
  method?: string;
  reference?: string;
}): Promise<ActionResult> {
  if (!input.paymentId) return { ok: false, error: 'Missing receipt id.' };
  const ctx = await adminCtx();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patch: Record<string, any> = {};
  if (input.amount != null && !Number.isNaN(input.amount)) patch.amount = input.amount;
  if (input.method) patch.method = METHOD_DB[input.method] ?? 'bank_transfer';
  if (input.reference !== undefined) patch.reference = input.reference.trim() || null;
  if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to update.' };

  const { error } = await ctx.supabase.from('payments').update(patch).eq('id', input.paymentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/payments');
  revalidatePath('/vouchers');
  revalidatePath('/');
  return { ok: true };
}

/** Soft-delete a receipt. The linked voucher's paid total drops accordingly. */
export async function deletePayment(paymentId: string): Promise<ActionResult> {
  if (!paymentId) return { ok: false, error: 'Missing receipt id.' };
  const ctx = await adminCtx();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from('payments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', paymentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/payments');
  revalidatePath('/vouchers');
  revalidatePath('/');
  return { ok: true };
}
