'use server';

// Ticket reply action. RLS scopes tickets/ticket_messages (staff to their org;
// a student to their own tickets). Inserts a message and moves an open ticket
// to In Progress. SLA (1-hour target) is computed on read.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function replyToTicket(input: {
  ticketId: string;
  message: string;
}): Promise<ActionResult> {
  const message = input.message?.trim();
  if (!message) return { ok: false, error: 'Enter a reply message.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };

  const { error: msgErr } = await supabase.from('ticket_messages').insert({
    org_id: profile.org_id,
    ticket_id: input.ticketId,
    sender_id: user.id,
    message,
  });
  if (msgErr) return { ok: false, error: msgErr.message };

  // Move an open ticket to in_progress (no-op if already further along).
  await supabase
    .from('tickets')
    .update({ status: 'in_progress' })
    .eq('id', input.ticketId)
    .eq('status', 'open');

  revalidatePath('/tickets');
  revalidatePath('/');
  return { ok: true };
}

export async function resolveTicket(input: { ticketId: string }): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase
    .from('tickets')
    .update({ status: 'resolved' })
    .eq('id', input.ticketId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/tickets');
  revalidatePath('/');
  return { ok: true };
}
