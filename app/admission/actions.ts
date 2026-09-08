'use server';

// Public DIRECT enrolment (no demo). The /admission page is unauthenticated, so
// it calls the SECURITY DEFINER `create_direct_enrollment` routine, which creates
// the student directly for the academy org (BOOKING_ORG_ID). Unlike /enroll (which
// converts a won lead) this has no lead — the student self-enrols after watching a
// recorded demo. Fee is 0 / next-due +30d; the admin finalises fee + schedule.
//
// The form mirrors the /onboarding multi-step admission form, so after creating the
// student we also save the fuller onboarding payload (school, subjects, timing,
// etc.) onto students.onboarding_data via the service-role client (the page is
// anonymous), and mark onboarding complete — same end state as /onboarding.
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { provisionLogin } from '@/lib/auth/provision';
import { guardPublicSubmit } from '@/lib/publicFormGuard';

const ENROLLABLE_PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'AS', 'A2', 'IGCSE', 'Edexcel IGCSE', 'Edexcel AS', 'Edexcel A2', 'Matric (9)', 'Matric (10)', 'Inter (11)', 'Inter (12)'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AdmissionResult {
  ok: boolean;
  error?: string;
}

export async function submitDirectEnrollment(input: {
  // Step 1 — student
  studentName: string;
  dob?: string;
  gender?: string;
  studentEmail: string;
  studentMobile?: string;
  program: string;
  examSession: string;
  grade?: string;
  school?: string;
  // Step 2 — parent & contact
  parentName: string;
  parentPhone?: string;
  parentWhatsapp: string;
  parentEmail?: string;
  parentOccupation?: string;
  city?: string;
  address?: string;
  // Step 3 — preferences & consent
  subjects?: string;
  previousResult?: string;
  timeOfDay?: string;
  preferredTime?: string;
  notes?: string;
  turnstileToken?: string;
}): Promise<AdmissionResult> {
  const guard = await guardPublicSubmit({ action: 'admission', token: input.turnstileToken });
  if (!guard.ok) return { ok: false, error: guard.error };

  const studentName = input.studentName?.trim();
  const parentName = input.parentName?.trim();
  const whatsapp = input.parentWhatsapp?.trim();
  const phone = whatsapp || input.parentPhone?.trim() || '';
  const email = input.studentEmail?.trim() || '';

  if (!studentName || !parentName || !phone) {
    return { ok: false, error: 'Student name, parent/guardian name, and a WhatsApp number are required.' };
  }
  if (!ENROLLABLE_PROGRAMS.includes(input.program)) {
    return { ok: false, error: 'Please select a valid program.' };
  }
  if (!input.examSession?.trim()) {
    return { ok: false, error: 'Exam session is required.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'A valid student email is required - class calendar invites are sent to it.' };
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
    p_whatsapp: whatsapp || '',
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

  // Save the fuller admission answers + mark onboarding complete (service-role,
  // since the page is anonymous). Best-effort: never fail the enrolment for this.
  if (typeof studentId === 'string') {
    try {
      const admin = createAdminClient();
      await admin
        .from('students')
        .update({
          onboarding_completed_at: new Date().toISOString(),
          onboarding_data: {
            fullName: studentName,
            studentEmail: email,
            studentMobile: input.studentMobile?.trim() || '',
            grade: input.grade || '',
            school: input.school?.trim() || '',
            parentName,
            parentPhone: input.parentPhone?.trim() || '',
            parentWhatsapp: whatsapp || '',
            parentEmail: input.parentEmail?.trim() || '',
            parentOccupation: input.parentOccupation?.trim() || '',
            subjects: input.subjects?.trim() || '',
            previousResult: input.previousResult?.trim() || '',
            timeOfDay: input.timeOfDay || '',
            preferredTime: input.preferredTime?.trim() || '',
            notes: input.notes?.trim() || '',
            agreedToPolicy: 'yes',
            source: 'direct_admission',
          },
        })
        .eq('id', studentId);
    } catch {
      /* onboarding payload is best-effort */
    }

    // Auto-provision the student's portal login (best-effort; never fail enrolment).
    if (email) {
      try {
        await provisionLogin({ email, name: studentName, role: 'student', orgId, studentId });
      } catch {
        /* invite email failure must not fail the enrolment */
      }
    }
  }

  return { ok: true };
}
