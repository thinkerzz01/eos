-- Track homework submission independently of grading.
--
-- Homework used a single `status` (assigned -> submitted/late -> graded), so once a
-- teacher graded a row we could no longer tell whether the student had actually
-- submitted it from their portal. This adds a real `submitted_at` timestamp: the
-- student's submission stamps it, and grading no longer erases that fact. The
-- Submission column is then honest (Submitted only when the student truly
-- submitted), while grading lives in `status`.

ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Backfill: rows currently submitted/late were submitted by the student, so use
-- updated_at as the best-known submission time. Graded rows are intentionally left
-- NULL - we can't tell if they were submitted in the portal or graded directly.
UPDATE public.homework
  SET submitted_at = updated_at
  WHERE submitted_at IS NULL AND status IN ('submitted', 'late') AND deleted_at IS NULL;

-- Stamp submitted_at when the student submits (locked SECURITY DEFINER path).
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
    UPDATE public.homework
      SET status = v_new, submitted_at = NOW(), updated_at = NOW()
      WHERE id = p_homework_id;
    RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.student_submit_homework(UUID) TO authenticated;
