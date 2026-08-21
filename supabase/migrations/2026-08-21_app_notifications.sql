-- ============================================================================
-- In-app notifications (the TopBar bell). Separate from the `notifications`
-- table, which is the OUTBOUND EMAIL QUEUE (keyed by email, admin-only). This
-- one is a per-USER inbox: each row targets a user_id and tracks read_at.
--
--   - Users read + mark-read their OWN rows (RLS below).
--   - Rows are created server-side for the target user; the app inserts them
--     with the service-role client (createAdminClient) so a homework grade can
--     notify the student without the grader needing write access to the
--     student's inbox. Admins may also insert within their org.
-- Run once in the Supabase SQL Editor.
-- ============================================================================
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
    ON public.app_notifications (user_id, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

-- Each user sees + updates (mark-read) only their own notifications.
DROP POLICY IF EXISTS own_app_notifications ON public.app_notifications;
CREATE POLICY own_app_notifications ON public.app_notifications
    FOR ALL USING (user_id = auth.uid());

-- Admin may manage any notification within their org (e.g. broadcast, cleanup).
DROP POLICY IF EXISTS admin_app_notifications ON public.app_notifications;
CREATE POLICY admin_app_notifications ON public.app_notifications
    FOR ALL USING (public.current_user_role() = 'admin' AND org_id = public.current_user_org_id());

-- keep updated_at fresh
DROP TRIGGER IF EXISTS trg_update_updated_at_app_notifications ON public.app_notifications;
CREATE TRIGGER trg_update_updated_at_app_notifications
    BEFORE UPDATE ON public.app_notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify:
-- SELECT COUNT(*) FROM public.app_notifications;
