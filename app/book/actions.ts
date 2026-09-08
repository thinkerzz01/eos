'use server';

// Public booking write path. The /book page is unauthenticated (anon), so it
// CANNOT touch tables directly under RLS. Instead it calls the locked
// `create_public_booking` SECURITY DEFINER routine (schema.sql §6), which is
// GRANTed to `anon` and creates a lead + an unassigned demo (teacher NULL,
// status 'needs_teacher') for exactly one org. The org is fixed per deployment
// via BOOKING_ORG_ID - a single academy owns the public form.
import { createClient } from '@/lib/supabase/server';
import { guardPublicSubmit } from '@/lib/publicFormGuard';
import { notifyStaff } from '@/lib/notifications/inapp';
import { sendViaResend } from '@/lib/notifications/resend';
import { renderBookingConfirmationEmail } from '@/lib/notifications/bookingConfirmationEmail';

// Programs the leads table accepts (program CHECK). Anything else is stored NULL.
const ENROLLABLE_PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'AS', 'A2', 'IGCSE', 'Edexcel IGCSE', 'Edexcel AS', 'Edexcel A2', 'Matric (9)', 'Matric (10)', 'Inter (11)', 'Inter (12)'];

// "How did you find us?" label -> DB source enum.
const SOURCE_MAP: Record<string, string> = {
  Google: 'google',
  Facebook: 'facebook',
  Instagram: 'instagram',
  WhatsApp: 'whatsapp',
  Referral: 'referral',
  'Walk-in': 'walk_in',
};

export interface BookingResult {
  ok: boolean;
  error?: string;
  ref?: string;
}

