-- ============================================================================
-- Thinkerzz EOS - Seed one test login for each of the remaining 3 roles
--   (admin is seeded separately by seed_admin.sql)
-- ----------------------------------------------------------------------------
-- The 4 roles in this system are: admin, manager, teacher, student.
--
-- STEP 1 - Create the 3 auth users FIRST (once), exactly like the admin:
--   Supabase Dashboard -> Authentication -> Users -> "Add user"
--   Add these three emails, each with a password, "Auto Confirm User" ticked:
--     - manager@thinkerzz.com
--     - muzammal@thinkerzz.com
--     - student@thinkerzz.com
--   (Change the emails below if you want different ones - keep them in sync.)
--
-- STEP 2 - Run this whole file in the SQL Editor.
--   It assigns the right role to each profile, and creates the backing
--   teacher / student row that those two roles need to see their own data.
-- ============================================================================

DO $$
DECLARE
    v_org_id       UUID := '00000000-0000-0000-0000-000000000001';

    -- >>> EDIT these to the exact emails you created in STEP 1 <<<
    v_manager_email TEXT := 'manager@thinkerzz.com';
    v_teacher_email TEXT := 'muzammal@thinkerzz.com';
    v_student_email TEXT := 'student@thinkerzz.com';

    v_user_id      UUID;
    v_teacher_id   UUID;
    v_student_id   UUID;
BEGIN
    -- Make sure the org exists (harmless if it already does).
    INSERT INTO public.orgs (id, name)
    VALUES (v_org_id, 'Thinkerzz')
    ON CONFLICT (id) DO NOTHING;

    -- ---- MANAGER ----------------------------------------------------------
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_manager_email LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No auth user for %. Add it in Authentication -> Users first.', v_manager_email;
    END IF;
    DELETE FROM public.profiles WHERE email = v_manager_email AND user_id <> v_user_id;
    INSERT INTO public.profiles (org_id, user_id, role, name, email)
    VALUES (v_org_id, v_user_id, 'manager', 'Test Manager', v_manager_email)
    ON CONFLICT (user_id) DO UPDATE
        SET role = 'manager', org_id = EXCLUDED.org_id, deleted_at = NULL, updated_at = NOW();

    -- ---- TEACHER ----------------------------------------------------------
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_teacher_email LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No auth user for %. Add it in Authentication -> Users first.', v_teacher_email;
    END IF;
    -- Reuse an existing teacher row for this email, else create one.
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

    -- ---- STUDENT ----------------------------------------------------------
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_student_email LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No auth user for %. Add it in Authentication -> Users first.', v_student_email;
    END IF;
    SELECT id INTO v_student_id FROM public.students
        WHERE org_id = v_org_id AND email = v_student_email AND deleted_at IS NULL LIMIT 1;
    IF v_student_id IS NULL THEN
        INSERT INTO public.students
            (org_id, name, parent_name, phone, email, program, exam_session,
             monthly_fee, next_due_date)
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

    RAISE NOTICE 'Seeded manager, teacher, and student test logins.';
END $$;

-- Verify (should show all 4 roles):
-- SELECT role, email, teacher_id, student_id FROM public.profiles ORDER BY role;
