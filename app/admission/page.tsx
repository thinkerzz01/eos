'use client';

// Public DIRECT-ENROLMENT form (no demo, no lead). Uses the shared AdmissionWizard
// so the manual admission link and the demo-convert enrolment link (/enroll) show
// an identical UI. This variant CREATES the student via submitDirectEnrollment.
import { AdmissionWizard, type AdmissionPayload } from '@/components/admission/AdmissionWizard';
import { submitDirectEnrollment } from './actions';

export default function AdmissionPage() {
  const onSubmit = (p: AdmissionPayload) => submitDirectEnrollment(p);
  return <AdmissionWizard onSubmit={onSubmit} />;
}
