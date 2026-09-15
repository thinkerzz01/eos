// Message catalogue + merge-field rendering.
// LOCKED invariant (AGENTS.md §3.5 / Master Plan §8): templates NEVER hardcode a
// gendered pronoun. Use {{student_name}} and a {{pronoun}} merge field sourced
// from the student's gender. Tone: greeting + a "hope you are well" line, clear
// purpose, kind close. No slang, no emojis, no dashes. Signed "Thinkerzz".

export type NotificationType =
  | 'class_reminder'
  | 'class_rescheduled'
  | 'fee_due'
  | 'grace_ending'
  | 'demo_confirmed'
  | 'payment_received'
  | 'monthly_report'
  | 'follow_up'
  | 'announcement'
  | 'grace_expired_admin';

export interface Pronoun {
  subject: string; // he / she / they
  object: string; // him / her / them
  possessive: string; // his / her / their
}

export function pronounFor(gender?: string | null): Pronoun {
  switch ((gender ?? '').toLowerCase()) {
    case 'male':
      return { subject: 'he', object: 'him', possessive: 'his' };
    case 'female':
      return { subject: 'she', object: 'her', possessive: 'her' };
    default:
      return { subject: 'they', object: 'them', possessive: 'their' };
  }
}

/** Replace {{token}} with vars[token]; unknown tokens render as empty string. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

/** Build the merge-field map from a notification payload (adds pronoun fields). */
export function buildVars(payload: Record<string, any>): Record<string, string> {
  const p = pronounFor(payload.gender);
  return {
    student_name: payload.student_name ?? '',
    parent_name: payload.parent_name ?? 'Parent',
    voucher_no: payload.voucher_no ?? '',
    due_date: payload.due_date ?? '',
    grace_deadline: payload.grace_deadline ?? '',
    class_subject: payload.class_subject ?? '',
    class_time: payload.class_time ?? '',
    amount: payload.amount != null ? String(payload.amount) : '',
    body: payload.body ?? '',
    // Demo-confirmation fields (used by the demo_confirmed template).
    date: payload.date ?? '',
    time: payload.time ?? '',
    subject: payload.subject ?? payload.class_subject ?? '',
    duration: payload.duration ?? '',
    pronoun: p.subject,
    pronoun_object: p.object,
    pronoun_possessive: p.possessive,
  };
}

interface Template {
  subject: string;
  body: string;
  // Optional direct-action button. `path` is appended to the portal URL; `useMeet`
  // uses the Google Meet link from the payload (falls back to `path` if absent).
  cta?: { label: string; path?: string; useMeet?: boolean };
}

export const TEMPLATES: Record<NotificationType, Template> = {
  class_reminder: {
    subject: 'Class Reminder For {{student_name}}',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nWe hope you are well. This is a friendly reminder that {{student_name}} has a {{class_subject}} class at {{class_time}}. Please make sure {{pronoun}} joins on time.\n\nWarm regards,\nThinkerzz',
    cta: { label: 'Join Your Class', useMeet: true, path: '/schedule' },
  },
  class_rescheduled: {
    subject: 'Class Rescheduled For {{student_name}}',
    body:
      "Assalam o Alaikum {{parent_name}},\n\nPlease note that {{student_name}}'s {{class_subject}} class has been rescheduled to {{class_time}}.\n\nPlease make sure {{pronoun}} joins at the new time.\n\nWe apologise for the change and appreciate your understanding.\n\nRegards,\nThinkerzz",
    cta: { label: 'View Your Classes', useMeet: true, path: '/schedule' },
  },
  fee_due: {
    subject: 'Fee Reminder For {{student_name}}',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nThis is a reminder that the fee for {{student_name}} is due on {{due_date}}.\n\nOnce paid, you can share the payment screenshot with us on WhatsApp or upload it through your portal.\n\nThank you.\n\nRegards,\nThinkerzz',
    cta: { label: 'View & Pay Voucher', path: '/fees' },
  },
  grace_ending: {
    subject: "A Quick Note About {{student_name}}'s Fee",
    body:
      "Assalam o Alaikum {{parent_name}},\n\nA quick reminder that the grace period for {{student_name}}'s fee ends on {{grace_deadline}}.\n\nPlease complete the payment before the deadline so {{student_name}}'s classes can continue without interruption.\n\nIf you have already made the payment, please disregard this message.\n\nRegards,\nThinkerzz",
    cta: { label: 'Pay Now', path: '/fees' },
  },
  demo_confirmed: {
    subject: 'Demo Confirmed: {{student_name}} | {{date}}',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nYour demo for {{student_name}} is confirmed.\n\nDemo Class Details\nDate: {{date}}\nTime: {{time}}\nSubject: {{subject}}\nDuration: {{duration}}\n\nJoin using the Google Meet button below. If the meeting link is not available yet, we will send it to you on WhatsApp.\n\nBefore Your Demo\nPlease join 5 minutes early and keep your study materials ready.\n\nWe look forward to meeting {{student_name}}.\n\nRegards,\nThinkerzz',
    cta: { label: 'Join Demo Class', useMeet: true },
  },
  payment_received: {
    subject: 'Payment Received For {{student_name}}',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nYour payment for {{student_name}} has been received successfully.\n\nThe payment receipt is now available in your Thinkerzz portal.\n\nThank you for choosing Thinkerzz.\n\nRegards,\nThinkerzz',
    cta: { label: 'View Receipt', path: '/fees' },
  },
  monthly_report: {
    subject: 'Monthly Progress Report For {{student_name}}',
    body:
      "Assalam o Alaikum {{parent_name}},\n\n{{body}}\n\nYou can view the complete progress report and other academic details in your Thinkerzz portal.\n\nThank you for being part of {{student_name}}'s learning journey.\n\nRegards,\nThinkerzz",
    cta: { label: 'Open Your Portal', path: '/login' },
  },
  follow_up: {
    subject: 'Following Up About {{student_name}}',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nWe are following up regarding {{student_name}}.\n\nIf you have any questions or need help with anything, please feel free to contact us. We will be happy to assist.\n\nRegards,\nThinkerzz',
  },
  announcement: {
    subject: '{{class_subject}}',
    body: '{{body}}',
    cta: { label: 'View in Portal', path: '/announcements' },
  },
  // Internal, Admin-facing alert (not a parent message) when a grace period has
  // expired unpaid - pushes the Stop/Extend/Mark-Paid decision (Master Plan §7).
  grace_expired_admin: {
    subject: 'Fee Decision Needed For {{student_name}}',
    body:
      'Admin Note\n\nThe grace period for voucher {{voucher_no}} for {{student_name}} ended on {{grace_deadline}}, and the voucher is still unpaid.\n\nPlease review the voucher in the Fee Vouchers section and select one of the available actions: Stop, Extend, or Mark Paid.\n\nRegards,\nThinkerzz',
    cta: { label: 'Open Fee Vouchers', path: '/vouchers' },
  },
};
