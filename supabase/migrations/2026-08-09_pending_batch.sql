-- ============================================================================
-- Thinkerzz EOS - PENDING MIGRATION (run once on the live DB)
-- ----------------------------------------------------------------------------
-- Everything the app needs that isn't in your live DB yet, from this session's
-- work. Safe to run on an existing database (uses IF NOT EXISTS / DROP-then-CREATE).
-- Paste the whole file into the Supabase Dashboard -> SQL Editor -> Run.
-- (A clean rebuild from schema.sql already includes all of this.)
-- ============================================================================

-- 1. ROLE ROUTING FIX ---------------------------------------------------------
-- Let a signed-in user read their OWN profile row so the app can resolve their
-- role/org (without this, non-admins fell back to the student portal, and a
-- manager could not read their org_id to create a student).
DROP POLICY IF EXISTS own_profile_read ON public.profiles;
CREATE POLICY own_profile_read ON public.profiles FOR SELECT USING (user_id = auth.uid());


-- 2. STUDENT ONBOARDING FORM --------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.get_student_public(p_student_id UUID)
RETURNS TABLE (name TEXT, program TEXT, exam_session TEXT, onboarding_done BOOLEAN) AS $$
    SELECT s.name, s.program, s.exam_session, (s.onboarding_completed_at IS NOT NULL)
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
        RAISE EXCEPTION 'This onboarding link is invalid.'; END IF;
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


-- 3. TEACHER PAYOUTS ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    method TEXT NOT NULL DEFAULT 'bank_transfer',
    reference TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);
ALTER TABLE public.teacher_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_teacher_payouts ON public.teacher_payouts;
CREATE POLICY admin_full_access_teacher_payouts ON public.teacher_payouts FOR ALL
  USING (current_user_role() = 'admin' AND org_id = current_user_org_id());
DROP TRIGGER IF EXISTS trg_update_updated_at_teacher_payouts ON public.teacher_payouts;
CREATE TRIGGER trg_update_updated_at_teacher_payouts BEFORE UPDATE ON public.teacher_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_audit_log_teacher_payouts ON public.teacher_payouts;
CREATE TRIGGER trg_audit_log_teacher_payouts AFTER INSERT OR UPDATE OR DELETE ON public.teacher_payouts
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_func();

-- Verify:
-- SELECT policyname FROM pg_policies WHERE tablename IN ('profiles','teacher_payouts');
-- SELECT proname FROM pg_proc WHERE proname IN ('get_student_public','submit_onboarding');
