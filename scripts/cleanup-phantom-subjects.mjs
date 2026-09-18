// One-off subject hygiene: soft-delete the not-taught subject rows that clutter
// the syllabus/subject pickers. REVERSIBLE - it only sets deleted_at, so a row
// can be restored by clearing that column. Skips any subject that has a student
// enrolled (student_subjects) or an active syllabus template, so nothing in use
// is ever touched.
//
// Usage:
//   node scripts/cleanup-phantom-subjects.mjs            # dry run (lists only)
//   node scripts/cleanup-phantom-subjects.mjs --apply    # perform the soft-delete
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

// Subjects the academy does not teach (confirmed by the owner). Matched by exact
// name across every program.
const NAMES = [
  'Marine Science', 'Thinking Skills', 'Media Studies', 'Drama', 'Music',
  'Sport & Physical Education', 'Law', 'Psychology', 'Design & Technology',
  'Global Perspectives & Research', 'English General Paper',
];

const { data: subs } = await sb.from('subjects').select('id,name,program,code').in('name', NAMES).is('deleted_at', null);
console.log(`Matched ${subs?.length ?? 0} subject rows.`);
let removed = 0, skipped = 0;
for (const s of subs ?? []) {
  const { count: enr } = await sb.from('student_subjects').select('*', { count: 'exact', head: true }).eq('subject_id', s.id).is('deleted_at', null);
  const { count: tpl } = await sb.from('syllabus_templates').select('*', { count: 'exact', head: true }).eq('subject_id', s.id).is('deleted_at', null);
  if ((enr ?? 0) > 0 || (tpl ?? 0) > 0) {
    console.log(`  SKIP  [${s.program}] ${s.name} (enrollments=${enr}, templates=${tpl})`);
    skipped++; continue;
  }
  if (APPLY) {
    const { error } = await sb.from('subjects').update({ deleted_at: new Date().toISOString() }).eq('id', s.id);
    if (error) { console.log(`  ERR   [${s.program}] ${s.name}: ${error.message}`); continue; }
  }
  console.log(`  ${APPLY ? 'REMOVED' : 'would remove'}  [${s.program}] ${s.name}`);
  removed++;
}
console.log(`\n${APPLY ? 'Removed' : 'Would remove'}: ${removed} | Skipped (in use): ${skipped}`);
if (!APPLY) console.log('Dry run. Re-run with --apply to soft-delete.');
