-- ============================================================================
-- SECURITY FIX (M2): the public /onboarding/<studentId> link leaked parent PII
-- (name/phone/email) to anyone holding the URL, forever, and the form could be
-- re-submitted to overwrite a student's contact details.
-- This:
--   1) makes get_student_public return parent name/phone/email ONLY while
--      onboarding is not yet completed (so a leaked link stops disclosing PII
--      once the student is onboarded), and
--   2) locks submit_onboarding after completion (no silent overwrites).
-- Signatures are unchanged, so the app keeps working. Run in the SQL Editor.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_public(UUID);
CREATE FUNCTION public.get_student_public(p_student_id UUID)
RETURNS TABLE (name TEXT, program TEXT, exam_session TEXT, parent_name TEXT, phone TEXT, email TEXT, onboarding_done BOOLEAN) AS $$
    SELECT
        s.name,
        s.program,
        s.exam_session,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.parent_name ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.phone ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.email ELSE NULL END,
        (s.onboarding_completed_at IS NOT NULL)
    FROM public.students s
    WHERE s.id = p_student_id AND s.deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_student_public(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_onboarding(
    p_student_id UUID, p_whatsapp TEXT, p_email TEXT, p_city TEXT, p_address TEXT,
    p_gender TEXT, p_dob DATE, p_data JSONB)
RETURNS UUID AS $$
DECLARE v_gender TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'This onboarding link is invalid.';
    END IF;
    -- Lock: an already-completed onboarding cannot be re-submitted / overwritten.
    IF EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND onboarding_completed_at IS NOT NULL) THEN
        RAISE EXCEPTION 'This onboarding has already been completed.';
    END IF;
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
