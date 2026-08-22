-- ============================================================================
-- 👉 RUN-ME: pending migrations to paste into the Supabase SQL Editor.
--
--   SQL Editor (new query):
--   https://supabase.com/dashboard/project/suiikarwglsjmwnfefyt/sql/new
--
-- This file is the single "what still needs running" list. Every block is
-- idempotent / safe to run more than once. After running, tick it off below.
-- Full explanations live next to each file in supabase/migrations/.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-21  Enrollment backbone (P1)
--     Lets a student be enrolled in a subject + teacher. Without this, admitting
--     a student WITH a per-subject teacher fails (the archived syllabus system
--     left a NOT NULL column blocking the insert). teacher_id stays required.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_subjects
  ALTER COLUMN syllabus_template_id DROP NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-21  In-app notifications (P2 — the TopBar bell)
--     Per-user notification inbox (separate from the outbound email queue).
--     Powers the bell dropdown + unread badge. Without it the bell just shows
--     "all caught up" (the app never breaks). Full file:
--     supabase/migrations/2026-08-21_app_notifications.sql
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user
    ON public.app_notifications (user_id, created_at DESC) WHERE deleted_at IS NULL;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_app_notifications ON public.app_notifications;
CREATE POLICY own_app_notifications ON public.app_notifications
    FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS admin_app_notifications ON public.app_notifications;
CREATE POLICY admin_app_notifications ON public.app_notifications
    FOR ALL USING (public.current_user_role() = 'admin' AND org_id = public.current_user_org_id());
DROP TRIGGER IF EXISTS trg_update_updated_at_app_notifications ON public.app_notifications;
CREATE TRIGGER trg_update_updated_at_app_notifications
    BEFORE UPDATE ON public.app_notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-21  Remove CNIC / B-Form from onboarding data (not needed)
--     CNIC was only a key inside the students.onboarding_data JSON (never a
--     column). This strips it from existing rows; the app no longer shows it.
--     Idempotent. Full file: supabase/migrations/2026-08-21_drop_onboarding_cnic.sql
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.students
SET onboarding_data = onboarding_data - 'cnic' - 'b_form' - 'cnicBform' - 'bform'
WHERE onboarding_data IS NOT NULL
  AND (onboarding_data ? 'cnic'
    OR onboarding_data ? 'b_form'
    OR onboarding_data ? 'cnicBform'
    OR onboarding_data ? 'bform');


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-21  SECURITY: homework grading lockdown (H1)
--     Students could set their own homework to graded/score=100. This makes
--     students read-only on homework and routes submission through a locked RPC
--     (status → submitted/late only). Full file:
--     supabase/migrations/2026-08-21_homework_student_lockdown.sql
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS student_access_own_homework ON public.homework;
DROP POLICY IF EXISTS student_read_own_homework ON public.homework;
CREATE POLICY student_read_own_homework ON public.homework FOR SELECT USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);
CREATE OR REPLACE FUNCTION public.student_submit_homework(p_homework_id UUID)
RETURNS TEXT AS $$
DECLARE v_deadline TIMESTAMPTZ; v_status TEXT; v_new TEXT;
BEGIN
    SELECT deadline, status INTO v_deadline, v_status
    FROM public.homework
    WHERE id = p_homework_id AND student_id = current_student_id() AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Homework not found.'; END IF;
    IF v_status = 'graded' THEN RAISE EXCEPTION 'This homework has already been graded.'; END IF;
    v_new := CASE WHEN v_deadline IS NOT NULL AND v_deadline < NOW() THEN 'late' ELSE 'submitted' END;
    UPDATE public.homework SET status = v_new, updated_at = NOW() WHERE id = p_homework_id;
    RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.student_submit_homework(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-21  SECURITY: onboarding PII lockdown (M2)
--     get_student_public stops disclosing parent name/phone/email once onboarding
--     is completed; submit_onboarding refuses re-submission after completion.
--     Full file: supabase/migrations/2026-08-21_onboarding_pii_lockdown.sql
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_student_public(UUID);
CREATE FUNCTION public.get_student_public(p_student_id UUID)
RETURNS TABLE (name TEXT, program TEXT, exam_session TEXT, parent_name TEXT, phone TEXT, email TEXT, onboarding_done BOOLEAN) AS $$
    SELECT s.name, s.program, s.exam_session,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.parent_name ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.phone ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.email ELSE NULL END,
        (s.onboarding_completed_at IS NOT NULL)
    FROM public.students s WHERE s.id = p_student_id AND s.deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_student_public(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_onboarding(
    p_student_id UUID, p_whatsapp TEXT, p_email TEXT, p_city TEXT, p_address TEXT,
    p_gender TEXT, p_dob DATE, p_data JSONB)
RETURNS UUID AS $$
DECLARE v_gender TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'This onboarding link is invalid.'; END IF;
    IF EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND onboarding_completed_at IS NOT NULL) THEN
        RAISE EXCEPTION 'This onboarding has already been completed.'; END IF;
    v_gender := CASE WHEN lower(COALESCE(p_gender,'')) IN ('male','female','other') THEN lower(p_gender) ELSE NULL END;
    UPDATE public.students SET
        whatsapp = COALESCE(NULLIF(p_whatsapp,''), whatsapp),
        email = COALESCE(NULLIF(p_email,''), email),
        city = COALESCE(NULLIF(p_city,''), city),
        address = COALESCE(NULLIF(p_address,''), address),
        gender = COALESCE(v_gender, gender),
        date_of_birth = COALESCE(p_dob, date_of_birth),
        onboarding_data = p_data, onboarding_completed_at = NOW(), updated_at = NOW()
    WHERE id = p_student_id;
    RETURN p_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.submit_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, JSONB) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-22  Settings → Typography (admin-selectable fonts)
