'use server';

// Public booking write path. The /book page is unauthenticated (anon), so it
// CANNOT touch tables directly under RLS. Instead it calls the locked
// `create_public_booking` SECURITY DEFINER routine (schema.sql §6), which is
// GRANTed to `anon` and creates a lead + an unassigned demo (teacher NULL,
// status 'needs_teacher') for exactly one org. The org is fixed per deployment
// via BOOKING_ORG_ID — a single academy owns the public form.
import { createClient } from '@/lib/supabase/server';

// CAIE programs the leads table accepts (program CHECK). Anything else (e.g.
// "Matric") is stored as NULL rather than violating the constraint.
const CAIE_PROGRAMS = ['O Level', 'A Level', 'IGCSE'];

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
  date: string; // YYYY-MM-DD (Pakistan date)
  hour: number; // 24h start hour in PKT (7..21)
}): Promise<BookingResult> {
  const studentName = input.studentName?.trim();
  const parentName = input.parentName?.trim();
  const parentPhone = input.parentPhone?.trim();

  if (!studentName || !parentName || !parentPhone) {
    return { ok: false, error: 'Student name, parent name, and phone are required.' };
  }
  if (!input.date || !(input.hour >= 7 && input.hour <= 21)) {
    return { ok: false, error: 'Please choose a valid date and time slot.' };
  }

  const orgId = process.env.BOOKING_ORG_ID;
  if (!orgId) {
    return {
      ok: false,
      error: 'Online booking is not configured yet. Please contact the academy directly.',
    };
  }

  // Build the scheduled timestamp in Pakistan time (+05:00) → a real TIMESTAMPTZ.
  const hh = String(input.hour).padStart(2, '0');
  const scheduledAt = `${input.date}T${hh}:00:00+05:00`;

  const program = CAIE_PROGRAMS.includes(input.program) ? input.program : null;

  const supabase = createClient(); // no session → anon; RPC is granted to anon
  const { data, error } = await supabase.rpc('create_public_booking', {
    p_org_id: orgId,
    p_name: studentName,
    p_parent_name: parentName,
    p_phone: parentPhone,
    p_email: input.parentEmail?.trim() || null,
    p_program: program,
    p_subjects: null,
    p_scheduled_at: scheduledAt,
  });

  if (error) {
    // The routine raises a friendly message for a duplicate phone; surface it.
    const msg = /already exists/i.test(error.message)
      ? 'A booking with this phone number already exists. Our team will reach out shortly.'
      : 'We could not save your booking. Please try again or contact the academy.';
    return { ok: false, error: msg };
  }

  const leadId = typeof data === 'string' ? data : '';
  const ref = leadId ? `THM-${leadId.slice(0, 8).toUpperCase()}` : 'THM-BOOKING';
  return { ok: true, ref };
}
