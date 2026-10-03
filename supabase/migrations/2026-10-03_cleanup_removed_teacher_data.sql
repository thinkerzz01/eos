-- ============================================================================
-- 2026-10-03  Clean up data left behind by removed teachers
-- ----------------------------------------------------------------------------
-- When a teacher is soft-deleted, their enrollments (student_subjects) and
-- payout rows (teacher_payouts) were left live, so they still dangled in the
-- salary sheet (e.g. a removed teacher with recorded payouts but no earnings).
-- This soft-deletes those children for EVERY already-removed teacher, so a
-- removed teacher leaves nothing behind. Reversible (sets deleted_at only) and
-- audited by the usual triggers.
--
-- Idempotent. Paste into the Supabase SQL Editor and Run.
-- ============================================================================

BEGIN;

-- Enrollments whose teacher is removed.
UPDATE public.student_subjects ss
SET deleted_at = NOW(), updated_at = NOW()
FROM public.teachers t
WHERE ss.teacher_id = t.id
  AND t.deleted_at IS NOT NULL
  AND ss.deleted_at IS NULL;

-- Payouts whose teacher is removed.
UPDATE public.teacher_payouts tp
SET deleted_at = NOW(), updated_at = NOW()
FROM public.teachers t
WHERE tp.teacher_id = t.id
  AND t.deleted_at IS NOT NULL
  AND tp.deleted_at IS NULL;

COMMIT;
