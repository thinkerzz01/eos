-- ============================================================================
-- 2026-09-11  Edexcel subjects (Int GCSE codes + IAL names)
--
-- The subject NAMES are shared with Cambridge, but the CODES differ by board, so
-- the Cambridge seed did NOT cover the Edexcel programs. This seeds them:
--   * 'Edexcel IGCSE' -> Edexcel International GCSE subjects WITH their spec codes
--     (4MA1, 4PH1, … — verify vs the Pearson Int GCSE information manual).
--   * 'Edexcel AS' / 'Edexcel A2' -> the core IAL subject NAMES with NO code
--     (Edexcel IAL is unit-based; set each qualification code in the Subjects
--     manager from the IAL manual).
-- Idempotent; runs for every org. Requires the AS/A2/Edexcel program CHECK to
-- already allow these programs (2026-09-08 migration).
-- ============================================================================

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS code TEXT;

DO $$
DECLARE
    v_org UUID;
    rec   RECORD;
    prog  TEXT;
    ial_progs TEXT[] := ARRAY['Edexcel AS', 'Edexcel A2'];
    ial_subjects TEXT[] := ARRAY[
        'Mathematics', 'Further Mathematics', 'Physics', 'Chemistry', 'Biology',
        'Economics', 'Business', 'Accounting', 'Computer Science', 'Information Technology',
        'English (First Language)', 'Literature in English', 'Geography', 'History',
        'Psychology', 'Law'
    ];
    subj TEXT;
BEGIN
    FOR v_org IN SELECT id FROM public.orgs LOOP

        -- Edexcel International GCSE: subjects WITH their spec codes.
        FOR rec IN SELECT * FROM (VALUES
            ('Mathematics','4MA1'), ('Additional Mathematics','4PM1'), ('Further Mathematics','4PM1'),
            ('Physics','4PH1'), ('Chemistry','4CH1'), ('Biology','4BI1'), ('Combined Science','4SD0'),
            ('Computer Science','4CP0'), ('Information Technology','4IT1'), ('Accounting','4AC1'),
            ('Economics','4EC1'), ('Business','4BS1'), ('Business Studies','4BS1'), ('Commerce','4CM1'),
            ('Geography','4GE1'), ('History','4HI1'), ('English (First Language)','4EA1'),
            ('English (Second Language)','4EB1'), ('Literature in English','4ET1'),
            ('Islamiyat','4IS1'), ('Pakistan Studies','4PA1'), ('Urdu','4UR0'), ('Arabic','4AA1')
        ) AS s(name, code) LOOP
            IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE org_id=v_org AND name=rec.name AND program='Edexcel IGCSE' AND deleted_at IS NULL) THEN
                INSERT INTO public.subjects (org_id, name, program, code) VALUES (v_org, rec.name, 'Edexcel IGCSE', rec.code);
            ELSE
                UPDATE public.subjects SET code=rec.code WHERE org_id=v_org AND name=rec.name AND program='Edexcel IGCSE' AND deleted_at IS NULL AND (code IS NULL OR code='');
            END IF;
        END LOOP;

        -- Edexcel International AS / A Level: names only (codes set in the manager).
        FOREACH prog IN ARRAY ial_progs LOOP
            FOREACH subj IN ARRAY ial_subjects LOOP
                IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE org_id=v_org AND name=subj AND program=prog AND deleted_at IS NULL) THEN
                    INSERT INTO public.subjects (org_id, name, program) VALUES (v_org, subj, prog);
                END IF;
            END LOOP;
        END LOOP;

    END LOOP;
END $$;

-- Verify:
-- SELECT program, name, code FROM public.subjects WHERE program LIKE 'Edexcel%' AND deleted_at IS NULL ORDER BY program, name;
