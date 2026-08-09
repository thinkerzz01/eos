// Message catalogue + merge-field rendering.
// LOCKED invariant (AGENTS.md §3.5 / Master Plan §8): templates NEVER hardcode a
// gendered pronoun. Use {{student_name}} and a {{pronoun}} merge field sourced
// from the student's gender. Tone: greeting + a "hope you are well" line, clear
// purpose, kind close. No slang, no emojis, no dashes. Signed "Thinkerzz".

export type NotificationType =
  | 'class_reminder'
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
    pronoun: p.subject,
    pronoun_object: p.object,
    pronoun_possessive: p.possessive,
  };
}

interface Template {
  subject: string;
  body: string;
}

export const TEMPLATES: Record<NotificationType, Template> = {
  class_reminder: {
    subject: 'Class reminder for {{student_name}}',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nWe hope you are well. This is a friendly reminder that {{student_name}} has a {{class_subject}} class at {{class_time}}. Please make sure {{pronoun}} joins on time.\n\nWarm regards,\nThinkerzz',
  },
  fee_due: {
    subject: 'Fee reminder for {{student_name}}',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nWe hope you are well. This is a gentle reminder that voucher {{voucher_no}} for {{student_name}} is due on {{due_date}}. Kindly use the voucher number as your payment reference and share the screenshot on WhatsApp or upload it in your portal.\n\nThank you for your continued trust,\nThinkerzz',
  },
  grace_ending: {
    subject: 'A quick note about {{student_name}} fee',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nWe hope you are well. We wanted to let you know that the grace period for voucher {{voucher_no}} ends on {{grace_deadline}}. Whenever it is convenient, please complete the payment so {{student_name}} continues without any interruption.\n\nWarm regards,\nThinkerzz',
  },
  demo_confirmed: {
    subject: 'Demo class confirmed for {{student_name}}',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nWe hope you are well. The demo class for {{student_name}} is confirmed for {{class_time}}. We look forward to meeting {{pronoun_object}}.\n\nWarm regards,\nThinkerzz',
  },
  payment_received: {
    subject: 'Payment received for {{student_name}}',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nWe hope you are well. We have received your payment for {{student_name}}. Thank you. Your receipt is available in the portal.\n\nWarm regards,\nThinkerzz',
  },
  monthly_report: {
    subject: 'Monthly progress report for {{student_name}}',
    body: '{{body}}',
  },
  follow_up: {
    subject: 'Following up about {{student_name}}',
    body:
      'Assalam o Alaikum {{parent_name}},\n\nWe hope you are well. We just wanted to follow up regarding {{student_name}}. Please let us know if there is anything we can help with.\n\nWarm regards,\nThinkerzz',
  },
  announcement: {
    subject: '{{class_subject}}',
    body: '{{body}}',
  },
  // Internal, Admin-facing alert (not a parent message) when a grace period has
  // expired unpaid — pushes the Stop/Extend/Mark-Paid decision (Master Plan §7).
  grace_expired_admin: {
    subject: 'Fee decision needed for {{student_name}}',
    body:
      'Admin note: the grace period for voucher {{voucher_no}} ({{student_name}}) ended on {{grace_deadline}} and it is still unpaid. Please review and choose Stop, Extend, or Mark Paid on the Fee Vouchers screen.\n\nThinkerzz EOS',
  },
};
