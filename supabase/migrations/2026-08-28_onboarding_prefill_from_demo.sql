-- ============================================================================
-- 2026-08-28  Onboarding pre-fill from the demo booking
--
-- When a demo lead is converted to a student (app/leads/actions.ts convertLead),
-- we now carry the family's booking details onto the student: city -> students.city
-- and school/subjects -> students.onboarding_data. This widens get_student_public
-- so the /onboarding link pre-fills those too (city, school, subjects), on top of
-- the existing name/program/exam-session/parent fields — so a converted student
-- doesn't retype what they already gave at booking.
--
-- Kept consistent with the PII lockdown: the extra fields (like the parent fields)
-- are returned ONLY while onboarding is not yet completed, so a leaked/finished
-- link discloses nothing. search_path pinned (linter clean). Signature widens by
-- adding columns, which the app reader tolerates.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_public(UUID);
CREATE FUNCTION public.get_student_public(p_student_id UUID)
RETURNS TABLE (
    name TEXT, program TEXT, exam_session TEXT,
    parent_name TEXT, phone TEXT, email TEXT,
    city TEXT, school TEXT, subjects TEXT,
    onboarding_done BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        s.name,
        s.program,
        s.exam_session,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.parent_name ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.phone ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.email ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.city ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN (s.onboarding_data ->> 'school') ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN (s.onboarding_data ->> 'subjects') ELSE NULL END,
        (s.onboarding_completed_at IS NOT NULL)
    FROM public.students s
    WHERE s.id = p_student_id AND s.deleted_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.get_student_public(UUID) TO anon, authenticated;
