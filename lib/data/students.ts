// Thinkerzz EOS - Students data-access layer (RLS-enforced, server-only)
// ---------------------------------------------------------------------------
// REFERENCE PATTERN for Step 2 of the audit remediation. Every other screen
// should follow this shape:
//   1. Use the SERVER Supabase client (carries the user's session cookie).
//   2. Query normally - Postgres RLS does the authorization. We never bypass
//      it with the service-role key.
//   3. Always filter `deleted_at IS NULL` (global soft-delete invariant).
//   4. Map DB rows -> the view-model the presentational UI already expects.
//   5. Fail safe: no session / error / no rows => return [] (empty state),
//      never a crash and never mock data.
//
// LIVE vs PENDING data: the `students` table owns identity + fee columns, so
// those are real here. Academic metrics (attendance %, homework %, subjects,
// timeline) are produced by Phase 4/5 tables and are left at neutral defaults
// until those slices are wired. They are NOT fabricated with fake-high values.

// Server-only: importing '@/lib/supabase/server' pulls in next/headers, which
// already throws if this module is ever imported into a client component.
import { createClient } from '@/lib/supabase/server';
import type { Student, EnrolledSubject } from '@/lib/mockStudentsData';
import { computeHealth, type FeeStatus } from '@/lib/health';
import { getServerRole } from '@/lib/auth/serverRole';

interface StudentRow {
  id: string;
  code?: string | null;
  name: string;
  parent_name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address?: string | null;
  city?: string | null;
  gender: string;
  program: string;
  exam_session: string;
  enrolled_at: string;
  months_committed: number;
  status: 'active' | 'paused' | 'stopped';
  monthly_fee: number;
  fee_status: 'paid' | 'due' | 'in_grace' | 'stopped';
  next_due_date: string;
  date_of_birth?: string | null;
  onboarding_data?: Record<string, any> | null;
  onboarding_completed_at?: string | null;
}

const FEE_STATUS_UI: Record<StudentRow['fee_status'], FeeStatus> = {
  paid: 'Paid',
  due: 'Due',
  in_grace: 'In Grace',
  stopped: 'Stopped',
};

const STATUS_UI: Record<StudentRow['status'], Student['status']> = {
  active: 'active',
  paused: 'paused',
  stopped: 'alumni',
};

function shortId(uuid: string): string {
  return uuid.split('-')[0].toUpperCase();
}

interface StudentAcademics {
  attendancePct: number;
  homeworkPct: number;
  completedClasses: number;
}

/** Map one real DB row into the rich Student view-model the UI renders. */
function mapRow(r: StudentRow, acad?: StudentAcademics): Student {
  const feeStatus = FEE_STATUS_UI[r.fee_status] ?? 'Due';

  // Academic metrics computed from the real attendance / homework / completed
  // class_sessions tables (see buildAcademics). Feeds the locked health formula.
  const attendancePct = acad?.attendancePct ?? 0;
  const homeworkPct = acad?.homeworkPct ?? 100; // 100 when nothing assigned
  const completedClasses = acad?.completedClasses ?? 0;
  const health = computeHealth({ attendancePct, homeworkPct, feeStatus, completedClasses });

  const enrolledSubjects: EnrolledSubject[] = [];

  // Onboarding payload (school, emergency contact, extra answers) collected
  // by the public /onboarding form and stored on students.onboarding_data.
  const ob = (r.onboarding_data ?? {}) as Record<string, any>;
  const obStr = (k: string): string => {
    const v = ob[k];
    return typeof v === 'string' ? v : v == null ? '' : String(v);
  };
  const schoolName = obStr('school') || obStr('schoolName') || obStr('school_name');
  const emergencyContact =
    obStr('emergencyContact') || obStr('emergency_contact') || obStr('emergency');

  return {
    id: r.id,
    stuId: r.code ?? `THM-${shortId(r.id)}`,
    name: r.name,
    dob: r.date_of_birth ?? '',
    gender: r.gender,
    rollNo: shortId(r.id),
    admissionDate: r.enrolled_at,
    parentName: r.parent_name,
    motherName: '',
    parentPhone: r.phone,
    motherPhone: r.whatsapp ?? '',
    parentEmail: r.email ?? '',
    parentRelation: 'Parent',
    prefLanguage: 'English',
    lastContact: '',
    program: r.program,
    grade: r.program,
    enrolledSubjects,
    attendancePct,
    homeworkPct,
    testsPct: 0,
    assignmentsPct: 0,
    masteryPct: 0,
    // A simple, real performance proxy from attendance + homework once the
    // student has attended at least one class; 0 (no data) before that.
    performanceScore: completedClasses > 0 ? Math.round((attendancePct + homeworkPct) / 2) : 0,
    feeStatus,
    feeDateText: r.next_due_date,
    nextClassTime: '',
    nextClassSubject: '',
    nextClassTeacher: '',
    nextClassRoom: '',
    aiTag: 'Average',
    aiMessage: '',
    tags: [],
    totalPaid: '',
    totalOutstanding: '',
    // UI type has no cold-start band; use Amber ("watch/insufficient data")
    // rather than a misleading Green or an alarming Red.
    healthBand: health.band ?? 'Amber',
    status: STATUS_UI[r.status] ?? 'active',
    timeline: [],
    documents: [],
    // Raw editable fields for the profile editor.
    whatsapp: r.whatsapp ?? '',
    city: r.city ?? '',
    address: r.address ?? '',
    examSession: r.exam_session ?? '',
    monthlyFee: Number(r.monthly_fee ?? 0),
    nextDueDate: r.next_due_date ?? '',
    // Onboarding payload for the profile Overview.
    onboardingDone: !!r.onboarding_completed_at,
    schoolName,
    emergencyContact,
    onboardingExtra: ob as Record<string, string>,
  };
}

