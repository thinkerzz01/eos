// Seed AS-portion outlines for AS subjects whose PDFs don't cleanly auto-extract
// (two-column "Notes and guidance" layout / paper-based AS-A2 split). Modeled from
// the official Cambridge AS subject content (AS topics only; A2 topics excluded).
// Objectives left empty - these are the coverage tick items (topics/subtopics).
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const env = {};
for (const f of ['.env.local', '.env.production.local']) {
  try { for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  } } catch {}
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PROGRAM = 'AS';
const t = (code, name, subs) => ({ code, name, subtopics: subs.map((s, i) => ({ code: `${code}.${i + 1}`, name: s, objectives: [] })) });

const SUBJECTS = [
  { name: 'Economics', code: '9708', years: '2026-2028', topics: [
    t('1', 'Basic economic ideas and resource allocation', ['Scarcity, choice and opportunity cost', 'Economic methodology', 'Factors of production', 'Resource allocation in different economic systems', 'Production possibility curves', 'Classification of goods and services']),
    t('2', 'The price system and the microeconomy', ['Demand and supply curves', 'Price, income and cross elasticities of demand', 'Price elasticity of supply', 'The interaction of demand and supply', 'Consumer and producer surplus']),
    t('3', 'Government microeconomic intervention', ['Reasons for government intervention in markets', 'Methods and effects of government intervention', 'Addressing income and wealth inequality']),
    t('4', 'The macroeconomy', ['National income statistics', 'The circular flow of income', 'Aggregate demand and aggregate supply analysis', 'Economic growth', 'Unemployment', 'Price stability']),
  ]},
  { name: 'Business', code: '9609', years: '2026-2028', topics: [
    t('1', 'Business and its environment', ['Enterprise', 'Business structure', 'Size of business', 'Business objectives', 'Stakeholders in a business']),
    t('2', 'Human resource management', ['Human resource management', 'Motivation', 'Management and leadership']),
    t('3', 'Marketing', ['The nature of marketing', 'Market research', 'The marketing mix']),
    t('4', 'Operations management', ['The nature of operations', 'Operations planning', 'Inventory management']),
    t('5', 'Finance and accounting', ['The need for business finance', 'Sources of finance', 'Forecasting and managing cash flows', 'Costs', 'Budgets']),
  ]},
  { name: 'Accounting', code: '9706', years: '2026-2028', topics: [
    t('1', 'Financial accounting', ['The accounting cycle', 'Accounting for non-current assets', 'Reconciliation and verification', 'Preparation of financial statements', 'Analysis and communication of accounting information']),
    t('2', 'Cost and management accounting', ['Costing of materials, labour and overheads', 'Absorption and marginal costing', 'Unit, job and batch costing', 'Budgeting and budgetary control']),
  ]},
  { name: 'Computer Science', code: '9618', years: '2027-2029', topics: [
    t('1', 'Information representation', ['Data representation', 'Multimedia', 'Compression']),
    t('2', 'Communication', ['Networks including the internet']),
    t('3', 'Hardware', ['Computers and their components', 'Logic gates and logic circuits']),
    t('4', 'Processor fundamentals', ['Central processing unit (CPU) architecture', 'Assembly language', 'Bit manipulation']),
    t('5', 'System software', ['Operating systems', 'Language translators']),
    t('6', 'Security, privacy and data integrity', ['Data security', 'Data integrity']),
    t('7', 'Ethics and ownership', ['Ethics and ownership']),
    t('8', 'Databases', ['Database concepts', 'Database management systems (DBMS)', 'Data definition and data manipulation language (SQL)']),
    t('9', 'Algorithm design and problem-solving', ['Computational thinking skills', 'Algorithms']),
    t('10', 'Data types and structures', ['Data types and records', 'Arrays', 'Files', 'Abstract data types (ADT)']),
    t('11', 'Programming', ['Programming basics', 'Constructs', 'Structured programming']),
    t('12', 'Software development', ['Program development life cycle', 'Program design', 'Program testing and maintenance']),
  ]},
];

async function seedSubject(s) {
  const { data: subj } = await sb.from('subjects').select('id, org_id').eq('program', PROGRAM).eq('name', s.name).is('deleted_at', null).limit(1).maybeSingle();
  if (!subj) { console.log(`SKIP ${s.name} - not found`); return; }
  let { data: tpl } = await sb.from('syllabus_templates').select('id').eq('org_id', subj.org_id).eq('subject_id', subj.id).eq('status', 'active').is('deleted_at', null).limit(1).maybeSingle();
  if (tpl?.id) {
    const { count } = await sb.from('syllabus_topics').select('id', { count: 'exact', head: true }).eq('template_id', tpl.id).is('deleted_at', null);
    if ((count ?? 0) > 0) { console.log(`SKIP ${s.name} - already has ${count} topics`); return; }
  } else {
    const { data } = await sb.from('syllabus_templates').insert({ org_id: subj.org_id, subject_id: subj.id, academic_year: s.years, cambridge_code: s.code, status: 'active' }).select('id').single();
    tpl = data;
  }
  let ts = 0, nsub = 0;
  for (const tp of s.topics) {
    const { data: topic } = await sb.from('syllabus_topics').insert({ org_id: subj.org_id, template_id: tpl.id, code: tp.code, name: tp.name, sort: ts++ }).select('id').single();
    const rows = tp.subtopics.map((st, i) => ({ org_id: subj.org_id, topic_id: topic.id, code: st.code, name: st.name, objectives: [], sort: i }));
    if (rows.length) { await sb.from('syllabus_subtopics').insert(rows); nsub += rows.length; }
  }
  console.log(`Seeded AS ${s.name} (${s.code}): ${s.topics.length} topics, ${nsub} subtopics`);
}
for (const s of SUBJECTS) await seedSubject(s);
console.log('Done.');
