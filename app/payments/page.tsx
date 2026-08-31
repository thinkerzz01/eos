// Payments - SERVER Component (Admin-only finance; RLS-authorized rows).
import { getPayments } from '@/lib/data/payments';
import { PaymentsClient } from './PaymentsClient';

export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/auth/requireRole';

export default async function PaymentsPage() {
  await requireRole(['admin']);
  const payments = await getPayments();
  return <PaymentsClient initialPayments={payments} />;
}
