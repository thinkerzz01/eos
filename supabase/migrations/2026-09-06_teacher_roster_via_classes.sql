-- A teacher's roster now = students they teach via a subject enrollment
-- (student_subjects) OR via a scheduled class (class_sessions). Previously only
-- student_subjects counted, so a student assigned to a teacher purely by
-- SCHEDULING A CLASS (class_sessions.teacher_id) never appeared on the teacher's
-- "My Students" / Assessments tabs - even though the teacher dashboard, which
-- counts class_sessions, DID show them. This aligns the tabs with the dashboard
-- and with what the teacher actually teaches. All still scoped to the teacher's
-- own id, so no cross-teacher leakage. Idempotent (DROP + CREATE).

-- My Students
DROP POLICY IF EXISTS teacher_read_own_students ON public.students;
CREATE POLICY teacher_read_own_students ON public.students FOR SELECT USING (
    current_user_role() = 'teacher' AND (
        id IN (SELECT student_id FROM public.student_subjects WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL)
        OR
        id IN (SELECT student_id FROM public.class_sessions WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL)
    )
);

-- Assessments (tests) for subjects the teacher teaches, by enrollment or by class
DROP POLICY IF EXISTS teacher_access_own_tests ON public.tests;
CREATE POLICY teacher_access_own_tests ON public.tests FOR ALL USING (
    current_user_role() = 'teacher' AND subject_id IN (
        SELECT subject_id FROM public.student_subjects WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
        UNION
        SELECT subject_id FROM public.class_sessions WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
    )
);
