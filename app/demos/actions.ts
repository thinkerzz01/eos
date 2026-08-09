'use server';

// Demos write actions. RLS decides permission (admin + manager may write demos).
//
// doAssign OVERLAP RE-CHECK (locked invariant, AGENTS.md §3.4): a public booking
// is created with NULL teacher, so the DB EXCLUDE constraint cannot fire on it.
// The moment a teacher is assigned we re-check that the teacher has no other
// session (demo or class) overlapping the demo's time window, and block if so.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createMeetEvent } from '@/lib/google/calendar';

const DEMO_MINUTES = 60; // demos table has no duration; assume a 60-minute slot

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  conflict?: boolean;
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
  if (error) return { ok: false, error: error.message };

  // Best-effort: create a Google Meet + calendar invites for the student & teacher.
  try {
    const lead = one<any>((demo as any).leads);
    const subj = one<any>((demo as any).subjects);
    const { data: teacher } = await supabase
      .from('teachers')
      .select('name,email')
      .eq('id', input.teacherId)
      .maybeSingle();
    const attendees = [lead?.email, (teacher as any)?.email].filter(Boolean) as string[];
    const meet = await createMeetEvent({
      summary: `Demo class - ${lead?.name ?? 'Student'}${subj?.name ? ` (${subj.name})` : ''}`,
      description: 'Thinkerzz free demo class. The teacher will start the meeting.',
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      attendees,
    });
    if (meet) {
      await supabase
        .from('demos')
        .update({ meeting_link: meet.meetLink, calendar_event_id: meet.eventId })
        .eq('id', input.demoId);
    }
  } catch {
    /* non-fatal: assignment still succeeded */
  }

  revalidatePath('/demos');
  revalidatePath('/');
  return { ok: true };
}

/** Soft-delete a demo (admin action). RLS enforces admin/manager write. */
export async function deleteDemo(demoId: string): Promise<ActionResult> {
  if (!demoId) return { ok: false, error: 'Missing demo id.' };
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: 'You are not signed in.' };
  const { error } = await supabase.from('demos').update({ deleted_at: new Date().toISOString() }).eq('id', demoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/demos');
  revalidatePath('/');
  return { ok: true };
}

export async function recordOutcome(input: {
  demoId: string;
  outcome: 'Won' | 'Lost' | 'No-show' | 'Pending';
  reason?: string;
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

  const { error } = await supabase
    .from('demos')
    .update({ status, outcome, reason: input.reason?.trim() || null })
    .eq('id', input.demoId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/demos');
  revalidatePath('/');
  return { ok: true };
}
