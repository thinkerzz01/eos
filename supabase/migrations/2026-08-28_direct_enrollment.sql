-- ============================================================================
-- 2026-08-28  Direct enrolment (no demo)
--
-- New scenario: some students enrol directly (they watched a recorded demo, no
-- live demo needed). The public /admission form lets a prospective student fill
-- everything themselves — including program + exam session, which for demo-origin
-- students were chosen during booking. This SECURITY DEFINER routine creates the
-- student row directly, scoped to the passed org (BOOKING_ORG_ID), the same anon
-- pattern as create_public_booking. Fee is 0 / next-due +30d for the admin to set.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_direct_enrollment(
    p_org_id UUID,
    p_student_name TEXT,
    p_parent_name TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_program TEXT,
    p_exam_session TEXT,
    p_gender TEXT DEFAULT 'female',
    p_whatsapp TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'walk_in'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_student_id UUID;
    v_source TEXT;
    v_gender TEXT;
BEGIN
    IF coalesce(btrim(p_student_name), '') = '' OR coalesce(btrim(p_parent_name), '') = ''
       OR coalesce(btrim(p_phone), '') = '' OR coalesce(btrim(p_exam_session), '') = '' THEN
        RAISE EXCEPTION 'Student name, parent name, phone and exam session are required.';
    END IF;

    -- Phone is unique among students; surface a friendly duplicate message.
    IF EXISTS (SELECT 1 FROM public.students WHERE org_id = p_org_id AND phone = p_phone AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'A student with this phone number is already enrolled.';
    END IF;

    v_source := CASE WHEN p_source IN ('google','facebook','instagram','whatsapp','referral','walk_in') THEN p_source ELSE 'walk_in' END;
    v_gender := CASE WHEN p_gender IN ('male','female','other') THEN p_gender ELSE 'female' END;

    INSERT INTO public.students (
        org_id, name, parent_name, phone, whatsapp, email, address, city,
        gender, program, exam_session, monthly_fee, next_due_date, fee_status, status, source
    )
    VALUES (
        p_org_id, p_student_name, p_parent_name, p_phone, NULLIF(p_whatsapp, ''),
        NULLIF(p_email, ''), NULLIF(p_address, ''), NULLIF(p_city, ''),
        v_gender, p_program, p_exam_session, 0, CURRENT_DATE + INTERVAL '30 days', 'due', 'active', v_source
    )
    RETURNING id INTO v_student_id;

    RETURN v_student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_direct_enrollment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_direct_enrollment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.create_direct_enrollment IS
    'Anon public direct-enrolment: creates a student directly (no demo/lead) for '
    'the /admission form. Org is passed (BOOKING_ORG_ID). Fee 0 / next-due +30d '
    'for the admin to finalise. Dedupes on phone.';
