-- Collect marketing data on the public demo booking: the student's SCHOOL and
-- CITY / hometown. Stored on the lead so the Marketing tab can segment by them.

-- 1) Two nullable columns on leads.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS school TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;

-- 2) Extend the anon booking routine to accept + store them. Drop the old
--    signature first, then recreate with the two extra params (defaulted so the
--    change is backward compatible).
DROP FUNCTION IF EXISTS public.create_public_booking(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT);

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
    p_city TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_lead_id UUID;
    v_source TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.leads WHERE org_id = p_org_id AND phone = p_phone AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'A lead with this phone number already exists.';
    END IF;

    v_source := CASE WHEN p_source IN ('google','facebook','instagram','whatsapp','referral','walk_in') THEN p_source ELSE 'google' END;

    INSERT INTO public.leads (org_id, name, parent_name, phone, email, program, subjects, source, status, temperature, school, city)
    VALUES (p_org_id, p_name, p_parent_name, p_phone, p_email, p_program, p_subjects, v_source, 'new', 'hot',
            NULLIF(p_school, ''), NULLIF(p_city, ''))
    RETURNING id INTO v_lead_id;

    INSERT INTO public.demos (org_id, lead_id, scheduled_at, status)
    VALUES (p_org_id, v_lead_id, p_scheduled_at, 'needs_teacher');

    RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO anon, authenticated;
