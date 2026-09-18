# Parse a Cambridge O Level "two-column item" syllabus PDF (e.g. O Level
# Additional Mathematics 4037) where each numbered X.Y line in the LEFT column IS
# a learning objective (statement), grouped under a numbered unit. The RIGHT
# column ("Examples include:") is illustrative and ignored.
#
# Mapping: unit "N Name" -> our TOPIC, plus one SUBTOPIC named after the unit
# holding the unit's X.Y statements as objectives.
#
# Usage: python parse-cambridge-olitems.py <pdf> <out.json>
import fitz, re, json, sys

BOLD = 16
LEFT_MAX = 290

def clean(t):
    t = t.replace('\x07', '').replace(' ', ' ').replace(' ', ' ').replace('\t', ' ')
    for a, b in (('–', '-'), ('—', '-'), ('‑', '-'),
                 ('’', "'"), ('‘', "'"), ('“', '"'), ('”', '"')):
        t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()

def parse(pdf_path):
    doc = fitz.open(pdf_path)
    lines = []
    for pageno, page in enumerate(doc):
        for b in page.get_text('dict')['blocks']:
            for l in b.get('lines', []):
                spans = l['spans']
                txt = clean(''.join(sp['text'] for sp in spans))
                if not txt:
                    continue
                xmin = min(sp['bbox'][0] for sp in spans)
                y = min(sp['bbox'][1] for sp in spans)
                size = max(round(sp['size'], 1) for sp in spans)
                bold = any(sp['flags'] & BOLD for sp in spans)
                lines.append([pageno, y, xmin, size, bold, txt])
    lines.sort(key=lambda r: (r[0], round(r[1]), r[2]))

    topics = []
    started = False
    topic = None; sub = None; cur = None
    need_name = None   # (topic, sub) awaiting a name from the next line

    def flush():
        nonlocal cur
        if sub is not None and cur:
            sub['objectives'].append(cur.strip())
        cur = None

    for pageno, y, xmin, size, bold, txt in lines:
        if size >= 15:
            if 'Subject content' in txt or ('Syllabus content' in txt and 'at a glance' not in txt):
                started = True; continue
            if started and any(k in txt for k in ('Details of the assessment', 'Details of assessment', 'Additional information', 'What else', 'Mathematical formulae', 'List of formulae', 'Mathematical notation')):
                flush(); started = False; continue
        if not started or xmin >= LEFT_MAX:
            continue
        if y < 30 or y > 795:
            continue
        if txt.startswith('Cambridge O Level') or txt.startswith('Cambridge International') or txt == 'Back to contents page':
            continue

        if need_name is not None and not re.match(r'^\d', txt):
            need_name[0]['name'] = txt; need_name[1]['name'] = txt; need_name = None; continue
        need_name = None

        mx = re.match(r'^(\d+\.\d+[a-z]?)(?:\s+(.*))?$', txt)
        mu = re.match(r'^(\d+)(?:\s+(.*))?$', txt)
        if mx and sub is not None:   # X.Y line = an objective statement
            flush()
            cur = (mx.group(2) or '').strip()
            continue
        if bold and mu and size >= 10.5:   # unit heading
            flush()
            uname = (mu.group(2) or '').strip()
            topic = {'code': mu.group(1), 'name': uname, 'subtopics': []}
            sub = {'code': mu.group(1), 'name': uname, 'objectives': []}
            topic['subtopics'].append(sub); topics.append(topic); cur = None
            if not uname:
                need_name = (topic, sub)
            continue
        if cur is not None:   # continuation of current objective statement
            cur = (cur + ' ' + txt).strip()

    flush()
    # strip "(continued)" and drop unit-topics without objectives
    for t in topics:
        t['name'] = re.sub(r'\s*\(continued\)\s*$', '', t['name']).strip()
        for s in t['subtopics']:
            s['name'] = re.sub(r'\s*\(continued\)\s*$', '', s['name']).strip()
    topics = [t for t in topics if any(s['objectives'] for s in t['subtopics'])]
    # merge duplicate units (page-break continuations) by code
    merged, by = [], {}
    for t in topics:
        if t['code'] in by:
            for s in t['subtopics']:
                by[t['code']]['subtopics'][0]['objectives'].extend(s['objectives'])
        else:
            by[t['code']] = t; merged.append(t)
    return {'AS': merged, 'A2': []}

if __name__ == '__main__':
    pdf, outp = sys.argv[1], sys.argv[2]
    data = parse(pdf)
    with open(outp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tp = data['AS']
    subs = sum(len(t['subtopics']) for t in tp)
    objs = sum(len(s['objectives']) for t in tp for s in t['subtopics'])
    print(f'{len(tp)} topics, {subs} subtopics, {objs} objectives')
