'use server';

// Public enrollment completion. The /enroll/<leadId> page is unauthenticated, so
// it calls the SECURITY DEFINER `submit_enrollment` routine (schema.sql), which
// creates the student from the won lead and marks the lead converted. Fee is 0 and
// the schedule is set by the Admin afterwards.
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardPublicSubmit } from '@/lib/publicFormGuard';

const ENROLLABLE_PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'AS', 'A2', 'IGCSE', 'Edexcel IGCSE', 'Edexcel AS', 'Edexcel A2', 'Matric (9)', 'Matric (10)', 'Inter (11)', 'Inter (12)'];

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
  // Richer admission answers (same fields as the direct-admission form), stored
  // on students.onboarding_data so the enrol and admission flows capture the same data.
  dob?: string;
  studentMobile?: string;
  grade?: string;
  school?: string;
  parentPhone?: string;
  parentWhatsapp?: string;
  parentEmail?: string;
  parentOccupation?: string;
  subjects?: string;
  previousResult?: string;
  timeOfDay?: string;
  preferredTime?: string;
  notes?: string;
  turnstileToken?: string;
}): Promise<EnrollResult> {
  const guard = await guardPublicSubmit({ action: 'enroll', token: input.turnstileToken });
  if (!guard.ok) return { ok: false, error: guard.error };

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

  const formEmail = input.email?.trim() || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
    return { ok: false, error: 'A valid email is required - class calendar invites are sent to it.' };
  }

  // SECURITY (M3): if the lead already has an email on file (from the booking),
  // that address WINS over the free-text form field. This stops someone who
  // holds a leaked enrollment link from binding the student's portal login (and
  // calendar invites) to an email they control. Read with the service role since
  // the page is anonymous; falls back to the submitted email if the lead has none.
  let email = formEmail;
  try {
    const adminRead = createAdminClient();
    const { data: lead } = await adminRead
      .from('leads')
      .select('email')
      .eq('id', input.leadId)
      .is('deleted_at', null)
      .maybeSingle();
    const onFile = (lead?.email ?? '').trim();
    if (onFile && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(onFile)) email = onFile;
  } catch {
    /* fall back to the submitted email */
  }

  const supabase = createClient(); // no session -> anon; RPC is granted to anon
  const { data: studentId, error } = await supabase.rpc('submit_enrollment', {
    p_lead_id: input.leadId,
    p_student_name: studentName,
    p_parent_name: parentName,
    p_phone: phone,
    p_email: email,
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

  // Save the fuller admission answers + mark onboarding complete (service-role,
  // since the page is anonymous). Best-effort: never fail the enrolment for this.
  // Mirrors submitDirectEnrollment so /enroll and /admission store the same data.
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
            dob: input.dob?.trim() || '',
            grade: input.grade || '',
            school: input.school?.trim() || '',
            parentName,
            parentPhone: input.parentPhone?.trim() || '',
            parentWhatsapp: input.parentWhatsapp?.trim() || phone,
            parentEmail: input.parentEmail?.trim() || '',
            parentOccupation: input.parentOccupation?.trim() || '',
            subjects: input.subjects?.trim() || '',
            previousResult: input.previousResult?.trim() || '',
            timeOfDay: input.timeOfDay || '',
            preferredTime: input.preferredTime?.trim() || '',
            notes: input.notes?.trim() || '',
            agreedToPolicy: 'yes',
            source: 'demo_enrollment',
          },
        })
        .eq('id', studentId);
      // Portal login is NOT auto-created — an admin grants LMS access manually
      // later (the student still gets reminders/invites by email).
    } catch {
      /* onboarding payload is best-effort; enrollment already succeeded */
    }
  }

  return { ok: true };
}
