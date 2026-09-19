// Cambridge exam sittings offered as quick-pick options wherever a session is
// captured (booking, add-lead, convert). "Custom..." lets staff type any label.
// Keep the list rolling forward as sittings pass; a free-text custom value always
// works, so an out-of-date list never blocks anyone.
export const EXAM_SESSIONS = [
  'Oct/Nov 2026',
  'May/Jun 2027',
  'Oct/Nov 2027',
  'May/Jun 2028',
] as const;

export const CUSTOM_SESSION = 'Custom...';
