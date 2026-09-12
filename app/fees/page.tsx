// Fees - SERVER Component. RLS auto-scopes vouchers to the viewer (admin: all;
// parent: own child). Manager is denied at the DB.
import { getFeeVouchers } from '@/lib/data/fees';
import { getPaymentInfo } from '@/lib/config/paymentInfo';
import { FeesClient } from './FeesClient';

export const dynamic = 'force-dynamic';

export default async function FeesPage() {
  // Students need the academy's bank/wallet details to pay, shown on the voucher.
  const [vouchers, paymentInfo] = await Promise.all([getFeeVouchers(), getPaymentInfo()]);
  return <FeesClient initialVouchers={vouchers} paymentInfo={paymentInfo} />;
}
