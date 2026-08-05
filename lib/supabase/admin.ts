// SERVICE-ROLE Supabase client — bypasses RLS.
//
// This is the ONE legitimate place a service-role key is used: trusted backend
// cron jobs that run with NO user session (there is no cookie to authorize).
// Every caller MUST be behind the `Authorization: Bearer <CRON_SECRET_TOKEN>`
// check first. NEVER import this into a page, client component, or any code
// path reachable from the browser — that would defeat RLS (AGENTS.md §6).
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service-role env not configured (URL / SERVICE_ROLE_KEY).');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
