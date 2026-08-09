-- ============================================================================
-- Onboarding pre-fill: get_student_public also returns parent_name / phone / email
-- so the onboarding form can pre-fill what we already know from the booking.
-- Run once in the Supabase SQL Editor. (schema.sql already has this.)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_student_public(UUID);
CREATE FUNCTION public.get_student_public(p_student_id UUID)
RETURNS TABLE (name TEXT, program TEXT, exam_session TEXT, parent_name TEXT, phone TEXT, email TEXT, onboarding_done BOOLEAN) AS $$
    SELECT s.name, s.program, s.exam_session, s.parent_name, s.phone, s.email,
           (s.onboarding_completed_at IS NOT NULL)
    FROM public.students s
    WHERE s.id = p_student_id AND s.deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_student_public(UUID) TO anon, authenticated;
