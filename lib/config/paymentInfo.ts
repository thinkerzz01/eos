import 'server-only';

// Academy payment details for fee vouchers, read from env (single-tenant). These
// are the SAME for every student, so a server component reads them once and passes
// them to the voucher UI. Returns null if none are configured (the UI then hides
// the "how to pay" panel rather than showing an empty box).
export interface PaymentInfo {
  bankTitle?: string;
  bankAccountNo?: string;
  bankIban?: string;
  wallet?: string;
}

export function getPaymentInfo(): PaymentInfo | null {
  const bankTitle = process.env.BANK_NAME_TITLE?.trim();
  const bankAccountNo = process.env.BANK_ACCOUNT_NO?.trim();
  const bankIban = process.env.BANK_ACCOUNT_IBAN?.trim();
  const wallet = process.env.MOBILE_WALLET_INFO?.trim();
  if (!bankTitle && !bankAccountNo && !bankIban && !wallet) return null;
  return { bankTitle, bankAccountNo, bankIban, wallet };
}
