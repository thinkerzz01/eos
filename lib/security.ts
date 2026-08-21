// Thinkerzz EOS - server-side security helpers.
//
// The REAL access lock is the database: Postgres RLS policies (schema.sql) deny
// by default and are enforced on every query. This file intentionally holds no
// client-side "permission" logic - earlier versions had UI helpers that printed
// authoritative-looking "RLS denied" strings without ever calling the database,
// which was misleading. They have been removed. What remains is the one check
// that genuinely runs server-side: verifying the cron Bearer secret.

/**
 * CRON BEARER SECRET CHECK (AGENTS.md §3.3).
 * Guards the /api/cron/* routes, which run with the service-role client and no
 * user session. Returns true only for an exact `Authorization: Bearer <secret>`.
 */
import { timingSafeEqual } from 'crypto';

/**
 * The cron shared secret. Accepts either CRON_SECRET_TOKEN (this app's name, used
 * by an external pinger) or CRON_SECRET (the name Vercel Cron uses when it
 * auto-attaches `Authorization: Bearer <CRON_SECRET>` to scheduled invocations).
 * Set whichever matches your scheduler - or both to the same value.
 */
export function cronSecret(): string {
  return process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET || '';
}

export function verifyCronBearerHeader(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader) return false;
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!expectedSecret || token.length === 0) return false;
  // Constant-time comparison (avoids leaking the secret via response timing).
  // timingSafeEqual requires equal-length buffers, so length must match first;
  // token length is not itself sensitive.
  const a = Buffer.from(token);
  const b = Buffer.from(expectedSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
