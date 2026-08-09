'use server';

// Leads write actions. Runs server-side with the user's session; RLS decides
// permission (admin + manager may write leads/students; others denied at the DB).
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const ENROLLABLE_PROGRAMS = ['O Level', 'A Level', 'IGCSE', 'Matric (9th)', 'Matric (10th)', 'Inter (11th)', 'Inter (12th)'];

export interface ActionResult {
  ok: boolean;
  error?: string;
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

/** Add a new lead. */
export async function createLead(input: {
  studentName: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  program: string;
  subjects?: string;
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
    // leads.program is CAIE-only (nullable) — store only if valid, else leave null.
    program: ENROLLABLE_PROGRAMS.includes(input.program) ? input.program : null,
    subjects: input.subjects?.trim() || null,
    source: 'walk_in',
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
  nextDueDate: string;
}): Promise<ActionResult> {
  if (!input.examSession?.trim()) return { ok: false, error: 'Exam session is required.' };
  if (!(input.monthlyFee > 0)) return { ok: false, error: 'A valid monthly fee is required.' };
  if (!input.nextDueDate) return { ok: false, error: 'Next due date is required.' };

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
      next_due_date: input.nextDueDate,
      status: 'active',
      fee_status: 'due',
      source: (lead as any).source ?? 'walk_in',
    })
    .select('id')
    .single();
  if (studentErr || !newStudent) {
    return { ok: false, error: studentErr?.message ?? 'Failed to create student.' };
  }

  const { error: leadErr } = await supabase
    .from('leads')
    .update({ status: 'won', converted_student_id: (newStudent as any).id })
    .eq('id', input.leadId);
  if (leadErr) return { ok: false, error: leadErr.message };

  revalidatePath('/leads');
  revalidatePath('/students');
  revalidatePath('/');
  return { ok: true };
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
