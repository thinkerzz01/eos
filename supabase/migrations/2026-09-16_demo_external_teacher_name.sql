-- Name of the external (outside / not-yet-hired) tutor who conducted a demo.
-- Captured at Log Outcome when conducted_by = 'external'. Nullable + additive.
ALTER TABLE public.demos
  ADD COLUMN IF NOT EXISTS external_teacher_name text;
