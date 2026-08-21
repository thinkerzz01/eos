// Fees - SERVER Component. RLS auto-scopes vouchers to the viewer (admin: all;
// parent: own child). Manager is denied at the DB.
import { getFeeVouchers } from '@/lib/data/fees';
import { getPaymentInfo } from '@/lib/config/paymentInfo';
import { FeesClient } from './FeesClient';

export const dynamic = 'force-dynamic';

export default async function FeesPage() {
  const vouchers = await getFeeVouchers();
  const paymentInfo = await getPaymentInfo();
  return <FeesClient initialVouchers={vouchers} paymentInfo={paymentInfo} />;
}
