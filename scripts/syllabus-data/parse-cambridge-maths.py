# Parse a Cambridge AS & A Level Mathematics (9709) / Further Mathematics (9231)
# syllabus PDF into our outline JSON, split AS vs A2.
#
# Maths is organised by exam COMPONENTS, not an AS/A2 content divider:
#   component header (size ~16) e.g. "Pure Mathematics 1 (for Paper 1)"
#     -> our TOPIC (name = component, code = its number)
#   "X.Y Name" (bold, LEFT column)     -> our SUBTOPIC
#   bullets under "Candidates should be able to:" (LEFT column) -> OBJECTIVES
#   right column (x >= 300) "Notes and examples" -> ignored.
#
# The AS-vs-A2 assignment of components is route-dependent, so it is a fixed
# default map here (owner confirms/adjusts). Unknown components default to AS.
#
# Usage: python parse-cambridge-maths.py <pdf> <out.json>
import fitz, re, json, sys

BOLD = 16
LEFT_MAX = 300
BULLET = '•'

# component name fragment -> (program, topic_code). Covers 9709 and 9231.
COMP_MAP = {
    'Pure Mathematics 1': ('AS', '1'),
    'Pure Mathematics 2': ('AS', '2'),
    'Pure Mathematics 3': ('A2', '3'),
    'Mechanics (for Paper 4)': ('AS', '4'),
    'Probability & Statistics 1': ('AS', '5'),
    'Probability & Statistics 2': ('A2', '6'),
    # Further Mathematics 9231
    'Further Pure Mathematics 1': ('AS', '1'),
    'Further Pure Mathematics 2': ('A2', '2'),
    'Further Mechanics': ('AS', '3'),
    'Further Probability & Statistics': ('AS', '4'),
}

def clean(t):
    t = t.replace('\x07', '').replace(' ', ' ').replace(' ', ' ').replace('\t', ' ')
    for a, b in (('–', '-'), ('—', '-'), ('‑', '-'),
                 ('’', "'"), ('‘', "'"), ('“', '"'), ('”', '"')):
        t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()

def match_component(t):
    # Prefer the LONGEST matching fragment so "Further Pure Mathematics 2" wins
    # over the substring "Pure Mathematics 2" (different program).
    best = None
    for frag, pc in COMP_MAP.items():
        if frag in t and (best is None or len(frag) > len(best[1])):
            best = (pc, frag)
    return (best[0], best[1]) if best else (None, None)

def parse(pdf_path):
    doc = fitz.open(pdf_path)
    spans = []
    for page in doc:
        for b in page.get_text('dict')['blocks']:
            for line in b.get('lines', []):
                for s in line['spans']:
                    if s['text'].strip() or s['text'] == BULLET:
                        spans.append((round(s['bbox'][0]), round(s['size'], 1), bool(s['flags'] & BOLD), s['text']))

    out = {'AS': [], 'A2': []}
    program = None; topic = None; sub = None; cur = None; started = False

    def flush():
        nonlocal cur
        if sub is not None and cur:
            txt = clean(cur)
            if txt:
                sub['objectives'].append(txt)
        cur = None

    i, n = 0, len(spans)
    while i < n:
        x, size, bold, raw = spans[i]
        t = clean(raw)

        if size >= 12.5:   # 9709 components are size 16, 9231 are size 13
            pc, frag = match_component(t)
            if pc:
                flush()
                program, code = pc
                cname = re.sub(r'\s*\(for Paper \d+\)\s*$', '', t).strip()
                cname = re.sub(r'^\d+\s+', '', cname)
                topic = {'code': code, 'name': cname, 'subtopics': []}
                out[program].append(topic); sub = None; cur = None; started = True
                i += 1; continue
            if started and any(k in t for k in ('Details of the assessment', 'Details of assessment', 'Additional information', 'What else', 'List of formulae')):
                flush(); program = None; topic = None; sub = None; i += 1; continue

        if program is None or topic is None:
            i += 1; continue
        if x >= LEFT_MAX:   # right column notes/examples
            i += 1; continue

        if raw.strip() == BULLET:
            flush(); cur = ''; i += 1; continue

        m2 = re.match(r'^(\d+\.\d+)\s*(.*)$', t)
        if bold and m2:
            flush()
            name = m2.group(2).strip()
            j = i + 1
            if not name:  # name may be the next bold span
                while j < n and spans[j][2] and spans[j][0] < LEFT_MAX:
                    nt = clean(spans[j][3])
                    if re.match(r'^\d', nt): break
                    name = (name + ' ' + nt).strip(); j += 1
            sub = {'code': m2.group(1), 'name': name, 'objectives': []}
            topic['subtopics'].append(sub); cur = None
            i = j; continue

        if t.lower().startswith('candidates should be able'):
            i += 1; continue

        if cur is not None:   # objective continuation
            cur = (cur + ' ' + t).strip()
        i += 1

    flush()
    for k in out:
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
        comps = ', '.join(t['name'] for t in tp)
        print(f'{sec}: {len(tp)} components, {subs} subtopics, {objs} objectives | {comps}')
