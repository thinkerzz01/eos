-- ============================================================================
-- 2026-10-03  Fix Maaz/Bilal enrollment class end date
-- ----------------------------------------------------------------------------
-- The enrollment (MAAZ BIN RAZI teaching Bilal Usman) had class_end_date equal to
-- class_start_date (both 2026-09-06), which under the per-cycle salary model means
-- zero payable cycles - yet the teacher was paid for one month. Owner confirms the
-- class runs 06 Sep 2026 -> 06 Oct 2026 (one cycle). Set the end date accordingly.
-- class_end_date is EXCLUSIVE (a cycle starting on/after it is not paid), so
-- 06 Oct 2026 yields exactly one cycle (06 Sep), matching the 10,500 already paid.
--
-- Idempotent. Paste into the Supabase SQL Editor and Run.
-- ============================================================================

UPDATE public.student_subjects ss
SET class_end_date = DATE '2026-10-06',
    salary_start_month = '2026-09',
    updated_at = NOW()
FROM public.teachers t, public.students s
WHERE ss.teacher_id = t.id
  AND ss.student_id = s.id
  AND t.name = 'MAAZ BIN RAZI'
  AND s.name = 'Bilal Usman'
  AND ss.deleted_at IS NULL;
