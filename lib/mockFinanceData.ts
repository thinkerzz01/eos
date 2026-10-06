// Central Finance Store for Phase 5 (Vouchers, Payments, Partial Payments, Refunds & Fee Decisions)

export interface FeeVoucher {
  id: string;
  voucherNo: string;
  studentId: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  program: string;
  dueDate: string; // Anchored to enrolment day
  graceDeadlineDate: string; // 3 days after due date
  totalAmount: number; // Flexible manual PKR value
  paidAmount: number;
  runningBalance: number;
  status: 'Paid' | 'Due' | 'In Grace' | 'Stopped';
  needsAdminDecision?: boolean; // true if grace period expired without payment
  period?: string;      // voucher period (e.g. "2026-09" or "September 2026") - for the billing-cycle label
  enrolledAt?: string | null; // student's enrolment day - anchors the cycle start/end
  subjects?: string;    // enrolled subject names, comma-joined (e.g. "Physics, Chemistry")
}

export interface PaymentTransaction {
  id: string;
  receiptNo: string;
  voucherId: string;
  studentName: string;
  studentPhone?: string;
  amount: number; // Positive for payment, NEGATIVE for refund!
  paymentDate: string;
  paymentMethod: 'Bank Transfer' | 'Cash' | 'JazzCash' | 'Easypaisa' | 'Cheque';
  type: 'Payment' | 'Partial Payment' | 'Refund';
  reason?: string;
  auditedBy: string;
}


// Dummy data removed. Populate via the app / real database.
export const MOCK_VOUCHERS: FeeVoucher[] = [];
export const MOCK_PAYMENTS: PaymentTransaction[] = [];
