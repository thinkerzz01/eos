// Vouchers — SERVER Component (Admin-only finance; RLS-authorized rows).
import { getVouchers } from '@/lib/data/vouchers';
import { getPayments } from '@/lib/data/payments';
import { getStudents } from '@/lib/data/students';
import { VouchersClient } from './VouchersClient';

export const dynamic = 'force-dynamic';

export default async function VouchersPage() {
  const [vouchers, payments, students] = await Promise.all([
    getVouchers(),
    getPayments(),
    getStudents(),
  ]);
  // Lightweight list for the "Create Voucher" student picker.
  const studentOptions = students.map((s) => ({ id: s.id, name: s.name }));
  return (
    <VouchersClient
      initialVouchers={vouchers}
      initialPayments={payments}
      students={studentOptions}
    />
  );
}
