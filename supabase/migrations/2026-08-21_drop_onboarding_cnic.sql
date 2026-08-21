-- ============================================================================
-- Remove CNIC / B-Form from onboarding data (not needed by the academy).
-- CNIC was never a column - it only ever lived as a key inside the
-- students.onboarding_data JSON blob. This strips that key from any existing
-- rows. The app no longer reads or displays it. Idempotent. Run in SQL Editor.
-- ============================================================================
UPDATE public.students
SET onboarding_data = onboarding_data - 'cnic' - 'b_form' - 'cnicBform' - 'bform'
WHERE onboarding_data IS NOT NULL
  AND (onboarding_data ? 'cnic'
    OR onboarding_data ? 'b_form'
    OR onboarding_data ? 'cnicBform'
    OR onboarding_data ? 'bform');

-- Verify (should return 0):
-- SELECT count(*) FROM public.students
--   WHERE onboarding_data ? 'cnic' OR onboarding_data ? 'b_form';
