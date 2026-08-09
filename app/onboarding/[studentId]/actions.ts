'use server';

// Public student onboarding. The /onboarding/<studentId> page is unauthenticated,
// so it uses SECURITY DEFINER RPCs (schema.sql): get_student_public to pre-fill the
// known name/program, and submit_onboarding to save the fuller details.
import { createClient } from '@/lib/supabase/server';

export interface OnboardingContext {
  ok: boolean;
  name?: string;
  program?: string;
  examSession?: string;
  alreadyDone?: boolean;
  error?: string;
}

export async function getOnboardingContext(studentId: string): Promise<OnboardingContext> {
  if (!studentId) return { ok: false, error: 'This onboarding link is invalid.' };
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_student_public', { p_student_id: studentId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { ok: false, error: 'This onboarding link is invalid or has expired.' };
  return {
    ok: true,
    name: row.name ?? '',
    program: row.program ?? '',
    examSession: row.exam_session ?? '',
    alreadyDone: !!row.onboarding_done,
  };
}

export interface OnboardingInput {
  studentId: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  address?: string;
  gender?: string;
  dob?: string; // YYYY-MM-DD
  // Extra answers stored as JSON (school, CNIC, subjects, emergency contact, etc.)
  data: Record<string, string>;
}

export interface OnboardingResult {
  ok: boolean;
  error?: string;
}

export async function submitOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  if (!input.studentId) return { ok: false, error: 'This onboarding link is invalid.' };
  const supabase = createClient();
  const { error } = await supabase.rpc('submit_onboarding', {
    p_student_id: input.studentId,
    p_whatsapp: input.whatsapp?.trim() || '',
    p_email: input.email?.trim() || '',
    p_city: input.city?.trim() || '',
    p_address: input.address?.trim() || '',
    p_gender: input.gender || '',
    p_dob: input.dob || null,
    p_data: input.data ?? {},
  });
  if (error) {
    const msg = /invalid/i.test(error.message)
      ? 'This onboarding link is invalid or has expired. Please contact the academy.'
      : 'We could not save your details. Please try again or contact the academy.';
    return { ok: false, error: msg };
  }
  return { ok: true };
}
