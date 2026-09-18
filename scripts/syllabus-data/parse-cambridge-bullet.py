# Parse a Cambridge AS & A Level "bullet" format syllabus PDF (Business, Economics,
# Accounting, Computer Science) into our outline JSON, split AS vs A2.
#
# Structure signals (verified on Business 9609):
#   - big section headers (size >= 14): "Subject content" starts AS; "A Level
#     content" switches to A2; assessment/etc. ends the content region.
#   - unit heading: bold, size ~13, code "N" + name (often "... (AS Level)").
#   - topic heading (level 2): bold, code "N.M" + name -> becomes our TOPIC.
#   - subtopic heading (level 3): regular, code "N.M.K" + name -> our SUBTOPIC.
#   - objectives: bullet char (fl0) then regular text, wrapping across regular
#     spans until the next bullet or heading.
#
# Maps 3 PDF levels to our 2: topic <- N.M, subtopic <- N.M.K, objectives <- bullets.
#
# Usage: python parse-cambridge-bullet.py <pdf> <out.json>
import fitz, re, json, sys

BOLD = 16
BULLET = '•'

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
                    if s['text'].strip() or s['text'] == BULLET:
                        spans.append((round(s['size'], 1), bool(s['flags'] & BOLD), s['text']))

    out = {'AS': [], 'A2': []}
    section = None
    topic = None
    sub = None
    mode = None            # 'subname' (collecting subtopic name) | 'obj'
    cur_obj = None

    def flush_obj():
        nonlocal cur_obj
        if sub is not None and cur_obj:
            txt = clean(cur_obj)
            if txt:
                sub['objectives'].append(txt)
        cur_obj = None

    def new_sub(code, name):
        nonlocal sub
        flush_obj()
        sub = {'code': code, 'name': name, 'objectives': []}
        if topic is not None:
            topic['subtopics'].append(sub)

    i, n = 0, len(spans)
    while i < n:
        size, bold, raw = spans[i]
        t = clean(raw)

        # Section boundaries
        if size >= 14:
            if 'A Level content' in t or 'A Level subject content' in t:
                flush_obj(); section, topic, sub, mode = 'A2', None, None, None; i += 1; continue
            if 'AS Level content' in t or 'AS Level subject content' in t or 'Subject content' in t:
                if section is None:
                    section = 'AS'
                i += 1; continue
            if section and any(k in t for k in ('Details of the assessment', 'Details of assessment', 'Additional information', 'What else', 'assessment at a glance')):
                flush_obj(); section = None; i += 1; continue

        if section is None:
            i += 1; continue

        # Bullet -> new objective
        if raw.strip() == BULLET or t == BULLET:
            flush_obj(); cur_obj = ''; mode = 'obj'; i += 1; continue

        # Headings by code pattern (code may be its own span, or share the span
        # with the name, e.g. "1.2.1  The accounting system").
        m3 = re.match(r'^(\d+\.\d+\.\d+[a-z]?)(?:[\t ]+(.*))?$', t)  # subtopic (regular)
        m2 = re.match(r'^(\d+\.\d+)(?:[\t ]+(.*))?$', t)            # topic (bold)
        m1 = re.match(r'^(\d+)$', t)                                # unit (bold, ignored)

        if m2 and bold:
            code = m2.group(1)
            inline = (m2.group(2) or '').strip()
            if inline:
                parts, j = [inline], i + 1
            else:
                parts, j = [], i + 1
                while j < n:
                    s2, b2, r2 = spans[j]
                    t2 = clean(r2)
                    if not b2 or re.match(r'^\d+(?:\.\d+){0,2}$', t2) or t2 == BULLET:
                        break
                    parts.append(t2); j += 1
            flush_obj()
            topic = {'code': code, 'name': ' '.join(p for p in parts if p).strip(), 'subtopics': []}
            out[section].append(topic); sub = None; mode = None
            i = j; continue

        if m3 and not bold:
            code = m3.group(1)
            inline = (m3.group(2) or '').strip()
            if inline:
                new_sub(code, inline); mode = 'subname'; i += 1; continue
            j, parts = i + 1, []
            while j < n:
                s2, b2, r2 = spans[j]
                t2 = clean(r2)
                if r2.strip() == BULLET or re.match(r'^\d+(?:\.\d+){0,2}[a-z]?$', t2):
                    break
                parts.append(t2); j += 1
            new_sub(code, ' '.join(p for p in parts if p).strip())
            mode = 'subname'
            i = j; continue

        if m1 and bold and size >= 12:
            # Unit heading: use its trailing "(A Level)" as a section hint, else ignore.
            j = i + 1; name = ''
            if j < n and spans[j][1]:
                name = clean(spans[j][2])
            if '(A Level' in name:
                flush_obj(); section = 'A2'; topic = None; sub = None; mode = None
            i += 1; continue

        # Objective continuation text
        if mode == 'obj' and cur_obj is not None:
            cur_obj = (cur_obj + ' ' + t).strip()
        i += 1

    flush_obj()
    cont = re.compile(r'\s*(\(continued\)|continued)\s*$', re.I)
    for k in out:
        # 1) merge page-break duplicate TOPICS sharing a code
        merged_t, by_tcode = [], {}
        for tp in out[k]:
            tp['name'] = cont.sub('', tp['name']).strip()
            if tp['code'] in by_tcode:
                by_tcode[tp['code']]['subtopics'].extend(tp['subtopics'])
            else:
                by_tcode[tp['code']] = tp; merged_t.append(tp)
        out[k] = merged_t
        # 2) merge duplicate SUBTOPICS within each topic
        for tp in out[k]:
            merged, by_code = [], {}
            for s in tp['subtopics']:
                s['name'] = cont.sub('', s['name']).strip()
                if s['code'] in by_code:
                    by_code[s['code']]['objectives'].extend(s['objectives'])
                else:
                    by_code[s['code']] = s; merged.append(s)
            tp['subtopics'] = merged
        out[k] = [tp for tp in out[k] if tp['subtopics']]
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
