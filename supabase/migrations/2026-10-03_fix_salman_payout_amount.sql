-- ============================================================================
-- 2026-10-03  Correct Muhammad Salman's first payout to the commission-adjusted
--             amount
-- ----------------------------------------------------------------------------
-- The 25% first-month commission applies to Salman's cycle, so his earning is
-- 12,750 (17,000 - 25%). His payout was recorded as the full 17,000, leaving a
-- 4,250 "overpaid". Owner confirms the commission is correct, so the recorded
-- payout value is corrected to 12,750. After this: earned 12,750 = paid 12,750
-- (settled).
--
-- NOTE: run this ONLY if the 17,000 was a mis-entry. If 17,000 was actually
-- transferred to Salman, do NOT run this - instead record a 4,250 "Refund from
-- Teacher" in the UI so the cash out stays accurate.
--
-- Idempotent (only touches the 17,000 row). Paste into the Supabase SQL Editor.
-- ============================================================================

UPDATE public.teacher_payouts tp
SET amount = 12750, updated_at = NOW()
FROM public.teachers t
WHERE tp.teacher_id = t.id
  AND t.name = 'Muhammad Salman'
  AND tp.amount = 17000
  AND tp.deleted_at IS NULL;
