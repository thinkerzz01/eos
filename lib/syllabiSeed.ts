// Shared academy reference data (programs, subjects, exam sessions, lead sources).
// NOTE: the Syllabus master data (SyllabusTemplate/SyllabusTopic/MASTER_SYLLABI/
// getSyllabusTemplate) was removed on 2026-08-08 and archived under
// _archive/syllabus/ (owner request). The exports below are still used across the
// app (onboarding, leads, teachers, etc.) and are kept.

export const ALL_PROGRAMS = [
  'O Level (O1)',
  'O Level (O2)',
  'A Level (A1)',
  'A Level (A2)',
  'IGCSE',
  'Matric (9)',
  'Matric (10)',
  'Inter (11)',
  'Inter (12)',
] as const;

export const CAIE_PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'A Level (A1)', 'A Level (A2)', 'IGCSE'] as const;
export const LOCAL_BOARD_PROGRAMS = [
  'Matric (9)',
  'Matric (10)',
  'Inter (11)',
  'Inter (12)',
] as const;

// Subjects grouped by the board/level they belong to, so a picker can show ONLY
// the subjects relevant to the chosen program (see subjectsForProgram below).
export const CAIE_SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Accounting',
  'Economics',
  'Business Studies',
  'Computer Science',
  'Information Technology',
  'English (First Language)',
  'English (Second Language)',
  'Additional Mathematics',
  'Islamiyat',
  'Pakistan Studies',
  'Urdu',
  'Statistics',
  'Psychology',
  'Sociology',
] as const;

export const MATRIC_SUBJECTS = [
  'Physics (Matric)',
  'Chemistry (Matric)',
  'Biology (Matric)',
  'Mathematics (Matric)',
  'Computer Science (Matric)',
  'English (Compulsory)',
  'Urdu (Compulsory)',
  'Islamiyat (Compulsory)',
  'Pakistan Studies (Compulsory)',
] as const;

export const INTER_SUBJECTS = [
  'Pre-Medical (Inter)',
  'Pre-Engineering (Inter)',
  'ICS (Computer Science Inter)',
  'I.Com (Commerce Inter)',
  'English (Compulsory)',
  'Urdu (Compulsory)',
  'Islamiyat (Compulsory)',
  'Pakistan Studies (Compulsory)',
] as const;

// Flat master list (deduped) - kept for the places that need every subject
// (teacher subjects, onboarding fallback, etc.).
export const ALL_SUBJECTS: string[] = Array.from(
  new Set<string>([...CAIE_SUBJECTS, ...MATRIC_SUBJECTS, ...INTER_SUBJECTS])
);

/**
 * The subjects relevant to a given academic program. O/A Level and IGCSE are CAIE;
 * Matric and Inter use the local-board lists. Anything unrecognised defaults to
 * CAIE (the most common). Used to filter the subject picker on the booking form.
 */
export function subjectsForProgram(program: string): readonly string[] {
  if (program.startsWith('Matric')) return MATRIC_SUBJECTS;
  if (program.startsWith('Inter')) return INTER_SUBJECTS;
  return CAIE_SUBJECTS;
}

// Standard CAIE subject codes (one per subject; O-Level codes used as the common
// default per the academy's choice). Matric/Inter subjects have no CAIE code and
// are intentionally omitted. NOTE: verify these against your exact syllabus
// variants — some subjects have alternates (e.g. Maths D 4024 vs 4029, Urdu 3247
// second-language vs 3248 first-language).
export const SUBJECT_CODES: Record<string, string> = {
  'Mathematics': '4024',
  'Additional Mathematics': '4037',
  'Physics': '5054',
  'Chemistry': '5070',
  'Biology': '5090',
  'Accounting': '7707',
  'Economics': '2281',
  'Business Studies': '7115',
  'Computer Science': '2210',
  'Information Technology': '0417',
  'English (First Language)': '1123',
  'English (Second Language)': '0510',
  'Islamiyat': '2058',
  'Pakistan Studies': '2059',
  'Urdu': '3247',
  'Statistics': '4040',
  'Psychology': '0490',
  'Sociology': '2251',
};

/** The CAIE code for a subject name, or '' if it has none (Matric/Inter, etc.). */
export function subjectCode(name: string): string {
  return SUBJECT_CODES[name] ?? '';
}

/** Display label for a subject: "Name (Code)" when a code exists, else just "Name". */
export function subjectLabel(name: string): string {
  const code = subjectCode(name);
  return code ? `${name} (${code})` : name;
}

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
