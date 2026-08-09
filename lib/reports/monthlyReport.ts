// Monthly parent report — assembly + optional LLM phrasing.
// LOCKED invariants (Master Plan §6.2/§8/§11, AGENTS.md §3.6):
//   - NO raw test scores. Only the COUNT of tests conducted + the assessed-grade
//     trend (up/same/down) + attendance/homework completion + topics covered.
//   - Our code assembles the final numbers. The LLM only PHRASES them and must
//     never invent or change a number.
//   - The LLM receives FIRST NAME and FACTS ONLY (never surname, never phone).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReportFacts {
  firstName: string;
  attendancePct: number;
  homeworkPct: number;
  testsConducted: number;
  topicsCovered: number;
  gradeTrend: 'up' | 'same' | 'down';
}

function monthStartISODate(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export async function assembleReportFacts(
  admin: SupabaseClient,
  student: { id: string; name: string }
): Promise<ReportFacts> {
  const firstName = (student.name ?? 'Student').split(' ')[0] || 'Student';
  const since = monthStartISODate();

  // Tests conducted this month (COUNT only — never the scores).
  const { count: testsConducted } = await admin
    .from('tests')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', student.id)
    .gte('date', since)
    .is('deleted_at', null);

  // Homework completion: on-time (submitted/graded) / total assigned; 100 if none.
  const { data: hw } = await admin
    .from('homework')
    .select('status')
    .eq('student_id', student.id)
    .is('deleted_at', null);
  const hwRows = hw ?? [];
  const homeworkPct = hwRows.length
    ? Math.round(
        (hwRows.filter((h: any) => h.status === 'submitted' || h.status === 'graded').length /
          hwRows.length) *
          100
      )
    : 100;

  // Attendance: (present + 0.5*late) / total; 0 if no records yet.
  const { data: att } = await admin
    .from('attendance')
    .select('status')
    .eq('student_id', student.id)
    .is('deleted_at', null);
  const attRows = att ?? [];
  const attendancePct = attRows.length
    ? Math.round(
        ((attRows.filter((a: any) => a.status === 'present').length +
          0.5 * attRows.filter((a: any) => a.status === 'late').length) /
          attRows.length) *
          100
      )
    : 0;

  // Topics covered so far.
  const { count: topicsCovered } = await admin
    .from('syllabus_progress')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', student.id)
    .eq('state', 'covered')
    .is('deleted_at', null);

  // Grade trend (Master Plan §6.2): this month's average score % vs last month's.
  const d0 = new Date();
  const priorStart = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const { data: trendRows } = await admin
    .from('tests')
    .select('date,score,max_score')
    .eq('student_id', student.id)
    .gte('date', priorStart)
    .is('deleted_at', null);
  const avgPct = (rows: any[]): number | null => {
    const tot = rows.reduce((a, r) => a + Number(r.max_score || 0), 0);
    const sc = rows.reduce((a, r) => a + Number(r.score || 0), 0);
    return tot > 0 ? (sc / tot) * 100 : null;
  };
  const aThis = avgPct((trendRows ?? []).filter((r: any) => r.date >= since));
  const aPrior = avgPct((trendRows ?? []).filter((r: any) => r.date < since));
  let gradeTrend: ReportFacts['gradeTrend'] = 'same';
  if (aThis != null && aPrior != null) {
    if (aThis > aPrior + 1) gradeTrend = 'up';
    else if (aThis < aPrior - 1) gradeTrend = 'down';
  }

  return {
    firstName,
    attendancePct,
    homeworkPct,
    testsConducted: testsConducted ?? 0,
    topicsCovered: topicsCovered ?? 0,
    gradeTrend,
  };
}

// Remove "AI dashes" from generated text: em/en dashes and spaced hyphens become
// commas or plain spacing, so parent-facing reports never contain a "-" style dash.
function stripDashes(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ', ') // em/en dash -> comma
    .replace(/\s+-\s+/g, ', ') // spaced hyphen -> comma
    .replace(/,\s*,/g, ',') // tidy any double commas
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Deterministic report text. These numbers are fixed by our code. */
export function assembleReportText(f: ReportFacts): string {
  return (
    `Progress summary for ${f.firstName} this month:\n` +
    `Attendance: ${f.attendancePct} percent.\n` +
    `Homework completion: ${f.homeworkPct} percent.\n` +
    `Tests conducted: ${f.testsConducted}.\n` +
    `Topics covered: ${f.topicsCovered}.\n` +
    `Assessed grade trend: ${f.gradeTrend}.\n` +
    `Thank you for your trust.\nThinkerzz`
  );
}

/**
 * Optional warm phrasing via OpenRouter. Receives first name + facts only.
 * Falls back to the deterministic text when no key is set or on any error,
 * so a report is never blocked on the LLM.
 */
export async function phraseReport(f: ReportFacts): Promise<string> {
  const assembled = assembleReportText(f);
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return assembled;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.1-8b-instruct:free',
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'You rephrase a short school progress note for a parent in a warm, professional tone. ' +
              'Do NOT change, add, or remove any number, percentage, count, or fact. ' +
              'No slang, no emojis, no dashes. Sign off as Thinkerzz.',
          },
          { role: 'user', content: assembled },
        ],
      }),
    });
    if (!res.ok) return assembled;
    const json: any = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? stripDashes(text.trim()) : assembled;
  } catch {
    return assembled;
  }
}