/**
 * Fetch the current user's visible students, authorized entirely by RLS:
 *   - admin / manager  -> all students in their org
 *   - teacher          -> only their own students (RLS policy)
 *   - student/parent   -> only their own child (RLS policy)
 * Returns [] for an unauthenticated request or on any error.
 */
/** Aggregate attendance / homework / completed sessions per student. */
function buildAcademics(
  att: { student_id: string; status: string }[],
  hw: { student_id: string; status: string }[],
  sessions: { student_id: string }[]
): Map<string, StudentAcademics> {
  type Acc = { present: number; late: number; attTotal: number; hwOnTime: number; hwTotal: number; completed: number };
  const acc = new Map<string, Acc>();
  const get = (id: string): Acc => {
    let e = acc.get(id);
    if (!e) { e = { present: 0, late: 0, attTotal: 0, hwOnTime: 0, hwTotal: 0, completed: 0 }; acc.set(id, e); }
    return e;
  };
  for (const a of att) {
    const e = get(a.student_id);
    e.attTotal++;
    if (a.status === 'present') e.present++;
    else if (a.status === 'late') e.late++;
  }
  for (const h of hw) {
    const e = get(h.student_id);
    e.hwTotal++;
    if (h.status === 'submitted' || h.status === 'graded') e.hwOnTime++;
  }
  for (const s of sessions) get(s.student_id).completed++;

  const out = new Map<string, StudentAcademics>();
  for (const [id, e] of Array.from(acc.entries())) {
    out.set(id, {
      // Attendance%: (present + 0.5·late) / total completed classes · 100
      attendancePct: e.attTotal > 0 ? Math.round(((e.present + 0.5 * e.late) / e.attTotal) * 100) : 0,
      // Homework%: on-time / assigned · 100; 100 if none assigned
      homeworkPct: e.hwTotal > 0 ? Math.round((e.hwOnTime / e.hwTotal) * 100) : 100,
      completedClasses: e.completed,
    });
  }
  return out;
}

/**
 * Strip parent/guardian CONTACT + address PII from a student view-model. Applied
 * server-side for the `teacher` role so contact details never reach a teacher's
 * browser at all (defense-in-depth behind the UI hiding). Teachers keep the
 * academic picture: name, program, subjects, class/attendance/homework metrics.
 */
function redactContactForTeacher(s: Student): Student {
  return {
    ...s,
    parentName: '',
    motherName: '',
    parentPhone: '',
    motherPhone: '',
    parentEmail: '',
    whatsapp: '',
    parentRelation: '',
    lastContact: '',
    address: '',
    city: '',
    emergencyContact: '',
    // onboardingExtra is a free-form answer blob that can carry contact PII
    // (emergency numbers, home details) — drop it wholesale for teachers.
    onboardingExtra: {},
  };
}

