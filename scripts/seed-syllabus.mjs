// One-off syllabus seed (service-role, backend). Loads a parsed outline JSON and
// writes it as the ACTIVE master template for a subject row (topics -> subtopics ->
// objectives). Idempotent: if the subject already has an active template WITH topics,
// it does nothing (pass --force to wipe & reseed that template's topics).
//
// Usage:
//   node scripts/seed-syllabus.mjs --json <path> --program "AS" --name "Physics" \
//        --code 9702 --years "2025-2027" [--only 1-11] [--force]
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, [])
);

const env = {};
for (const f of ['.env.local', '.env.production.local']) {
  try { for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  } } catch {}
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function inRange(code, only) {
  if (!only) return true;
  const [a, b] = String(only).split('-').map(Number);
  const n = Number(code);
  return n >= a && n <= (b ?? a);
}

const topics = JSON.parse(fs.readFileSync(args.json, 'utf8')).filter((t) => inRange(t.code, args.only));
if (!topics.length) { console.error('No topics after --only filter.'); process.exit(1); }

// Resolve org + subject row.
const { data: subj, error: se } = await sb
  .from('subjects').select('id, org_id, name, program, code')
  .eq('program', args.program).eq('name', args.name).is('deleted_at', null).limit(1).maybeSingle();
if (se || !subj) { console.error('Subject not found:', args.program, args.name, se?.message); process.exit(1); }
console.log(`Subject: ${subj.program} ${subj.name} (${subj.code ?? '-'})  org=${subj.org_id}`);

// Find or create the active template.
let { data: tpl } = await sb.from('syllabus_templates')
  .select('id').eq('org_id', subj.org_id).eq('subject_id', subj.id).eq('status', 'active').is('deleted_at', null)
  .limit(1).maybeSingle();

if (tpl?.id) {
  const { count } = await sb.from('syllabus_topics').select('id', { count: 'exact', head: true })
    .eq('template_id', tpl.id).is('deleted_at', null);
  if ((count ?? 0) > 0 && !args.force) {
    console.log(`Template already has ${count} topics. Use --force to wipe & reseed. Aborting.`);
    process.exit(0);
  }
  if (args.force) {
    // soft-delete existing topics + their subtopics
    const { data: ts } = await sb.from('syllabus_topics').select('id').eq('template_id', tpl.id).is('deleted_at', null);
    const ids = (ts ?? []).map((t) => t.id);
    if (ids.length) {
      await sb.from('syllabus_subtopics').update({ deleted_at: new Date().toISOString() }).in('topic_id', ids);
      await sb.from('syllabus_topics').update({ deleted_at: new Date().toISOString() }).in('id', ids);
    }
    await sb.from('syllabus_templates').update({ academic_year: args.years || 'Current', cambridge_code: args.code || subj.code || '' }).eq('id', tpl.id);
  }
} else {
  const { data, error } = await sb.from('syllabus_templates').insert({
    org_id: subj.org_id, subject_id: subj.id,
    academic_year: args.years || 'Current', cambridge_code: args.code || subj.code || '', status: 'active',
  }).select('id').single();
  if (error) { console.error('Template insert failed:', error.message); process.exit(1); }
  tpl = data;
}

let tSort = 0, tCount = 0, sCount = 0, oCount = 0;
for (const t of topics) {
  const { data: topic, error: te } = await sb.from('syllabus_topics').insert({
    org_id: subj.org_id, template_id: tpl.id, code: String(t.code), name: t.name, sort: tSort++,
  }).select('id').single();
  if (te) { console.error('Topic insert failed:', te.message); process.exit(1); }
  tCount++;
  let sSort = 0;
  const rows = (t.subtopics || []).map((s) => ({
    org_id: subj.org_id, topic_id: topic.id, code: String(s.code), name: s.name,
    objectives: Array.isArray(s.objectives) ? s.objectives : [], sort: sSort++,
  }));
  if (rows.length) {
    const { error: se2 } = await sb.from('syllabus_subtopics').insert(rows);
    if (se2) { console.error('Subtopic insert failed:', se2.message); process.exit(1); }
    sCount += rows.length;
    oCount += rows.reduce((n, r) => n + r.objectives.length, 0);
  }
}
console.log(`Seeded template ${tpl.id}: ${tCount} topics, ${sCount} subtopics, ${oCount} objectives.`);
