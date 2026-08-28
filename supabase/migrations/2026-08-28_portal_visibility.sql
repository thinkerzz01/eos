-- ============================================================================
-- 2026-08-28  Portal visibility: teacher NAME-only lookup
--
-- The `teachers` table holds contact PII (email, phone). Its RLS only lets
-- admin/manager read it, so students and teachers currently get NULL when a
-- class/homework row embeds `teachers(name)` -> the UI shows "Unassigned".
--
-- Product decision: a STUDENT should see WHICH teacher takes each class
-- (name only) but never a teacher's phone/email. Column-level GRANTs can't
-- express this because every signed-in app user shares the single Postgres
-- role `authenticated` (app-role lives in profiles.role, not the DB role).
--
-- So we expose ONLY the name through a SECURITY DEFINER function that returns
-- id + name and nothing else, scoped to the caller's own org. No contact
-- column can leak through it, and the row set is org-bounded.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.teacher_names(ids uuid[])
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT t.id, t.name
    FROM public.teachers t
    WHERE t.id = ANY(ids)
      AND t.org_id = current_user_org_id()
      AND t.deleted_at IS NULL;
$$;

-- Lock down the REST/RPC surface: only signed-in users may call it (not anon).
REVOKE ALL ON FUNCTION public.teacher_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_names(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.teacher_names(uuid[]) IS
    'Name-only teacher lookup for portal views. Returns id+name for the given '
    'teacher ids within the caller''s org. Deliberately exposes NO contact '
    'columns (email/phone) so students/teachers can see who teaches a class '
    'without seeing personal contact details.';
