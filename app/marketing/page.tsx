import { getMarketingData } from '@/lib/data/marketing';
import { MarketingClient } from './MarketingClient';

export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  const data = await getMarketingData();
  return <MarketingClient data={data} />;
}
