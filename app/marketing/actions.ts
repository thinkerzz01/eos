'use server';

// Marketing write actions. Records ad spend per channel/month so the source table
// can compute real cost-per-student / ROI (previously there was no way to enter
// spend, so those columns were always blank). RLS gives admin + manager FOR ALL
// on ad_spend; everyone else is denied at the DB.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Channels line up with the lead `source` keys so spend joins to leads.
export const AD_CHANNELS = ['google', 'facebook', 'instagram', 'whatsapp', 'referral', 'walk_in'] as const;

export async function recordAdSpend(input: {
  channel: string;
  amount: string | number;
  period: string; // YYYY-MM-DD (any day in the month)
}): Promise<ActionResult> {
  const channel = (input.channel ?? '').toLowerCase().trim();
  if (!AD_CHANNELS.includes(channel as any)) return { ok: false, error: 'Pick a valid channel.' };
  const amount = typeof input.amount === 'number' ? input.amount : parseFloat(input.amount);
  if (Number.isNaN(amount) || amount < 0) return { ok: false, error: 'Enter a valid amount.' };
  if (!input.period) return { ok: false, error: 'Pick the month the spend is for.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return { ok: false, error: 'Only an admin or manager can record ad spend.' };
  }

  const { error } = await supabase.from('ad_spend').insert({
    org_id: profile.org_id,
    channel,
    amount,
    period: input.period,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/marketing');
  return { ok: true };
}
