-- Homework: add an optional description (instructions) and real grading fields.
--
-- Before this, homework had only a title + deadline, and "grading" just flipped
-- the status to graded with no mark captured. This adds:
--   description  - the full task / instructions the teacher writes when assigning
--   max_score    - the marks the homework is out of (defaults shown as 100 in UI)
--   feedback     - the teacher's optional note when grading
-- (the `score` column already exists.) All nullable and additive.

ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS max_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS feedback TEXT;
