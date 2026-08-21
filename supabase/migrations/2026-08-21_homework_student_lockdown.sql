-- ============================================================================
-- SECURITY FIX (H1): students could grade their own homework.
-- The old policy gave students FOR ALL on their own homework rows, so a student
-- could set status='graded' + score=100 (directly via the anon key, or through
-- the gradeHomework action). This:
--   1) restricts students to SELECT (read) only, and
--   2) adds a locked SECURITY DEFINER RPC that lets a student submit their OWN
--      homework - flipping status to 'submitted'/'late' ONLY, never touching the
--      score and never setting 'graded'.
-- Grading/edit stays with admin/manager/teacher (their existing policies + an
-- explicit role check in the server actions). Run in the Supabase SQL Editor.
-- ============================================================================

-- 1. Students: read-only on their own homework (was FOR ALL).
DROP POLICY IF EXISTS student_access_own_homework ON public.homework;
DROP POLICY IF EXISTS student_read_own_homework ON public.homework;
CREATE POLICY student_read_own_homework ON public.homework FOR SELECT USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);

-- 2. Locked submission path. SECURITY DEFINER, but internally scoped to the
--    caller's own student_id via current_student_id(), so it can only ever touch
--    the calling student's homework, and only the status column.
CREATE OR REPLACE FUNCTION public.student_submit_homework(p_homework_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_deadline TIMESTAMPTZ;
    v_status TEXT;
    v_new TEXT;
BEGIN
    SELECT deadline, status INTO v_deadline, v_status
    FROM public.homework
    WHERE id = p_homework_id
      AND student_id = current_student_id()
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Homework not found.';
    END IF;
    IF v_status = 'graded' THEN
        RAISE EXCEPTION 'This homework has already been graded.';
    END IF;

    v_new := CASE WHEN v_deadline IS NOT NULL AND v_deadline < NOW() THEN 'late' ELSE 'submitted' END;
    UPDATE public.homework SET status = v_new, updated_at = NOW() WHERE id = p_homework_id;
    RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.student_submit_homework(UUID) TO authenticated;

-- Verify:
-- SELECT polname, cmd FROM pg_policies WHERE tablename = 'homework' AND polname LIKE 'student%';
