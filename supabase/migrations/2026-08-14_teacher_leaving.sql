-- Teacher departure: record WHEN a teacher leaves the academy and WHY.
-- Keeps the teacher's record (history / reporting) but moves them off the
-- active roster via a new 'left' status. Used by markTeacherLeft() and the
-- "Left the Academy" action on the Teachers tab.

-- 1) Two nullable columns: when they left + the reason (5 presets or custom).
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS leaving_reason TEXT NULL;

-- 2) Allow the 'left' status value alongside the existing ones.
ALTER TABLE public.teachers DROP CONSTRAINT IF EXISTS teachers_status_check;
ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_status_check
  CHECK (status IN ('available', 'in_class', 'on_leave', 'left'));
