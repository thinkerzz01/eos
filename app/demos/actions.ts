'use server';

// Demos write actions. RLS decides permission (admin + manager may write demos).
//
// doAssign OVERLAP RE-CHECK (locked invariant, AGENTS.md §3.4): a public booking
// is created with NULL teacher, so the DB EXCLUDE constraint cannot fire on it.
// The moment a teacher is assigned we re-check that the teacher has no other
// session (demo or class) overlapping the demo's time window, and block if so.
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { createMeetEvent, calendarReasonText, buildClassInvite, updateCalendarEvent } from '@/lib/google/calendar';
import { friendlyDbError } from '@/lib/friendlyError';
import { sendViaResend } from '@/lib/notifications/resend';
import { renderTeacherDemoEmail } from '@/lib/notifications/bookingConfirmationEmail';
import { buildGoogleCalUrl } from '@/lib/notifications/calendarLink';

// Read-only service-role client for looking up invite emails, so the invite
// never depends on the caller's RLS. Falls back to the session client. See the
// same helper in app/schedule/actions.ts for the rationale.
function inviteReader(sessionClient: ReturnType<typeof createClient>) {
  try {
    return createAdminClient();
  } catch {
    return sessionClient;
  }
}

const DEMO_MINUTES = 60; // demos table has no duration; assume a 60-minute slot
const ENROLLABLE_PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'AS', 'A2', 'IGCSE', 'Edexcel IGCSE', 'Edexcel AS', 'Edexcel A2', 'Matric (9)', 'Matric (10)', 'Inter (11)', 'Inter (12)'];
const SOURCES = ['google', 'facebook', 'instagram', 'whatsapp', 'referral', 'walk_in'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  conflict?: boolean;
  // Set when the action succeeded but the calendar invite did not send.
  warning?: string;
}

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function assignTeacher(input: {
  demoId: string;
  teacherId: string;
}): Promise<ActionResult> {
  if (!input.teacherId) return { ok: false, error: 'Select a teacher.' };
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: demo } = await supabase
    .from('demos')
    .select('id,scheduled_at,leads(name,email),subjects(name)')
    .eq('id', input.demoId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!demo) return { ok: false, error: 'Demo not found.' };

  const start = new Date((demo as any).scheduled_at);
  const end = new Date(start.getTime() + DEMO_MINUTES * 60000);
  const winLo = new Date(start.getTime() - DEMO_MINUTES * 60000);

  // 1) Overlap with the teacher's OTHER demos (each treated as a 60-min slot):
  //    two demos overlap when their start times are < 60 min apart.
  const { data: demoClashes } = await supabase
    .from('demos')
    .select('id')
    .eq('teacher_id', input.teacherId)
    .neq('id', input.demoId)
    .is('deleted_at', null)
    .gt('scheduled_at', winLo.toISOString())
    .lt('scheduled_at', end.toISOString());

  // 2) Overlap with the teacher's class sessions: start_at < end AND end_at > start.
  const { data: classClashes } = await supabase
    .from('class_sessions')
    .select('id')
    .eq('teacher_id', input.teacherId)
    .is('deleted_at', null)
    .lt('start_at', end.toISOString())
    .gt('end_at', start.toISOString());

  if ((demoClashes && demoClashes.length > 0) || (classClashes && classClashes.length > 0)) {
    return {
      ok: false,
      conflict: true,
      error:
        'Conflict: this teacher already has an overlapping session at that time. Assignment blocked by the doAssign overlap re-check.',
    };
  }

  const { error } = await supabase
    .from('demos')
    .update({ teacher_id: input.teacherId, status: 'scheduled' })
    .eq('id', input.demoId);
  if (error) return { ok: false, error: friendlyDbError(error) };

  // Best-effort: create a Google Meet + calendar invites for the student & teacher.
  // The assignment already succeeded; a calendar miss is reported, not fatal.
  let warning: string | undefined;
  try {
    const lead = one<any>((demo as any).leads);
    const subj = one<any>((demo as any).subjects);
    const reader = inviteReader(supabase);
    const { data: teacher } = await reader
      .from('teachers')
      .select('name,email')
      .eq('id', input.teacherId)
      .maybeSingle();
    const attendees = [lead?.email, (teacher as any)?.email].filter(Boolean) as string[];
    const invite = buildClassInvite({
      subject: subj?.name,
      teacherName: (teacher as any)?.name,
      studentName: lead?.name,
      isDemo: true,
    });
    const meet = await createMeetEvent({
      summary: invite.summary,
      description: invite.description,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      attendees,
    });
    const meetUrl = meet.ok ? meet.meetLink : undefined;
    if (meet.ok) {
      await supabase
        .from('demos')
        .update({ meeting_link: meet.meetLink, calendar_event_id: meet.eventId })
        .eq('id', input.demoId);
    } else {
      warning = `Teacher assigned, but the calendar invite could not be sent: ${calendarReasonText(meet.reason)}.`;
    }

    // Email the assigned TEACHER a designed demo notice with the main info,
    // the Meet link (once available) and an Add-to-Calendar button. Best-effort:
    // a mail failure never undoes the assignment.
    const teacherEmail = (teacher as any)?.email as string | undefined;
    if (teacherEmail) {
      try {
        const fmtDate = start.toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi',
        });
        const fmtT = (d: Date) =>
          d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' }).replace(/\b([ap]m)\b/gi, (m) => m.toUpperCase());
        const googleCalUrl = buildGoogleCalUrl({
          text: invite.summary,
          startISO: start.toISOString(),
          endISO: end.toISOString(),
          details: `Thinkerzz demo class with ${lead?.name ?? 'the student'}.`,
          location: meetUrl || 'Google Meet',
        });
        const tmail = renderTeacherDemoEmail({
          teacherName: (teacher as any)?.name ?? 'Teacher',
          studentName: lead?.name ?? '',
          dateLabel: fmtDate,
          timeLabel: `${fmtT(start)} - ${fmtT(end)} (PKT)`,
          subject: subj?.name,
          durationLabel: '1 Hour',
          meetUrl,
          googleCalUrl,
          whatsappNumber: process.env.NEXT_PUBLIC_ACADEMY_WHATSAPP || undefined,
        });
        await sendViaResend(teacherEmail, tmail.subject, tmail.text, tmail.html);
      } catch {
        /* teacher notice is best-effort; assignment already succeeded */
      }
    }
  } catch {
    warning = 'Teacher assigned, but the calendar invite could not be sent (unexpected error).';
  }

  revalidatePath('/demos');
  revalidatePath('/');
  return { ok: true, warning };
}

