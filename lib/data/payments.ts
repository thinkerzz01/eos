// Payments data-access - RLS-enforced, server-only. Admin-only.
// A refund is a NEGATIVE-amount payment linked to the original voucher.
import { createClient } from '@/lib/supabase/server';
import type { PaymentTransaction } from '@/lib/mockFinanceData';

const METHOD_UI: Record<string, PaymentTransaction['paymentMethod']> = {
  bank_transfer: 'Bank Transfer',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  cash: 'Cash',
  other: 'Cheque',
};

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

function mapRow(r: any): PaymentTransaction {
  const voucher = one<any>(r.vouchers);
  const student = one<any>(voucher?.students);
  const amount = Number(r.amount || 0);
  return {
    id: r.id,
    receiptNo: `RCP-${String(r.id).split('-')[0].toUpperCase()}`,
    voucherId: r.voucher_id,
    studentName: student?.name ?? '',
    amount,
    paymentDate: r.at,
    paymentMethod: METHOD_UI[r.method as string] ?? 'Bank Transfer',
    type: amount < 0 ? 'Refund' : 'Payment',
    reason: r.reference ?? '',
    auditedBy: r.reconciled_by ?? '',
  };
}

export async function getPayments(): Promise<PaymentTransaction[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('payments')
    .select('id,voucher_id,amount,method,reference,reconciled_by,at,vouchers(voucher_no,students(name))')
    .is('deleted_at', null)
    .order('at', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
