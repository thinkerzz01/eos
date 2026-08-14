// Public vCard (.vcf) for the academy contact. Linked from the welcome email as a
// "Save Thinkerzz Contact" button: tapping it on a phone opens "Add to Contacts"
// with Thinkerzz pre-filled. Saving it makes the class-invite sender a KNOWN
// contact, so future Google Calendar invites are trusted and auto-add (removes the
// "invitation from an unknown sender" warning). No auth - this is public info.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const email = process.env.NEXT_PUBLIC_ACADEMY_EMAIL ?? 'thinkerzz01@gmail.com';
  const phoneRaw = process.env.NEXT_PUBLIC_ACADEMY_WHATSAPP ?? '923262324477';
  const phone = phoneRaw.replace(/\D/g, '');
  const portal = (process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://portal.thinkerzz.com').replace(/\/$/, '');

  // vCard 3.0, CRLF line endings (spec).
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:;Thinkerzz Academy;;;',
    'FN:Thinkerzz Academy',
    'ORG:Thinkerzz Academy',
    `EMAIL;TYPE=INTERNET:${email}`,
    `TEL;TYPE=CELL:+${phone}`,
    `URL:${portal}`,
    'NOTE:Thinkerzz - Question. Think. Achieve. Your class invitations are sent from this contact - save it so classes appear automatically on your calendar.',
    'END:VCARD',
    '',
  ].join('\r\n');

  return new NextResponse(vcard, {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="Thinkerzz.vcf"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