/**
 * Edit (reschedule) a demo's date/time. If it already has a Google Calendar event
 * (teacher assigned), the invite is moved to the new time (best-effort). RLS
 * enforces admin/manager write.
 */
export async function updateDemo(input: {
  demoId: string;
  date: string; // YYYY-MM-DD (PKT)
  time: string; // HH:MM (PKT)
}): Promise<ActionResult> {
  if (!input.demoId) return { ok: false, error: 'Missing demo id.' };
  if (!input.date || !/^\d{2}:\d{2}$/.test(input.time ?? '')) {
    return { ok: false, error: 'Pick a valid date and time.' };
  }
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const startISO = new Date(`${input.date}T${input.time}:00+05:00`).toISOString();
  const endISO = new Date(new Date(startISO).getTime() + DEMO_MINUTES * 60000).toISOString();

  const { data: updated, error } = await supabase
    .from('demos')
    .update({ scheduled_at: startISO })
    .eq('id', input.demoId)
    .select('id,calendar_event_id')
    .single();
  if (error) return { ok: false, error: friendlyDbError(error) };

  let warning: string | undefined;
  const eventId = (updated as any)?.calendar_event_id as string | undefined;
  if (eventId) {
    const upd = await updateCalendarEvent(eventId, { startISO, endISO });
    if (!upd.ok) warning = `Demo rescheduled, but the calendar invite could not be moved: ${calendarReasonText(upd.reason ?? 'api_error')}.`;
  }

  revalidatePath('/demos');
  revalidatePath('/');
  return { ok: true, warning };
}

/** Soft-delete a demo (admin action). RLS enforces admin/manager write. */
export async function deleteDemo(demoId: string): Promise<ActionResult> {
  if (!demoId) return { ok: false, error: 'Missing demo id.' };
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: 'You are not signed in.' };
  const { error } = await supabase.from('demos').update({ deleted_at: new Date().toISOString() }).eq('id', demoId);
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath('/demos');
  revalidatePath('/');
  return { ok: true };
}

/** Soft-delete several demos at once. RLS enforces admin/manager write. */
export async function bulkDeleteDemos(ids: string[]): Promise<ActionResult> {
  const clean = (ids ?? []).filter(Boolean);
  if (clean.length === 0) return { ok: false, error: 'No demos selected.' };
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase
    .from('demos')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', clean);
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/demos');
  revalidatePath('/');
  return { ok: true };
}

