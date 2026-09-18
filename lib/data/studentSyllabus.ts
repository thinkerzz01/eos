import 'server-only';

// Phase 3 - the student's own read-only "My Syllabus" progress. Reads the frozen
// snapshot + coverage for the SIGNED-IN student (RLS student_read_own on
// student_syllabus / student_syllabus_item). Subject display names are resolved
// with the cookie-free service-role client, but ONLY for the subject_ids that
// belong to this student's own snapshots (no cross-student leak) - the `subjects`
// table has no student read policy, so this fills just the labels.
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerIdentity } from '@/lib/auth/serverRole';

export interface MyItem {
  code: string | null;
  name: string;
  covered: boolean;
  coveredOn: string | null;
  objectives: string[];
}
export interface MyTopic {
  code: string | null;
  name: string | null;
  covered: number;
  total: number;
  items: MyItem[];
}
export interface MySubject {
  subjectId: string;
  subjectName: string;
  program: string;
  note: string | null;
  total: number;
  covered: number;
  pct: number;
  lastCoveredOn: string | null;
  topics: MyTopic[];
}

/** The signed-in student's own progress. */
export async function getMySyllabus(): Promise<MySubject[]> {
  const { studentId } = await getServerIdentity();
  if (!studentId) return [];
  return getSyllabusForStudent(studentId);
}

/**
 * Progress for a specific student. Reads through the session client so RLS
 * enforces access (teacher: own students only; admin/manager: all; a student
 * could only ever pass their own id). Subject labels are filled with the
 * service-role client, restricted to the subject_ids that came back.
 */
export async function getSyllabusForStudent(studentId: string): Promise<MySubject[]> {
  try {
    if (!studentId) return [];
    const supabase = createClient();

    const { data: headers } = await supabase
      .from('student_syllabus')
      .select('id, subject_id, source_note')
      .eq('student_id', studentId)
      .is('deleted_at', null);
    const hs = (headers ?? []) as any[];
    if (!hs.length) return [];

    const headerIds = hs.map((h) => h.id);
    const { data: items } = await supabase
      .from('student_syllabus_item')
      .select('student_syllabus_id, topic_code, topic_name, subtopic_code, subtopic_name, objectives, status, covered_on')
      .in('student_syllabus_id', headerIds)
      .order('sort', { ascending: true });

    // Subject labels (service-role, restricted to this student's own subjects).
    const admin = createAdminClient();
    const { data: subs } = await admin
      .from('subjects')
      .select('id, name, program')
      .in('id', hs.map((h) => h.subject_id));
    const meta = new Map<string, { name: string; program: string }>(
      ((subs ?? []) as any[]).map((s) => [s.id, { name: s.name, program: s.program }])
    );

    const byHeader = new Map<string, any[]>();
    for (const it of (items ?? []) as any[]) {
      const arr = byHeader.get(it.student_syllabus_id) ?? [];
      arr.push(it);
      byHeader.set(it.student_syllabus_id, arr);
    }

    const out: MySubject[] = [];
    for (const h of hs) {
      const its = byHeader.get(h.id) ?? [];
      if (!its.length) continue;
      const topics = new Map<string, MyTopic>();
      let covered = 0;
      let lastCovered: string | null = null;
      for (const it of its) {
        const key = `${it.topic_code ?? ''}|${it.topic_name ?? ''}`;
        if (!topics.has(key)) topics.set(key, { code: it.topic_code, name: it.topic_name, covered: 0, total: 0, items: [] });
        const t = topics.get(key)!;
        const isCov = it.status === 'covered';
        t.items.push({
          code: it.subtopic_code,
          name: it.subtopic_name,
          covered: isCov,
          coveredOn: it.covered_on,
          objectives: Array.isArray(it.objectives) ? it.objectives.map(String) : [],
        });
        t.total++;
        if (isCov) {
          t.covered++;
          covered++;
          if (it.covered_on && (!lastCovered || it.covered_on > lastCovered)) lastCovered = it.covered_on;
        }
      }
      const m = meta.get(h.subject_id);
      const total = its.length;
      out.push({
        subjectId: h.subject_id,
        subjectName: m?.name ?? 'Your subject',
        program: m?.program ?? '',
        note: h.source_note ?? null,
        total,
        covered,
        pct: total ? Math.round((covered / total) * 100) : 0,
        lastCoveredOn: lastCovered,
        topics: Array.from(topics.values()),
      });
    }
    out.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    return out;
  } catch {
    return [];
  }
}
