-- Let the student add a note when submitting homework — e.g. what they completed
-- and where they uploaded the file (WhatsApp / Google Drive link). No file storage;
-- the note is plain text the teacher reads when grading.

ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS submission_note TEXT;

-- Extend the locked submit RPC to accept + store the note. Replace the old
-- single-arg signature with a two-arg one (p_note defaults to NULL, so an
-- argument-less call still works).
DROP FUNCTION IF EXISTS public.student_submit_homework(UUID);

CREATE OR REPLACE FUNCTION public.student_submit_homework(p_homework_id UUID, p_note TEXT DEFAULT NULL)
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
      SET status = v_new,
          submitted_at = NOW(),
          submission_note = NULLIF(btrim(p_note), ''),
          updated_at = NOW()
      WHERE id = p_homework_id;
    RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.student_submit_homework(UUID, TEXT) TO authenticated;
