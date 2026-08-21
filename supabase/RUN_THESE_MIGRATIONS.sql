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


-- ============================================================================
-- Already run earlier (kept for reference — safe to re-run, all idempotent):
--   [x] 2026-08-14_teacher_leaving.sql
--   [x] 2026-08-14_booking_school_city.sql
--   [x] 2026-08-15_settings_bank_info.sql
--   [x] 2026-08-18_class_rescheduled_notif.sql
-- ============================================================================
