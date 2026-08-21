// Marketing / source-performance data-access (RLS-enforced, server-only).
// Master Plan §9/§11: source performance (Google first) + cost-per-student
// (blank until ad spend is recorded). Binds leads.source + ad_spend.
import { createClient } from '@/lib/supabase/server';

const SOURCE_ORDER = ['google', 'facebook', 'instagram', 'whatsapp', 'referral', 'walk_in'];
const SOURCE_LABEL: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  walk_in: 'Walk-in',
};

export interface SourceStat {
  key: string;
  source: string;
  leads: number;
  won: number;
  conversionPct: number;
  spend: number;
  costPerStudent: number | null; // null = blank until ads (no spend recorded)
}

export const MARKETING_SOURCE_ORDER = SOURCE_ORDER;
export const MARKETING_SOURCE_LABEL = SOURCE_LABEL;

export interface MarketingRawLead {
  source: string; // normalized key (google, facebook, ...)
  status: string; // lead status (won = converted)
  createdISO: string;
}
export interface MarketingData {
  leads: MarketingRawLead[];
  spend: { key: string; amount: number }[];
}

/**
 * Raw marketing rows for CLIENT-side filtering (date range / source / conversion).
 * The Marketing tab recomputes the source table from these so the filters are live.
 */
export async function getMarketingData(): Promise<MarketingData> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { leads: [], spend: [] };

  const [leadsRes, spendRes] = await Promise.all([
    supabase.from('leads').select('source,status,created_at').is('deleted_at', null),
    supabase.from('ad_spend').select('channel,amount').is('deleted_at', null),
  ]);

  const leads: MarketingRawLead[] = (leadsRes.data ?? []).map((l: any) => ({
    source: (l.source as string) ?? 'google',
    status: (l.status as string) ?? 'new',
    createdISO: l.created_at as string,
  }));

  const spendMap = new Map<string, number>();
  for (const s of spendRes.data ?? []) {
    const k = String((s as any).channel ?? '').toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
    spendMap.set(k, (spendMap.get(k) ?? 0) + Number((s as any).amount || 0));
  }
  const spend = Array.from(spendMap.entries()).map(([key, amount]) => ({ key, amount }));

  return { leads, spend };
}

export async function getMarketingStats(): Promise<SourceStat[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const [leadsRes, spendRes] = await Promise.all([
    supabase.from('leads').select('source,status').is('deleted_at', null),
    supabase.from('ad_spend').select('channel,amount').is('deleted_at', null),
  ]);

  const leadCount = new Map<string, { leads: number; won: number }>();
  for (const l of leadsRes.data ?? []) {
    const k = ((l as any).source as string) ?? 'google';
    const e = leadCount.get(k) ?? { leads: 0, won: 0 };
    e.leads++;
    if ((l as any).status === 'won') e.won++;
    leadCount.set(k, e);
  }

  const spendByChannel = new Map<string, number>();
  for (const s of spendRes.data ?? []) {
    const k = String((s as any).channel ?? '')
      .toLowerCase()
      .replace(/[^a-z]+/g, '_')
      .replace(/^_|_$/g, '');
    spendByChannel.set(k, (spendByChannel.get(k) ?? 0) + Number((s as any).amount || 0));
  }

  return SOURCE_ORDER.map((k) => {
    const c = leadCount.get(k) ?? { leads: 0, won: 0 };
    const spend = spendByChannel.get(k) ?? 0;
    return {
      key: k,
      source: SOURCE_LABEL[k] ?? k,
      leads: c.leads,
      won: c.won,
      conversionPct: c.leads > 0 ? Math.round((c.won / c.leads) * 100) : 0,
      spend,
      costPerStudent: spend > 0 && c.won > 0 ? Math.round(spend / c.won) : null,
    };
  });
}
