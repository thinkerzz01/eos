-- T8: Announcements delivery fix (2026-08-14)
-- Announcements are org-wide broadcasts (no per-role/per-program audience UI).
-- Before this, teachers had NO read policy (saw nothing) and students' read was
-- gated behind announcement_targets rows that are never created (saw nothing).
-- This makes every announcement visible to all students + teachers in the org.
-- Idempotent: safe to run more than once.

DROP POLICY IF EXISTS student_read_announcements ON public.announcements;
CREATE POLICY student_read_announcements ON public.announcements FOR SELECT USING (
    current_user_role() = 'student' AND org_id = current_user_org_id()
);

DROP POLICY IF EXISTS teacher_read_announcements ON public.announcements;
CREATE POLICY teacher_read_announcements ON public.announcements FOR SELECT USING (
    current_user_role() = 'teacher' AND org_id = current_user_org_id()
);
