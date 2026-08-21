import 'server-only';
import { headers } from 'next/headers';

// Abuse protection for the ANON public forms (booking, enrollment, onboarding).
// Two layers, both fail-open when unconfigured so dev/un-set deploys keep working:
//   1) Per-IP rate limit (in-memory sliding window). Effective on a single
//      long-running Node process (a VPS). On multi-instance serverless it is
//      per-instance only - front the app with Cloudflare rate-limiting for a hard
//      cross-instance cap.
//   2) Cloudflare Turnstile challenge - enabled by setting TURNSTILE_SECRET_KEY
//      (server) + NEXT_PUBLIC_TURNSTILE_SITE_KEY (client). Until then it is skipped.

type Timestamps = number[];
const buckets = new Map<string, Timestamps>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  // Bound memory: occasionally drop fully-expired buckets.
  if (buckets.size > 5000) {
    buckets.forEach((v, k) => {
      if (v.every((t: number) => now - t > windowMs)) buckets.delete(k);
    });
  }
  return true;
}

export function clientIp(): string {
  const h = headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('cf-connecting-ip') || h.get('x-real-ip') || 'unknown';
}

export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY?.trim();
}

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true; // not configured -> do not block
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    if (!res.ok) return false;
    const json: any = await res.json();
    return json?.success === true;
  } catch {
    return false;
  }
}

/**
 * Guard a public-form submission: rate-limit by IP, then verify the Turnstile
 * token (if Turnstile is configured). Returns a friendly error to show the user.
 */
export async function guardPublicSubmit(input: {
  action: string;
  token?: string;
  limit?: number; // default 5
  windowMs?: number; // default 10 minutes
}): Promise<{ ok: boolean; error?: string }> {
  const ip = clientIp();
  const okRate = rateLimit(`${input.action}:${ip}`, input.limit ?? 5, input.windowMs ?? 10 * 60 * 1000);
  if (!okRate) {
    return { ok: false, error: 'Too many attempts from your connection. Please wait a few minutes and try again.' };
  }
  const human = await verifyTurnstile(input.token, ip);
  if (!human) {
    return { ok: false, error: 'Please complete the verification challenge and try again.' };
  }
  return { ok: true };
}
