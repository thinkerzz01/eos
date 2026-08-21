'use server';

// Public enrollment completion. The /enroll/<leadId> page is unauthenticated, so
// it calls the SECURITY DEFINER `submit_enrollment` routine (schema.sql), which
// creates the student from the won lead and marks the lead converted. Fee is 0 and
// the schedule is set by the Admin afterwards.
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { provisionLogin } from '@/lib/auth/provision';
import { guardPublicSubmit } from '@/lib/publicFormGuard';

const ENROLLABLE_PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'A Level (A1)', 'A Level (A2)', 'IGCSE', 'Matric (9)', 'Matric (10)', 'Inter (11)', 'Inter (12)'];

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

  // Auto-provision the student's portal login (best-effort). The page is anon, so
  // we resolve the org from the just-created student via the service-role client.
  if (email && typeof studentId === 'string') {
    try {
      const admin = createAdminClient();
      const { data: student } = await admin
        .from('students')
        .select('org_id')
        .eq('id', studentId)
        .single();
      if (student?.org_id) {
        await provisionLogin({
          email,
          name: studentName,
          role: 'student',
          orgId: student.org_id,
          studentId,
        });
      }
    } catch {
      // Never fail the enrollment because the invite email could not be sent.
    }
  }

  return { ok: true };
}
