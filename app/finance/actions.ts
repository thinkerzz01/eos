'use server';

// Expense write actions for the Finance / Revenue tab (Admin only - RLS denies
// everyone else on the expenses table).
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { friendlyDbError } from '@/lib/friendlyError';

export interface ExpenseResult {
  ok: boolean;
  error?: string;
}

export const EXPENSE_CATEGORIES = ['Rent', 'Ads', 'Utilities', 'Software', 'Salaries (other)', 'Equipment', 'Misc'] as const;

async function ctx() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null as string | null, role: null as string | null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  return { supabase, user, orgId: (profile?.org_id as string) ?? null, role: (profile?.role as string) ?? null };
}

/** Record a business expense (rent, ads, etc.). Admin only. */
export async function addExpense(input: {
  category: string;
  amount: number;
  spentOn: string; // YYYY-MM-DD
  note?: string;
}): Promise<ExpenseResult> {
  if (!input.category?.trim()) return { ok: false, error: 'Pick a category.' };
  if (!(input.amount > 0)) return { ok: false, error: 'Enter a valid amount greater than zero.' };
  if (!input.spentOn || !/^\d{4}-\d{2}-\d{2}$/.test(input.spentOn)) return { ok: false, error: 'Enter a valid date.' };

  const { supabase, user, orgId, role } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };
  if (role !== 'admin') return { ok: false, error: 'Only an admin can record expenses.' };

  const { error } = await supabase.from('expenses').insert({
    org_id: orgId,
    category: input.category.trim(),
    amount: input.amount,
    spent_on: input.spentOn,
    note: input.note?.trim() || null,
    created_by: user.id,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/finance');
  revalidatePath('/');
  return { ok: true };
}

/** Soft-delete an expense. Admin only. */
export async function deleteExpense(id: string): Promise<ExpenseResult> {
  if (!id) return { ok: false, error: 'Missing expense id.' };
  const { supabase, user, orgId, role } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };
  if (role !== 'admin') return { ok: false, error: 'Only an admin can delete expenses.' };

  const { error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/finance');
  return { ok: true };
}
