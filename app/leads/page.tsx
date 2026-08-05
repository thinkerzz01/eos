// Leads — SERVER Component (real, RLS-authorized rows -> client UI).
import { getLeads } from '@/lib/data/leads';
import { LeadsClient } from './LeadsClient';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const leads = await getLeads();
  return <LeadsClient initialLeads={leads} />;
}
