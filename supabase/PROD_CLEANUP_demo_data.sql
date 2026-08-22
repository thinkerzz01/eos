-- ============================================================================
-- PROD_CLEANUP_demo_data.sql
--
-- Removes any demo/test rows that a dev seed (seed_students.sql,
-- seed_voucher.sql, seed_roles.sql) may have inserted, so nothing fake shows to
-- real users after go-live.
--
-- It targets ONLY known demo markers:
--   * students whose email ends in "@example.com"  (the seeded demo students)
--   * the three test logins manager@/teacher@/student@thinkerzz.com
-- Your real admin (admin@thinkerzz.com), org, and subjects are NOT touched.
--
-- SAFETY:
--   * Run STEP 1 first — it only COUNTS what would be removed. If every count
--     is 0, your prod DB is already clean; do not run STEP 2.
--   * STEP 2 is wrapped in a single transaction: if anything errors, the whole
--     thing rolls back and nothing is deleted.
--   * Deletes are hard deletes of throwaway demo rows — intended for a fresh
--     production database only. Do NOT run against a DB with real data you
--     have not first inspected.
-- ============================================================================


-- ── STEP 1 — INSPECT (safe, read-only). Run this alone first. ──────────────
SELECT 'demo students (@example.com)' AS what, count(*) FROM public.students WHERE email ILIKE '%@example.com'
UNION ALL SELECT 'test-login profiles', count(*) FROM public.profiles WHERE email IN ('manager@thinkerzz.com','teacher@thinkerzz.com','student@thinkerzz.com')
UNION ALL SELECT 'test teachers', count(*) FROM public.teachers WHERE email IN ('teacher@thinkerzz.com')
UNION ALL SELECT 'test students', count(*) FROM public.students WHERE email IN ('student@thinkerzz.com');


-- ── STEP 2 — PURGE (destructive). Run ONLY if STEP 1 found demo rows. ──────
-- Uncomment the block below (select it and remove the leading "-- ") to run.
/*
BEGIN;

-- All student ids considered "demo": @example.com seeds + the test student.
CREATE TEMP TABLE _demo_students ON COMMIT DROP AS
  SELECT id FROM public.students
  WHERE email ILIKE '%@example.com' OR email = 'student@thinkerzz.com';

-- Voucher ids belonging to those students (needed to clear voucher children).
CREATE TEMP TABLE _demo_vouchers ON COMMIT DROP AS
  SELECT id FROM public.vouchers WHERE student_id IN (SELECT id FROM _demo_students);

-- 1. Finance children (reference vouchers).
DELETE FROM public.refunds        WHERE voucher_id IN (SELECT id FROM _demo_vouchers);
DELETE FROM public.fee_decisions  WHERE voucher_id IN (SELECT id FROM _demo_vouchers);
DELETE FROM public.payments       WHERE voucher_id IN (SELECT id FROM _demo_vouchers);
DELETE FROM public.voucher_lines  WHERE voucher_id IN (SELECT id FROM _demo_vouchers);
DELETE FROM public.vouchers       WHERE id         IN (SELECT id FROM _demo_vouchers);

-- 2. Academic / activity children (reference students).
DELETE FROM public.attendance         WHERE student_id IN (SELECT id FROM _demo_students);
DELETE FROM public.class_notes        WHERE session_id IN (SELECT id FROM public.class_sessions WHERE student_id IN (SELECT id FROM _demo_students));
DELETE FROM public.class_sessions     WHERE student_id IN (SELECT id FROM _demo_students);
DELETE FROM public.homework           WHERE student_id IN (SELECT id FROM _demo_students);
DELETE FROM public.tests              WHERE student_id IN (SELECT id FROM _demo_students);
DELETE FROM public.syllabus_progress  WHERE student_id IN (SELECT id FROM _demo_students);
DELETE FROM public.documents          WHERE student_id IN (SELECT id FROM _demo_students);
DELETE FROM public.announcement_targets WHERE student_id IN (SELECT id FROM _demo_students);
DELETE FROM public.referrals          WHERE referrer_student_id IN (SELECT id FROM _demo_students);
DELETE FROM public.student_subjects   WHERE student_id IN (SELECT id FROM _demo_students);

-- 3. The students themselves.
DELETE FROM public.students WHERE id IN (SELECT id FROM _demo_students);

-- 4. Test-login profiles + their backing teacher rows (NOT the real admin).
DELETE FROM public.profiles WHERE email IN ('manager@thinkerzz.com','teacher@thinkerzz.com','student@thinkerzz.com');
DELETE FROM public.teachers WHERE email = 'teacher@thinkerzz.com';

COMMIT;
*/
-- After COMMIT, the matching auth users (manager@/teacher@/student@thinkerzz.com)
-- can be deleted from the Supabase dashboard: Authentication → Users.
