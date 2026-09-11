-- ============================================================================
-- 👉 RUN-ME: pending migrations to paste into the Supabase SQL Editor.
--
--   SQL Editor (new query):
--   https://supabase.com/dashboard/project/suiikarwglsjmwnfefyt/sql/new
--
-- This file is the single "what still needs running" list. Every block is
-- idempotent / safe to run more than once. After running, tick it off below.
-- Full explanations live next to each file in supabase/migrations/.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-21  Enrollment backbone (P1)
--     Lets a student be enrolled in a subject + teacher. Without this, admitting
--     a student WITH a per-subject teacher fails (the archived syllabus system
--     left a NOT NULL column blocking the insert). teacher_id stays required.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_subjects
  ALTER COLUMN syllabus_template_id DROP NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-21  In-app notifications (P2 — the TopBar bell)
--     Per-user notification inbox (separate from the outbound email queue).
--     Powers the bell dropdown + unread badge. Without it the bell just shows
--     "all caught up" (the app never breaks). Full file:
--     supabase/migrations/2026-08-21_app_notifications.sql
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user
    ON public.app_notifications (user_id, created_at DESC) WHERE deleted_at IS NULL;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_app_notifications ON public.app_notifications;
CREATE POLICY own_app_notifications ON public.app_notifications
    FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS admin_app_notifications ON public.app_notifications;
CREATE POLICY admin_app_notifications ON public.app_notifications
    FOR ALL USING (public.current_user_role() = 'admin' AND org_id = public.current_user_org_id());
DROP TRIGGER IF EXISTS trg_update_updated_at_app_notifications ON public.app_notifications;
CREATE TRIGGER trg_update_updated_at_app_notifications
    BEFORE UPDATE ON public.app_notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-21  Remove CNIC / B-Form from onboarding data (not needed)
--     CNIC was only a key inside the students.onboarding_data JSON (never a
--     column). This strips it from existing rows; the app no longer shows it.
--     Idempotent. Full file: supabase/migrations/2026-08-21_drop_onboarding_cnic.sql
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.students
SET onboarding_data = onboarding_data - 'cnic' - 'b_form' - 'cnicBform' - 'bform'
WHERE onboarding_data IS NOT NULL
  AND (onboarding_data ? 'cnic'
    OR onboarding_data ? 'b_form'
    OR onboarding_data ? 'cnicBform'
    OR onboarding_data ? 'bform');


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-21  SECURITY: homework grading lockdown (H1)
--     Students could set their own homework to graded/score=100. This makes
--     students read-only on homework and routes submission through a locked RPC
--     (status → submitted/late only). Full file:
--     supabase/migrations/2026-08-21_homework_student_lockdown.sql
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS student_access_own_homework ON public.homework;
DROP POLICY IF EXISTS student_read_own_homework ON public.homework;
CREATE POLICY student_read_own_homework ON public.homework FOR SELECT USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);
CREATE OR REPLACE FUNCTION public.student_submit_homework(p_homework_id UUID)
RETURNS TEXT AS $$
DECLARE v_deadline TIMESTAMPTZ; v_status TEXT; v_new TEXT;
BEGIN
    SELECT deadline, status INTO v_deadline, v_status
    FROM public.homework
    WHERE id = p_homework_id AND student_id = current_student_id() AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Homework not found.'; END IF;
    IF v_status = 'graded' THEN RAISE EXCEPTION 'This homework has already been graded.'; END IF;
    v_new := CASE WHEN v_deadline IS NOT NULL AND v_deadline < NOW() THEN 'late' ELSE 'submitted' END;
    UPDATE public.homework SET status = v_new, updated_at = NOW() WHERE id = p_homework_id;
    RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.student_submit_homework(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-21  SECURITY: onboarding PII lockdown (M2)
--     get_student_public stops disclosing parent name/phone/email once onboarding
--     is completed; submit_onboarding refuses re-submission after completion.
--     Full file: supabase/migrations/2026-08-21_onboarding_pii_lockdown.sql
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_student_public(UUID);
CREATE FUNCTION public.get_student_public(p_student_id UUID)
RETURNS TABLE (name TEXT, program TEXT, exam_session TEXT, parent_name TEXT, phone TEXT, email TEXT, onboarding_done BOOLEAN) AS $$
    SELECT s.name, s.program, s.exam_session,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.parent_name ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.phone ELSE NULL END,
        CASE WHEN s.onboarding_completed_at IS NULL THEN s.email ELSE NULL END,
        (s.onboarding_completed_at IS NOT NULL)
    FROM public.students s WHERE s.id = p_student_id AND s.deleted_at IS NULL;
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
    IF EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND onboarding_completed_at IS NOT NULL) THEN
        RAISE EXCEPTION 'This onboarding has already been completed.'; END IF;
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


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-22  Settings → Typography (admin-selectable fonts)
--     Adds orgs.heading_font / orgs.body_font (font keys from lib/fonts.ts).
--     App falls back to Nunito headings + Jost body when null.
--     Full file: supabase/migrations/2026-08-22_org_typography.sql
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS heading_font TEXT,
  ADD COLUMN IF NOT EXISTS body_font TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-22  Database linter hardening (Supabase security lints)
