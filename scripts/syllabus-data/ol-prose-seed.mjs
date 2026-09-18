// Seed the prose/skills/practical O Level (O1) subjects whose PDFs have no clean
// topic->subtopic->objective structure to auto-extract. These outlines are modeled
// at section/skill level from the official syllabus structure (papers, components,
// content areas) - a sensible coverage granularity to review and refine, not a
// verbatim objective list. Objectives are intentionally left empty.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = {};
for (const f of ['.env.local', '.env.production.local']) {
  try { for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  } } catch {}
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PROGRAM = 'O Level (O1)';
const t = (code, name, subs) => ({ code, name, subtopics: subs.map((s, i) => ({ code: `${code}.${i + 1}`, name: s, objectives: [] })) });

const SUBJECTS = [
  { name: 'Statistics', code: '4040', years: '2025-2027', topics: [
    t('1', 'Subject content', [
      'Data and its collection', 'Summary representation of data',
      'Formation of data into ungrouped or grouped frequency distributions',
      'Formation of frequency distributions into cumulative frequency distributions',
      'Statistical measures, their interpretation and appropriate use',
      'Transformations involving mean and standard deviation',
      'Crude and standardised rates, and their appropriate use', 'Index numbers',
      'Bivariate distributions and their representation by scatter diagrams',
      'Time series', 'Elementary ideas of probability', 'Probability distributions',
    ]),
  ]},
  { name: 'History', code: '2147', years: '2027-2028', topics: [
    t('1', 'Core Content Option A: The nineteenth century (1848-1914)', [
      'Were the revolutions of 1848 important?', 'How was Italy unified?', 'How was Germany unified?',
      'Why was there a civil war in the United States and what were its results?',
      'Why, and with what effects, did nations gain and expand their empires?',
      'What caused the First World War?',
    ]),
    t('2', 'Core Content Option B: The twentieth century (1919-c.2000)', [
      'Was the Treaty of Versailles fair?', 'To what extent was the League of Nations a success?',
      "How far was Hitler's foreign policy to blame for the Second World War?",
      'Who was to blame for the Cold War?', 'How effectively did the United States contain the spread of communism?',
      "How secure was the USSR's control over Eastern Europe, 1948-c.1989?",
    ]),
    t('3', 'Depth Studies (one chosen)', [
      'Germany, 1918-45', 'Russia, 1905-41', 'The USA, 1919-41', 'China, c.1930-c.1990',
      'South Africa, c.1940-c.1994', 'Israelis and Palestinians since 1945',
    ]),
  ]},
  { name: 'Islamiyat', code: '2058', years: '2026-2027', topics: [
    t('1', 'The History and Importance of the Qur’an (Paper 1)', [
      'The major themes of the selected passages of the Qur’an',
      'The history of the compilation of the Qur’an',
      'The life and importance of the Prophet Muhammad in Makkah and Madinah',
    ]),
    t('2', 'The First Islamic Community and the Hadith (Paper 2)', [
      'The first Islamic community: the Rightly Guided Caliphs',
      'The importance of the Hadith and selected Hadiths',
      'The Pillars of Islam and the articles of faith',
    ]),
  ]},
  { name: 'Urdu', code: '3247', years: '2027', topics: [
    t('1', 'Content themes', [
      'Health and fitness', 'The world of youth', 'Education and training', 'The world we live in',
    ]),
    t('2', 'Language skills', [
      'Reading and comprehension', 'Summary', 'Directed writing', 'Composition',
    ]),
  ]},
  { name: 'Arabic', code: '3180', years: '2026', topics: [
    t('1', 'Composition (Paper 1)', ['Letter, report, speech or dialogue', 'Essay']),
    t('2', 'Translation and Reading Comprehension (Paper 2)', ['Translation', 'Reading comprehension']),
  ]},
  { name: 'English (First Language)', code: '1123', years: '2027-2028', topics: [
    t('1', 'Reading (Paper 1)', ['Comprehension and reading for meaning', 'Summary skills', 'Analysis of language and style']),
    t('2', 'Writing (Paper 2)', ['Directed writing', 'Composition: narrative and descriptive', 'Composition: argumentative and discursive']),
  ]},
  { name: 'Literature in English', code: '2010', years: '2027', topics: [
    t('1', 'Poetry', ['Understanding and response to set poems', 'Analysis of language, imagery and form']),
    t('2', 'Prose', ['Understanding and response to the set prose text', 'Character, theme and narrative method']),
    t('3', 'Drama', ['Understanding and response to the set drama text', 'Character, dramatic method and staging']),
  ]},
  { name: 'Global Perspectives', code: '2069', years: '2025-2027', topics: [
    t('1', 'Component 1: Written Examination', ['Research and information skills', 'Analysis of sources and arguments', 'Evaluation of evidence', 'Reflection']),
    t('2', 'Component 2: Individual Report', ['Identifying and researching a global issue', 'Analysis and evaluation', 'Reflection and personal response']),
    t('3', 'Component 3: Team Project', ['Collaboration and teamwork', 'Project outcome', 'Reflection on the process']),
  ]},
  { name: 'Food & Nutrition', code: '6065', years: '2026-2028', topics: [
    t('1', 'Subject content', [
      'The nutrients', 'The relationship between energy and nutrients', 'Meal planning and management',
      'Food preparation and cooking', 'Food commodities', 'Food hygiene, storage and preservation',
      'Convenience foods and food additives', 'Consumer education',
    ]),
  ]},
  { name: 'Art & Design', code: '6090', years: '2027', topics: [
    t('1', 'Component 1: Coursework', ['Recording and observation', 'Development of ideas and experimentation', 'Personal outcome']),
    t('2', 'Component 2: Externally Set Assignment', ['Preparatory study', 'Final outcome under controlled conditions']),
  ]},
];

async function seedSubject(s) {
  const { data: subj } = await sb.from('subjects').select('id, org_id')
    .eq('program', PROGRAM).eq('name', s.name).is('deleted_at', null).limit(1).maybeSingle();
  if (!subj) { console.log(`SKIP ${s.name} - subject row not found`); return; }
  let { data: tpl } = await sb.from('syllabus_templates').select('id')
    .eq('org_id', subj.org_id).eq('subject_id', subj.id).eq('status', 'active').is('deleted_at', null).limit(1).maybeSingle();
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
  console.log(`Seeded ${s.name} (${s.code}): ${s.topics.length} topics, ${nsub} subtopics`);
}

for (const s of SUBJECTS) await seedSubject(s);
console.log('Done.');
