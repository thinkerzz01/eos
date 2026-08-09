// Payments - SERVER Component (Admin-only finance; RLS-authorized rows).
import { getPayments } from '@/lib/data/payments';
import { PaymentsClient } from './PaymentsClient';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const payments = await getPayments();
  return <PaymentsClient initialPayments={payments} />;
}
