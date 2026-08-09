'use server';

// Leads write actions. Runs server-side with the user's session; RLS decides
// permission (admin + manager may write leads/students; others denied at the DB).
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const ENROLLABLE_PROGRAMS = ['O Level', 'A Level', 'IGCSE', 'Matric (9th)', 'Matric (10th)', 'Inter (11th)', 'Inter (12th)'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Add N days to a YYYY-MM-DD date (date-only, no timezone shift).
function addDaysYMD(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
// "September 2026" from a YYYY-MM-DD date (voucher period label).
function monthLabelYMD(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

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
    source: SOURCE_MAP[input.source ?? ''] ?? 'walk_in',
    status: 'new',
    temperature: (input.temperature ?? 'Warm').toLowerCase(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/leads');
  revalidatePath('/');
  return { ok: true };
}

/**
 * Convert a lead into an active student: create the student, then mark the lead
 * Won and link converted_student_id. Requires the fee fields the students table
 * needs (exam session, monthly fee, next due date).
 */
export async function convertLead(input: {
  leadId: string;
  examSession: string;
  monthlyFee: number;
  firstFeePaidDate: string; // the day the student paid the first month's fee
  paymentMethod?: string; // 'Bank Transfer' | 'JazzCash'
}): Promise<ActionResult> {
  if (!input.examSession?.trim()) return { ok: false, error: 'Exam session is required.' };
  if (!(input.monthlyFee > 0)) return { ok: false, error: 'A valid monthly fee is required.' };
  if (!input.firstFeePaidDate) return { ok: false, error: 'First fee paid date is required.' };

  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };

  const { data: lead } = await supabase
    .from('leads')
    .select('id,name,parent_name,phone,email,program,source,status')
    .eq('id', input.leadId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!lead) return { ok: false, error: 'Lead not found.' };
  if ((lead as any).status === 'won') return { ok: false, error: 'This lead is already converted.' };
  if (!ENROLLABLE_PROGRAMS.includes((lead as any).program)) {
    return {
      ok: false,
      error: 'This lead’s program is not a CAIE program (O/A Level, IGCSE), so it cannot be enrolled as a student.',
    };
  }

  // The first month is paid at conversion, so the next fee is due 30 days later.
  const nextDue = addDaysYMD(input.firstFeePaidDate, 30);

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
      monthly_fee: input.monthlyFee,
      next_due_date: nextDue,
      first_class_date: null,
      status: 'active',
      fee_status: 'due', // flipped to 'paid' below once the first payment is recorded
      source: (lead as any).source ?? 'walk_in',
    })
    .select('id')
    .single();
  if (studentErr || !newStudent) {
    return { ok: false, error: studentErr?.message ?? 'Failed to create student.' };
  }
  const studentId = (newStudent as any).id;

  // Record the first month as PAID: a paid voucher + a matching payment, so the
  // student's total-paid reflects the fee and the 30-day cycle starts. Best-effort
  // (finance tables are admin-only at the DB) - a manager convert still creates the
  // student; the paid voucher is just skipped with a warning.
  let warning: string | undefined;
  const { data: voucher, error: vErr } = await supabase
    .from('vouchers')
    .insert({
      org_id: orgId,
      student_id: studentId,
      period: monthLabelYMD(input.firstFeePaidDate),
      amount: input.monthlyFee,
      due_date: input.firstFeePaidDate,
      grace_deadline: addDaysYMD(input.firstFeePaidDate, 3),
      status: 'paid',
    })
    .select('id')
    .single();

  if (vErr || !voucher) {
    warning = 'Student created, but the first paid month could not be recorded (finance is admin-only). Add the first voucher from the Vouchers screen.';
  } else {
    const { error: payErr } = await supabase.from('payments').insert({
      org_id: orgId,
      voucher_id: (voucher as any).id,
      amount: input.monthlyFee,
      method: input.paymentMethod === 'JazzCash' ? 'jazzcash' : 'bank_transfer',
      reference: 'First month fee at enrollment',
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
export async function softDeleteLead(leadId: string): Promise<ActionResult> {
  if (!leadId) return { ok: false, error: 'Missing lead id.' };
  const { supabase, user, orgId } = await ctx();
  if (!user || !orgId) return { ok: false, error: 'You are not signed in.' };
  const { error } = await supabase.from('leads').update({ deleted_at: new Date().toISOString() }).eq('id', leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/leads');
  revalidatePath('/demos');
  revalidatePath('/');
  return { ok: true };
}

const STAGE_DB: Record<string, string> = {
  New: 'new',
  Contacted: 'contacted',
  'Demo Set': 'demo_booked',
  'Demo Done': 'demo_booked',
  Won: 'won',
  Lost: 'lost',
};
const TEMP_DB: Record<string, string> = { Hot: 'hot', Warm: 'warm', Cold: 'cold' };

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
  if (error) return { ok: false, error: error.message };

  revalidatePath('/leads');
  revalidatePath('/');
  return { ok: true };
}