export async function getStudents(): Promise<Student[]> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const baseCols =
    'id,code,name,parent_name,phone,whatsapp,email,address,city,gender,program,exam_session,enrolled_at,months_committed,status,monthly_fee,fee_status,next_due_date';
  // Try to read the onboarding columns too; fall back gracefully if the
  // onboarding migration has not been applied yet (so the page never breaks).
  let data: any = null;
  let error: any = null;
  const rich = await supabase
    .from('students')
    .select(`${baseCols},date_of_birth,onboarding_data,onboarding_completed_at`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (rich.error) {
    const basic = await supabase
      .from('students')
      .select(baseCols)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    data = basic.data;
    error = basic.error;
  } else {
    data = rich.data;
  }

  if (error || !data) return [];

  // Compute academics + subjects + next class from the real tables (all
  // RLS-scoped, so a teacher only ever sees their own students' rows).
  const [attRes, hwRes, sessRes, ssRes] = await Promise.all([
    supabase.from('attendance').select('student_id,status').is('deleted_at', null),
    supabase.from('homework').select('student_id,status').is('deleted_at', null),
    supabase
      .from('class_sessions')
      .select('student_id,start_at,status,meeting_link,subjects(name)')
      .is('deleted_at', null)
      .order('start_at', { ascending: true }),
    supabase.from('student_subjects').select('student_id,subjects(name)').is('deleted_at', null),
  ]);

  const embedName = (rel: any): string =>
    (Array.isArray(rel) ? rel[0]?.name : rel?.name) ?? '';

  const sessions = (sessRes.data as any[]) ?? [];
  const completed = sessions.filter((r) => r.status === 'completed').map((r) => ({ student_id: r.student_id }));
  const acad = buildAcademics(attRes.data ?? [], hwRes.data ?? [], completed);

  // Subjects the student is taught (by this viewer's scope) = subject enrollments
  // + any scheduled/held classes. Next class = the earliest upcoming scheduled one.
  const now = Date.now();
  const subjectsByStudent = new Map<string, Set<string>>();
  const nextByStudent = new Map<string, { time: string; subject: string }>();
  const addSubject = (sid: string, name: string) => {
    if (!sid || !name) return;
    const set = subjectsByStudent.get(sid) ?? new Set<string>();
    set.add(name);
    subjectsByStudent.set(sid, set);
  };
  const fmtNext = (iso: string): string =>
    new Date(iso).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi',
    });
  for (const r of sessions) {
    const name = embedName(r.subjects);
    addSubject(r.student_id, name);
    if (r.status === 'scheduled' && r.start_at && new Date(r.start_at).getTime() >= now) {
      const prev = nextByStudent.get(r.student_id);
      if (!prev || new Date(r.start_at).getTime() < new Date(prev.time).getTime()) {
        // Store ISO temporarily in `time` for comparison, then format below.
        nextByStudent.set(r.student_id, { time: r.start_at, subject: name });
      }
    }
  }
  for (const r of (ssRes.data as any[]) ?? []) addSubject(r.student_id, embedName(r.subjects));

  const mapped = (data as StudentRow[]).map((r) => mapRow(r, acad.get(r.id)));

  for (const s of mapped) {
    const subs = Array.from(subjectsByStudent.get(s.id) ?? []);
    if (subs.length) {
      s.enrolledSubjects = subs.map((name) => ({
        subject: name, teacherName: '', assessedGrade: '', targetGrade: 'A*',
        avgScore: 0, assignments: '', quizScore: 0, status: 'Good', trend: 'stable',
      }));
    }
    const nx = nextByStudent.get(s.id);
    if (nx) {
      s.nextClassTime = fmtNext(nx.time);
      s.nextClassSubject = nx.subject;
    }
  }

  // Teachers only ever see students RLS already scoped to them (their assigned
  // students). On top of that, hide all parent/guardian contact PII from them.
  const role = await getServerRole();
  if (role === 'teacher') return mapped.map(redactContactForTeacher);
  return mapped;
}
