-- ============================================================================
-- Enrollment backbone: allow student_subjects rows WITHOUT a syllabus template.
-- The syllabus master-data system was archived on 2026-08-08, so requiring a
-- syllabus_template_id made it impossible to enroll a student in a subject at
-- all (the column is NOT NULL with an FK to a table that is now empty). This
-- drops that NOT NULL so a student can be linked to a subject + teacher now, and
-- a syllabus template can be attached later if/when that system returns.
--
-- teacher_id STAYS NOT NULL: an enrollment must name the teacher (that link is
-- what powers teacher load, the teacher's student roster, the dashboard Teacher
-- filter, and per-subject assessed grades). Run once in the Supabase SQL Editor.
-- ============================================================================
ALTER TABLE public.student_subjects
  ALTER COLUMN syllabus_template_id DROP NOT NULL;

-- Verify:
-- SELECT is_nullable FROM information_schema.columns
--   WHERE table_name = 'student_subjects' AND column_name = 'syllabus_template_id';
