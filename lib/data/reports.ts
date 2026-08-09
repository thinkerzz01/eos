// Monthly reports data-access (RLS-enforced, server-only). Builds one report per
// active student from real attendance + tests. Per the locked policy the report
// carries NO raw test scores - only the COUNT of tests conducted and the trend.
// (For richer phrasing, the Phase 6 backend `lib/reports/monthlyReport.ts` +
// the /api/cron/monthly-reports route assemble & enqueue these to parents.)
import { createClient } from '@/lib/supabase/server';
import type { MonthlyReportData } from '@/lib/mockIntelligenceData';

function gradeFromPct(pct: number): MonthlyReportData['assessedGrade'] {
  if (pct >= 90) return 'A*';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  if (pct >= 40) return 'E';
  return 'U';
}

export async function getMonthlyReports(): Promise<MonthlyReportData[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: students } = await supabase
    .from('students')
    .select('id,name,program')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (!students || students.length === 0) return [];

  // Master Plan §11: the monthly report counts THIS month's activity, not lifetime.
  const md = new Date();
  const monthStart = new Date(Date.UTC(md.getUTCFullYear(), md.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const [attRes, testsRes] = await Promise.all([
    supabase.from('attendance').select('student_id,status').is('deleted_at', null),
    supabase.from('tests').select('student_id,score,max_score').gte('date', monthStart).is('deleted_at', null),
  ]);

  const att = new Map<string, { present: number; late: number; total: number }>();
  for (const a of attRes.data ?? []) {
    const e = att.get((a as any).student_id) ?? { present: 0, late: 0, total: 0 };
    e.total++;
    if ((a as any).status === 'present') e.present++;
    else if ((a as any).status === 'late') e.late++;
    att.set((a as any).student_id, e);
  }
  const testStats = new Map<string, { count: number; score: number; max: number }>();
  for (const t of testsRes.data ?? []) {
    const id = (t as any).student_id;
    const e = testStats.get(id) ?? { count: 0, score: 0, max: 0 };
    e.count++;
    e.score += Number((t as any).score || 0);
    e.max += Number((t as any).max_score || 0);
    testStats.set(id, e);
  }

  const month = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Asia/Karachi', month: 'long', year: 'numeric',
  });

  return (students as any[]).map((s) => {
    const a = att.get(s.id);
    const attendancePct = a && a.total > 0 ? Math.round(((a.present + 0.5 * a.late) / a.total) * 100) : 0;
    return {
      studentId: s.id,
      firstName: (s.name ?? 'Student').split(' ')[0] || 'Student', // first name only (privacy)
      program: s.program ?? '',
      month,
      topicsCovered: [], // from syllabus_progress topic names (later slice)
      testsConductedCount: testStats.get(s.id)?.count ?? 0,
      gradeTrend: 'same', // needs grade history to compute a real trend
      // Derived from the student's real test scores; '-' when no tests yet.
      assessedGrade: (() => {
        const ts = testStats.get(s.id);
        return ts && ts.count > 0 && ts.max > 0
          ? gradeFromPct((ts.score / ts.max) * 100)
          : ('-' as MonthlyReportData['assessedGrade']);
      })(),
      attendancePct,
    } as MonthlyReportData;
  });
}

export interface FunnelStats {
  demosBooked: number;
  studentsEnrolled: number;
  funnelPct: number; // enrolled / demos booked (Master Plan §11)
  lostReasons: { reason: string; count: number }[];
}

export async function getFunnelStats(): Promise<FunnelStats> {
  const empty: FunnelStats = { demosBooked: 0, studentsEnrolled: 0, funnelPct: 0, lostReasons: [] };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const [demosRes, studentsRes, lostRes] = await Promise.all([
    supabase.from('demos').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
    supabase.from('leads').select('lost_reason').eq('status', 'lost').is('deleted_at', null),
  ]);

  const demosBooked = demosRes.count ?? 0;
  const studentsEnrolled = studentsRes.count ?? 0;
  const lostMap = new Map<string, number>();
  for (const l of lostRes.data ?? []) {
    const r = ((l as any).lost_reason as string) || 'Unspecified';
    lostMap.set(r, (lostMap.get(r) ?? 0) + 1);
  }
  const lostReasons = Array.from(lostMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    demosBooked,
    studentsEnrolled,
    funnelPct: demosBooked > 0 ? Math.round((studentsEnrolled / demosBooked) * 100) : 0,
    lostReasons,
  };
}
