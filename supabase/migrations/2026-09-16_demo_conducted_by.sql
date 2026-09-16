-- Record who ran a demo: an in-system ('internal') teacher, or an outside /
-- not-yet-hired ('external') teacher. Set at Log Outcome. External demos have no
-- teacher_id and never trigger any email/invite. Nullable + additive, so existing
-- rows and the app keep working before/after this runs.
ALTER TABLE public.demos
  ADD COLUMN IF NOT EXISTS conducted_by text
  CHECK (conducted_by IN ('internal', 'external'));
