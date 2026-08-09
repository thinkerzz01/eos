-- ============================================================================
-- Thinkerzz EOS — First-Admin Bootstrap
-- ----------------------------------------------------------------------------
-- Auth is now enforced (deny-by-default). Accounts are NOT created by logging
-- in anymore, so the very first admin must be seeded once, by you.
--
-- WHY A SCRIPT: the `profiles` RLS policies grant access based on an EXISTING
-- admin profile (chicken-and-egg). The Supabase SQL editor runs as a superuser
-- and bypasses RLS, so it is the correct place to insert the first row.
--
-- ---------------------------------------------------------------------------
-- STEP 1 — Create the auth user (once)
--   Supabase Dashboard  ->  Authentication  ->  Users  ->  "Add user"
--   Enter the admin email + a strong password, and tick "Auto Confirm User".
--   (Use the email in ADMIN_EMAIL from your .env.local.)
--
-- STEP 2 — Lock the front door (recommended)
--   Dashboard -> Authentication -> Providers -> Email:
--   turn OFF "Allow new users to sign up" so no one can self-register.
--
-- STEP 3 — Run this script
--   Dashboard -> SQL Editor -> paste this file -> set the email below -> Run.
--   NOTE: the Supabase SQL Editor is NOT psql, so we set the email inside the
--   block below (the old "\set" meta-command only works in the psql CLI).
-- ============================================================================

-- Fixed single-tenant org id (matches the app's default org).
DO $$
DECLARE
    v_org_id  UUID := '00000000-0000-0000-0000-000000000001';
    -- >>> EDIT THIS to the exact email you created in Step 1 <<<
    v_email   TEXT := 'admin@thinkerzz.com';
    v_user_id UUID;
BEGIN
    -- Ensure the organisation exists.
    INSERT INTO public.orgs (id, name)
    VALUES (v_org_id, 'Thinkerzz Academy')
    ON CONFLICT (id) DO NOTHING;

    -- Find the auth user created in Step 1.
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
          'No auth user found for %. Complete STEP 1 (Add user) first.', v_email;
    END IF;

    -- Remove any stale/orphaned profile for this email (e.g. left over from the
    -- old auto-signup flow) so we do not end up with duplicate admin profiles.
    DELETE FROM public.profiles WHERE email = v_email AND user_id <> v_user_id;

    -- Create (or refresh) the admin profile for that user.
    INSERT INTO public.profiles (org_id, user_id, role, name, email)
    VALUES (v_org_id, v_user_id, 'admin', 'Academy Admin', v_email)
    ON CONFLICT (user_id) DO UPDATE
        SET role = 'admin',
            org_id = EXCLUDED.org_id,
            deleted_at = NULL,
            updated_at = NOW();

    RAISE NOTICE 'Admin profile ready for % (user_id %).', v_email, v_user_id;
END $$;

-- Verify:
-- SELECT p.role, p.email, p.org_id FROM public.profiles p ORDER BY p.created_at;
