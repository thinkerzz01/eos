-- Editable academy bank / payment details, stored on the per-org settings row so
-- an Admin can change them from the Settings page (previously env-only). The
-- voucher "How to pay" panel reads these (falling back to env if unset).
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS bank_title TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_no TEXT,
  ADD COLUMN IF NOT EXISTS bank_iban TEXT,
  ADD COLUMN IF NOT EXISTS wallet_info TEXT;