--     Pins search_path on all 12 SECURITY DEFINER / trigger functions and
--     revokes RPC EXECUTE on the two trigger helpers. Public-form RPCs and the
--     current_* RLS helpers are intentionally left callable (see file header).
--     Full file: supabase/migrations/2026-08-22_linter_hardening.sql
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  sig text;
  sigs text[] := ARRAY[
    'public.update_updated_at_column()',
    'public.audit_log_trigger_func()',
    'public.current_user_role()',
    'public.current_user_org_id()',
    'public.current_teacher_id()',
    'public.current_student_id()',
    'public.get_open_slots(uuid, date)',
    'public.get_student_public(uuid)',
    'public.student_submit_homework(uuid)',
    'public.create_public_booking(uuid, text, text, text, text, text, text, timestamptz, text, text, text)',
    'public.submit_enrollment(uuid, text, text, text, text, text, text, text, text, text)',
    'public.submit_onboarding(uuid, text, text, text, text, text, date, jsonb)'
  ];
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', sig);
    EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'skipped (not found): %', sig;
    END;
  END LOOP;
  FOREACH sig IN ARRAY ARRAY['public.audit_log_trigger_func()','public.update_updated_at_column()'] LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
    EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'skipped revoke (not found): %', sig;
    END;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-22  Performance lint wins (targeted indexes + auth initplan)
