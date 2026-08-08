// Thinkerzz EOS — server-side security helpers.
//
// The REAL access lock is the database: Postgres RLS policies (schema.sql) deny
// by default and are enforced on every query. This file intentionally holds no
// client-side "permission" logic — earlier versions had UI helpers that printed
// authoritative-looking "RLS denied" strings without ever calling the database,
// which was misleading. They have been removed. What remains is the one check
// that genuinely runs server-side: verifying the cron Bearer secret.

/**
 * CRON BEARER SECRET CHECK (AGENTS.md §3.3).
 * Guards the /api/cron/* routes, which run with the service-role client and no
 * user session. Returns true only for an exact `Authorization: Bearer <secret>`.
 */
export function verifyCronBearerHeader(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader) return false;
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.replace('Bearer ', '').trim();
  return token === expectedSecret && expectedSecret.length > 0;
}
