'use server';

// Phase 2 - teacher coverage marking. A teacher (or admin/manager) marks which
// syllabus subtopics were covered, tied to the class session they just taught
// (decision D2). Coverage lives on the per-student SNAPSHOT items, so it is never
// disturbed by later edits to the master outline. RLS restricts teachers to their
// own students; admin/manager have full access.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function actor() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, teacherId: null as string | null };
  const { data: p } = await supabase
    .from('profiles')
    .select('teacher_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  return { supabase, user, teacherId: (p?.teacher_id as string) ?? null };
}

// Today's date in Pakistan (UTC+5), as YYYY-MM-DD, for covered_on (a DATE column).
function pktToday(): string {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export interface CoverageItem {
  id: string;
  topicCode: string | null;
  topicName: string | null;
  subtopicCode: string | null;
  subtopicName: string;
  objectives: string[];
  status: string;            // 'pending' | 'in_progress' | 'covered'
  coveredOn: string | null;
  sessionId: string | null;
}

export interface SessionSyllabus {
  ok: boolean;
  error?: string;
  hasSnapshot: boolean;
  items: CoverageItem[];
  total: number;
  covered: number;
}

/** Load the student's frozen syllabus for a subject, with current coverage. */
export async function getSessionSyllabus(input: { studentId: string; subjectId: string }): Promise<SessionSyllabus> {
  const empty = { hasSnapshot: false, items: [], total: 0, covered: 0 };
  const { supabase, user } = await actor();
  if (!user) return { ok: false, error: 'You are not signed in.', ...empty };
  if (!input.studentId || !input.subjectId) return { ok: false, error: 'Missing student or subject.', ...empty };

  const { data: hdr } = await supabase
    .from('student_syllabus')
    .select('id')
    .eq('student_id', input.studentId)
    .eq('subject_id', input.subjectId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (!hdr?.id) return { ok: true, ...empty };

  const { data: rows } = await supabase
    .from('student_syllabus_item')
    .select('id, topic_code, topic_name, subtopic_code, subtopic_name, objectives, status, covered_on, session_id')
    .eq('student_syllabus_id', hdr.id)
    .order('sort', { ascending: true });
  const items: CoverageItem[] = ((rows ?? []) as any[]).map((r) => ({
    id: r.id,
    topicCode: r.topic_code,
    topicName: r.topic_name,
    subtopicCode: r.subtopic_code,
    subtopicName: r.subtopic_name,
    objectives: Array.isArray(r.objectives) ? r.objectives.map(String) : [],
    status: r.status,
    coveredOn: r.covered_on,
    sessionId: r.session_id,
  }));
  const covered = items.filter((i) => i.status === 'covered').length;
  return { ok: true, hasSnapshot: true, items, total: items.length, covered };
}

/**
 * Mark ONE snapshot item covered / not covered. Covering stamps the date, the
 * marking teacher, and the session it was taught in; un-covering clears them.
 */
export async function setSubtopicCoverage(input: {
  itemId: string;
  covered: boolean;
  sessionId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, teacherId } = await actor();
  if (!user) return { ok: false, error: 'You are not signed in.' };
  if (!input.itemId) return { ok: false, error: 'Missing item.' };

  const patch = input.covered
    ? {
        status: 'covered',
        covered_on: pktToday(),
        covered_by: teacherId,
        session_id: input.sessionId ?? null,
        updated_at: new Date().toISOString(),
      }
    : {
        status: 'pending',
        covered_on: null,
        covered_by: null,
        session_id: null,
        updated_at: new Date().toISOString(),
      };

  const { error } = await supabase.from('student_syllabus_item').update(patch).eq('id', input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/schedule');
  return { ok: true };
}
