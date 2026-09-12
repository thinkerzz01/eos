-- Backfill student_subjects enrollment from the timetable.
--
-- Students whose classes were created directly in the schedule wizard never got a
-- student_subjects row (that link was only ever written at admission). As a result
-- the teacher's homework / test "Subject" picker showed "No subjects assigned to
-- this student", even though the student clearly has that subject on the timetable.
--
-- This creates the missing enrollment links from class_sessions. It is additive
-- and idempotent (the NOT EXISTS guard skips any student+subject that already has
-- a live enrollment), so it is safe to run more than once. Going forward the app
-- writes the enrollment when a class is scheduled, so this is a one-time repair.

INSERT INTO public.student_subjects (org_id, student_id, subject_id, teacher_id, target_grade)
SELECT DISTINCT ON (cs.student_id, cs.subject_id)
  cs.org_id, cs.student_id, cs.subject_id, cs.teacher_id, 'A*'
FROM public.class_sessions cs
WHERE cs.deleted_at IS NULL
  AND cs.teacher_id IS NOT NULL
  AND cs.subject_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.student_subjects ss
    WHERE ss.student_id = cs.student_id
      AND ss.subject_id = cs.subject_id
      AND ss.deleted_at IS NULL
  )
ORDER BY cs.student_id, cs.subject_id, cs.created_at ASC;
