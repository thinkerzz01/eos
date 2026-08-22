-- ============================================================================
-- 2026-08-22  Database linter hardening (Supabase Performance/Security lints)
--
-- Addresses two classes of WARN findings from the Supabase linter:
--
--   1. function_search_path_mutable (12 functions)
--      A SECURITY DEFINER function with a mutable search_path can be tricked
--      into resolving object names against an attacker-controlled schema.
--      We pin search_path to a fixed value on every flagged routine. `public`
--      stays on the path so the existing (unqualified) bodies keep resolving,
--      and pg_temp is placed LAST so temp objects can never shadow real ones.
--
--   2. anon/authenticated can EXECUTE trigger helper functions via /rpc/
--      audit_log_trigger_func() and update_updated_at_column() are TRIGGER
--      functions. Triggers fire through the trigger mechanism regardless of
--      EXECUTE grants, so exposing them on the REST RPC endpoint is pointless
--      surface area. We revoke EXECUTE from every client role.
--
-- NOT changed here (accepted by design — see notes at bottom):
--   * The public-form RPCs (create_public_booking, submit_enrollment,
--     submit_onboarding, get_student_public, get_open_slots,
--     student_submit_homework) are INTENTIONALLY anon-callable and carry their
--     own internal authorization. They keep EXECUTE.
--   * The current_* helpers are referenced by RLS policies for signed-in
--     users, so `authenticated` MUST keep EXECUTE or every policy breaks. They
--     only ever return the caller's own role/org/id, so there is no data leak.
--
-- Idempotent and resilient: each statement is guarded, so a since-renamed or
-- absent function is skipped with a NOTICE instead of aborting the run.
-- ============================================================================

DO $$
DECLARE
  sig text;
  -- Full signatures of every flagged function (must match the live catalog).
  sigs text[] := ARRAY[
    'public.update_updated_at_column()',
    'public.audit_log_trigger_func()',
    'public.current_user_role()',
    'public.current_user_org_id()',
    'public.current_teacher_id()',
    'public.current_student_id()',
    'public.get_open_slots(uuid, date)',
    'public.get_student_public(uuid)',
    'public.student_submit_homework(uuid)',
    'public.create_public_booking(uuid, text, text, text, text, text, text, timestamptz, text, text, text)',
    'public.submit_enrollment(uuid, text, text, text, text, text, text, text, text, text)',
    'public.submit_onboarding(uuid, text, text, text, text, text, date, jsonb)'
  ];
BEGIN
  -- 1. Pin search_path on all flagged functions.
  FOREACH sig IN ARRAY sigs LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', sig);
    EXCEPTION
      WHEN undefined_function THEN
        RAISE NOTICE 'skipped (not found): %', sig;
    END;
  END LOOP;

  -- 2. Remove pointless RPC exposure of the two trigger helpers.
  FOREACH sig IN ARRAY ARRAY[
    'public.audit_log_trigger_func()',
    'public.update_updated_at_column()'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
    EXCEPTION
      WHEN undefined_function THEN
        RAISE NOTICE 'skipped revoke (not found): %', sig;
    END;
  END LOOP;
END $$;
