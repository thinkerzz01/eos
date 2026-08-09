// Shared academy reference data (programs, subjects, exam sessions, lead sources).
// NOTE: the Syllabus master data (SyllabusTemplate/SyllabusTopic/MASTER_SYLLABI/
// getSyllabusTemplate) was removed on 2026-08-08 and archived under
// _archive/syllabus/ (owner request). The exports below are still used across the
// app (onboarding, leads, teachers, etc.) and are kept.

export const ALL_PROGRAMS = [
  'O Level',
  'A Level',
  'IGCSE',
  'Matric (9th)',
  'Matric (10th)',
  'Inter (11th)',
  'Inter (12th)',
] as const;

export const CAIE_PROGRAMS = ['O Level', 'A Level', 'IGCSE'] as const;
export const LOCAL_BOARD_PROGRAMS = [
  'Matric (9th)',
  'Matric (10th)',
  'Inter (11th)',
  'Inter (12th)',
] as const;

export const ALL_SUBJECTS = [
  // CAIE Subjects
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Accounting',
  'Economics',
  'Business Studies',
  'Computer Science',
  'English (First Language)',
  'English (Second Language)',
  'Additional Mathematics',
  'Islamiyat',
  'Pakistan Studies',
  'Urdu',
  'Statistics',
  'Psychology',
  'Sociology',
  // Matric & Inter Local Board Subjects
  'Physics (Matric)',
  'Chemistry (Matric)',
  'Biology (Matric)',
  'Mathematics (Matric)',
  'Computer Science (Matric)',
  'English (Compulsory)',
  'Urdu (Compulsory)',
  'Islamiyat (Compulsory)',
  'Pakistan Studies (Compulsory)',
  'Pre-Medical (Inter)',
  'Pre-Engineering (Inter)',
  'ICS (Computer Science Inter)',
  'I.Com (Commerce Inter)',
] as const;

export const EXAM_SESSIONS = [
  'May/June 2026',
  'Oct/Nov 2026',
  'May/June 2027',
  'Oct/Nov 2027',
  'Annual Board 2026',
  'Annual Board 2027',
];

// Labels must normalize to the DB source enum (google/facebook/instagram/
// whatsapp/referral/walk_in) - see normalizeSource in app/students/actions.ts.
export const LEAD_SOURCES = [
  'Instagram',
  'Facebook',
  'Google',
  'Referral',
  'Walk-in',
  'WhatsApp',
];
