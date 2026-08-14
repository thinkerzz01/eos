// Google Calendar + Meet (server-only). Mints a short-lived access token from the
// OAuth refresh token, then creates calendar events with a Meet link + attendee
// invites (which drop the event on the student's and teacher's calendars).
//
// BEST-EFFORT BY DESIGN: every function returns null on any failure or when Google
// is not configured, so booking/scheduling never breaks if the integration is off
// or the token has lapsed. Uses only fetch (no extra dependency).

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cachedToken: { token: string; expiresAt: number } | null = null;

function googleConfigured(): boolean {
  const rt = process.env.GOOGLE_REFRESH_TOKEN;
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      rt &&
      !rt.startsWith('PASTE_')
  );
}

async function getAccessToken(): Promise<string | null> {
  if (!googleConfigured()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    if (!json.access_token) return null;
    cachedToken = { token: json.access_token, expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000 };
    return cachedToken.token;
  } catch {
    return null;
  }
}

function requestId(): string {
  try {
    return (globalThis.crypto as any).randomUUID();
  } catch {
    return `req-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

export interface MeetEventInput {
  summary: string;
  description?: string;
  startISO: string; // ISO timestamp (UTC or with offset)
  endISO: string;
  attendees: string[]; // emails (student, teacher)
  recurrence?: string[]; // e.g. ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12']
}

// Why a calendar sync did or did not happen, so callers can tell the admin
// instead of silently swallowing the failure.
export type CalendarSyncReason = 'not_configured' | 'auth_failed' | 'no_recipients' | 'api_error';

export type MeetEventResult =
  | { ok: true; meetLink: string; eventId: string }
  | { ok: false; reason: CalendarSyncReason };

/** Human-readable explanation for a failed calendar sync (for admin toasts). */
export function calendarReasonText(reason: CalendarSyncReason): string {
  switch (reason) {
    case 'not_configured':
      return 'Google Calendar is not connected';
    case 'auth_failed':
      return 'the Google sign-in has expired - reconnect Google';
    case 'no_recipients':
      return 'no email on file for the student or teacher';
    case 'api_error':
      return 'Google rejected the request';
  }
}

/** Create a Google Calendar event with a Meet link. Never throws; returns a
 *  structured result so the caller can surface WHY a sync did not happen. */
export async function createMeetEvent(input: MeetEventInput): Promise<MeetEventResult> {
  const recipients = input.attendees.filter(Boolean);
  if (recipients.length === 0) return { ok: false, reason: 'no_recipients' };
  if (!googleConfigured()) return { ok: false, reason: 'not_configured' };
  const token = await getAccessToken();
  if (!token) return { ok: false, reason: 'auth_failed' };
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  const body: any = {
    summary: input.summary,
    description: input.description ?? '',
    start: { dateTime: input.startISO, timeZone: 'Asia/Karachi' },
    end: { dateTime: input.endISO, timeZone: 'Asia/Karachi' },
    attendees: recipients.map((email) => ({ email })),
    conferenceData: { createRequest: { requestId: requestId(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    // Guests can't invite others or edit; they join only.
    guestsCanInviteOthers: false,
    guestsCanModify: false,
    // Two popup reminders: the usual 30 minutes, plus 5 minutes to prompt joining
    // just before the class starts.
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'popup', minutes: 5 },
      ],
    },
  };
  if (input.recurrence && input.recurrence.length) body.recurrence = input.recurrence;

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) return { ok: false, reason: 'api_error' };
    const json: any = await res.json();
    if (!json.id) return { ok: false, reason: 'api_error' };
    const meetLink =
      json.hangoutLink ||
      json.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri ||
      '';
    return { ok: true, meetLink, eventId: json.id as string };
  } catch {
    return { ok: false, reason: 'api_error' };
  }
}

/**
 * Build a clean, professional calendar title + description for a class or demo
 * invite. No emojis (reads as unprofessional); plain hyphen bullets. The teacher
 * and student names are included when known so the student recognises the class.
 */
export function buildClassInvite(opts: {
  subject?: string;
  teacherName?: string;
  studentName?: string;
  isDemo?: boolean;
}): { summary: string; description: string } {
  const subject = (opts.subject || '').trim() || 'Class';
  const label = opts.isDemo ? 'Free Demo Class' : 'Class';
  const summary = `Thinkerzz ${subject} ${label}${opts.studentName ? ` - ${opts.studentName}` : ''}`;

  const lines: string[] = [`Thinkerzz ${subject} ${label}`, ''];
  if (opts.teacherName) lines.push(`Teacher: ${opts.teacherName}`);
  if (opts.studentName) lines.push(`Student: ${opts.studentName}`);
  lines.push('');
  lines.push('Join using the Google Meet link attached to this invitation.');
  lines.push('');
  lines.push('Please note:');
  lines.push('- Join at least 5 minutes before the scheduled start time.');
  lines.push('- Your teacher will start the meeting. Kindly wait if it has not begun yet.');
  lines.push('- Keep your camera on and have your books and materials ready.');
  if (opts.isDemo) {
    lines.push('- If you are unable to attend, please inform the academy in advance.');
    lines.push('');
    lines.push('We look forward to seeing you.');
  } else {
    lines.push('- If you cannot attend, inform the academy in advance so a makeup class can be arranged.');
    lines.push('');
    lines.push('Thank you.');
  }
  lines.push('Thinkerzz Academy');

  return { summary, description: lines.join('\n') };
}

/** Weekly RRULE from JS weekdays (0=Sun..6=Sat) + occurrence count. */
export function weeklyRecurrence(weekdays: number[], count: number): string[] {
  const MAP = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const days = weekdays.map((d) => MAP[d]).filter(Boolean).join(',');
  if (!days || count <= 0) return [];
  return [`RRULE:FREQ=WEEKLY;BYDAY=${days};COUNT=${count}`];
}
