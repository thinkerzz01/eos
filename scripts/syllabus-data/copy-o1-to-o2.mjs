// Mirror every O Level (O1) outline into the matching O Level (O2) subject.
// Cambridge O Level is ONE syllabus taught across the academy's two years, so O2
// gets the same outline as O1. Idempotent: skips any O2 subject that already has
// topics. Copies template header + topics + subtopics + objectives faithfully.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = {};
for (const f of ['.env.local', '.env.production.local']) {
  try { for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  } } catch {}
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SRC = 'O Level (O1)', DST = 'O Level (O2)';

const { data: srcSubs } = await sb.from('subjects').select('id, org_id, name').eq('program', SRC).is('deleted_at', null);
const { data: dstSubs } = await sb.from('subjects').select('id, name').eq('program', DST).is('deleted_at', null);
const dstByName = new Map((dstSubs ?? []).map((s) => [s.name, s.id]));

let copied = 0, skipped = 0;
for (const src of (srcSubs ?? [])) {
  const dstId = dstByName.get(src.name);
  if (!dstId) continue;

  // Source active template + its topics/subtopics.
  const { data: st } = await sb.from('syllabus_templates').select('id, academic_year, cambridge_code')
    .eq('org_id', src.org_id).eq('subject_id', src.id).eq('status', 'active').is('deleted_at', null).limit(1).maybeSingle();
  if (!st?.id) continue;
  const { data: stops } = await sb.from('syllabus_topics').select('id, code, name, sort').eq('template_id', st.id).is('deleted_at', null).order('sort');
  if (!stops?.length) continue;

  // Destination: skip if it already has an outline.
  let { data: dt } = await sb.from('syllabus_templates').select('id')
    .eq('org_id', src.org_id).eq('subject_id', dstId).eq('status', 'active').is('deleted_at', null).limit(1).maybeSingle();
  if (dt?.id) {
    const { count } = await sb.from('syllabus_topics').select('id', { count: 'exact', head: true }).eq('template_id', dt.id).is('deleted_at', null);
    if ((count ?? 0) > 0) { skipped++; continue; }
  } else {
    const { data } = await sb.from('syllabus_templates').insert({ org_id: src.org_id, subject_id: dstId, academic_year: st.academic_year, cambridge_code: st.cambridge_code, status: 'active' }).select('id').single();
    dt = data;
  }

  const srcTopicIds = stops.map((t) => t.id);
  const { data: ssubs } = await sb.from('syllabus_subtopics').select('topic_id, code, name, objectives, sort').in('topic_id', srcTopicIds).is('deleted_at', null).order('sort');
  const byTopic = new Map();
  for (const s of (ssubs ?? [])) { const a = byTopic.get(s.topic_id) ?? []; a.push(s); byTopic.set(s.topic_id, a); }

  let nsub = 0;
  for (const tp of stops) {
    const { data: newTopic } = await sb.from('syllabus_topics').insert({ org_id: src.org_id, template_id: dt.id, code: tp.code, name: tp.name, sort: tp.sort }).select('id').single();
    const rows = (byTopic.get(tp.id) ?? []).map((s) => ({ org_id: src.org_id, topic_id: newTopic.id, code: s.code, name: s.name, objectives: s.objectives ?? [], sort: s.sort }));
    if (rows.length) { await sb.from('syllabus_subtopics').insert(rows); nsub += rows.length; }
  }
  copied++;
  console.log(`Copied ${src.name}: ${stops.length} topics, ${nsub} subtopics -> O2`);
}
console.log(`\nDone. Copied ${copied} subjects, skipped ${skipped} (already had outlines).`);
