'use client';

// Demo-convert enrolment form. The parent (server) page validated the lead behind
// this link and passes the booking data as `initial`. It renders the SAME shared
// AdmissionWizard as the manual /admission link so the applicant sees an identical
// UI; on submit it converts the won lead into a student via submitEnrollment.
import { AdmissionWizard, type AdmissionPayload } from '@/components/admission/AdmissionWizard';
import { submitEnrollment } from './actions';

export interface EnrollInitial {
  studentName: string;
  parentName: string;
  phone: string;
  email: string;
  program: string;
  city: string;
  address: string;
}

export function EnrollForm({ leadId, initial }: { leadId: string; initial: EnrollInitial }) {
  const onSubmit = (p: AdmissionPayload) =>
    submitEnrollment({
      leadId,
      studentName: p.studentName,
      parentName: p.parentName,
      // The wizard's WhatsApp field is the primary contact number.
      phone: p.parentWhatsapp || p.parentPhone || '',
      email: p.studentEmail,
      program: p.program,
      examSession: p.examSession,
      gender: p.gender,
      city: p.city,
      address: p.address,
      // Richer admission answers - stored on the student's onboarding record.
      dob: p.dob,
      studentMobile: p.studentMobile,
      grade: p.grade,
      school: p.school,
      parentPhone: p.parentPhone,
      parentWhatsapp: p.parentWhatsapp,
      parentEmail: p.parentEmail,
      parentOccupation: p.parentOccupation,
      subjects: p.subjects,
      previousResult: p.previousResult,
      timeOfDay: p.timeOfDay,
      preferredTime: p.preferredTime,
      notes: p.notes,
      turnstileToken: p.turnstileToken,
    });

  return (
    <AdmissionWizard
      onSubmit={onSubmit}
      initial={{
        fullName: initial.studentName,
        parentName: initial.parentName,
        parentWhatsapp: initial.phone,
        studentEmail: initial.email,
        program: initial.program,
        city: initial.city,
        address: initial.address,
      }}
    />
  );
}