--     Adds covering indexes on hot FK columns and hoists auth.uid() to a
--     subselect in 6 policies. Skips the 515 multiple-permissive findings by
--     design. Full file: supabase/migrations/2026-08-22_perf_lints.sql
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_student_subjects_teacher_id   ON public.student_subjects (teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_student_id   ON public.student_subjects (student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject_id   ON public.student_subjects (subject_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_teacher_id     ON public.class_sessions (teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_student_id     ON public.class_sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_subject_id     ON public.class_sessions (subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id         ON public.attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id         ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_homework_student_id           ON public.homework (student_id);
CREATE INDEX IF NOT EXISTS idx_homework_teacher_id           ON public.homework (teacher_id);
CREATE INDEX IF NOT EXISTS idx_homework_subject_id           ON public.homework (subject_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_student_id           ON public.vouchers (student_id);
CREATE INDEX IF NOT EXISTS idx_voucher_lines_voucher_id      ON public.voucher_lines (voucher_id);
CREATE INDEX IF NOT EXISTS idx_payments_voucher_id           ON public.payments (voucher_id);
CREATE INDEX IF NOT EXISTS idx_demos_teacher_id              ON public.demos (teacher_id);
CREATE INDEX IF NOT EXISTS idx_demos_lead_id                 ON public.demos (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_communications_lead_id   ON public.lead_communications (lead_id);
CREATE INDEX IF NOT EXISTS idx_tickets_opened_by            ON public.tickets (opened_by);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id    ON public.ticket_messages (ticket_id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_id    ON public.app_notifications (user_id);

DROP POLICY IF EXISTS own_profile_read ON public.profiles;
CREATE POLICY own_profile_read ON public.profiles FOR SELECT
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_app_notifications ON public.app_notifications;
CREATE POLICY own_app_notifications ON public.app_notifications FOR ALL
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS teacher_access_tickets ON public.tickets;
CREATE POLICY teacher_access_tickets ON public.tickets FOR ALL
  USING (current_user_role() = 'teacher' AND opened_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS student_access_own_tickets ON public.tickets;
CREATE POLICY student_access_own_tickets ON public.tickets FOR ALL
  USING (current_user_role() = 'student' AND opened_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS teacher_access_ticket_messages ON public.ticket_messages;
CREATE POLICY teacher_access_ticket_messages ON public.ticket_messages FOR ALL
  USING (current_user_role() = 'teacher' AND ticket_id IN (
    SELECT id FROM public.tickets WHERE opened_by = (SELECT auth.uid()) AND deleted_at IS NULL));
DROP POLICY IF EXISTS student_access_own_ticket_messages ON public.ticket_messages;
CREATE POLICY student_access_own_ticket_messages ON public.ticket_messages FOR ALL
  USING (current_user_role() = 'student' AND ticket_id IN (
    SELECT id FROM public.tickets WHERE opened_by = (SELECT auth.uid()) AND deleted_at IS NULL));


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-28  Portal visibility — teacher NAME-only lookup
--     Lets a student/teacher see a teacher's NAME (never phone/email) on their
--     classes & homework, and lets the portal greet a teacher by their real name.
--     Full file: supabase/migrations/2026-08-28_portal_visibility.sql
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.teacher_names(ids uuid[])
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT t.id, t.name
    FROM public.teachers t
    WHERE t.id = ANY(ids)
      AND t.org_id = current_user_org_id()
      AND t.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.teacher_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_names(uuid[]) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-28  Direct enrolment (no demo) — the public /admission form
--     Creates a student directly (no lead/demo) for the academy org, so a
--     prospective student can self-enrol after a recorded demo. Fee 0 / next-due
--     +30d for the admin to finalise. Dedupes on phone.
--     Full file: supabase/migrations/2026-08-28_direct_enrollment.sql
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_direct_enrollment(
    p_org_id UUID, p_student_name TEXT, p_parent_name TEXT, p_phone TEXT, p_email TEXT,
    p_program TEXT, p_exam_session TEXT, p_gender TEXT DEFAULT 'female',
    p_whatsapp TEXT DEFAULT NULL, p_city TEXT DEFAULT NULL, p_address TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'walk_in'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_student_id UUID; v_source TEXT; v_gender TEXT;
BEGIN
    IF coalesce(btrim(p_student_name),'')='' OR coalesce(btrim(p_parent_name),'')=''
       OR coalesce(btrim(p_phone),'')='' OR coalesce(btrim(p_exam_session),'')='' THEN
        RAISE EXCEPTION 'Student name, parent name, phone and exam session are required.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.students WHERE org_id = p_org_id AND phone = p_phone AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'A student with this phone number is already enrolled.';
    END IF;
    v_source := CASE WHEN p_source IN ('google','facebook','instagram','whatsapp','referral','walk_in') THEN p_source ELSE 'walk_in' END;
    v_gender := CASE WHEN p_gender IN ('male','female','other') THEN p_gender ELSE 'female' END;
    INSERT INTO public.students (org_id, name, parent_name, phone, whatsapp, email, address, city,
        gender, program, exam_session, monthly_fee, next_due_date, fee_status, status, source)
    VALUES (p_org_id, p_student_name, p_parent_name, p_phone, NULLIF(p_whatsapp,''),
        NULLIF(p_email,''), NULLIF(p_address,''), NULLIF(p_city,''),
        v_gender, p_program, p_exam_session, 0, CURRENT_DATE + INTERVAL '30 days', 'due', 'active', v_source)
    RETURNING id INTO v_student_id;
    RETURN v_student_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_direct_enrollment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_direct_enrollment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-28  Sync stale portal names (fixes the "Test Teacher" greeting)
--     seed_roles.sql created teacher/student portal profiles named "Test Teacher"
--     / "Test Student". When you rename the real teacher/student, the profile name
--     lagged behind. These update ONLY mismatched names to the real record — they
--     never delete a login. Safe / idempotent.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.profiles p SET name = t.name
FROM public.teachers t
WHERE p.teacher_id = t.id AND p.role = 'teacher' AND p.name <> t.name;

UPDATE public.profiles p SET name = s.name
FROM public.students s
WHERE p.student_id = s.id AND p.role = 'student' AND p.name <> s.name;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-09-06  Sequential demo numbers: DMO-<hex>  ->  DM-000001
--     Adds demos.demo_no (a real running counter via a sequence), renumbers
--     existing demos from 1 in creation order (the "reset"), and auto-numbers new
--     demos via the column DEFAULT. Each demo's number is STABLE. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.demo_no_seq;

ALTER TABLE public.demos ADD COLUMN IF NOT EXISTS demo_no BIGINT;

WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
    FROM public.demos
)
UPDATE public.demos d
SET demo_no = o.rn
FROM ordered o
WHERE d.id = o.id AND d.demo_no IS NULL;

SELECT setval(
    'public.demo_no_seq',
    COALESCE((SELECT MAX(demo_no) FROM public.demos), 0) + 1,
    false
);

ALTER TABLE public.demos ALTER COLUMN demo_no SET DEFAULT nextval('public.demo_no_seq');
ALTER TABLE public.demos ALTER COLUMN demo_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS demos_demo_no_key ON public.demos (demo_no);
ALTER SEQUENCE public.demo_no_seq OWNED BY public.demos.demo_no;
GRANT USAGE ON SEQUENCE public.demo_no_seq TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-09-06  Teacher roster via classes (fixes "My Students" empty)
--     A teacher assigned a student by SCHEDULING A CLASS (class_sessions) did not
--     appear on the teacher's My Students / Assessments tabs (those keyed only on
--     student_subjects). Broaden both to also match class_sessions.teacher_id.
--     Still scoped to the teacher's own id. Idempotent (DROP + CREATE).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS teacher_read_own_students ON public.students;
CREATE POLICY teacher_read_own_students ON public.students FOR SELECT USING (
    current_user_role() = 'teacher' AND (
        id IN (SELECT student_id FROM public.student_subjects WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL)
        OR
        id IN (SELECT student_id FROM public.class_sessions WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL)
    )
);

DROP POLICY IF EXISTS teacher_access_own_tests ON public.tests;
CREATE POLICY teacher_access_own_tests ON public.tests FOR ALL USING (
    current_user_role() = 'teacher' AND subject_id IN (
        SELECT subject_id FROM public.student_subjects WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
        UNION
        SELECT subject_id FROM public.class_sessions WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
    )
);


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-28  Onboarding pre-fill from the demo booking
--     convertLead now carries the family's booking city/school/subjects onto the
--     new student; this widens get_student_public so the /onboarding link pre-fills
--     them too (returned only while onboarding isn't completed — PII-safe).
--     Full file: supabase/migrations/2026-08-28_onboarding_prefill_from_demo.sql
-- ─────────────────────────────────────────────────────────────────────────────
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
        s.name, s.program, s.exam_session,
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


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-08-28  Editable subject codes
--     Adds subjects.code (admin-editable in the Subjects manager, shown in every
--     picker) and backfills standard O-Level CAIE codes (verified on
--     cambridgeinternational.org). Only fills blanks — safe to re-run.
--     Full file: supabase/migrations/2026-08-28_subject_codes.sql
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS code TEXT;
UPDATE public.subjects s SET code = m.code
FROM (VALUES
    ('Mathematics', '4024'), ('Additional Mathematics', '4037'), ('Physics', '5054'),
    ('Chemistry', '5070'), ('Biology', '5090'), ('Accounting', '7707'),
    ('Economics', '2281'), ('Business Studies', '7115'), ('Computer Science', '2210'),
    ('Information Technology', '0417'), ('English (First Language)', '1123'),
    ('English (Second Language)', '0510'), ('Islamiyat', '2058'),
    ('Pakistan Studies', '2059'), ('Urdu', '3247'), ('Statistics', '4040'),
    ('Psychology', '0490'), ('Sociology', '2251')
) AS m(name, code)
WHERE s.name = m.name AND (s.code IS NULL OR s.code = '');


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-09-08  Programs: A Level (A1)/(A2) -> AS / A2, add Edexcel
--     Widens the program CHECK on every program table to the new set AND renames
--     old A-Level rows. Run this as ONE block (drop CHECK -> rename -> add CHECK)
--     — renaming before widening the CHECK is what errored with 23514.
--     Full file: supabase/migrations/2026-09-08_programs_as_a2_edexcel.sql
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['students', 'leads', 'subjects', 'syllabus_templates', 'announcement_targets'];
    new_check CONSTANT TEXT :=
      'program IN (''O Level (O1)'', ''O Level (O2)'', ''AS'', ''A2'', ''IGCSE'', '
      || '''Edexcel IGCSE'', ''Edexcel AS'', ''Edexcel A2'', '
      || '''Matric (9)'', ''Matric (10)'', ''Inter (11)'', ''Inter (12)'')';
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_program_check');
        EXECUTE format($f$
            UPDATE public.%I SET program = CASE program
                WHEN 'A Level (A1)' THEN 'AS'
                WHEN 'A Level (A2)' THEN 'A2'
                ELSE program END
            WHERE program IN ('A Level (A1)', 'A Level (A2)')
        $f$, t);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s)', t, t || '_program_check', new_check);
    END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- [ ] 2026-09-11  Expand Cambridge subject catalog (+ codes)
--     Adds the full O Level / AS & A Level subject set to every org across the
--     Cambridge programs, with default codes. Idempotent. Requires the programs
--     migration (AS/A2 in the CHECK) to have run first.
--     Full file: supabase/migrations/2026-09-11_more_subjects.sql
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS code TEXT;
DO $$
DECLARE
    v_org UUID; prog TEXT; rec RECORD;
    progs TEXT[] := ARRAY['O Level (O1)', 'O Level (O2)', 'AS', 'A2', 'IGCSE'];
BEGIN
    FOR v_org IN SELECT id FROM public.orgs LOOP
        FOREACH prog IN ARRAY progs LOOP
            FOR rec IN SELECT * FROM (VALUES
                ('Mathematics','4024'), ('Additional Mathematics','4037'), ('Further Mathematics','9231'),
                ('Statistics','4040'), ('Physics','5054'), ('Chemistry','5070'), ('Biology','5090'),
                ('Combined Science','5129'), ('Marine Science','9693'), ('Environmental Management','5014'),
                ('Computer Science','2210'), ('Information Technology','0417'), ('Accounting','7707'),
                ('Economics','2281'), ('Business','7081'), ('Business Studies','7115'), ('Commerce','7100'),
                ('Geography','2217'), ('History','2147'), ('Sociology','2251'), ('Psychology','0490'),
                ('Law','9084'), ('Global Perspectives','2069'), ('Global Perspectives & Research','9239'),
                ('Thinking Skills','9694'), ('English (First Language)','1123'), ('English (Second Language)','0510'),
                ('Literature in English','2010'), ('English General Paper','8021'), ('Urdu','3247'),
                ('Arabic','3180'), ('Islamiyat','2058'), ('Islamic Studies','2068'), ('Pakistan Studies','2059'),
                ('Art & Design','6090'), ('Design & Technology','9705'), ('Media Studies','9607'),
                ('Drama','9482'), ('Music','9483'), ('Sport & Physical Education','9395'),
                ('Food & Nutrition','6065'), ('Fashion & Textiles','6130')
            ) AS s(name, code) LOOP
                IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE org_id=v_org AND name=rec.name AND program=prog AND deleted_at IS NULL) THEN
                    INSERT INTO public.subjects (org_id, name, program, code) VALUES (v_org, rec.name, prog, rec.code);
                ELSE
                    UPDATE public.subjects SET code=rec.code WHERE org_id=v_org AND name=rec.name AND program=prog AND deleted_at IS NULL AND (code IS NULL OR code='');
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;


-- ============================================================================
-- Already run earlier (kept for reference — safe to re-run, all idempotent):
--   [x] 2026-08-14_teacher_leaving.sql
--   [x] 2026-08-14_booking_school_city.sql
--   [x] 2026-08-15_settings_bank_info.sql
--   [x] 2026-08-18_class_rescheduled_notif.sql
--   [x] 2026-08-28_portal_visibility.sql      (block above)
--   [x] 2026-08-28_direct_enrollment.sql      (block above)
-- ============================================================================
