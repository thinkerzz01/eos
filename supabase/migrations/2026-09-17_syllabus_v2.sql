-- ============================================================================
-- 2026-09-17  Syllabus module v2 (coverage tracking, one-on-one)
--
-- Rebuilds the archived syllabus system for the new model agreed with the owner:
--   * Master outline per subject, kept as versions (exam-year cycles) via
--     syllabus_templates (reused) -> syllabus_topics (reused, +code) ->
--     syllabus_subtopics (NEW, with learning objectives as JSONB).
--   * Per-enrollment SNAPSHOT so editing a master never disturbs a live student:
--     student_syllabus (NEW header) + student_syllabus_item (NEW, frozen outline
--     + coverage state). Coverage lives ON the item.
--   * Teachers mark coverage in-session; students view read-only (later phases).
--
-- AS vs A2 is handled by separate subject rows (AS master = topics 1-11, A2 = 12-25).
-- Legacy syllabus_progress is left dormant (monthlyReport reads its count -> 0);
-- it is rewired to the new coverage in Phase 2, then dropped in a later cleanup.
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Master template: relax the old program constraint (subject_id already encodes
--    program; a template is one exam-year version of a subject's outline).
ALTER TABLE public.syllabus_templates ALTER COLUMN program DROP NOT NULL;
ALTER TABLE public.syllabus_templates DROP CONSTRAINT IF EXISTS syllabus_templates_program_check;
-- One ACTIVE template per subject (older versions stay as status='archived').
CREATE UNIQUE INDEX IF NOT EXISTS uq_syllabus_templates_active_subject
    ON public.syllabus_templates (subject_id)
    WHERE status = 'active' AND deleted_at IS NULL;

-- 2. Topics: add a code ("1", "2", ...).
ALTER TABLE public.syllabus_topics ADD COLUMN IF NOT EXISTS code TEXT;

-- 3. Subtopics (NEW) - the level teachers tick; objectives kept as a faithful copy.
CREATE TABLE IF NOT EXISTS public.syllabus_subtopics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    topic_id UUID NOT NULL REFERENCES public.syllabus_topics(id) ON DELETE CASCADE,
    code TEXT,
    name TEXT NOT NULL,
    objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_syllabus_subtopics_topic_id ON public.syllabus_subtopics (topic_id);

-- 4. Per-enrollment snapshot header (NEW).
CREATE TABLE IF NOT EXISTS public.student_syllabus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
    template_id UUID NULL REFERENCES public.syllabus_templates(id),
    source_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_syllabus_student_subject
    ON public.student_syllabus (student_id, subject_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_student_syllabus_student_id ON public.student_syllabus (student_id);

-- 5. Per-enrollment snapshot item (NEW) - frozen outline + coverage state.
CREATE TABLE IF NOT EXISTS public.student_syllabus_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    student_syllabus_id UUID NOT NULL REFERENCES public.student_syllabus(id) ON DELETE CASCADE,
    topic_code TEXT,
    topic_name TEXT,
    subtopic_code TEXT,
    subtopic_name TEXT NOT NULL,
    objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'covered')),
    covered_on DATE NULL,
    covered_by UUID NULL REFERENCES public.teachers(id),
    session_id UUID NULL REFERENCES public.class_sessions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_syllabus_item_parent ON public.student_syllabus_item (student_syllabus_id);

-- ----------------------------------------------------------------------------
-- RLS (mirrors the existing model: helper fns current_user_role/current_user_org_id
-- /current_teacher_id/current_student_id). Master tables are admin/manager only;
-- teachers/students only ever touch the SNAPSHOT tables.
-- syllabus_templates + syllabus_topics already have admin/manager policies.
-- ----------------------------------------------------------------------------
ALTER TABLE public.syllabus_subtopics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_syllabus      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_syllabus_item ENABLE ROW LEVEL SECURITY;

-- syllabus_subtopics: admin + manager only (master data).
DROP POLICY IF EXISTS admin_full_access_syllabus_subtopics ON public.syllabus_subtopics;
CREATE POLICY admin_full_access_syllabus_subtopics ON public.syllabus_subtopics FOR ALL
    USING (current_user_role() = 'admin' AND org_id = current_user_org_id());
DROP POLICY IF EXISTS manager_access_syllabus_subtopics ON public.syllabus_subtopics;
CREATE POLICY manager_access_syllabus_subtopics ON public.syllabus_subtopics FOR ALL
    USING (current_user_role() = 'manager' AND org_id = current_user_org_id());

-- student_syllabus: admin + manager full; teacher own students; student read own.
DROP POLICY IF EXISTS admin_full_access_student_syllabus ON public.student_syllabus;
CREATE POLICY admin_full_access_student_syllabus ON public.student_syllabus FOR ALL
    USING (current_user_role() = 'admin' AND org_id = current_user_org_id());
DROP POLICY IF EXISTS manager_access_student_syllabus ON public.student_syllabus;
CREATE POLICY manager_access_student_syllabus ON public.student_syllabus FOR ALL
    USING (current_user_role() = 'manager' AND org_id = current_user_org_id());
DROP POLICY IF EXISTS teacher_access_own_student_syllabus ON public.student_syllabus;
CREATE POLICY teacher_access_own_student_syllabus ON public.student_syllabus FOR ALL
    USING (current_user_role() = 'teacher' AND student_id IN (
        SELECT student_id FROM public.student_subjects WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
    ));
DROP POLICY IF EXISTS student_read_own_student_syllabus ON public.student_syllabus;
CREATE POLICY student_read_own_student_syllabus ON public.student_syllabus FOR SELECT
    USING (current_user_role() = 'student' AND student_id = current_student_id());

-- student_syllabus_item: same access, resolved via the parent snapshot header.
DROP POLICY IF EXISTS admin_full_access_student_syllabus_item ON public.student_syllabus_item;
CREATE POLICY admin_full_access_student_syllabus_item ON public.student_syllabus_item FOR ALL
    USING (current_user_role() = 'admin' AND org_id = current_user_org_id());
DROP POLICY IF EXISTS manager_access_student_syllabus_item ON public.student_syllabus_item;
CREATE POLICY manager_access_student_syllabus_item ON public.student_syllabus_item FOR ALL
    USING (current_user_role() = 'manager' AND org_id = current_user_org_id());
DROP POLICY IF EXISTS teacher_access_own_student_syllabus_item ON public.student_syllabus_item;
CREATE POLICY teacher_access_own_student_syllabus_item ON public.student_syllabus_item FOR ALL
    USING (current_user_role() = 'teacher' AND student_syllabus_id IN (
        SELECT id FROM public.student_syllabus WHERE deleted_at IS NULL AND student_id IN (
            SELECT student_id FROM public.student_subjects WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
        )
    ));
DROP POLICY IF EXISTS student_read_own_student_syllabus_item ON public.student_syllabus_item;
CREATE POLICY student_read_own_student_syllabus_item ON public.student_syllabus_item FOR SELECT
    USING (current_user_role() = 'student' AND student_syllabus_id IN (
        SELECT id FROM public.student_syllabus WHERE deleted_at IS NULL AND student_id = current_student_id()
    ));

-- Verify (run after applying):
-- SELECT table_name FROM information_schema.tables WHERE table_name IN
--   ('syllabus_subtopics','student_syllabus','student_syllabus_item');
