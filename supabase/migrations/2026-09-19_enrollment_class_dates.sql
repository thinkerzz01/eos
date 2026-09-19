-- ============================================================================
-- 2026-09-19  Exact class start / end dates on the teacher salary enrollment
-- ----------------------------------------------------------------------------
-- The teacher salary is one row per student_subjects enrollment. It only had a
-- coarse `salary_start_month` (YYYY-MM). This adds the exact class start and end
-- dates so pay is anchored to real dates: the 25% first-month commission falls in
-- the month of class_start_date, and salary stops after class_end_date (blank =
-- open-ended). Mirrors the student billing_start_date / billing_end_date model.
--
-- Idempotent. Paste into the Supabase SQL Editor and Run.
-- ============================================================================

alter table public.student_subjects
  add column if not exists class_start_date date,   -- first class / salary start
  add column if not exists class_end_date date;     -- last class; salary stops after this (null = open-ended)

-- Backfill the start date from the existing salary_start_month (first of that
-- month) where we have it, so existing enrollments keep their commission month.
update public.student_subjects
  set class_start_date = to_date(salary_start_month || '-01', 'YYYY-MM-DD')
  where class_start_date is null
    and salary_start_month is not null
    and salary_start_month ~ '^\d{4}-\d{2}$';

-- Verify:
-- SELECT id, monthly_salary, salary_start_month, class_start_date, class_end_date
-- FROM public.student_subjects ORDER BY created_at DESC LIMIT 20;