export async function recordOutcome(input: {
  demoId: string;
  outcome: 'Won' | 'Lost' | 'No-show' | 'Pending';
  reason?: string;
  conductedBy?: 'internal' | 'external'; // who ran the demo; never sends any email
  externalTeacherName?: string; // name of the external tutor (when conductedBy = external)
}): Promise<ActionResult> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  // Map UI outcome -> demos.status + demos.outcome enum (won/lost/follow_up).
  let status: string;
  let outcome: string | null;
  switch (input.outcome) {
    case 'Won':
      status = 'done';
      outcome = 'won';
      break;
    case 'Lost':
      status = 'done';
      outcome = 'lost';
      break;
    case 'No-show':
      status = 'done';
      outcome = 'follow_up';
      break;
    default: // Pending
      status = 'awaiting_outcome';
      outcome = null;
      break;
  }

  const patch: Record<string, any> = { status, outcome, reason: input.reason?.trim() || null };
  if (input.conductedBy) patch.conducted_by = input.conductedBy;
  // Only an external tutor carries a name; clear it for internal.
  if (input.conductedBy === 'external') patch.external_teacher_name = input.externalTeacherName?.trim() || null;
  else if (input.conductedBy === 'internal') patch.external_teacher_name = null;

  let { error } = await supabase.from('demos').update(patch).eq('id', input.demoId);
  // If the conducted_by / external_teacher_name columns aren't there yet (migration
  // not applied), still save the outcome without them so nothing is blocked.
  if (error && /conducted_by|external_teacher_name|column .* does not exist|schema cache/i.test(error.message)) {
    const { conducted_by, external_teacher_name, ...rest } = patch;
    ({ error } = await supabase.from('demos').update(rest).eq('id', input.demoId));
  }
  if (error) return { ok: false, error: friendlyDbError(error) };

  // Keep the lead pipeline in sync with the demo outcome so a decided demo leaves
  // the "New" stage. NOTE: lead status 'won' means ENROLLED (set only by Convert),
  // so a won demo maps to 'demo_won' (Demo Won - won but not yet enrolled; stays
  // convertible). Lost -> lost; No-show -> contacted. Pending leaves it untouched.
  const leadStatus =
    input.outcome === 'Won' ? 'demo_won'
    : input.outcome === 'Lost' ? 'lost'
    : input.outcome === 'No-show' ? 'contacted'
    : null;
  if (leadStatus) {
    const { data: demoRow } = await supabase.from('demos').select('lead_id').eq('id', input.demoId).maybeSingle();
    const leadId = (demoRow as any)?.lead_id as string | undefined;
    if (leadId) {
      // Never downgrade a lead that's already enrolled ('won').
      await supabase
        .from('leads')
        .update({ status: leadStatus })
        .eq('id', leadId)
        .neq('status', 'won')
        .is('deleted_at', null);
    }
  }

  revalidatePath('/demos');
  revalidatePath('/');
  revalidatePath('/leads');
  return { ok: true };
}

/**
 * Staff-created demo (e.g. a phone booking). Creates the lead (CRM record) + an
 * unassigned demo (status 'needs_teacher') - the same shape the public /book page
 * produces - then a teacher is assigned via assignTeacher. RLS: admin + manager
 * may write leads/demos. Email is required so the demo invite can reach the family.
 */
export async function createDemo(input: {
  studentName: string;
  parentName: string;
  phone: string;
  email: string;
  program?: string;
  subjectId?: string;
  source?: string;
  date: string; // YYYY-MM-DD (PKT)
  time: string; // HH:MM (PKT)
}): Promise<ActionResult & { demoId?: string }> {
  const studentName = input.studentName?.trim();
  const parentName = input.parentName?.trim();
  const phone = input.phone?.trim();
  const email = input.email?.trim();
  if (!studentName || !parentName || !phone) {
    return { ok: false, error: 'Student name, parent name, and phone are required.' };
  }
  if (!EMAIL_RE.test(email ?? '')) {
    return { ok: false, error: 'A valid email is required - the demo invite is sent to it.' };
  }
  if (!input.date || !/^\d{2}:\d{2}$/.test(input.time ?? '')) {
    return { ok: false, error: 'Pick a valid date and time.' };
  }

  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: 'You are not signed in.' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };
  const orgId = profile.org_id as string;

  // Friendly duplicate-phone guard (mirrors the public booking routine).
  const { data: dup } = await supabase
    .from('leads')
    .select('id')
    .eq('org_id', orgId)
    .eq('phone', phone)
    .is('deleted_at', null)
    .maybeSingle();
  if (dup) return { ok: false, error: 'A lead with this phone number already exists.' };

  const program = ENROLLABLE_PROGRAMS.includes(input.program ?? '') ? input.program! : null;
  const source = SOURCES.includes((input.source ?? '').toLowerCase()) ? input.source!.toLowerCase() : 'walk_in';
  const scheduledAt = `${input.date}T${input.time}:00+05:00`;

  // Optional subject: store its name on the lead + link it on the demo (used in the
  // demo Meet invite title when a teacher is assigned).
  let subjectName: string | null = null;
  if (input.subjectId) {
    const { data: subj } = await supabase.from('subjects').select('name').eq('id', input.subjectId).maybeSingle();
    subjectName = (subj as any)?.name ?? null;
  }

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .insert({
      org_id: orgId,
      name: studentName,
      parent_name: parentName,
      phone,
      email,
      program,
      subjects: subjectName,
      source,
      // A demo is being booked, so the lead starts at "Demo Booked" (not "New").
      status: 'demo_booked',
      temperature: 'hot',
    })
    .select('id')
    .single();
  if (leadErr) return { ok: false, error: leadErr.message };

  const { data: demo, error: demoErr } = await supabase
    .from('demos')
    .insert({
      org_id: orgId,
      lead_id: lead.id,
      subject_id: input.subjectId || null,
      scheduled_at: scheduledAt,
      status: 'needs_teacher',
    })
    .select('id')
    .single();
  if (demoErr) {
    // Roll back the orphan lead (best-effort) so a failed demo does not leave a lead.
    await supabase.from('leads').update({ deleted_at: new Date().toISOString() }).eq('id', lead.id);
    return { ok: false, error: demoErr.message };
  }

  revalidatePath('/demos');
  revalidatePath('/leads');
  revalidatePath('/');
  return { ok: true, demoId: demo.id };
}
