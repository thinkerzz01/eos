// Monthly reports data-access (RLS-enforced, server-only). Builds one report per
// active student from real attendance + tests. Per the locked policy the report
// carries NO raw test scores — only the COUNT of tests conducted and the trend.
// (For richer phrasing, the Phase 6 backend `lib/reports/monthlyReport.ts` +
// the /api/cron/monthly-reports route assemble & enqueue these to parents.)
import { createClient } from '@/lib/supabase/server';
import type { MonthlyReportData } from '@/lib/mockIntelligenceData';

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

  const [attRes, testsRes] = await Promise.all([
    supabase.from('attendance').select('student_id,status').is('deleted_at', null),
    supabase.from('tests').select('student_id').is('deleted_at', null),
  ]);

  const att = new Map<string, { present: number; late: number; total: number }>();
  for (const a of attRes.data ?? []) {
    const e = att.get((a as any).student_id) ?? { present: 0, late: 0, total: 0 };
    e.total++;
    if ((a as any).status === 'present') e.present++;
    else if ((a as any).status === 'late') e.late++;
    att.set((a as any).student_id, e);
  }
  const testCount = new Map<string, number>();
  for (const t of testsRes.data ?? []) {
    const id = (t as any).student_id;
    testCount.set(id, (testCount.get(id) ?? 0) + 1);
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
      testsConductedCount: testCount.get(s.id) ?? 0,
      gradeTrend: 'same', // needs grade history to compute
      assessedGrade: 'B', // placeholder until student_subjects.assessed_grade is wired
      attendancePct,
    } as MonthlyReportData;
  });
}
