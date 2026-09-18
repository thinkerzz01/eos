// Load a parsed Cambridge AS & A Level outline (from parse-cambridge-*.py, shape
// {"AS":[...],"A2":[...]}) into the app. The AS section goes to the subject's AS
// program row, the A Level section to its A2 program row - each as the ACTIVE
// master template (topics -> subtopics -> objectives).
//
// Safe by default: if a template already has topics it is SKIPPED unless --force,
// which soft-deletes the old topics/subtopics first (student snapshots are frozen
// copies and are never touched). Service-role; run from the project root.
//
// Usage:
//   node scripts/load-cambridge.mjs --json <parsed.json> --name "Physics" \
//        --code 9702 --as-years "2025-2027" --a2-years "2025-2027" [--force]
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

const data = JSON.parse(fs.readFileSync(args.json, 'utf8'));
const NOW = () => new Date().toISOString();
const force = !!args.force;

async function loadSection(program, topics, years) {
  if (!topics || !topics.length) { console.log(`  ${program}: nothing to load.`); return; }
  const { data: subj } = await sb.from('subjects')
    .select('id, org_id').eq('program', program).eq('name', args.name).is('deleted_at', null).limit(1).maybeSingle();
  if (!subj) { console.log(`  ${program}: subject "${args.name}" not found - skipped.`); return; }

  let { data: tpl } = await sb.from('syllabus_templates')
    .select('id').eq('org_id', subj.org_id).eq('subject_id', subj.id).eq('status', 'active').is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (tpl?.id) {
    const { count } = await sb.from('syllabus_topics').select('*', { count: 'exact', head: true }).eq('template_id', tpl.id).is('deleted_at', null);
    if ((count ?? 0) > 0 && !force) { console.log(`  ${program}: template already has ${count} topics - skipped (use --force to replace).`); return; }
    if ((count ?? 0) > 0 && force) {
      const { data: old } = await sb.from('syllabus_topics').select('id').eq('template_id', tpl.id).is('deleted_at', null);
      const ids = (old ?? []).map((t) => t.id);
      if (ids.length) {
        await sb.from('syllabus_subtopics').update({ deleted_at: NOW() }).in('topic_id', ids);
        await sb.from('syllabus_topics').update({ deleted_at: NOW() }).in('id', ids);
      }
    }
    await sb.from('syllabus_templates').update({ academic_year: years || 'Current', cambridge_code: String(args.code || ''), updated_at: NOW() }).eq('id', tpl.id);
  } else {
    const { data: created, error } = await sb.from('syllabus_templates')
      .insert({ org_id: subj.org_id, subject_id: subj.id, academic_year: years || 'Current', cambridge_code: String(args.code || ''), status: 'active' })
      .select('id').single();
    if (error) { console.log(`  ${program}: template create failed - ${error.message}`); return; }
    tpl = created;
  }

  let nT = 0, nS = 0;
  for (let ti = 0; ti < topics.length; ti++) {
    const t = topics[ti];
    const { data: trow, error: te } = await sb.from('syllabus_topics')
      .insert({ org_id: subj.org_id, template_id: tpl.id, code: String(t.code || '') || null, name: t.name, sort: ti })
      .select('id').single();
    if (te) { console.log(`  ${program}: topic "${t.name}" failed - ${te.message}`); continue; }
    nT++;
    const rows = (t.subtopics || []).map((s, si) => ({
      org_id: subj.org_id, topic_id: trow.id, code: String(s.code || '') || null, name: s.name,
      objectives: s.objectives || [], sort: si,
    }));
    if (rows.length) {
      const { error: se } = await sb.from('syllabus_subtopics').insert(rows);
      if (se) { console.log(`  ${program}: subtopics for "${t.name}" failed - ${se.message}`); continue; }
      nS += rows.length;
    }
  }
  console.log(`  ${program}: loaded ${nT} topics, ${nS} subtopics.`);
}

console.log(`Loading "${args.name}" (${args.code})${force ? ' [--force]' : ''}`);
await loadSection('AS', data.AS, args['as-years']);
await loadSection('A2', data.A2, args['a2-years']);
console.log('Done.');
