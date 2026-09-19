'use server';

// Leads write actions. Runs server-side with the user's session; RLS decides
// permission (admin + manager may write leads/students; others denied at the DB).
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { friendlyDbError } from '@/lib/friendlyError';
import { addDaysYMD, addMonthsYMD, monthLabelYMD } from '@/lib/date/ymd';

const ENROLLABLE_PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'AS', 'A2', 'IGCSE', 'Edexcel IGCSE', 'Edexcel AS', 'Edexcel A2', 'Matric (9)', 'Matric (10)', 'Inter (11)', 'Inter (12)'];

export interface ActionResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null as string | null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  return { supabase, user, orgId: (profile?.org_id as string) ?? null };
}

// ── Lead communications (call / note log) ──────────────────────────────────
export interface LeadCommunication {
  id: string;
  channel: string;
  note: string;
  at: string;
}

/** List a lead's logged calls/notes, newest first. RLS scopes to the org. */
export async function listLeadCommunications(leadId: string): Promise<LeadCommunication[]> {
  if (!leadId) return [];
  const { supabase, user } = await ctx();
  if (!user) return [];
  const { data, error } = await supabase
    .from('lead_communications')
    .select('id,channel,note,at')
    .eq('lead_id', leadId)
    .is('deleted_at', null)
    .order('at', { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({ id: r.id, channel: r.channel, note: r.note, at: r.at }));
}

/** Log a call / WhatsApp / note against a lead. */
export async function logLeadCommunication(input: {
  leadId: string;
  channel: string;
  note: string;
}): Promise<ActionResult> {
  const note = input.note?.trim();
  if (!input.leadId) return { ok: false, error: 'Missing lead.' };
  if (!note) return { ok: false, error: 'Write a note first.' };
  const channel = (input.channel || 'note').toLowerCase();

  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase.from('lead_communications').insert({
    org_id: orgId,
    lead_id: input.leadId,
    channel,
    note,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/leads');
  return { ok: true };
}

// "How did you find us?" label -> DB source enum (same set as the public booking).
const SOURCE_MAP: Record<string, string> = {
  Google: 'google', Facebook: 'facebook', Instagram: 'instagram',
  WhatsApp: 'whatsapp', Referral: 'referral', 'Walk-in': 'walk_in', 'Walk In': 'walk_in',
};

/** Add a new lead. */
export async function createLead(input: {
  studentName: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  program: string;
  subjects?: string;
  examSession?: string;
  source?: string;
  temperature?: 'Hot' | 'Warm' | 'Cold';
}): Promise<ActionResult> {
  const studentName = input.studentName?.trim();
  const parentName = input.parentName?.trim();
  const parentPhone = input.parentPhone?.trim();
  if (!studentName || !parentName) {
    return { ok: false, error: 'Student name and parent name are required.' };
  }
  if (!parentPhone) {
    return { ok: false, error: 'Parent phone is required.' };
  }

  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase.from('leads').insert({
    org_id: orgId,
    name: studentName,
    parent_name: parentName,
    phone: parentPhone,
    email: input.parentEmail?.trim() || null,
    // leads.program is CAIE-only (nullable) - store only if valid, else leave null.
    program: ENROLLABLE_PROGRAMS.includes(input.program) ? input.program : null,
    subjects: input.subjects?.trim() || null,
    exam_session: input.examSession?.trim() || null,
    source: SOURCE_MAP[input.source ?? ''] ?? 'walk_in',
    status: 'new',
    temperature: (input.temperature ?? 'Warm').toLowerCase(),
  });
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/leads');
  revalidatePath('/');
  return { ok: true };
}

/**
 * Convert a lead into an active student and start their billing plan.
 *
 * Two billing modes:
 *   - 'monthly': `amount` is the monthly fee. The first month is recorded PAID at
 *     the start date; the next voucher is due one calendar month later and the
 *     billing cron rolls it forward each month until `endDate` (the session end).
 *   - 'upfront': `amount` is the TOTAL price for the whole block (crash course /
 *     prepaid). One PAID voucher covers start -> end; NO monthly vouchers and NO
 *     fee reminders are generated during the block. `endDate` is required.
 */
export async function convertLead(input: {
  leadId: string;
  examSession: string;
  billingMode?: 'monthly' | 'upfront';
  amount: number; // monthly fee (monthly) OR total block price (upfront)
  startDate: string; // YYYY-MM-DD - first fee paid / block start
  endDate?: string; // YYYY-MM-DD - billing end (session end); required for upfront
  paymentMethod?: string; // 'Bank Transfer' | 'JazzCash'
}): Promise<ActionResult> {
  const mode = input.billingMode === 'upfront' ? 'upfront' : 'monthly';
  if (!input.examSession?.trim()) return { ok: false, error: 'Exam session is required.' };
  if (!(input.amount > 0)) {
    return { ok: false, error: mode === 'upfront' ? 'A valid total amount is required.' : 'A valid monthly fee is required.' };
  }
  if (!input.startDate) return { ok: false, error: 'Start date is required.' };
  if (mode === 'upfront' && !input.endDate) {
    return { ok: false, error: 'An end date is required for an upfront / crash-course plan.' };
  }
  if (input.endDate && input.endDate < input.startDate) {
    return { ok: false, error: 'The end date cannot be before the start date.' };
  }

  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { data: lead } = await supabase
    .from('leads')
    .select('id,name,parent_name,phone,email,program,source,status,school,city,subjects')
    .eq('id', input.leadId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!lead) return { ok: false, error: 'Lead not found.' };
  if ((lead as any).status === 'won') return { ok: false, error: 'This lead is already converted.' };
  if (!ENROLLABLE_PROGRAMS.includes((lead as any).program)) {
    return {
      ok: false,
      error: 'This lead’s program is not one of the academy’s programs, so it cannot be enrolled as a student.',
    };
  }

  const endDate = input.endDate || null;
  // monthly: next fee is due one calendar month after the start (day-of-month kept).
  // upfront: park next_due_date past the block end so the cron never bills it.
  const nextDue = mode === 'upfront'
    ? addDaysYMD(endDate as string, 1)
    : addMonthsYMD(input.startDate, 1);

  const { data: newStudent, error: studentErr } = await supabase
    .from('students')
    .insert({
      org_id: orgId,
      name: (lead as any).name,
      parent_name: (lead as any).parent_name,
      phone: (lead as any).phone,
      email: (lead as any).email,
      program: (lead as any).program,
      exam_session: input.examSession.trim(),
      // upfront students carry no monthly fee; monthly students carry theirs.
      monthly_fee: mode === 'upfront' ? 0 : input.amount,
      billing_mode: mode,
      billing_start_date: input.startDate,
      billing_end_date: endDate,
      next_due_date: nextDue,
      first_class_date: null,
      status: 'active',
      fee_status: 'due', // flipped to 'paid' below once the first payment is recorded
      source: (lead as any).source ?? 'walk_in',
      // Carry the family's booking details forward so the onboarding link
      // pre-fills them (city on the student row; school/subjects seeded into
      // onboarding_data). onboarding_completed_at stays NULL -> still "not done".
      city: (lead as any).city ?? null,
      onboarding_data: (() => {
        const pf: Record<string, string> = {};
        if ((lead as any).school) pf.school = (lead as any).school;
        if ((lead as any).subjects) pf.subjects = (lead as any).subjects;
        return Object.keys(pf).length ? pf : null;
      })(),
    })
    .select('id')
    .single();
  if (studentErr || !newStudent) {
    return { ok: false, error: studentErr?.message ?? 'Failed to create student.' };
  }
  const studentId = (newStudent as any).id;

  // Record the first payment as PAID: a paid voucher + a matching payment. For
  // monthly this is the first month; for upfront it is the whole block. Best-effort
  // (finance tables are admin-only at the DB) - a manager convert still creates the
  // student; the paid voucher is just skipped with a warning.
  const firstPeriod = mode === 'upfront'
    ? `Upfront ${monthLabelYMD(input.startDate)} - ${monthLabelYMD(endDate as string)}`
    : monthLabelYMD(input.startDate);
  let warning: string | undefined;
  const { data: voucher, error: vErr } = await supabase
    .from('vouchers')
    .insert({
      org_id: orgId,
      student_id: studentId,
      period: firstPeriod,
      amount: input.amount,
      due_date: input.startDate,
      grace_deadline: addDaysYMD(input.startDate, 3),
      status: 'paid',
    })
    .select('id')
    .single();

  if (vErr || !voucher) {
    warning = 'Student created, but the first paid voucher could not be recorded (finance is admin-only). Add the first voucher from the Vouchers screen.';
  } else {
    const { error: payErr } = await supabase.from('payments').insert({
      org_id: orgId,
      voucher_id: (voucher as any).id,
      amount: input.amount,
      method: input.paymentMethod === 'JazzCash' ? 'jazzcash' : 'bank_transfer',
      reference: mode === 'upfront' ? 'Upfront / crash-course fee at enrollment' : 'First month fee at enrollment',
      reconciled_by: user.id,
    });
    if (payErr) {
      warning = 'Student created and voucher issued, but the payment record failed. Record the first payment from the Vouchers screen.';
    } else {
      await supabase.from('students').update({ fee_status: 'paid' }).eq('id', studentId);
    }
  }

  const { error: leadErr } = await supabase
    .from('leads')
    .update({ status: 'won', converted_student_id: studentId })
    .eq('id', input.leadId);
  if (leadErr) return { ok: false, error: leadErr.message };

  revalidatePath('/leads');
  revalidatePath('/students');
  revalidatePath('/vouchers');
  revalidatePath('/payments');
  revalidatePath('/');
  return { ok: true, warning };
}

/** Soft-delete a lead (admin action). RLS enforces admin/manager write. */
// Deleting a lead also removes its demo(s), so a fake demo doesn't linger in the
// Demos/Marketing tabs. Best-effort. NOTE: we do NOT auto-delete a converted
// student here - that could wipe a real, active student; remove the student from
// the Students tab instead (which cascades back to its lead + demo).
async function cascadeDeleteDemosForLeads(
  supabase: ReturnType<typeof createClient>,
  leadIds: string[]
): Promise<void> {
  try {
    await supabase.from('demos').update({ deleted_at: new Date().toISOString() }).in('lead_id', leadIds);
  } catch {
    /* best-effort */
  }
}

function revalidateAcademyData(): void {
  for (const p of ['/leads', '/demos', '/marketing', '/reports', '/students', '/']) {
    revalidatePath(p);
  }
}

export async function softDeleteLead(leadId: string): Promise<ActionResult> {
  if (!leadId) return { ok: false, error: 'Missing lead id.' };
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };
  const { error } = await supabase.from('leads').update({ deleted_at: new Date().toISOString() }).eq('id', leadId);
  if (error) return { ok: false, error: friendlyDbError(error) };
  await cascadeDeleteDemosForLeads(supabase, [leadId]);
  revalidateAcademyData();
  return { ok: true };
}

const STAGE_DB: Record<string, string> = {
  New: 'new',
  Contacted: 'contacted',
  'Demo Set': 'demo_booked',
  'Demo Done': 'demo_booked',
  'Demo Won': 'demo_won',
  Won: 'won',
  Lost: 'lost',
};
const TEMP_DB: Record<string, string> = { Hot: 'hot', Warm: 'warm', Cold: 'cold' };

/**
 * Mark a lead as NOT converted (Lost) with a reason (fee issue, timing, etc.).
 * Stored in leads.lost_reason so the team can see why it did not convert.
 */
export async function markLeadNotConverted(input: {
  leadId: string;
  reason: string;
}): Promise<ActionResult> {
  if (!input.leadId) return { ok: false, error: 'Missing lead id.' };
  const reason = input.reason?.trim();
  if (!reason) return { ok: false, error: 'Please choose or enter a reason.' };
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase
    .from('leads')
    .update({ status: 'lost', lost_reason: reason })
    .eq('id', input.leadId);
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/leads');
  revalidatePath('/');
  return { ok: true };
}

/** Soft-delete several leads at once. RLS enforces admin/manager write. */
export async function bulkDeleteLeads(ids: string[]): Promise<ActionResult> {
  const clean = (ids ?? []).filter(Boolean);
  if (clean.length === 0) return { ok: false, error: 'No leads selected.' };
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase
    .from('leads')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', clean);
  if (error) return { ok: false, error: friendlyDbError(error) };

  await cascadeDeleteDemosForLeads(supabase, clean);
  revalidateAcademyData();
  return { ok: true };
}

/** Set the stage on several leads at once (maps the UI stage to leads.status). */
export async function bulkSetLeadStage(ids: string[], stage: string): Promise<ActionResult> {
  const clean = (ids ?? []).filter(Boolean);
  if (clean.length === 0) return { ok: false, error: 'No leads selected.' };
  const db = STAGE_DB[stage];
  if (!db) return { ok: false, error: 'Invalid stage.' };

  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase.from('leads').update({ status: db }).in('id', clean);
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/leads');
  revalidatePath('/');
  return { ok: true };
}

/** Inline-edit a lead's stage and/or temperature. */
export async function updateLead(input: {
  leadId: string;
  stage?: string;
  temperature?: string;
}): Promise<ActionResult> {
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const patch: Record<string, any> = {};
  if (input.stage && STAGE_DB[input.stage]) patch.status = STAGE_DB[input.stage];
  if (input.temperature && TEMP_DB[input.temperature]) patch.temperature = TEMP_DB[input.temperature];
  if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to update.' };

  const { error } = await supabase.from('leads').update(patch).eq('id', input.leadId);
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidatePath('/leads');
  revalidatePath('/');
  return { ok: true };
}
