-- ============================================================================
-- 2026-10-03  De-dupe vouchers + enforce one voucher per student per period
-- ----------------------------------------------------------------------------
-- The "one voucher per student per period" rule lived only in app code, and only
-- in TWO of the three creation paths (the billing cron and "Generate This Month").
-- The "Create Voucher" button (and any ad-hoc SQL / test script) had no guard, and
-- the table had no uniqueness backstop (only voucher_no / code are unique). So one
-- student accumulated ~1000 identical vouchers for the same period, inflating the
-- dashboard Outstanding/Overdue totals and the Fee Vouchers list.
--
-- This migration:
--   1. Soft-deletes duplicate vouchers, keeping ONE row per (student_id, period).
--      It keeps the "most real" row: any row that has payments, else a paid row,
--      else the oldest. It NEVER soft-deletes a voucher that has a live payment.
--   2. Verifies no (student_id, period) still has >1 live voucher (would mean two
--      copies both carry payments) - if so it aborts so nothing is applied and the
--      owner can resolve those by hand.
--   3. Adds a partial UNIQUE index so duplicates can never be inserted again.
--
-- Idempotent (safe to re-run). Atomic. Paste into the Supabase SQL Editor and Run.
-- ============================================================================

BEGIN;

-- 1. Soft-delete duplicates, keeping one live row per (student_id, period).
WITH ranked AS (
  SELECT
    v.id,
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.voucher_id = v.id AND p.deleted_at IS NULL
    ) AS has_payment,
    row_number() OVER (
      PARTITION BY v.student_id, v.period
      ORDER BY
        EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.voucher_id = v.id AND p.deleted_at IS NULL
        ) DESC,                     -- keep a row that has payments
        (v.status = 'paid') DESC,   -- then a paid row
        v.created_at ASC,           -- then the oldest
        v.id ASC                    -- deterministic tie-break
    ) AS rn
  FROM public.vouchers v
  WHERE v.deleted_at IS NULL
)
UPDATE public.vouchers v
SET deleted_at = NOW(), updated_at = NOW()
FROM ranked r
WHERE v.id = r.id
  AND r.rn > 1
  AND r.has_payment = false;        -- safety: never soft-delete a voucher with payments

-- 2. Abort if any (student_id, period) still has more than one live voucher
--    (only possible if two copies both carried payments - resolve by hand first).
DO $$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining FROM (
    SELECT student_id, period
    FROM public.vouchers
    WHERE deleted_at IS NULL
    GROUP BY student_id, period
    HAVING count(*) > 1
  ) t;
  IF remaining > 0 THEN
    RAISE EXCEPTION
      'Aborting: % student+period group(s) still have multiple live vouchers with payments on more than one copy. Resolve these manually, then re-run.', remaining;
  END IF;
END $$;

-- 3. Backstop: one live voucher per student per period, forever.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vouchers_student_period
  ON public.vouchers(student_id, period)
  WHERE deleted_at IS NULL;

COMMIT;
