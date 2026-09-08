-- ============================================================================
-- 2026-09-08  Programs: rename A Level (A1)/(A2) -> AS / A2, add Edexcel
--
-- New program set across every table with a `program` column. Done in the right
-- order so it can't fail: DROP the old CHECK, RENAME the old A-Level rows to the
-- new AS / A2 values, then ADD the new CHECK. (Adding the new CHECK first would
-- reject the still-old rows; renaming first without dropping the CHECK is what
-- errored with 23514.) Safe to run once; re-running is a no-op on the rows.
-- ============================================================================

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
        -- 1. drop the old CHECK so the rename below is allowed
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_program_check');

        -- 2. rename the old A-Level labels to the new AS / A2
        EXECUTE format($f$
            UPDATE public.%I SET program = CASE program
                WHEN 'A Level (A1)' THEN 'AS'
                WHEN 'A Level (A2)' THEN 'A2'
                ELSE program END
            WHERE program IN ('A Level (A1)', 'A Level (A2)')
        $f$, t);

        -- 3. add the new CHECK (all rows now hold valid values)
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s)', t, t || '_program_check', new_check);
    END LOOP;
END $$;

-- Verify afterwards:
-- SELECT DISTINCT program FROM public.students ORDER BY 1;
