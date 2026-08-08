// Complete Academy Programs & Master Syllabi Reference Data for Thinkerzz EOS v3.1

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
// whatsapp/referral/walk_in) — see normalizeSource in app/students/actions.ts.
export const LEAD_SOURCES = [
  'Instagram',
  'Facebook',
  'Google',
  'Referral',
  'Walk-in',
  'WhatsApp',
];

export interface SyllabusTopic {
  id: string;
  name: string;
  sort: number;
}

export interface SyllabusTemplate {
  id: string;
  program: string;
  subjectName: string;
  academicYear: string;
  cambridgeCode: string;
  status: 'active' | 'archived';
  topics: SyllabusTopic[];
}

export const MASTER_SYLLABI: Record<string, { code: string; topics: string[] }> = {
  Physics: {
    code: '9702',
    topics: [
      'Physical quantities & units',
      'Kinematics & projectile motion',
      'Dynamics & momentum',
      'Forces, density & pressure',
      'Work, energy & power',
      'Deformation of solids',
      'Waves & superposition',
      'Electricity & D.C. circuits',
      'Particle & nuclear physics',
      'Motion in a circle',
      'Gravitational fields',
      'Ideal gases & thermodynamics',
      'Oscillations & simple harmonic motion',
      'Electric fields & capacitance',
      'Magnetic fields & electromagnetic induction',
      'Quantum physics & medical imaging',
    ],
  },
  Chemistry: {
    code: '9701',
    topics: [
      'Atomic structure & stoichiometry',
      'Chemical bonding & states of matter',
      'Chemical energetics & enthalpy',
      'Electrochemistry & redox',
      'Equilibria & Le Chatelier principle',
      'Reaction kinetics',
      'Periodic Table: Group 2 & Group 17',
      'Nitrogen, sulfur & environmental chemistry',
      'Organic chemistry: Hydrocarbons & haloalkanes',
      'Alcohols, esters & carbonyl compounds',
      'Carboxylic acids & polymerisation',
      'Analytical techniques (NMR, IR, Mass Spec)',
      'Transition elements & complex ions',
    ],
  },
  Mathematics: {
    code: '9709',
    topics: [
      'Quadratics & functions',
      'Coordinate geometry',
      'Circular measure & trigonometry',
      'Series & binomial expansion',
      'Differentiation & integration (P1)',
      'Algebra & logarithmic functions (P3)',
      'Vectors & 3D geometry',
      'Complex numbers',
      'Differential equations',
      'Permutations & combinations (S1)',
      'Probability & random variables',
      'Normal distribution & hypothesis testing',
    ],
  },
  Biology: {
    code: '9700',
    topics: [
      'Cell structure & microscopy',
      'Biological molecules & enzymes',
      'Cell membranes & transport',
      'Mitosis & nucleic acids',
      'Transport in plants & mammals',
      'Gas exchange & infectious diseases',
      'Immunity & vaccination',
      'Respiration & photosynthesis',
      'Homeostasis & nervous coordination',
      'Inherited change & genetics',
      'Selection & evolution',
      'Biodiversity & genetic technology',
    ],
  },
  Accounting: {
    code: '9706',
    topics: [
      'Financial accounting fundamentals',
      'Control accounts & bank reconciliation',
      'Correction of errors & suspense accounts',
      'Preparation of financial statements',
      'Partnership & company accounting',
      'Cost & management accounting (Marginal / Absorption)',
    ],
  },
  Economics: {
    code: '9708',
    topics: [
      'Basic economic ideas & resource allocation',
      'The price system & microeconomics',
      'Government microeconomic intervention',
      'The macroeconomy & price stability',
      'Government macroeconomic intervention',
      'International trade & exchange rates',
    ],
  },
  'Business Studies': {
    code: '9609',
    topics: [
      'Business & its environment',
      'People in organisations & HR',
      'Marketing principles & strategy',
      'Operations & project management',
      'Finance & accounting principles',
      'Strategic management & decision making',
    ],
  },
  'Computer Science': {
    code: '9618',
    topics: [
      'Information representation & data types',
      'Communication & internet technologies',
      'Hardware & virtual machines',
      'System software & security',
      'Data security & privacy',
      'Ethics & ownership',
      'Database & data modelling',
      'Algorithm design & problem solving',
      'Software development lifecycle',
      'Programming paradigms (Python / OOP)',
    ],
  },
};

export const CAIE_MASTER_SYLLABI = MASTER_SYLLABI;

export function getSyllabusTemplate(
  subject: string,
  program: string = 'A Level'
): SyllabusTemplate {
  const master = MASTER_SYLLABI[subject] || {
    code: '1000',
    topics: [
      'Core Fundamentals',
      'Intermediate Concepts',
      'Applied Problem Solving',
      'Past Paper Applications',
      'Final Revision & Exam Practice',
    ],
  };

  return {
    id: `template-${subject.toLowerCase().replace(/\s+/g, '-')}-2026`,
    program,
    subjectName: subject,
    academicYear: '2026',
    cambridgeCode: master.code,
    status: 'active',
    topics: master.topics.map((name, index) => ({
      id: `topic-${index + 1}`,
      name,
      sort: index + 1,
    })),
  };
}
