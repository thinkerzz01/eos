// Teachers data-access (RLS-enforced, server-only). Pattern: see lib/data/students.ts.
// Pay lives in the separate Admin-only `teacher_pay_rates` table. We nested-select
// it here, but RLS filters the embedded rows per role: an Admin sees the rate, a
// Manager/Teacher/Student gets an EMPTY array (so perClassPay resolves to 0). The
// isolation is enforced at the DB, not by hiding the column in code.
import { createClient } from '@/lib/supabase/server';
import type { Teacher } from '@/app/teachers/TeachersClient';

interface DemoStat {
  completed: number; // demos with a recorded outcome (won/lost/follow_up)
  converted: number; // demos won
}

// TeacherScore = 0.45·Rating% + 0.35·DemoConversion% + 0.20·Reliability%.
// DemoConversion% (Master Plan §6.3) = won / demos-with-recorded-outcome over a
// rolling 90-day window (computed from the demos table below, not stored counts).
// Cold start: < 5 completed demos => null ("Building record" / "New").
function teacherScore(rating: number, reliability: number, d: DemoStat): number | null {
  if (d.completed < 5) return null;
  const ratingPct = (rating / 5) * 100;
  const convPct = d.completed > 0 ? (d.converted / d.completed) * 100 : 0;
  return Math.round(0.45 * ratingPct + 0.35 * convPct + 0.2 * reliability);
}

function mapRow(r: any, demo: DemoStat, subjects: string[], programs: string[], load: number): Teacher {
  const isLeft = !!r.left_at || r.status === 'left';
  const status: Teacher['status'] = isLeft ? 'Left' : r.status === 'on_leave' ? 'On Leave' : 'Teaching';
  // RLS returns pay rates only to an Admin; for everyone else this is empty -> 0.
  const rates: any[] = Array.isArray(r.teacher_pay_rates) ? r.teacher_pay_rates : [];
  const latestRate = rates
    .slice()
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))[0];
  return {
    id: r.id,
    empId: `TCH-${r.id.split('-')[0].toUpperCase()}`,
    name: r.name,
    email: r.email,
    phone: r.phone,
    joinDate: r.join_date,
    subjects,           // from teacher_subjects
    programs,           // distinct programs of those subjects
    capacity: r.capacity,
    currentLoad: load,  // enrolled student_subjects for this teacher
    perClassPay: latestRate ? Number(latestRate.rate_per_class) : 0,
    score: teacherScore(Number(r.rating || 0), Number(r.reliability || 0), demo),
    rating: r.rating,
    ratingCount: demo.completed,
    status,
    experience: '',
    qualification: '',
    todaysClassesCount: 0,
    pendingReviewsCount: 0,
    payrollStatus: 'Ready',
    alertsCount: 0,
    schedule: [],
  };
}

export async function getTeachers(): Promise<Teacher[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const baseCols =
    'id,name,email,phone,capacity,status,rating,reliability,join_date,city,teacher_pay_rates(rate_per_class,effective_from)';
  // Try to read the optional "left the academy" columns; fall back gracefully if
  // the migration (left_at / leaving_reason) has not been applied yet, so the
  // page never breaks before the SQL is run.
  let data: any = null;
  let error: any = null;
  const rich = await supabase
    .from('teachers')
    .select(`${baseCols},left_at,leaving_reason`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (rich.error) {
    const basic = await supabase
      .from('teachers')
      .select(baseCols)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    data = basic.data;
    error = basic.error;
  } else {
    data = rich.data;
  }

  if (error || !data) return [];

  // Subjects + programs per teacher (from teacher_subjects), and enrolled load
  // (from student_subjects). Both RLS-scoped. Empty until those links exist.
  const [{ data: tsRows }, { data: ssRows }] = await Promise.all([
    supabase.from('teacher_subjects').select('teacher_id,subjects(name,program)').is('deleted_at', null),
    supabase.from('student_subjects').select('teacher_id').is('deleted_at', null),
  ]);
  const subjBy = new Map<string, Set<string>>();
  const progBy = new Map<string, Set<string>>();
  for (const row of (tsRows as any[]) ?? []) {
    const tid = row.teacher_id as string;
    const subj = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
    if (!tid || !subj) continue;
    if (!subjBy.has(tid)) subjBy.set(tid, new Set());
    if (!progBy.has(tid)) progBy.set(tid, new Set());
    if (subj.name) subjBy.get(tid)!.add(subj.name);
    if (subj.program) progBy.get(tid)!.add(subj.program);
  }
  const loadBy = new Map<string, number>();
  for (const row of (ssRows as any[]) ?? []) {
    const tid = (row as any).teacher_id as string;
    if (tid) loadBy.set(tid, (loadBy.get(tid) ?? 0) + 1);
  }

  // Rolling 90-day demo conversion per teacher (Master Plan §6.3): count only
  // demos that have a recorded outcome; converted = won.
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: demoRows } = await supabase
    .from('demos')
    .select('teacher_id,outcome,scheduled_at')
    .not('teacher_id', 'is', null)
    .in('outcome', ['won', 'lost', 'follow_up'])
    .gte('scheduled_at', cutoff)
    .is('deleted_at', null);
  const byTeacher = new Map<string, DemoStat>();
  for (const d of demoRows ?? []) {
    const id = (d as any).teacher_id as string;
    const e = byTeacher.get(id) ?? { completed: 0, converted: 0 };
    e.completed++;
    if ((d as any).outcome === 'won') e.converted++;
    byTeacher.set(id, e);
  }

  return (data as any[]).map((r) =>
    mapRow(
      r,
      byTeacher.get(r.id) ?? { completed: 0, converted: 0 },
      Array.from(subjBy.get(r.id) ?? []).sort(),
      Array.from(progBy.get(r.id) ?? []).sort(),
      loadBy.get(r.id) ?? 0
    )
  );
}
