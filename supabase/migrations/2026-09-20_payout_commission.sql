-- Per-enrollment control over the 25% first-month commission.
-- When false, the teacher gets the FULL salary even in the first month (no 25%
-- deduction). Defaults true so existing behaviour is unchanged.
ALTER TABLE public.student_subjects
  ADD COLUMN IF NOT EXISTS apply_commission boolean NOT NULL DEFAULT true;
