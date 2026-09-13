import 'server-only';

// Academy payment details for fee vouchers. Editable from the Settings page
// (stored on the per-org `settings` row); falls back to env vars when unset, and
// falls back gracefully if the bank columns have not been migrated yet. Returns
// null if nothing is configured (the UI then hides the "how to pay" panel).
//
// Shown on the fees/vouchers pages, so the read is cached (payment details change
// rarely) and busted on save via the 'org-config' tag. Read with the cookie-free
// service-role client so it is safe inside unstable_cache; these details are shown
// to students anyway (so they can pay), so this exposes nothing new.
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export interface PaymentInfo {
  bankTitle?: string;
  bankAccountNo?: string;
  bankIban?: string;
  wallet?: string;
}

const loadPaymentInfo = unstable_cache(
  async (): Promise<PaymentInfo | null> => {
    let bankTitle: string | undefined;
    let bankAccountNo: string | undefined;
    let bankIban: string | undefined;
    let wallet: string | undefined;

    // Prefer DB values (admin-editable). Wrapped so a missing-column error (pre
    // migration) or missing service-role key simply falls through to env values.
    try {
      const admin = createAdminClient();
      const { data } = await admin
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
      /* columns not present yet / no service role - use env */
    }

    bankTitle = bankTitle ?? process.env.BANK_NAME_TITLE?.trim() ?? undefined;
    bankAccountNo = bankAccountNo ?? process.env.BANK_ACCOUNT_NO?.trim() ?? undefined;
    bankIban = bankIban ?? process.env.BANK_ACCOUNT_IBAN?.trim() ?? undefined;
    wallet = wallet ?? process.env.MOBILE_WALLET_INFO?.trim() ?? undefined;

    if (!bankTitle && !bankAccountNo && !bankIban && !wallet) return null;
    return { bankTitle, bankAccountNo, bankIban, wallet };
  },
  ['payment-info'],
  { revalidate: 3600, tags: ['org-config'] }
);

export async function getPaymentInfo(): Promise<PaymentInfo | null> {
  return loadPaymentInfo();
}
