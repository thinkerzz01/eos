// Shared academy reference data (programs, subjects, exam sessions, lead sources).
// NOTE: the Syllabus master data (SyllabusTemplate/SyllabusTopic/MASTER_SYLLABI/
// getSyllabusTemplate) was removed on 2026-08-08 and archived under
// _archive/syllabus/ (owner request). The exports below are still used across the
// app (onboarding, leads, teachers, etc.) and are kept.

export const ALL_PROGRAMS = [
  'O Level (O1)',
  'O Level (O2)',
  'AS',
  'A2',
  'IGCSE',
  'Edexcel IGCSE',
  'Edexcel AS',
  'Edexcel A2',
  'Matric (9)',
  'Matric (10)',
  'Inter (11)',
  'Inter (12)',
] as const;

// Cambridge (CAIE) programs.
export const CAIE_PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'AS', 'A2', 'IGCSE'] as const;
// Edexcel (Pearson) programs.
export const EDEXCEL_PROGRAMS = ['Edexcel IGCSE', 'Edexcel AS', 'Edexcel A2'] as const;
export const LOCAL_BOARD_PROGRAMS = [
  'Matric (9)',
  'Matric (10)',
  'Inter (11)',
  'Inter (12)',
] as const;

// Subjects grouped by the board/level they belong to, so a picker can show ONLY
// the subjects relevant to the chosen program (see subjectsForProgram below).
// Cambridge subjects offered across O Level / IGCSE / AS & A Level. Names are
// shared across those levels (the code differs per level — see SUBJECT_CODES for
// the default, editable per subject in the Subjects manager). Compiled from the
// official cambridgeinternational.org O Level and AS & A Level subject catalogs.
export const CAIE_SUBJECTS = [
  // Mathematics
  'Mathematics',
  'Additional Mathematics',
  'Further Mathematics',
  'Statistics',
  // Sciences
  'Physics',
  'Chemistry',
  'Biology',
  'Combined Science',
  'Marine Science',
  'Environmental Management',
  // Computing
  'Computer Science',
  'Information Technology',
  // Business & Commerce
  'Accounting',
  'Economics',
  'Business',
  'Business Studies',
  'Commerce',
  // Humanities & Social Sciences
  'Geography',
  'History',
  'Sociology',
  'Psychology',
  'Law',
  'Global Perspectives',
  'Global Perspectives & Research',
  'Thinking Skills',
  // English & Literature
  'English (First Language)',
  'English (Second Language)',
  'Literature in English',
  'English General Paper',
  // Languages & Religious Studies
  'Urdu',
  'Arabic',
  'Islamiyat',
  'Islamic Studies',
  'Pakistan Studies',
  // Arts & Applied
  'Art & Design',
  'Design & Technology',
  'Media Studies',
  'Drama',
  'Music',
  'Sport & Physical Education',
  'Food & Nutrition',
  'Fashion & Textiles',
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
  // Mathematics
  'Mathematics': '4024',            // O Level Maths D
  'Additional Mathematics': '4037', // O Level
  'Further Mathematics': '9231',    // A Level
  'Statistics': '4040',             // O Level
  // Sciences
  'Physics': '5054',                // O Level
  'Chemistry': '5070',              // O Level
  'Biology': '5090',                // O Level
  'Combined Science': '5129',       // O Level
  'Marine Science': '9693',         // A Level
  'Environmental Management': '5014', // O Level
  // Computing
  'Computer Science': '2210',       // O Level
  'Information Technology': '0417',  // IGCSE ICT (A Level IT 9626)
  // Business & Commerce
  'Accounting': '7707',             // O Level
  'Economics': '2281',              // O Level
  'Business': '7081',               // O Level (A Level 9609)
  'Business Studies': '7115',       // O Level
  'Commerce': '7100',               // O Level
  // Humanities & Social Sciences
  'Geography': '2217',              // O Level
  'History': '2147',                // O Level
  'Sociology': '2251',              // O Level (A Level 9699)
  'Psychology': '0490',             // IGCSE (A Level 9990)
  'Law': '9084',                    // A Level
  'Global Perspectives': '2069',    // O Level
  'Global Perspectives & Research': '9239', // A Level
  'Thinking Skills': '9694',        // A Level
  // English & Literature
  'English (First Language)': '1123', // O Level English Language
  'English (Second Language)': '0510', // IGCSE ESL
  'Literature in English': '2010',  // O Level (A Level 9695)
  'English General Paper': '8021',  // AS Level
  // Languages & Religious Studies
  'Urdu': '3247',                   // O Level First Language (Second Language 3248)
  'Arabic': '3180',                 // O Level
  'Islamiyat': '2058',              // O Level
  'Islamic Studies': '2068',        // O Level
  'Pakistan Studies': '2059',       // O Level
  // Arts & Applied
  'Art & Design': '6090',           // O Level (A Level 9479)
  'Design & Technology': '9705',    // A Level
  'Media Studies': '9607',          // A Level
  'Drama': '9482',                  // A Level
  'Music': '9483',                  // A Level
  'Sport & Physical Education': '9395', // A Level
  'Food & Nutrition': '6065',       // O Level
  'Fashion & Textiles': '6130',     // O Level
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

/**
 * Label for a DB subject row that prefers its admin-set code, falling back to the
 * standard-code map. Use this for pickers fed by the subjects table so an
 * admin-edited code shows everywhere.
 */
export function labelWithCode(name: string, code?: string | null): string {
  const c = (code && String(code).trim()) || subjectCode(name);
  return c ? `${name} (${c})` : name;
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
