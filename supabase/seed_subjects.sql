-- ============================================================================
-- Thinkerzz EOS — Seed core CAIE subjects (Phase 2 reference data).
-- Classes/homework/tests reference a subject, so subjects must exist first.
-- Run once in the Supabase SQL Editor. Idempotent (skips existing rows).
-- ============================================================================
DO $$
DECLARE
    v_org  UUID := '00000000-0000-0000-0000-000000000001';
    prog   TEXT;
    subj   TEXT;
    progs  TEXT[] := ARRAY['O Level', 'A Level', 'IGCSE'];
    subjs  TEXT[] := ARRAY[
        'Mathematics', 'Additional Mathematics', 'Physics', 'Chemistry', 'Biology',
        'Computer Science', 'Economics', 'Accounting', 'Business Studies',
        'English (First Language)'
    ];
BEGIN
    -- Make sure the org exists so the FK below never fails, regardless of
    -- whether seed_admin.sql has run yet.
    INSERT INTO public.orgs (id, name)
    VALUES (v_org, 'Thinkerzz Academy')
    ON CONFLICT (id) DO NOTHING;

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

-- Verify:
-- SELECT name, program FROM public.subjects WHERE deleted_at IS NULL ORDER BY program, name;
