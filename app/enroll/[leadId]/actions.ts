'use server';

// Public enrollment completion. The /enroll/<leadId> page is unauthenticated, so
// it calls the SECURITY DEFINER `submit_enrollment` routine (schema.sql), which
// creates the student from the won lead and marks the lead converted. Fee is 0 and
// the schedule is set by the Admin afterwards.
import { createClient } from '@/lib/supabase/server';

const ENROLLABLE_PROGRAMS = ['O Level', 'A Level', 'IGCSE', 'Matric (9th)', 'Matric (10th)', 'Inter (11th)', 'Inter (12th)'];

export interface EnrollResult {
  ok: boolean;
  error?: string;
}

export async function submitEnrollment(input: {
  leadId: string;
  studentName: string;
  parentName: string;
  phone: string;
  email?: string;
  program: string;
  examSession: string;
  gender?: string;
  city?: string;
  address?: string;
}): Promise<EnrollResult> {
  const studentName = input.studentName?.trim();
  const parentName = input.parentName?.trim();
  const phone = input.phone?.trim();

  if (!input.leadId) return { ok: false, error: 'This enrollment link is invalid.' };
  if (!studentName || !parentName || !phone) {
    return { ok: false, error: 'Student name, parent name, and phone are required.' };
  }
  if (!ENROLLABLE_PROGRAMS.includes(input.program)) {
    return { ok: false, error: 'Please select a valid program.' };
  }
  if (!input.examSession?.trim()) {
    return { ok: false, error: 'Exam session is required.' };
  }

  const supabase = createClient(); // no session -> anon; RPC is granted to anon
  const { error } = await supabase.rpc('submit_enrollment', {
    p_lead_id: input.leadId,
    p_student_name: studentName,
    p_parent_name: parentName,
    p_phone: phone,
    p_email: input.email?.trim() || '',
    p_program: input.program,
    p_exam_session: input.examSession.trim(),
    p_gender: input.gender || 'female',
    p_city: input.city?.trim() || '',
    p_address: input.address?.trim() || '',
  });

  if (error) {
    const msg = /already been enrolled/i.test(error.message)
      ? 'This student has already been enrolled. Please contact the academy if this is unexpected.'
      : /invalid/i.test(error.message)
      ? 'This enrollment link is invalid or has expired. Please contact the academy.'
      : 'We could not complete the enrollment. Please try again or contact the academy.';
    return { ok: false, error: msg };
  }

  return { ok: true };
}
