import { getMarketingStats } from '@/lib/data/marketing';
import { MarketingClient } from './MarketingClient';

export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  const stats = await getMarketingStats();
  return <MarketingClient initialStats={stats} />;
}