--     Adds orgs.heading_font / orgs.body_font (font keys from lib/fonts.ts).
--     App falls back to Nunito headings + Jost body when null.
--     Full file: supabase/migrations/2026-08-22_org_typography.sql
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS heading_font TEXT,
  ADD COLUMN IF NOT EXISTS body_font TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-22  Database linter hardening (Supabase security lints)
--     Pins search_path on all 12 SECURITY DEFINER / trigger functions and
--     revokes RPC EXECUTE on the two trigger helpers. Public-form RPCs and the
--     current_* RLS helpers are intentionally left callable (see file header).
--     Full file: supabase/migrations/2026-08-22_linter_hardening.sql
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  sig text;
  sigs text[] := ARRAY[
    'public.update_updated_at_column()',
    'public.audit_log_trigger_func()',
    'public.current_user_role()',
    'public.current_user_org_id()',
    'public.current_teacher_id()',
    'public.current_student_id()',
    'public.get_open_slots(uuid, date)',
    'public.get_student_public(uuid)',
    'public.student_submit_homework(uuid)',
    'public.create_public_booking(uuid, text, text, text, text, text, text, timestamptz, text, text, text)',
    'public.submit_enrollment(uuid, text, text, text, text, text, text, text, text, text)',
    'public.submit_onboarding(uuid, text, text, text, text, text, date, jsonb)'
  ];
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', sig);
    EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'skipped (not found): %', sig;
    END;
  END LOOP;
  FOREACH sig IN ARRAY ARRAY['public.audit_log_trigger_func()','public.update_updated_at_column()'] LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
    EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'skipped revoke (not found): %', sig;
    END;
  END LOOP;
END $$;


-- ============================================================================
-- Already run earlier (kept for reference — safe to re-run, all idempotent):
--   [x] 2026-08-14_teacher_leaving.sql
--   [x] 2026-08-14_booking_school_city.sql
--   [x] 2026-08-15_settings_bank_info.sql
--   [x] 2026-08-18_class_rescheduled_notif.sql
-- ============================================================================
