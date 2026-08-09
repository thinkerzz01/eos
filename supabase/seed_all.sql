-- ============================================================================
-- Thinkerzz EOS - SEED ALL (one paste after a database reset)
-- ----------------------------------------------------------------------------
-- Runs the whole re-seed in order: org + admin profile, subjects, and the
-- manager/teacher/student test logins. Idempotent - safe to run more than once.
--
-- PREREQUISITE: the LOGIN accounts must already exist in
--   Supabase Dashboard -> Authentication -> Users  (they survive a reset).
--   - admin@thinkerzz.com     (REQUIRED - this block errors if it is missing)
--   - manager@thinkerzz.com   (optional - skipped if missing)
--   - muzammal@thinkerzz.com  (optional - the teacher login)
--   - student@thinkerzz.com   (optional)
--
-- HOW TO USE: after running reset_database.sql + schema.sql, paste this whole
-- file into the SQL Editor and Run.  (Edit the emails below if yours differ.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ORG + ADMIN  (required)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_org_id  UUID := '00000000-0000-0000-0000-000000000001';
    v_email   TEXT := 'admin@thinkerzz.com';
    v_user_id UUID;
BEGIN
    INSERT INTO public.orgs (id, name) VALUES (v_org_id, 'Thinkerzz') ON CONFLICT (id) DO NOTHING;

    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No auth user for %. Add it in Authentication -> Users first.', v_email;
    END IF;

    DELETE FROM public.profiles WHERE email = v_email AND user_id <> v_user_id;
    INSERT INTO public.profiles (org_id, user_id, role, name, email)
    VALUES (v_org_id, v_user_id, 'admin', 'Academy Admin', v_email)
    ON CONFLICT (user_id) DO UPDATE
        SET role = 'admin', org_id = EXCLUDED.org_id, deleted_at = NULL, updated_at = NOW();
    RAISE NOTICE 'Admin profile ready for %.', v_email;
END $$;

-- ---------------------------------------------------------------------------
-- 2) SUBJECTS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_org  UUID := '00000000-0000-0000-0000-000000000001';
    prog   TEXT;
    subj   TEXT;
    progs  TEXT[] := ARRAY['O Level (O1)', 'O Level (O2)', 'A Level (A1)', 'A Level (A2)', 'IGCSE'];
    subjs  TEXT[] := ARRAY[
        'Mathematics', 'Additional Mathematics', 'Physics', 'Chemistry', 'Biology',
        'Computer Science', 'Economics', 'Accounting', 'Business Studies',
        'English (First Language)'
    ];
BEGIN
    FOREACH prog IN ARRAY progs LOOP
        FOREACH subj IN ARRAY subjs LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.subjects
                WHERE org_id = v_org AND name = subj AND program = prog AND deleted_at IS NULL
            ) THEN
                INSERT INTO public.subjects (org_id, name, program) VALUES (v_org, subj, prog);
            END IF;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Subjects seeded (% programs x % subjects).', array_length(progs, 1), array_length(subjs, 1);
END $$;

-- ---------------------------------------------------------------------------
-- 3) MANAGER / TEACHER / STUDENT test logins  (each skipped if its login is missing)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_org_id        UUID := '00000000-0000-0000-0000-000000000001';
    v_manager_email TEXT := 'manager@thinkerzz.com';
    v_teacher_email TEXT := 'muzammal@thinkerzz.com';
    v_student_email TEXT := 'student@thinkerzz.com';
    v_user_id  UUID;
    v_teacher_id UUID;
    v_student_id UUID;
BEGIN
    -- MANAGER
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_manager_email LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Skipped manager: no auth user for %.', v_manager_email;
    ELSE
        DELETE FROM public.profiles WHERE email = v_manager_email AND user_id <> v_user_id;
        INSERT INTO public.profiles (org_id, user_id, role, name, email)
        VALUES (v_org_id, v_user_id, 'manager', 'Test Manager', v_manager_email)
        ON CONFLICT (user_id) DO UPDATE
            SET role = 'manager', org_id = EXCLUDED.org_id, deleted_at = NULL, updated_at = NOW();
    END IF;

    -- TEACHER
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_teacher_email LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Skipped teacher: no auth user for %.', v_teacher_email;
    ELSE
        SELECT id INTO v_teacher_id FROM public.teachers
            WHERE org_id = v_org_id AND email = v_teacher_email AND deleted_at IS NULL LIMIT 1;
        IF v_teacher_id IS NULL THEN
            INSERT INTO public.teachers (org_id, name, email, phone, capacity)
            VALUES (v_org_id, 'Test Teacher', v_teacher_email, '03000000000', 20)
            RETURNING id INTO v_teacher_id;
        END IF;
        DELETE FROM public.profiles WHERE email = v_teacher_email AND user_id <> v_user_id;
        INSERT INTO public.profiles (org_id, user_id, role, name, email, teacher_id)
        VALUES (v_org_id, v_user_id, 'teacher', 'Test Teacher', v_teacher_email, v_teacher_id)
        ON CONFLICT (user_id) DO UPDATE
            SET role = 'teacher', org_id = EXCLUDED.org_id, teacher_id = EXCLUDED.teacher_id,
                deleted_at = NULL, updated_at = NOW();
    END IF;

    -- STUDENT
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_student_email LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Skipped student: no auth user for %.', v_student_email;
    ELSE
        SELECT id INTO v_student_id FROM public.students
            WHERE org_id = v_org_id AND email = v_student_email AND deleted_at IS NULL LIMIT 1;
        IF v_student_id IS NULL THEN
            INSERT INTO public.students
                (org_id, name, parent_name, phone, email, program, exam_session, monthly_fee, next_due_date)
            VALUES
                (v_org_id, 'Test Student', 'Test Parent', '03000000001', v_student_email,
                 'O Level (O1)', 'May/June 2027', 5000, CURRENT_DATE + INTERVAL '30 days')
            RETURNING id INTO v_student_id;
        END IF;
        DELETE FROM public.profiles WHERE email = v_student_email AND user_id <> v_user_id;
        INSERT INTO public.profiles (org_id, user_id, role, name, email, student_id)
        VALUES (v_org_id, v_user_id, 'student', 'Test Student', v_student_email, v_student_id)
        ON CONFLICT (user_id) DO UPDATE
            SET role = 'student', org_id = EXCLUDED.org_id, student_id = EXCLUDED.student_id,
                deleted_at = NULL, updated_at = NOW();
    END IF;

    RAISE NOTICE 'Role seeding complete.';
END $$;

-- Verify:
-- SELECT role, email FROM public.profiles ORDER BY role;
-- SELECT COUNT(*) AS subjects FROM public.subjects WHERE deleted_at IS NULL;
