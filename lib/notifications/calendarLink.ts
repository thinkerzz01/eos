// Build a "Add to Google Calendar" link (the same render?action=TEMPLATE URL the
// public booking email uses). Kept in one place so demo + class emails share it.
// Times are ISO strings; Google reads the compact UTC form YYYYMMDDTHHMMSSZ.

export function buildGoogleCalUrl(opts: {
  text: string; // event title
  startISO: string;
  endISO: string;
  details?: string;
  location?: string;
}): string {
  const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.text.replace(/\s+/g, ' ').trim(),
    dates: `${z(opts.startISO)}/${z(opts.endISO)}`,
  });
  if (opts.details) params.set('details', opts.details);
  if (opts.location) params.set('location', opts.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
