-- ============================================================================
-- Program labels -> granular set (O Level (O1) .. Inter (12)) across the portal.
-- Maps existing rows to the new labels, then swaps the CHECK constraint on every
-- table that has a `program` column. Run once in the Supabase SQL Editor.
-- Existing 'O Level'/'A Level' default to (O1)/(A1); adjust individual rows after
-- if any student is actually O2/A2.
-- ============================================================================
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['students', 'leads', 'subjects', 'syllabus_templates', 'announcement_targets'];
    new_check CONSTANT TEXT :=
      'program IN (''O Level (O1)'', ''O Level (O2)'', ''A Level (A1)'', ''A Level (A2)'', ''IGCSE'', ''Matric (9)'', ''Matric (10)'', ''Inter (11)'', ''Inter (12)'')';
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format($f$
            UPDATE public.%I SET program = CASE program
                WHEN 'O Level'      THEN 'O Level (O1)'
                WHEN 'A Level'      THEN 'A Level (A1)'
                WHEN 'Matric (9th)' THEN 'Matric (9)'
                WHEN 'Matric (10th)' THEN 'Matric (10)'
                WHEN 'Inter (11th)' THEN 'Inter (11)'
                WHEN 'Inter (12th)' THEN 'Inter (12)'
                ELSE program END
            WHERE program IS NOT NULL
        $f$, t);
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_program_check');
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s)', t, t || '_program_check', new_check);
    END LOOP;
END $$;

-- Verify:
-- SELECT DISTINCT program FROM public.students;