export async function submitPublicBooking(input: {
  studentName: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  program: string;
  subject?: string;
  source?: string; // "How did you find us?"
  school?: string;
  city?: string;
  area?: string; // town / society / neighbourhood (finer than city)
  date: string; // YYYY-MM-DD (Pakistan date)
  time: string; // HH:MM (PKT)
  turnstileToken?: string;
}): Promise<BookingResult> {
  // Abuse protection (rate limit + optional Turnstile) before any DB work.
  const guard = await guardPublicSubmit({ action: 'book', token: input.turnstileToken });
  if (!guard.ok) return { ok: false, error: guard.error };

  const studentName = input.studentName?.trim();
  const parentName = input.parentName?.trim();
  const parentPhone = input.parentPhone?.trim();
  const school = input.school?.trim();
  const city = input.city?.trim();
  const area = input.area?.trim();

  if (!studentName || !parentName || !parentPhone) {
    return { ok: false, error: 'Student name, parent name, and phone are required.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.parentEmail?.trim() || '')) {
    return { ok: false, error: 'A valid email is required - your demo class invite is sent to it.' };
  }
  if (!input.subject?.trim()) {
    return { ok: false, error: 'Please select a subject.' };
  }
  if (!input.source?.trim()) {
    return { ok: false, error: 'Please tell us how you found us.' };
  }
  if (!school) {
    return { ok: false, error: 'Please enter the school name.' };
  }
  if (!city) {
    return { ok: false, error: 'Please enter the city / hometown.' };
  }
  if (!input.date || !/^\d{2}:\d{2}$/.test(input.time || '')) {
    return { ok: false, error: 'Please choose a valid date and time.' };
  }

  const orgId = process.env.BOOKING_ORG_ID;
  if (!orgId) {
    return {
      ok: false,
      error: 'Online booking is not configured yet. Please contact the academy directly.',
    };
  }

  // Build the scheduled timestamp in Pakistan time (+05:00) → a real TIMESTAMPTZ.
  const scheduledAt = `${input.date}T${input.time}:00+05:00`;

  const program = ENROLLABLE_PROGRAMS.includes(input.program) ? input.program : null;
  const source = SOURCE_MAP[input.source ?? ''] ?? 'google';

  const supabase = createClient(); // no session → anon; RPC is granted to anon
  const baseArgs = {
    p_org_id: orgId,
    p_name: studentName,
    p_parent_name: parentName,
    p_phone: parentPhone,
    p_email: input.parentEmail!.trim(),
    p_program: program,
    p_subjects: input.subject?.trim() || null,
    p_scheduled_at: scheduledAt,
    p_source: source,
  };
  // Prefer the fullest signature (school + city + area). Fall back gracefully if
  // a migration has not been applied yet, so booking never breaks:
  //   area+city+school  →  city+school  →  base
  let { data, error } = await supabase.rpc('create_public_booking', { ...baseArgs, p_school: school, p_city: city, p_area: area });
  if (error && /function|does not exist|schema cache|p_school|p_city|p_area/i.test(error.message)) {
    ({ data, error } = await supabase.rpc('create_public_booking', { ...baseArgs, p_school: school, p_city: city }));
    if (error && /function|does not exist|schema cache|p_school|p_city/i.test(error.message)) {
      ({ data, error } = await supabase.rpc('create_public_booking', baseArgs));
    }
  }

  if (error) {
    // The routine raises a friendly message for a duplicate phone; surface it.
    const msg = /already exists/i.test(error.message)
      ? 'A booking with this phone number already exists. Our team will reach out shortly.'
      : 'We could not save your booking. Please try again or contact the academy.';
    return { ok: false, error: msg };
  }

  const leadId = typeof data === 'string' ? data : '';
  const ref = leadId ? `THM-${leadId.slice(0, 8).toUpperCase()}` : 'THM-BOOKING';

  // Alert the academy team (in-app bell) that a new booking arrived - best-effort.
  await notifyStaff(orgId, {
    title: 'New demo booking',
    body: `${studentName} · ${input.subject?.trim() ?? ''} (${input.program})`,
    link: '/demos',
  });

  // Send the family a branded confirmation email (best-effort: a mail failure must
  // never fail the booking - the booking is already saved). Teacher + Meet link do
  // not exist yet at booking time, so the email adapts (shown once assigned).
  try {
    const parentEmail = input.parentEmail!.trim();
    const fmt12 = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      const p = h < 12 ? 'AM' : 'PM';
      const hr = h % 12 === 0 ? 12 : h % 12;
      return `${hr}:${String(m).padStart(2, '0')} ${p}`;
    };
    const addHour = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const start = new Date(`${input.date}T${input.time}:00+05:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const dateLabel = new Date(`${input.date}T00:00:00+05:00`).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi',
    });
    const timeLabel = `${fmt12(input.time)} – ${fmt12(addHour(input.time))} (PKT)`;

    const waDigits = (process.env.NEXT_PUBLIC_ACADEMY_WHATSAPP ?? '').replace(/\D/g, '');
    const whatsappUrl = waDigits
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(`Hi Thinkerzz, I booked a free demo (Ref: ${ref}) for ${studentName}.`)}`
      : '';
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://portal.thinkerzz.com').replace(/\/$/, '');
    const g = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Thinkerzz ${input.subject?.trim() ?? ''} Free Demo Class`.replace(/\s+/g, ' ').trim(),
      dates: `${z(start)}/${z(end)}`,
      details: `Your free Thinkerzz demo class. Booking reference: ${ref}. The Google Meet link is shared on WhatsApp before the class.`,
      location: 'Google Meet',
    });

    const email = renderBookingConfirmationEmail({
      studentName,
      parentName,
      bookingRef: ref,
      dateLabel,
      timeLabel,
      subject: input.subject?.trim() || undefined,
      program: input.program,
      durationLabel: '1 Hour',
      whatsappNumber: parentPhone,
      whatsappUrl,
      googleCalUrl: `https://calendar.google.com/calendar/render?${g.toString()}`,
      bookAnotherUrl: `${base}/book`,
      homeUrl: process.env.NEXT_PUBLIC_ACADEMY_WEBSITE || 'https://thinkerzz.com',
    });
    await sendViaResend(parentEmail, email.subject, email.text, email.html);
  } catch {
    /* never fail a saved booking because of an email problem */
  }

  return { ok: true, ref };
}
