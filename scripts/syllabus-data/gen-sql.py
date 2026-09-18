# Turn a parsed Cambridge outline ({"AS":[...],"A2":[...]}) into a self-contained
# SQL script for the Supabase SQL editor. Each section becomes a PL/pgSQL block
# that: resolves the subject row + org, finds/creates the ACTIVE template, wipes
# any existing (empty-objective) outline, then inserts topics + subtopics +
# objectives. Idempotent-safe to re-run (it replaces).
#
# Usage: python gen-sql.py <parsed.json> <Name> <code> <as-years> <a2-years> <out.sql>
import json, sys

def q(s):  # SQL single-quoted string literal
    return "'" + str(s).replace("'", "''") + "'"

def jb(objs):  # jsonb literal
    return "'" + json.dumps(objs, ensure_ascii=False).replace("'", "''") + "'::jsonb"

def section_sql(program, name, code, years, topics):
    if not topics:
        return f"-- {name} {program}: no content parsed, skipped.\n"
    L = []
    L.append("DO $$")
    L.append("DECLARE v_org uuid; v_subject uuid; v_tpl uuid;")
    L.append("BEGIN")
    L.append(f"  SELECT id, org_id INTO v_subject, v_org FROM public.subjects")
    L.append(f"    WHERE program={q(program)} AND name={q(name)} AND deleted_at IS NULL LIMIT 1;")
    L.append(f"  IF v_subject IS NULL THEN RAISE NOTICE {q(name+' '+program+' not found - skipped')}; RETURN; END IF;")
    L.append("  SELECT id INTO v_tpl FROM public.syllabus_templates")
    L.append("    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL")
    L.append("    ORDER BY created_at DESC LIMIT 1;")
    L.append("  IF v_tpl IS NULL THEN")
    L.append("    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)")
    L.append(f"      VALUES(v_org,v_subject,{q(years)},{q(code)},'active') RETURNING id INTO v_tpl;")
    L.append("  ELSE")
    L.append(f"    UPDATE public.syllabus_templates SET academic_year={q(years)}, cambridge_code={q(code)}, updated_at=now() WHERE id=v_tpl;")
    L.append("    UPDATE public.syllabus_subtopics SET deleted_at=now()")
    L.append("      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);")
    L.append("    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;")
    L.append("  END IF;")
    # topics
    trows = []
    for ti, t in enumerate(topics):
        trows.append(f"    (v_org,v_tpl,{q(t['code'])},{q(t['name'])},{ti})")
    L.append("  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES")
    L.append(",\n".join(trows) + ";")
    # subtopics via a VALUES list joined to topics by code
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
    parsed, name, code, asy, a2y, outp = sys.argv[1:7]
    d = json.load(open(parsed, encoding='utf-8'))
    out = []
    out.append(f"-- {name} ({code}) - Cambridge AS & A Level outline with objectives.")
    out.append(f"-- Generated from the official syllabus PDF. Safe to re-run (replaces).\n")
    out.append(section_sql('AS', name, code, asy, d.get('AS', [])))
    out.append("")
    out.append(section_sql('A2', name, code, a2y, d.get('A2', [])))
    with open(outp, 'w', encoding='utf-8') as f:
        f.write("\n".join(out))
    print('wrote', outp)
