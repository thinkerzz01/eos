-- ============================================================================
-- Thinkerzz EOS - STRATEGIC HUMAN-READABLE CODES
-- ----------------------------------------------------------------------------
-- Adds a sequential `code` to each record (TZ-STU-0001, TZ-TCH-0001, ...) driven
-- by a Postgres sequence, so IDs count up in order instead of being random. The
-- hidden UUID stays as the internal key. Backfills existing rows in creation order.
-- Idempotent-ish: safe to run once on the live DB. (schema.sql includes this too.)
-- Paste the whole file into the Supabase SQL Editor and Run.
-- ============================================================================

-- Each table is done explicitly (clear and easy to audit). Safe to re-run: the
-- column add is IF NOT EXISTS and the backfill only touches rows whose code IS NULL.

-- students -> TZ-STU-0001
CREATE SEQUENCE IF NOT EXISTS students_code_seq;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS code TEXT;
WITH ordered AS (SELECT id, row_number() OVER (ORDER BY created_at, id) rn FROM public.students WHERE code IS NULL)
UPDATE public.students s SET code = 'TZ-STU-' || to_char(o.rn, 'FM0000') FROM ordered o WHERE s.id = o.id;
SELECT setval('students_code_seq', GREATEST((SELECT COUNT(*) FROM public.students), 1), (SELECT COUNT(*) FROM public.students) > 0);
ALTER TABLE public.students ALTER COLUMN code SET DEFAULT ('TZ-STU-' || to_char(nextval('students_code_seq'), 'FM0000'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_code ON public.students(code);

-- teachers -> TZ-TCH-0001
CREATE SEQUENCE IF NOT EXISTS teachers_code_seq;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS code TEXT;
WITH ordered AS (SELECT id, row_number() OVER (ORDER BY created_at, id) rn FROM public.teachers WHERE code IS NULL)
UPDATE public.teachers s SET code = 'TZ-TCH-' || to_char(o.rn, 'FM0000') FROM ordered o WHERE s.id = o.id;
SELECT setval('teachers_code_seq', GREATEST((SELECT COUNT(*) FROM public.teachers), 1), (SELECT COUNT(*) FROM public.teachers) > 0);
ALTER TABLE public.teachers ALTER COLUMN code SET DEFAULT ('TZ-TCH-' || to_char(nextval('teachers_code_seq'), 'FM0000'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_teachers_code ON public.teachers(code);

-- leads -> TZ-LEAD-0001
CREATE SEQUENCE IF NOT EXISTS leads_code_seq;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS code TEXT;
WITH ordered AS (SELECT id, row_number() OVER (ORDER BY created_at, id) rn FROM public.leads WHERE code IS NULL)
UPDATE public.leads s SET code = 'TZ-LEAD-' || to_char(o.rn, 'FM0000') FROM ordered o WHERE s.id = o.id;
SELECT setval('leads_code_seq', GREATEST((SELECT COUNT(*) FROM public.leads), 1), (SELECT COUNT(*) FROM public.leads) > 0);
ALTER TABLE public.leads ALTER COLUMN code SET DEFAULT ('TZ-LEAD-' || to_char(nextval('leads_code_seq'), 'FM0000'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_code ON public.leads(code);

-- vouchers -> TZ-VCH-0001  (voucher_no is now optional; code is the shown id)
CREATE SEQUENCE IF NOT EXISTS vouchers_code_seq;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.vouchers ALTER COLUMN voucher_no DROP NOT NULL;
WITH ordered AS (SELECT id, row_number() OVER (ORDER BY created_at, id) rn FROM public.vouchers WHERE code IS NULL)
UPDATE public.vouchers s SET code = 'TZ-VCH-' || to_char(o.rn, 'FM0000') FROM ordered o WHERE s.id = o.id;
SELECT setval('vouchers_code_seq', GREATEST((SELECT COUNT(*) FROM public.vouchers), 1), (SELECT COUNT(*) FROM public.vouchers) > 0);
ALTER TABLE public.vouchers ALTER COLUMN code SET DEFAULT ('TZ-VCH-' || to_char(nextval('vouchers_code_seq'), 'FM0000'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_vouchers_code ON public.vouchers(code);

-- payments -> TZ-RCP-0001
CREATE SEQUENCE IF NOT EXISTS payments_code_seq;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS code TEXT;
WITH ordered AS (SELECT id, row_number() OVER (ORDER BY created_at, id) rn FROM public.payments WHERE code IS NULL)
UPDATE public.payments s SET code = 'TZ-RCP-' || to_char(o.rn, 'FM0000') FROM ordered o WHERE s.id = o.id;
SELECT setval('payments_code_seq', GREATEST((SELECT COUNT(*) FROM public.payments), 1), (SELECT COUNT(*) FROM public.payments) > 0);
ALTER TABLE public.payments ALTER COLUMN code SET DEFAULT ('TZ-RCP-' || to_char(nextval('payments_code_seq'), 'FM0000'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_code ON public.payments(code);

-- teacher_payouts -> TZ-PAY-0001
CREATE SEQUENCE IF NOT EXISTS payouts_code_seq;
ALTER TABLE public.teacher_payouts ADD COLUMN IF NOT EXISTS code TEXT;
WITH ordered AS (SELECT id, row_number() OVER (ORDER BY created_at, id) rn FROM public.teacher_payouts WHERE code IS NULL)
UPDATE public.teacher_payouts s SET code = 'TZ-PAY-' || to_char(o.rn, 'FM0000') FROM ordered o WHERE s.id = o.id;
SELECT setval('payouts_code_seq', GREATEST((SELECT COUNT(*) FROM public.teacher_payouts), 1), (SELECT COUNT(*) FROM public.teacher_payouts) > 0);
ALTER TABLE public.teacher_payouts ALTER COLUMN code SET DEFAULT ('TZ-PAY-' || to_char(nextval('payouts_code_seq'), 'FM0000'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_payouts_code ON public.teacher_payouts(code);

-- Verify:
-- SELECT code, name FROM public.students ORDER BY code;
