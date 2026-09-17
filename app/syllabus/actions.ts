'use server';

// Syllabus Manager write actions (admin/manager only). Edits the MASTER outline
// per subject: template header -> topics (with code) -> subtopics (with learning
// objectives). Reorder normalises sort to 0..n-1 on the affected sibling list.
// Snapshots that students already hold are NOT touched by these edits (that is the
// whole point of the per-enrollment snapshot); a re-sync action comes in Phase 2.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { friendlyDbError } from '@/lib/friendlyError';
import { getSubjectSyllabus, type SubjectSyllabus } from '@/lib/data/syllabus';
import { ensureEnrollmentSnapshot } from '@/lib/syllabus/snapshot';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, orgId: null as string | null, role: null as string | null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  return { supabase, orgId: (profile?.org_id as string) ?? null, role: (profile?.role as string) ?? null };
}

async function guard() {
  const c = await ctx();
  if (!c.orgId) return { ...c, error: 'You are not signed in.' };
  if (c.role !== 'admin' && c.role !== 'manager') return { ...c, error: 'Only an admin or manager can edit the syllabus.' };
  return { ...c, error: null as string | null };
}

/**
 * Backfill snapshots for every active enrollment that lacks one (and whose subject
 * has a master outline). Safe to run repeatedly - it skips enrollments already
 * snapshotted and subjects without an outline. Admin/manager only.
 */
export async function generateSnapshots(): Promise<ActionResult & { created?: number; scanned?: number }> {
  const { supabase, orgId, error } = await guard();
  if (error) return { ok: false, error };
  const { data: enr } = await supabase
    .from('student_subjects')
    .select('student_id, subject_id, students!inner(deleted_at)')
    .is('deleted_at', null)
    .is('students.deleted_at', null);
  const rows = (enr ?? []) as any[];
  let created = 0;
  for (const r of rows) {
    const made = await ensureEnrollmentSnapshot(supabase, orgId!, r.student_id, r.subject_id);
    if (made) created++;
  }
  revalidatePath('/syllabus');
  return { ok: true, created, scanned: rows.length };
}

/** Load the full master outline for a subject (guarded; used by the manager UI). */
export async function getOutline(subjectId: string): Promise<{ ok: boolean; error?: string; outline?: SubjectSyllabus }> {
  const { error } = await guard();
  if (error) return { ok: false, error };
  if (!subjectId) return { ok: false, error: 'Missing subject.' };
  const outline = await getSubjectSyllabus(subjectId);
  return { ok: true, outline };
}

/** Create the active master template for a subject (or return the existing one). */
export async function ensureTemplate(input: { subjectId: string; examYears?: string; code?: string }): Promise<ActionResult> {
  if (!input.subjectId) return { ok: false, error: 'Missing subject.' };
  const { supabase, orgId, error } = await guard();
  if (error) return { ok: false, error };

  const { data: existing } = await supabase
    .from('syllabus_templates')
    .select('id')
    .eq('org_id', orgId)
    .eq('subject_id', input.subjectId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle();
  if (existing?.id) return { ok: true, id: existing.id };

  const { data, error: e } = await supabase
    .from('syllabus_templates')
    .insert({
      org_id: orgId,
      subject_id: input.subjectId,
      academic_year: input.examYears?.trim() || 'Current',
      cambridge_code: input.code?.trim() || '',
      status: 'active',
    })
    .select('id')
    .single();
  if (e) return { ok: false, error: friendlyDbError(e) };
  revalidatePath('/syllabus');
  return { ok: true, id: data.id };
}

/** Update the template header (exam-year label + code). */
export async function updateTemplate(input: { id: string; examYears?: string; code?: string }): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: 'Missing template.' };
  const { supabase, error } = await guard();
  if (error) return { ok: false, error };
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.examYears !== undefined) patch.academic_year = input.examYears.trim() || 'Current';
  if (input.code !== undefined) patch.cambridge_code = input.code.trim();
  const { error: e } = await supabase.from('syllabus_templates').update(patch).eq('id', input.id);
  if (e) return { ok: false, error: friendlyDbError(e) };
  revalidatePath('/syllabus');
  return { ok: true };
}

// ---- Topics -----------------------------------------------------------------

export async function addTopic(input: { templateId: string; code?: string; name: string }): Promise<ActionResult> {
  const name = input.name?.trim();
  if (!input.templateId || !name) return { ok: false, error: 'Topic name is required.' };
  const { supabase, orgId, error } = await guard();
  if (error) return { ok: false, error };
  const { data: last } = await supabase
    .from('syllabus_topics')
    .select('sort')
    .eq('template_id', input.templateId)
    .is('deleted_at', null)
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = ((last?.sort as number) ?? -1) + 1;
  const { data, error: e } = await supabase
    .from('syllabus_topics')
    .insert({ org_id: orgId, template_id: input.templateId, code: input.code?.trim() || null, name, sort })
    .select('id')
    .single();
  if (e) return { ok: false, error: friendlyDbError(e) };
  revalidatePath('/syllabus');
  return { ok: true, id: data.id };
}

