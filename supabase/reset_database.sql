-- ============================================================================
-- Thinkerzz EOS - FULL DATABASE RESET (Supabase)
-- ----------------------------------------------------------------------------
-- WARNING: this WIPES ALL DATA in the public schema (students, leads, vouchers,
-- everything). Your LOGIN accounts in the `auth` schema are NOT touched, but their
-- `profiles` rows are wiped, so you must re-seed the admin afterwards.
--
-- HOW TO USE (in the Supabase Dashboard -> SQL Editor):
--   1. Run THIS file (reset_database.sql).
--   2. Run the whole schema.sql.
--   3. Re-seed: your admin SQL (for thinkerzz01@gmail.com), seed_subjects.sql,
--      and (optional) the manager/teacher/student test-role SQL.
--
-- Only needed for a clean rebuild. For an existing DB you'd normally run a small
-- migration instead. GitHub does NOT apply this - you run it here manually.
-- ============================================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore the default access Supabase expects on the public schema.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- Next: run schema.sql (it re-creates every table, RLS policy, function, the
-- realtime publication, and the anon-EXECUTE lockdown), then re-seed.
