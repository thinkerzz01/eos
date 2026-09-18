# Like gen-sql.py but for O Level: there is no AS/A2 split, so the single parsed
# outline is loaded into BOTH the academy's O Level batches (O1 and O2), which are
# mirror rows of the same Cambridge syllabus. Reads a parsed {"AS":[...],"A2":[...]}
# file and uses AS + A2 combined as the one outline.
#
# Usage: python gen-sql-olevel.py <parsed.json> <Name> <code> <years> <out.sql>
import json, sys

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

def jb(objs):
    return "'" + json.dumps(objs, ensure_ascii=False).replace("'", "''") + "'::jsonb"

def section_sql(program, name, code, years, topics):
    if not topics:
        return f"-- {name} [{program}]: no content, skipped.\n"
    L = ["DO $$", "DECLARE v_org uuid; v_subject uuid; v_tpl uuid;", "BEGIN",
         f"  SELECT id, org_id INTO v_subject, v_org FROM public.subjects",
         f"    WHERE program={q(program)} AND name={q(name)} AND deleted_at IS NULL LIMIT 1;",
         f"  IF v_subject IS NULL THEN RAISE NOTICE {q(name+' '+program+' not found - skipped')}; RETURN; END IF;",
         "  SELECT id INTO v_tpl FROM public.syllabus_templates",
         "    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL",
         "    ORDER BY created_at DESC LIMIT 1;",
         "  IF v_tpl IS NULL THEN",
         "    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)",
         f"      VALUES(v_org,v_subject,{q(years)},{q(code)},'active') RETURNING id INTO v_tpl;",
         "  ELSE",
         f"    UPDATE public.syllabus_templates SET academic_year={q(years)}, cambridge_code={q(code)}, updated_at=now() WHERE id=v_tpl;",
         "    UPDATE public.syllabus_subtopics SET deleted_at=now()",
         "      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);",
         "    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;",
         "  END IF;"]
    trows = [f"    (v_org,v_tpl,{q(t['code'])},{q(t['name'])},{ti})" for ti, t in enumerate(topics)]
    L.append("  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES")
    L.append(",\n".join(trows) + ";")
    srows = []
    for t in topics:
        for si, s in enumerate(t['subtopics']):
            srows.append(f"    ({q(t['code'])},{q(s['code'])},{q(s['name'])},{jb(s['objectives'])},{si})")
    if srows:
        L.append("  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)")
        L.append("  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES")
        L.append(",\n".join(srows))
        L.append("  ) AS x(tcode, scode, sname, objectives, sort)")
        L.append("  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;")
    L.append(f"  RAISE NOTICE {q('Loaded '+name+' '+program)};")
    L.append("END $$;")
    return "\n".join(L) + "\n"

if __name__ == '__main__':
    parsed, name, code, years, outp = sys.argv[1:6]
    d = json.load(open(parsed, encoding='utf-8'))
    topics = (d.get('AS') or []) + (d.get('A2') or [])
    out = [f"-- {name} ({code}) - Cambridge O Level outline with objectives, loaded into O1 + O2.\n"]
    out.append(section_sql('O Level (O1)', name, code, years, topics))
    out.append("")
    out.append(section_sql('O Level (O2)', name, code, years, topics))
    with open(outp, 'w', encoding='utf-8') as f:
        f.write("\n".join(out))
    subs = sum(len(t['subtopics']) for t in topics)
    objs = sum(len(s['objectives']) for t in topics for s in t['subtopics'])
    print(f'wrote {outp} | {len(topics)} topics, {subs} subtopics, {objs} objectives (x2 for O1+O2)')
