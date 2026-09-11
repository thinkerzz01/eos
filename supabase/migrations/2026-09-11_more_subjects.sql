-- ============================================================================
-- 2026-09-11  Expand the Cambridge subject catalog (+ codes)
--
-- Adds the full Cambridge subject set (compiled from the official O Level and
-- AS & A Level catalogs on cambridgeinternational.org) to every org, across the
-- Cambridge programs (O1, O2, AS, A2, IGCSE), with the default code per subject
-- (one per subject — editable per row in the Subjects manager). Idempotent:
-- inserts a (subject, program) only if missing, and backfills a blank code.
-- Names are shared across levels (the code is the O-Level default where a subject
-- exists there, else the AS/A-Level code); adjust any per-program code in the
-- Subjects manager. Admin can delete subjects that a given program doesn't offer.
--
-- Requires the earlier `subjects.code` column and the AS/A2 program CHECK — this
-- self-heals the column and only targets Cambridge programs.
-- ============================================================================

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS code TEXT;

DO $$
DECLARE
    v_org UUID;
    prog  TEXT;
    progs TEXT[] := ARRAY['O Level (O1)', 'O Level (O2)', 'AS', 'A2', 'IGCSE'];
    rec   RECORD;
BEGIN
    FOR v_org IN SELECT id FROM public.orgs LOOP
        FOREACH prog IN ARRAY progs LOOP
            FOR rec IN
                SELECT * FROM (VALUES
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
                ) AS s(name, code)
            LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM public.subjects
                    WHERE org_id = v_org AND name = rec.name AND program = prog AND deleted_at IS NULL
                ) THEN
                    INSERT INTO public.subjects (org_id, name, program, code)
                    VALUES (v_org, rec.name, prog, rec.code);
                ELSE
                    UPDATE public.subjects SET code = rec.code
                    WHERE org_id = v_org AND name = rec.name AND program = prog
                      AND deleted_at IS NULL AND (code IS NULL OR code = '');
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- Verify:
-- SELECT program, count(*) FROM public.subjects WHERE deleted_at IS NULL GROUP BY program ORDER BY 1;
