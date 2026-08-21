import 'server-only';

// Academy payment details for fee vouchers. Editable from the Settings page
// (stored on the per-org `settings` row); falls back to env vars when unset, and
// falls back gracefully if the bank columns have not been migrated yet. Returns
// null if nothing is configured (the UI then hides the "how to pay" panel).
import { createClient } from '@/lib/supabase/server';

export interface PaymentInfo {
  bankTitle?: string;
  bankAccountNo?: string;
  bankIban?: string;
  wallet?: string;
}

export async function getPaymentInfo(): Promise<PaymentInfo | null> {
  let bankTitle: string | undefined;
  let bankAccountNo: string | undefined;
  let bankIban: string | undefined;
  let wallet: string | undefined;

  // Prefer DB values (admin-editable). Wrapped so a missing-column error (pre
  // migration) simply falls through to the env values below.
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('settings')
      .select('bank_title,bank_account_no,bank_iban,wallet_info')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    bankTitle = (data as any)?.bank_title?.trim() || undefined;
    bankAccountNo = (data as any)?.bank_account_no?.trim() || undefined;
    bankIban = (data as any)?.bank_iban?.trim() || undefined;
    wallet = (data as any)?.wallet_info?.trim() || undefined;
  } catch {
    /* columns not present yet - use env */
  }

  bankTitle = bankTitle ?? process.env.BANK_NAME_TITLE?.trim() ?? undefined;
  bankAccountNo = bankAccountNo ?? process.env.BANK_ACCOUNT_NO?.trim() ?? undefined;
  bankIban = bankIban ?? process.env.BANK_ACCOUNT_IBAN?.trim() ?? undefined;
  wallet = wallet ?? process.env.MOBILE_WALLET_INFO?.trim() ?? undefined;

  if (!bankTitle && !bankAccountNo && !bankIban && !wallet) return null;
  return { bankTitle, bankAccountNo, bankIban, wallet };
}
