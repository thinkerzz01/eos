// Syllabus data-access (server-only). Reads the MASTER outline for a subject
// (template -> topics -> subtopics -> objectives) for the admin Syllabus Manager.
// Admin/manager only feature, low traffic, edited during setup - so we read fresh
// via the org-scoped service-role client rather than caching (avoids stale trees
// right after an edit). Org is resolved per-request from the signed-in identity.
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerIdentity } from '@/lib/auth/serverRole';

export interface SyllabusSubtopic {
  id: string;
  code: string;
  name: string;
  objectives: string[];
  sort: number;
}
export interface SyllabusTopic {
  id: string;
  code: string;
  name: string;
  sort: number;
  subtopics: SyllabusSubtopic[];
}
export interface SubjectSyllabus {
  subjectId: string;
  template: { id: string; examYears: string; code: string; status: string } | null;
  topics: SyllabusTopic[];
}

// A subject row for the manager's subject picker, with a flag for whether it
// already has an outline and how many subtopics it holds.
export interface SyllabusSubjectRow {
  id: string;
  name: string;
  program: string;
  code: string | null;
  hasOutline: boolean;
  topicCount: number;
  subtopicCount: number;
  // How many of the subtopics carry at least one learning objective. Drives the
  // Complete / Partial / Empty status shown in the manager overview.
  objectiveCount: number;
  examYears: string | null;
}

// Fetch every row of a table for this org in 1000-row pages. Supabase caps a
// single select at 1000 rows, so aggregating counts across the whole org (now
// >1000 subtopics) MUST paginate or the totals silently under-report.
async function fetchAll<T>(
  run: (from: number, to: number) => Promise<{ data: T[] | null }>
): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data } = await run(from, from + page - 1);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

function toStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

/** Full master outline for one subject (active template). Empty template=null if none. */
export async function getSubjectSyllabus(subjectId: string): Promise<SubjectSyllabus> {
  const empty: SubjectSyllabus = { subjectId, template: null, topics: [] };
  try {
    const { orgId } = await getServerIdentity();
    if (!orgId || !subjectId) return empty;
    const admin = createAdminClient();

    const { data: tpl } = await admin
      .from('syllabus_templates')
      .select('id, academic_year, cambridge_code, status')
      .eq('org_id', orgId)
      .eq('subject_id', subjectId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!tpl?.id) return empty;

    const { data: topics } = await admin
      .from('syllabus_topics')
      .select('id, code, name, sort')
      .eq('template_id', tpl.id)
      .is('deleted_at', null)
      .order('sort', { ascending: true });

    const topicIds = (topics ?? []).map((t: any) => t.id);
    let subs: any[] = [];
    if (topicIds.length) {
      const { data } = await admin
        .from('syllabus_subtopics')
        .select('id, topic_id, code, name, objectives, sort')
        .in('topic_id', topicIds)
        .is('deleted_at', null)
        .order('sort', { ascending: true });
      subs = data ?? [];
    }
    const byTopic = new Map<string, SyllabusSubtopic[]>();
    for (const s of subs) {
      const arr = byTopic.get(s.topic_id) ?? [];
      arr.push({ id: s.id, code: s.code ?? '', name: s.name, objectives: toStringArray(s.objectives), sort: s.sort ?? 0 });
      byTopic.set(s.topic_id, arr);
    }
    return {
      subjectId,
      template: {
        id: tpl.id,
        examYears: (tpl as any).academic_year ?? '',
        code: (tpl as any).cambridge_code ?? '',
        status: (tpl as any).status ?? 'active',
      },
      topics: (topics ?? []).map((t: any) => ({
        id: t.id,
        code: t.code ?? '',
        name: t.name,
        sort: t.sort ?? 0,
        subtopics: byTopic.get(t.id) ?? [],
      })),
    };
  } catch {
    return empty;
  }
}

/** Every subject for the manager picker, flagged with outline status. */
export async function listSyllabusSubjects(): Promise<SyllabusSubjectRow[]> {
  try {
    const { orgId } = await getServerIdentity();
    if (!orgId) return [];
    const admin = createAdminClient();

    const { data: subjects } = await admin
      .from('subjects')
      .select('id, name, program, code')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('program', { ascending: true })
      .order('name', { ascending: true });
    const subjectRows = (subjects ?? []) as any[];
    if (subjectRows.length === 0) return [];

    // Active templates for this org, with their topic ids (to count subtopics).
    const { data: tpls } = await admin
      .from('syllabus_templates')
      .select('id, subject_id, academic_year')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .is('deleted_at', null);
    const tplBySubject = new Map<string, { id: string; examYears: string }>();
    for (const t of (tpls ?? []) as any[]) {
      if (!tplBySubject.has(t.subject_id)) tplBySubject.set(t.subject_id, { id: t.id, examYears: t.academic_year ?? '' });
    }

    const tplIds = Array.from(tplBySubject.values()).map((t) => t.id);
    const topicCountByTpl = new Map<string, number>();
    const topicIdsByTpl = new Map<string, string[]>();
    const tplByTopic = new Map<string, string>();
    if (tplIds.length) {
      // Paginated: topics fit in one page today, but do not depend on that.
      const topics = await fetchAll<any>(async (from, to) => {
        const { data } = await admin
          .from('syllabus_topics')
          .select('id, template_id')
          .in('template_id', tplIds)
          .is('deleted_at', null)
          .range(from, to);
        return { data };
      });
      for (const t of topics) {
        topicCountByTpl.set(t.template_id, (topicCountByTpl.get(t.template_id) ?? 0) + 1);
        const arr = topicIdsByTpl.get(t.template_id) ?? [];
        arr.push(t.id);
        topicIdsByTpl.set(t.template_id, arr);
        tplByTopic.set(t.id, t.template_id);
      }
    }
    // Subtopic + objective counts per template. MUST paginate: the org has
    // >1000 subtopics, so a single select would cap and under-count.
    const subCountByTpl = new Map<string, number>();
    const objCountByTpl = new Map<string, number>();
    const allTopicIds = Array.from(tplByTopic.keys());
    if (allTopicIds.length) {
      const subs = await fetchAll<any>(async (from, to) => {
        const { data } = await admin
          .from('syllabus_subtopics')
          .select('topic_id, objectives')
          .in('topic_id', allTopicIds)
          .is('deleted_at', null)
          .range(from, to);
        return { data };
      });
      for (const s of subs) {
        const tplId = tplByTopic.get(s.topic_id);
        if (!tplId) continue;
        subCountByTpl.set(tplId, (subCountByTpl.get(tplId) ?? 0) + 1);
        if (Array.isArray(s.objectives) && s.objectives.length > 0) {
          objCountByTpl.set(tplId, (objCountByTpl.get(tplId) ?? 0) + 1);
        }
      }
    }

    return subjectRows.map((s) => {
      const tpl = tplBySubject.get(s.id);
      const topicCount = tpl ? topicCountByTpl.get(tpl.id) ?? 0 : 0;
      const subtopicCount = tpl ? subCountByTpl.get(tpl.id) ?? 0 : 0;
      const objectiveCount = tpl ? objCountByTpl.get(tpl.id) ?? 0 : 0;
      return {
        id: s.id,
        name: s.name,
        program: s.program,
        code: s.code ?? null,
        hasOutline: !!tpl && topicCount > 0,
        topicCount,
        subtopicCount,
        objectiveCount,
        examYears: tpl?.examYears ?? null,
      };
    });
  } catch {
    return [];
  }
}
