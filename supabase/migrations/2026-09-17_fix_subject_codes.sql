-- ============================================================================
-- 2026-09-17  Fix incorrect Cambridge subject codes
--
-- Verified every coded subject row against the official Cambridge subject pages
-- (AS & A Level, IGCSE, O Level). O Level and IGCSE codes were all correct.
-- The only wrong code was AS/A Level "Sport & Physical Education", which held
-- 9395 - that code is actually Travel & Tourism. The correct Cambridge
-- International AS & A Level Physical Education code is 9396.
-- Idempotent: only changes rows still holding the wrong code.
-- ============================================================================

UPDATE public.subjects
SET code = '9396'
WHERE program IN ('AS','A2')
  AND name = 'Sport & Physical Education'
  AND code = '9395'
  AND deleted_at IS NULL;

-- IGCSE "Sport & Physical Education" had no code. Official Cambridge IGCSE
-- Physical Education is 0413. Only fills the blank, so it is safe to re-run.
UPDATE public.subjects
SET code = '0413'
WHERE program = 'IGCSE'
  AND name = 'Sport & Physical Education'
  AND (code IS NULL OR code = '')
  AND deleted_at IS NULL;

-- Verify:
-- SELECT program, name, code FROM public.subjects
--   WHERE name = 'Sport & Physical Education' AND deleted_at IS NULL;
