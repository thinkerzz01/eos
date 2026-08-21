// Teacher portal dashboard data - RLS-enforced, server-only. Every query runs
// under the teacher's session, so class_sessions/homework are already scoped to
// their own rows (teacher_access_own_* policies). Returns null for non-teachers.
// NOTE: teacher_payouts is admin-only under RLS, so payout is intentionally NOT
// shown here - a teacher cannot read it.
import { createClient } from '@/lib/supabase/server';

export interface TeacherDashboard {
  classesToday: number;
  classesThisWeek: number;
  studentsCount: number;
  pendingReviews: number; // submitted/late homework awaiting a grade
  nextClass: { label: string; time: string } | null;
}

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

export async function getTeacherDashboard(): Promise<TeacherDashboard | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if ((profile as any)?.role !== 'teacher') return null;

  const now = Date.now();
  const todayPKT = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const dayStart = new Date(`${todayPKT}T00:00:00+05:00`).getTime();
  const dayEnd = new Date(`${todayPKT}T23:59:59+05:00`).getTime();
  const weekEnd = now + 7 * 86400000;

  const { data: sessions } = await supabase
    .from('class_sessions')
    .select('id,start_at,student_id,status,students(name),subjects(name)')
    .is('deleted_at', null)
    .order('start_at', { ascending: true });
  const rows = (sessions as any[]) ?? [];
  const t = (r: any) => new Date(r.start_at).getTime();

  const classesToday = rows.filter((r) => t(r) >= dayStart && t(r) <= dayEnd).length;
  const classesThisWeek = rows.filter((r) => t(r) >= now && t(r) <= weekEnd).length;
  const studentsCount = new Set(rows.map((r) => r.student_id).filter(Boolean)).size;

  const upcoming = rows.find((r) => t(r) > now && r.status === 'scheduled');
  let nextClass: TeacherDashboard['nextClass'] = null;
  if (upcoming) {
    const st = one<any>(upcoming.students);
    const sub = one<any>(upcoming.subjects);
    nextClass = {
      label: `${sub?.name ?? 'Class'}${st?.name ? ` · ${st.name}` : ''}`,
      time: new Date(upcoming.start_at).toLocaleString('en-GB', {
        timeZone: 'Asia/Karachi', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
      }),
    };
  }

  const { data: hw } = await supabase.from('homework').select('id,status').is('deleted_at', null);
  const pendingReviews = ((hw as any[]) ?? []).filter((h) => h.status === 'submitted' || h.status === 'late').length;

  return { classesToday, classesThisWeek, studentsCount, pendingReviews, nextClass };
}
