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

// Edexcel International GCSE spec codes (verify vs the Pearson Int GCSE info
// manual). Edexcel International A Level (IAL) is unit-based (WMA11, WCH11, …) and
// its per-subject qualification codes are set in the Subjects manager instead of
// hard-coded here.
export const EDEXCEL_IGCSE_CODES: Record<string, string> = {
  'Mathematics': '4MA1',
  'Additional Mathematics': '4PM1',   // Further Pure Mathematics
  'Further Mathematics': '4PM1',
  'Physics': '4PH1',
  'Chemistry': '4CH1',
  'Biology': '4BI1',
  'Combined Science': '4SD0',          // Science (Double Award)
  'Computer Science': '4CP0',
  'Information Technology': '4IT1',
  'Accounting': '4AC1',
  'Economics': '4EC1',
  'Business': '4BS1',
  'Business Studies': '4BS1',
  'Commerce': '4CM1',
  'Geography': '4GE1',
  'History': '4HI1',
  'English (First Language)': '4EA1',
  'English (Second Language)': '4EB1',
  'Literature in English': '4ET1',
  'Islamiyat': '4IS1',
  'Pakistan Studies': '4PA1',
  'Urdu': '4UR0',
  'Arabic': '4AA1',
};

// Cambridge IGCSE syllabus codes (0-prefixed; the mainstream syllabus per subject,
// not the 9-1 UK variants). From the official IGCSE subject catalog.
export const IGCSE_CODES: Record<string, string> = {
  'Mathematics': '0580', 'Additional Mathematics': '0606', 'Physics': '0625',
  'Chemistry': '0620', 'Biology': '0610', 'Combined Science': '0653',
  'Marine Science': '0697', 'Environmental Management': '0680',
  'Computer Science': '0478', 'Information Technology': '0417',
  'Accounting': '0452', 'Economics': '0455', 'Business': '0264', 'Business Studies': '0450',
  'Commerce': '0715', 'Geography': '0460', 'History': '0470', 'Sociology': '0495',
  'Global Perspectives': '0457', 'English (First Language)': '0500',
  'English (Second Language)': '0510', 'Literature in English': '0475',
  'Islamiyat': '0493', 'Pakistan Studies': '0448', 'Urdu': '0539', 'Arabic': '0508',
  'Art & Design': '0400', 'Design & Technology': '0445', 'Drama': '0411',
  'Music': '0410', 'Food & Nutrition': '0648',
};

// Cambridge AS & A Level syllabus codes (9-prefixed; 8-prefixed = AS-only). From
// the official AS & A Level subject catalog.
export const A_LEVEL_CODES: Record<string, string> = {
  'Mathematics': '9709', 'Further Mathematics': '9231', 'Physics': '9702',
  'Chemistry': '9701', 'Biology': '9700', 'Marine Science': '9693',
  'Environmental Management': '8291', 'Computer Science': '9618',
  'Information Technology': '9626', 'Accounting': '9706', 'Economics': '9708',
  'Business': '9609', 'Geography': '9696', 'History': '9489', 'Sociology': '9699',
  'Psychology': '9990', 'Law': '9084', 'Global Perspectives & Research': '9239',
  'Thinking Skills': '9694', 'English (First Language)': '9093',
  'Literature in English': '9695', 'English General Paper': '8021',
  'Urdu': '9676', 'Arabic': '9680', 'Islamic Studies': '9488',
  'Art & Design': '9479', 'Design & Technology': '9705', 'Media Studies': '9607',
  'Drama': '9482', 'Music': '9483', 'Sport & Physical Education': '9395',
};

// Edexcel International Advanced Level cash-in codes. IAS = X-prefix, IAL = Y-prefix.
// Verified pattern (Business YBS11 / Accounting YAC11); a few unit suffixes (01 vs
// 11) may vary by spec version — verify vs the Pearson IAL information manual.
export const EDEXCEL_IAS_CODES: Record<string, string> = {
  'Mathematics': 'XMA01', 'Further Mathematics': 'XFM01', 'Physics': 'XPH11',
  'Chemistry': 'XCH11', 'Biology': 'XBI11', 'Economics': 'XEC11', 'Business': 'XBS11',
  'Accounting': 'XAC11', 'Information Technology': 'XIT01', 'Psychology': 'XPY01',
  'Law': 'XLA01', 'Geography': 'XGE01', 'History': 'XHI01',
  'English (First Language)': 'XEN01', 'Literature in English': 'XET01',
};
export const EDEXCEL_IAL_CODES: Record<string, string> = {
  'Mathematics': 'YMA01', 'Further Mathematics': 'YFM01', 'Physics': 'YPH11',
  'Chemistry': 'YCH11', 'Biology': 'YBI11', 'Economics': 'YEC11', 'Business': 'YBS11',
  'Accounting': 'YAC11', 'Information Technology': 'YIT01', 'Psychology': 'YPY01',
  'Law': 'YLA01', 'Geography': 'YGE01', 'History': 'YHI01',
  'English (First Language)': 'YEN01', 'Literature in English': 'YET01',
};

/** The default (Cambridge O-Level) code for a subject name, or '' if none. */
export function subjectCode(name: string): string {
  return SUBJECT_CODES[name] ?? '';
}

/**
 * The correct code for a subject GIVEN the program's board AND level:
 *   O Level (O1/O2) -> Cambridge O Level (4024 …)
 *   IGCSE           -> Cambridge IGCSE (0580 …)
 *   AS / A2         -> Cambridge AS & A Level (9709 …)
 *   Edexcel IGCSE   -> Edexcel Int GCSE (4MA1 …)
 *   Edexcel AS      -> Edexcel IAS (XMA01 …)
 *   Edexcel A2      -> Edexcel IAL (YMA01 …)
 *   Matric / Inter  -> '' (local boards, no CAIE/Edexcel code)
 * Returns '' when the level doesn't offer the subject (so no wrong code shows).
 */
export function codeForProgram(name: string, program?: string): string {
  switch (program) {
    case 'IGCSE': return IGCSE_CODES[name] ?? '';
    case 'AS':
    case 'A2': return A_LEVEL_CODES[name] ?? '';
    case 'Edexcel IGCSE': return EDEXCEL_IGCSE_CODES[name] ?? '';
    case 'Edexcel AS': return EDEXCEL_IAS_CODES[name] ?? '';
    case 'Edexcel A2': return EDEXCEL_IAL_CODES[name] ?? '';
    case 'O Level (O1)':
    case 'O Level (O2)': return subjectCode(name);
    default: return subjectCode(name); // unknown -> O-Level default (Matric/Inter -> '')
  }
}

/** Board-aware label: "Name (Code)" using the program's board code, else "Name". */
export function labelForProgram(name: string, program?: string): string {
  const c = codeForProgram(name, program);
  return c ? `${name} (${c})` : name;
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
