-- ============================================================================
-- 2026-09-20  Onboarding prefill - expose the booking details we already have
-- ----------------------------------------------------------------------------
-- The /onboarding form tries to prefill city, school and subjects, but
-- get_student_public never returned them, so those fields stayed blank. This
-- widens the RPC to also return city, whatsapp, and school/subjects (carried into
-- students.onboarding_data at enrollment). Return type changes, so DROP + CREATE.
--
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_public(UUID);

CREATE FUNCTION public.get_student_public(p_student_id UUID)
RETURNS TABLE (
  name TEXT, program TEXT, exam_session TEXT, parent_name TEXT,
  phone TEXT, email TEXT, city TEXT, whatsapp TEXT,
  school TEXT, subjects TEXT, onboarding_done BOOLEAN
) AS $$
    SELECT
      s.name, s.program, s.exam_session, s.parent_name,
      s.phone, s.email, s.city, s.whatsapp,
      COALESCE(s.onboarding_data->>'school', s.onboarding_data->>'schoolName', '') AS school,
      COALESCE(s.onboarding_data->>'subjects', '') AS subjects,
      (s.onboarding_completed_at IS NOT NULL) AS onboarding_done
    FROM public.students s
    WHERE s.id = p_student_id AND s.deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_student_public(UUID) TO anon, authenticated;
