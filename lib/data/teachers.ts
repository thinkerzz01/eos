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

function mapRow(r: any, demo: DemoStat): Teacher {
  const status: Teacher['status'] = r.status === 'on_leave' ? 'On Leave' : 'Teaching';
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
    subjects: [],       // from teacher_subjects (later slice)
    programs: [],
    capacity: r.capacity,
    currentLoad: 0,     // from class_sessions (Phase 4)
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
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('teachers')
    .select('id,name,email,phone,capacity,status,rating,reliability,join_date,city,teacher_pay_rates(rate_per_class,effective_from)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

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

  return (data as any[]).map((r) => mapRow(r, byTeacher.get(r.id) ?? { completed: 0, converted: 0 }));
}
