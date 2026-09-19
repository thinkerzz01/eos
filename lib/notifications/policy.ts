// GLOBAL COMMS SWITCH (owner request, 2026-09-19)
// ------------------------------------------------
// Only DEMO and CLASS communications go out. Everything else is suppressed at the
// source: fee-due / grace / grace-expired alerts, payment receipts, monthly
// reports, lead follow-ups, and homework in-app pings. To re-enable a channel,
// add its type/category to the sets below.
//
// NOT governed here (kept working on purpose):
//   - Auth emails (password reset, account invite) - sent directly; essential for
//     login/onboarding, must never be blocked.
//   - Demo emails (booking confirmation to the family, teacher assignment) - sent
//     directly via Resend, not through the queue, so they are unaffected.

// Queue (email) notification types allowed to send. Demo emails are direct sends,
// so only the class emails are listed here.
export const ENABLED_EMAIL_TYPES = new Set<string>(['class_reminder', 'class_rescheduled']);
export function isEmailEnabled(type: string): boolean {
  return ENABLED_EMAIL_TYPES.has(type);
}

// In-app (bell) notification categories allowed. Each notice is tagged by the
// caller; an untagged notice is treated as disabled.
export const ENABLED_INAPP_CATEGORIES = new Set<string>(['class', 'demo']);
export function isInAppEnabled(category?: string): boolean {
  return !!category && ENABLED_INAPP_CATEGORIES.has(category);
}
