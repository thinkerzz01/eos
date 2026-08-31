// Leads - SERVER Component (real, RLS-authorized rows -> client UI).
import { getLeads } from '@/lib/data/leads';
import { LeadsClient } from './LeadsClient';

export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/auth/requireRole';

export default async function LeadsPage() {
  await requireRole(['admin', 'manager']);
  const leads = await getLeads();
  return <LeadsClient initialLeads={leads} />;
}
