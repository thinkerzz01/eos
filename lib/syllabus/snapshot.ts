import 'server-only';

// Per-enrollment syllabus SNAPSHOT. When a student is enrolled in a subject we
// freeze a private copy of that subject's current master outline onto the student,
// so later edits to the master never disturb a student who is mid-course. Coverage
// (teacher ticks) then lives on the frozen items. Best-effort: if the subject has
// no master outline yet, nothing is created (the admin "Generate snapshots" action
// backfills once the outline exists). Accepts whatever Supabase client the caller
// has (cookie/RLS for admin-manager, or service-role for backfill/cron).

interface MinimalClient {
  from: (t: string) => any;
}

/**
 * Ensure a snapshot exists for (student, subject). Returns true if it created one,
 * false if it already existed or there was no master to copy. Never throws.
 */
export async function ensureEnrollmentSnapshot(
  supabase: MinimalClient,
  orgId: string,
  studentId: string,
  subjectId: string
): Promise<boolean> {
  try {
    if (!orgId || !studentId || !subjectId) return false;

    // Already snapshotted?
    const { data: existing } = await supabase
      .from('student_syllabus')
      .select('id')
      .eq('student_id', studentId)
      .eq('subject_id', subjectId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return false;

    // Active master template for the subject.
    const { data: tpl } = await supabase
      .from('syllabus_templates')
      .select('id, academic_year, cambridge_code')
      .eq('org_id', orgId)
      .eq('subject_id', subjectId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!tpl?.id) return false;

    const { data: topics } = await supabase
      .from('syllabus_topics')
      .select('id, code, name, sort')
      .eq('template_id', tpl.id)
      .is('deleted_at', null)
      .order('sort', { ascending: true });
    const topicRows = (topics ?? []) as any[];
    if (topicRows.length === 0) return false;

    const topicIds = topicRows.map((t) => t.id);
    const { data: subs } = await supabase
      .from('syllabus_subtopics')
      .select('id, topic_id, code, name, objectives, sort')
      .in('topic_id', topicIds)
      .is('deleted_at', null)
      .order('sort', { ascending: true });
    const subRows = (subs ?? []) as any[];
    if (subRows.length === 0) return false;

    // Create the snapshot header.
    const { data: header, error: hErr } = await supabase
      .from('student_syllabus')
      .insert({
        org_id: orgId,
        student_id: studentId,
        subject_id: subjectId,
        template_id: tpl.id,
        source_note: `${(tpl as any).cambridge_code || ''} ${(tpl as any).academic_year || ''}`.trim() || null,
      })
      .select('id')
      .single();
    if (hErr || !header?.id) return false;

    // Flatten master -> items, preserving topic then subtopic order.
    const byTopic = new Map<string, any[]>();
    for (const s of subRows) {
      const arr = byTopic.get(s.topic_id) ?? [];
      arr.push(s);
      byTopic.set(s.topic_id, arr);
    }
    const items: Record<string, any>[] = [];
    let sort = 0;
    for (const t of topicRows) {
      for (const s of byTopic.get(t.id) ?? []) {
        items.push({
          org_id: orgId,
          student_syllabus_id: header.id,
          topic_code: t.code ?? null,
          topic_name: t.name ?? null,
          subtopic_code: s.code ?? null,
          subtopic_name: s.name,
          objectives: Array.isArray(s.objectives) ? s.objectives : [],
          sort: sort++,
          status: 'pending',
        });
      }
    }
    if (items.length === 0) return false;
    const { error: iErr } = await supabase.from('student_syllabus_item').insert(items);
    if (iErr) return false;
    return true;
  } catch {
    return false;
  }
}
