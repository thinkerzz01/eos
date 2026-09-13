-- Teacher SALARY model (replaces the per-class rate model on Teacher Payouts).
-- A teacher's pay is a fixed monthly salary per student/subject enrollment, with
-- a missed-class deduction and a first-month 25% commission. These columns hold
-- the per-enrollment inputs; everything else is derived (see lib/config/payroll.ts).

alter table public.student_subjects
  add column if not exists monthly_salary numeric(10,2),          -- agreed salary for this teacher+subject
  add column if not exists weekly_days int,                        -- 3 / 4 / 5 (→ 13 / 17 / 22 classes)
  add column if not exists salary_start_month text;                -- 'YYYY-MM' first paid month (25% commission month); null = use created_at month

-- Guard the schedule values (skip if the constraint already exists).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'student_subjects_weekly_days_chk'
  ) then
    alter table public.student_subjects
      add constraint student_subjects_weekly_days_chk
      check (weekly_days is null or weekly_days in (3, 4, 5));
  end if;
end $$;
