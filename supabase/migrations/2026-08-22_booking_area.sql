-- Capture the student's Area / Town / Society on the public demo booking (finer
-- than city) so the team can act on locality. Adds leads.area and extends the
-- anon booking routine to accept + store it. Backward compatible (p_area
-- defaults to NULL), and pins search_path (keeps the linter clean on recreate).

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS area TEXT;

DROP FUNCTION IF EXISTS public.create_public_booking(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_public_booking(
    p_org_id UUID,
    p_name TEXT,
    p_parent_name TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_program TEXT,
    p_subjects TEXT,
    p_scheduled_at TIMESTAMPTZ,
    p_source TEXT DEFAULT 'google',
    p_school TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_area TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lead_id UUID;
    v_source TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.leads WHERE org_id = p_org_id AND phone = p_phone AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'A lead with this phone number already exists.';
    END IF;

    v_source := CASE WHEN p_source IN ('google','facebook','instagram','whatsapp','referral','walk_in') THEN p_source ELSE 'google' END;

    INSERT INTO public.leads (org_id, name, parent_name, phone, email, program, subjects, source, status, temperature, school, city, area)
    VALUES (p_org_id, p_name, p_parent_name, p_phone, p_email, p_program, p_subjects, v_source, 'new', 'hot',
            NULLIF(p_school, ''), NULLIF(p_city, ''), NULLIF(p_area, ''))
    RETURNING id INTO v_lead_id;

    INSERT INTO public.demos (org_id, lead_id, scheduled_at, status)
    VALUES (p_org_id, v_lead_id, p_scheduled_at, 'needs_teacher');

    RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
