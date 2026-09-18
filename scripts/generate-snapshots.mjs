// Backfill per-student syllabus snapshots for every active enrollment
// (student_subjects) whose subject has an active outline but no snapshot yet.
// Mirrors the app's "Generate student snapshots" action. Idempotent + safe to
// re-run (skips enrollments that already have a snapshot). Service-role.
//
// Usage:
//   node scripts/generate-snapshots.mjs          # dry run (lists what it would create)
//   node scripts/generate-snapshots.mjs --apply  # create the snapshots
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = {};
for (const f of ['.env.local', '.env.production.local']) {
  try { for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  } } catch {}
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes('--apply');

const { data: enr } = await sb
  .from('student_subjects')
  .select('org_id, student_id, subject_id, students(name), subjects(name)')
  .is('deleted_at', null);

let created = 0, skipped = 0, noOutline = 0;
for (const e of enr ?? []) {
  const label = `${e.students?.name ?? '?'} - ${e.subjects?.name ?? '?'}`;

  const { data: existing } = await sb.from('student_syllabus')
    .select('id').eq('student_id', e.student_id).eq('subject_id', e.subject_id).is('deleted_at', null).limit(1).maybeSingle();
  if (existing?.id) { skipped++; continue; }

  const { data: tpl } = await sb.from('syllabus_templates')
    .select('id, academic_year, cambridge_code').eq('org_id', e.org_id).eq('subject_id', e.subject_id)
    .eq('status', 'active').is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!tpl?.id) { noOutline++; console.log(`  no outline: ${label}`); continue; }

  const { data: topics } = await sb.from('syllabus_topics')
    .select('id, code, name, sort').eq('template_id', tpl.id).is('deleted_at', null).order('sort', { ascending: true });
  if (!(topics ?? []).length) { noOutline++; console.log(`  no topics: ${label}`); continue; }
  const topicIds = topics.map((t) => t.id);
  const { data: subs } = await sb.from('syllabus_subtopics')
    .select('id, topic_id, code, name, objectives, sort').in('topic_id', topicIds).is('deleted_at', null).order('sort', { ascending: true });
  if (!(subs ?? []).length) { noOutline++; console.log(`  no subtopics: ${label}`); continue; }

  if (!APPLY) { console.log(`  would create: ${label} (${subs.length} items)`); created++; continue; }

  const { data: header, error: hErr } = await sb.from('student_syllabus').insert({
    org_id: e.org_id, student_id: e.student_id, subject_id: e.subject_id, template_id: tpl.id,
    source_note: `${tpl.cambridge_code || ''} ${tpl.academic_year || ''}`.trim() || null,
  }).select('id').single();
  if (hErr || !header?.id) { console.log(`  ERR header ${label}: ${hErr?.message}`); continue; }

  const byTopic = new Map();
  for (const s of subs) { const a = byTopic.get(s.topic_id) ?? []; a.push(s); byTopic.set(s.topic_id, a); }
  const items = []; let sort = 0;
  for (const t of topics) for (const s of (byTopic.get(t.id) ?? [])) items.push({
    org_id: e.org_id, student_syllabus_id: header.id, topic_code: t.code ?? null, topic_name: t.name ?? null,
    subtopic_code: s.code ?? null, subtopic_name: s.name, objectives: Array.isArray(s.objectives) ? s.objectives : [], sort: sort++, status: 'pending',
  });
  const { error: iErr } = await sb.from('student_syllabus_item').insert(items);
  if (iErr) { console.log(`  ERR items ${label}: ${iErr.message}`); continue; }
  console.log(`  created: ${label} (${items.length} items)`);
  created++;
}
console.log(`\n${APPLY ? 'Created' : 'Would create'}: ${created} | already had: ${skipped} | no outline: ${noOutline}`);
if (!APPLY) console.log('Dry run. Re-run with --apply to create snapshots.');
