-- ============================================================================
-- 2026-09-19  Billing modes (monthly vs upfront) + session capture on leads
-- ----------------------------------------------------------------------------
-- Adds a per-student billing plan so the system supports:
--   * monthly students  (billing_mode = 'monthly') - one voucher per month, auto
--     generated a few days before each due date, until billing_end_date.
--   * upfront / crash-course students (billing_mode = 'upfront') - one paid
--     voucher for the whole block, NO monthly vouchers, NO fee reminders until the
--     block ends.
-- billing_end_date is the hard stop (the exam session end). billing_start_date is
-- the enrolment start. Existing students default to 'monthly' with blank dates, so
-- nothing about their current behaviour changes.
--
-- Also adds leads.exam_session so the session can be captured at demo/booking time
-- and carried into enrolment.
--
-- Idempotent: every ADD COLUMN is IF NOT EXISTS. Paste into the Supabase SQL
-- Editor and Run.
-- ============================================================================

-- Students: the billing plan --------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_mode IN ('monthly', 'upfront'));

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS billing_start_date DATE;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS billing_end_date DATE;

-- Leads: capture the exam session at booking/demo time ------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS exam_session TEXT;

-- Verify:
-- SELECT id, name, billing_mode, billing_start_date, billing_end_date, next_due_date
-- FROM public.students ORDER BY created_at DESC LIMIT 20;