export async function updateTopic(input: { id: string; code?: string; name?: string }): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: 'Missing topic.' };
  const { supabase, error } = await guard();
  if (error) return { ok: false, error };
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.code !== undefined) patch.code = input.code.trim() || null;
  const { error: e } = await supabase.from('syllabus_topics').update(patch).eq('id', input.id);
  if (e) return { ok: false, error: friendlyDbError(e) };
  revalidatePath('/syllabus');
  return { ok: true };
}

export async function deleteTopic(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Missing topic.' };
  const { supabase, error } = await guard();
  if (error) return { ok: false, error };
  const { error: e } = await supabase
    .from('syllabus_topics')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (e) return { ok: false, error: friendlyDbError(e) };
  revalidatePath('/syllabus');
  return { ok: true };
}

export async function moveTopic(input: { templateId: string; id: string; dir: 'up' | 'down' }): Promise<ActionResult> {
  const { supabase, error } = await guard();
  if (error) return { ok: false, error };
  const { data: rows } = await supabase
    .from('syllabus_topics')
    .select('id, sort, created_at')
    .eq('template_id', input.templateId)
    .is('deleted_at', null)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  const ids = ((rows ?? []) as any[]).map((r) => r.id);
  const i = ids.indexOf(input.id);
  if (i === -1) return { ok: false, error: 'Topic not found.' };
  const j = input.dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return { ok: true }; // already at the edge
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (let k = 0; k < ids.length; k++) {
    await supabase.from('syllabus_topics').update({ sort: k }).eq('id', ids[k]);
  }
  revalidatePath('/syllabus');
  return { ok: true };
}

// ---- Subtopics --------------------------------------------------------------

export async function addSubtopic(input: { topicId: string; code?: string; name: string; objectives?: string[] }): Promise<ActionResult> {
  const name = input.name?.trim();
  if (!input.topicId || !name) return { ok: false, error: 'Subtopic name is required.' };
  const { supabase, orgId, error } = await guard();
  if (error) return { ok: false, error };
  const { data: last } = await supabase
    .from('syllabus_subtopics')
    .select('sort')
    .eq('topic_id', input.topicId)
    .is('deleted_at', null)
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = ((last?.sort as number) ?? -1) + 1;
  const objectives = (input.objectives ?? []).map((s) => String(s).trim()).filter(Boolean);
  const { data, error: e } = await supabase
    .from('syllabus_subtopics')
    .insert({ org_id: orgId, topic_id: input.topicId, code: input.code?.trim() || null, name, objectives, sort })
    .select('id')
    .single();
  if (e) return { ok: false, error: friendlyDbError(e) };
  revalidatePath('/syllabus');
  return { ok: true, id: data.id };
}

export async function updateSubtopic(input: { id: string; code?: string; name?: string; objectives?: string[] }): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: 'Missing subtopic.' };
  const { supabase, error } = await guard();
  if (error) return { ok: false, error };
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.code !== undefined) patch.code = input.code.trim() || null;
  if (input.objectives !== undefined) patch.objectives = input.objectives.map((s) => String(s).trim()).filter(Boolean);
  const { error: e } = await supabase.from('syllabus_subtopics').update(patch).eq('id', input.id);
  if (e) return { ok: false, error: friendlyDbError(e) };
  revalidatePath('/syllabus');
  return { ok: true };
}

export async function deleteSubtopic(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Missing subtopic.' };
  const { supabase, error } = await guard();
  if (error) return { ok: false, error };
  const { error: e } = await supabase
    .from('syllabus_subtopics')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (e) return { ok: false, error: friendlyDbError(e) };
  revalidatePath('/syllabus');
  return { ok: true };
}

export async function moveSubtopic(input: { topicId: string; id: string; dir: 'up' | 'down' }): Promise<ActionResult> {
  const { supabase, error } = await guard();
  if (error) return { ok: false, error };
  const { data: rows } = await supabase
    .from('syllabus_subtopics')
    .select('id, sort, created_at')
    .eq('topic_id', input.topicId)
    .is('deleted_at', null)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  const ids = ((rows ?? []) as any[]).map((r) => r.id);
  const i = ids.indexOf(input.id);
  if (i === -1) return { ok: false, error: 'Subtopic not found.' };
  const j = input.dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (let k = 0; k < ids.length; k++) {
    await supabase.from('syllabus_subtopics').update({ sort: k }).eq('id', ids[k]);
  }
  revalidatePath('/syllabus');
  return { ok: true };
}
