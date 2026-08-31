import { getMarketingData } from '@/lib/data/marketing';
import { MarketingClient } from './MarketingClient';

export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/auth/requireRole';

export default async function MarketingPage() {
  await requireRole(['admin', 'manager']);
  const data = await getMarketingData();
  return <MarketingClient data={data} />;
}
