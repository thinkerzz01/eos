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

export interface MeetEventResult {
  meetLink: string;
  eventId: string;
}

/** Create a Google Calendar event with a Meet link. Returns null on any failure. */
export async function createMeetEvent(input: MeetEventInput): Promise<MeetEventResult | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  const body: any = {
    summary: input.summary,
    description: input.description ?? '',
    start: { dateTime: input.startISO, timeZone: 'Asia/Karachi' },
    end: { dateTime: input.endISO, timeZone: 'Asia/Karachi' },
    attendees: input.attendees.filter(Boolean).map((email) => ({ email })),
    conferenceData: { createRequest: { requestId: requestId(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    // Guests can't invite others or edit; they join only.
    guestsCanInviteOthers: false,
    guestsCanModify: false,
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
    if (!res.ok) return null;
    const json: any = await res.json();
    if (!json.id) return null;
    const meetLink =
      json.hangoutLink ||
      json.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri ||
      '';
    return { meetLink, eventId: json.id as string };
  } catch {
    return null;
  }
}

/** Weekly RRULE from JS weekdays (0=Sun..6=Sat) + occurrence count. */
export function weeklyRecurrence(weekdays: number[], count: number): string[] {
  const MAP = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const days = weekdays.map((d) => MAP[d]).filter(Boolean).join(',');
  if (!days || count <= 0) return [];
  return [`RRULE:FREQ=WEEKLY;BYDAY=${days};COUNT=${count}`];
}
