-- ============================================================================
-- 2026-08-22  Performance lint wins (targeted, low-risk)
--
-- Two cheap, safe optimizations from the Supabase performance linter. We are
-- deliberately NOT touching the 515 "multiple_permissive_policies" findings —
-- those are one per-role RLS design decision counted many times, harmless at
-- this scale, and only fixable by a risky full policy rewrite. Revisit only at
-- tens of thousands of rows.
--
--   PART A — Covering indexes on the FK columns this app actually joins/filters
--            on in hot paths (RLS subqueries, dashboards, the notification
--            bell). We skip the ~59 cold / org_id FKs the linter also lists:
--            org_id has near-zero selectivity here (effectively single-org) so
--            an index on it would never be used, and unused indexes only slow
--            writes. Every statement is additive and idempotent.
--
--   PART B — Wrap auth.uid() as (SELECT auth.uid()) in the 6 policies the
--            linter flagged for per-row re-evaluation (auth_rls_initplan).
--            The subselect makes Postgres evaluate it ONCE per query instead
--            of once per row. Semantically identical — a documented Supabase
--            best practice. Definitions are otherwise byte-for-byte unchanged.
-- ============================================================================

-- PART A — targeted covering indexes ---------------------------------------

CREATE INDEX IF NOT EXISTS idx_student_subjects_teacher_id   ON public.student_subjects (teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_student_id   ON public.student_subjects (student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject_id   ON public.student_subjects (subject_id);

CREATE INDEX IF NOT EXISTS idx_class_sessions_teacher_id     ON public.class_sessions (teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_student_id     ON public.class_sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_subject_id     ON public.class_sessions (subject_id);

CREATE INDEX IF NOT EXISTS idx_attendance_session_id         ON public.attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id         ON public.attendance (student_id);

CREATE INDEX IF NOT EXISTS idx_homework_student_id           ON public.homework (student_id);
CREATE INDEX IF NOT EXISTS idx_homework_teacher_id           ON public.homework (teacher_id);
CREATE INDEX IF NOT EXISTS idx_homework_subject_id           ON public.homework (subject_id);

CREATE INDEX IF NOT EXISTS idx_vouchers_student_id           ON public.vouchers (student_id);
CREATE INDEX IF NOT EXISTS idx_voucher_lines_voucher_id      ON public.voucher_lines (voucher_id);
CREATE INDEX IF NOT EXISTS idx_payments_voucher_id           ON public.payments (voucher_id);

CREATE INDEX IF NOT EXISTS idx_demos_teacher_id              ON public.demos (teacher_id);
CREATE INDEX IF NOT EXISTS idx_demos_lead_id                 ON public.demos (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_communications_lead_id   ON public.lead_communications (lead_id);

CREATE INDEX IF NOT EXISTS idx_tickets_opened_by            ON public.tickets (opened_by);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id    ON public.ticket_messages (ticket_id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_id    ON public.app_notifications (user_id);

-- PART B — hoist auth.uid() out of the per-row loop (6 policies) ------------

DROP POLICY IF EXISTS own_profile_read ON public.profiles;
CREATE POLICY own_profile_read ON public.profiles FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS own_app_notifications ON public.app_notifications;
CREATE POLICY own_app_notifications ON public.app_notifications FOR ALL
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS teacher_access_tickets ON public.tickets;
CREATE POLICY teacher_access_tickets ON public.tickets FOR ALL
  USING (current_user_role() = 'teacher' AND opened_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS student_access_own_tickets ON public.tickets;
CREATE POLICY student_access_own_tickets ON public.tickets FOR ALL
  USING (current_user_role() = 'student' AND opened_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS teacher_access_ticket_messages ON public.ticket_messages;
CREATE POLICY teacher_access_ticket_messages ON public.ticket_messages FOR ALL
  USING (current_user_role() = 'teacher' AND ticket_id IN (
    SELECT id FROM public.tickets WHERE opened_by = (SELECT auth.uid()) AND deleted_at IS NULL
  ));

DROP POLICY IF EXISTS student_access_own_ticket_messages ON public.ticket_messages;
CREATE POLICY student_access_own_ticket_messages ON public.ticket_messages FOR ALL
  USING (current_user_role() = 'student' AND ticket_id IN (
    SELECT id FROM public.tickets WHERE opened_by = (SELECT auth.uid()) AND deleted_at IS NULL
  ));
