'use server';

// Public DIRECT enrolment (no demo). The /admission page is unauthenticated, so
// it calls the SECURITY DEFINER `create_direct_enrollment` routine, which creates
// the student directly for the academy org (BOOKING_ORG_ID). Unlike /enroll (which
// converts a won lead) this has no lead — the student self-enrols after watching a
// recorded demo. Fee is 0 / next-due +30d; the admin finalises fee + schedule.
import { createClient } from '@/lib/supabase/server';
import { provisionLogin } from '@/lib/auth/provision';
import { guardPublicSubmit } from '@/lib/publicFormGuard';

const ENROLLABLE_PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'A Level (A1)', 'A Level (A2)', 'IGCSE', 'Matric (9)', 'Matric (10)', 'Inter (11)', 'Inter (12)'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AdmissionResult {
  ok: boolean;
  error?: string;
}

export async function submitDirectEnrollment(input: {
  studentName: string;
  parentName: string;
  phone: string;
  email: string;
  program: string;
  examSession: string;
  gender?: string;
  whatsapp?: string;
  city?: string;
  address?: string;
  turnstileToken?: string;
}): Promise<AdmissionResult> {
  const guard = await guardPublicSubmit({ action: 'admission', token: input.turnstileToken });
  if (!guard.ok) return { ok: false, error: guard.error };

  const studentName = input.studentName?.trim();
  const parentName = input.parentName?.trim();
  const phone = input.phone?.trim();
  const email = input.email?.trim() || '';

  if (!studentName || !parentName || !phone) {
    return { ok: false, error: 'Student name, parent name, and phone are required.' };
  }
  if (!ENROLLABLE_PROGRAMS.includes(input.program)) {
    return { ok: false, error: 'Please select a valid program.' };
  }
  if (!input.examSession?.trim()) {
    return { ok: false, error: 'Exam session is required.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'A valid email is required - class calendar invites are sent to it.' };
  }

  const orgId = process.env.BOOKING_ORG_ID;
  if (!orgId) {
    return { ok: false, error: 'Enrolment is not configured yet. Please contact the academy.' };
  }

  const supabase = createClient(); // no session -> anon; RPC is granted to anon
  const { data: studentId, error } = await supabase.rpc('create_direct_enrollment', {
    p_org_id: orgId,
    p_student_name: studentName,
    p_parent_name: parentName,
    p_phone: phone,
    p_email: email,
    p_program: input.program,
    p_exam_session: input.examSession.trim(),
    p_gender: input.gender || 'female',
    p_whatsapp: input.whatsapp?.trim() || '',
    p_city: input.city?.trim() || '',
    p_address: input.address?.trim() || '',
    p_source: 'walk_in',
  });

  if (error) {
    const msg = /already enrolled/i.test(error.message)
      ? 'A student with this phone number is already enrolled. Please contact the academy if this is unexpected.'
      : 'We could not complete the enrolment. Please try again or contact the academy.';
    return { ok: false, error: msg };
  }

  // Auto-provision the student's portal login (best-effort; never fail enrolment).
  if (email && typeof studentId === 'string') {
    try {
      await provisionLogin({
        email,
        name: studentName,
        role: 'student',
        orgId,
        studentId,
      });
    } catch {
      /* invite email failure must not fail the enrolment */
    }
  }

  return { ok: true };
}
