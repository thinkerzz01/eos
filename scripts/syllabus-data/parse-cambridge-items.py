# Parse a Cambridge AS & A Level "numbered items" format syllabus PDF (Economics
# 9708) into our outline JSON, split AS vs A2.
#
# Structure (verified on Economics 9708): no bullets; three numeric levels where
# the deepest level IS the objective statement:
#   unit    "N"        bold  -> our TOPIC   (name carries "(AS Level)"/"(A Level)")
#   topic   "N.M"      regular, code+name  -> our SUBTOPIC
#   item    "N.M.K"    regular, code+statement -> an OBJECTIVE of that subtopic
# Section switches on "AS Level content" / "A Level content" dividers and on the
# unit-name suffix.
#
# Usage: python parse-cambridge-items.py <pdf> <out.json>
import fitz, re, json, sys

BOLD = 16

def clean(t):
    t = t.replace('\x07', '').replace(' ', ' ').replace(' ', ' ')
    for a, b in (('–', '-'), ('—', '-'), ('‑', '-'),
                 ('’', "'"), ('‘', "'"), ('“', '"'), ('”', '"')):
        t = t.replace(a, b)
    return t.strip()

def parse(pdf_path):
    doc = fitz.open(pdf_path)
    spans = []
    for page in doc:
        for b in page.get_text('dict')['blocks']:
            for line in b.get('lines', []):
                for s in line['spans']:
                    if s['text'].strip():
                        spans.append((round(s['size'], 1), bool(s['flags'] & BOLD), s['text']))

    out = {'AS': [], 'A2': []}
    section = None
    topic = None
    sub = None
    cur_obj = None

    def flush():
        nonlocal cur_obj
        if sub is not None and cur_obj:
            txt = clean(cur_obj)
            if txt:
                sub['objectives'].append(txt)
        cur_obj = None

    i, n = 0, len(spans)
    while i < n:
        size, bold, raw = spans[i]
        t = clean(raw)

        if size >= 14:
            if 'A Level content' in t or 'A Level subject content' in t:
                flush(); section, topic, sub = 'A2', None, None; i += 1; continue
            if 'AS Level content' in t or 'AS content' in t or 'Subject content' in t:
                if section is None: section = 'AS'
                i += 1; continue
            if section and any(k in t for k in ('Details of the assessment', 'Details of assessment', 'Additional information', 'What else')):
                flush(); section = None; i += 1; continue
        if section is None:
            i += 1; continue

        m_unit = re.match(r'^(\d+)$', t)
        m_topic = re.match(r'^(\d+\.\d+)(?:[\t ]+(.*))?$', t)
        m_item = re.match(r'^(\d+\.\d+\.\d+[a-z]?)(?:[\t ]+(.*))?$', t)

        if bold and m_unit:
            # Unit name follows (bold); its "(A Level)" suffix flips the section.
            j = i + 1; parts = []
            while j < n and spans[j][1]:
                t2 = clean(spans[j][2])
                if re.match(r'^\d', t2): break
                parts.append(t2); j += 1
            name = ' '.join(parts).strip()
            if '(A Level' in name: section = 'A2'
            elif '(AS Level' in name: section = 'AS'
            name = re.sub(r'\s*\((AS |A )?Level\)\s*$', '', name).strip()
            flush()
            topic = {'code': m_unit.group(1), 'name': name, 'subtopics': []}
            out[section].append(topic); sub = None
            i = j; continue

        if m_item:  # deepest level = an objective statement
            code = m_item.group(1)
            inline = (m_item.group(2) or '').strip()
            flush()
            if inline:
                cur_obj = inline; i += 1; continue
            # statement is the following regular spans until the next code
            j, parts = i + 1, []
            while j < n:
                s2, b2, r2 = spans[j]
                t2 = clean(r2)
                if re.match(r'^\d+(?:\.\d+){1,2}[a-z]?(?:[\t ]|$)', t2): break
                if b2 and re.match(r'^\d+$', t2): break
                parts.append(t2); j += 1
            cur_obj = ' '.join(parts).strip()
            i = j; continue

        if m_topic:  # middle level = subtopic
            code = m_topic.group(1)
            inline = (m_topic.group(2) or '').strip()
            flush()
            if inline:
                name = inline; j = i + 1
            else:
                j, parts = i + 1, []
                while j < n:
                    s2, b2, r2 = spans[j]
                    t2 = clean(r2)
                    if re.match(r'^\d+(?:\.\d+){1,2}', t2): break
                    parts.append(t2); j += 1
                name = ' '.join(parts).strip()
            sub = {'code': code, 'name': name, 'objectives': []}
            if topic is not None: topic['subtopics'].append(sub)
            i = j; continue

        # continuation of the current objective statement
        if cur_obj is not None:
            cur_obj = (cur_obj + ' ' + t).strip()
        i += 1

    flush()
    sfx = re.compile(r'\s*\(?\s*(AS Level|A Level)\)?\s*$', re.I)
    cont = re.compile(r'\s*(\(continued\)|continued)\s*$', re.I)
    for k in out:
        # merge page-break duplicate units (topics) sharing a code
        merged, by = [], {}
        for tp in out[k]:
            tp['name'] = cont.sub('', sfx.sub('', tp['name'])).strip()
            if tp['code'] in by:
                by[tp['code']]['subtopics'].extend(tp['subtopics'])
            else:
                by[tp['code']] = tp; merged.append(tp)
        # merge duplicate subtopics within each topic
        for tp in merged:
            ms, bc = [], {}
            for s in tp['subtopics']:
                s['name'] = cont.sub('', s['name']).strip()
                if s['code'] in bc:
                    bc[s['code']]['objectives'].extend(s['objectives'])
                else:
                    bc[s['code']] = s; ms.append(s)
            tp['subtopics'] = ms
        out[k] = [tp for tp in merged if tp['subtopics']]
    return out

if __name__ == '__main__':
    pdf, outp = sys.argv[1], sys.argv[2]
    data = parse(pdf)
    with open(outp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    for sec in ('AS', 'A2'):
        tp = data[sec]
        subs = sum(len(t['subtopics']) for t in tp)
        objs = sum(len(s['objectives']) for t in tp for s in t['subtopics'])
        withobj = sum(1 for t in tp for s in t['subtopics'] if s['objectives'])
        print(f'{sec}: {len(tp)} topics, {subs} subtopics, {objs} objectives ({withobj}/{subs} have objectives)')
