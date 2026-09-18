# Parse a Cambridge AS & A Level "two-column" format syllabus PDF (Computer
# Science 9618) into our outline JSON, split AS vs A2.
#
# Layout (verified on CompSci 9618):
#   - LEFT column (x < 290) holds the syllabus: topic "X.Y Name" (bold), then
#     one or more unnumbered subtopic names (e.g. "Graphics", "Sound") each
#     followed by "Candidates should be able to:" and a list of objectives.
#   - RIGHT column (x >= 290) is "Notes and guidance" - supplementary, ignored.
#   - objectives have no bullets/numbers; each is a block of lines. A new
#     objective starts on a larger vertical gap. Subtopics have no codes, so we
#     synthesise them as X.Y.n.
#   - sections switch on "AS content" / "A Level content" dividers.
#
# Usage: python parse-cambridge-twocol.py <pdf> <out.json>
import fitz, re, json, sys

BOLD = 16
LEFT_MAX = 290    # x below this is the syllabus column
GAP = 17          # vertical gap (px) above which a new objective starts

def clean(t):
    t = t.replace('\x07', '').replace(' ', ' ').replace(' ', ' ').replace('\t', ' ')
    for a, b in (('–', '-'), ('—', '-'), ('‑', '-'),
                 ('’', "'"), ('‘', "'"), ('“', '"'), ('”', '"')):
        t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()

def parse(pdf_path):
    doc = fitz.open(pdf_path)
    # Flatten to visual lines: [page, y, xmin, size, bold, text]
    L = []
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
                L.append([pageno, y, xmin, size, bold, txt])
    L.sort(key=lambda r: (r[0], round(r[1]), r[2]))
    n = len(L)

    def next_left(i):
        j = i + 1
        while j < n:
            if L[j][3] < 14 and L[j][2] < LEFT_MAX:
                return L[j][5]
            j += 1
        return None

    out = {'AS': [], 'A2': []}
    section = None; topic = None; sub = None
    cur = None; last_y = None; last_page = None; pending = None
    need_name = False   # topic code seen with no inline name -> next line is the name

    def flush():
        nonlocal cur
        if sub is not None and cur:
            sub['objectives'].append(cur.strip())
        cur = None

    CAND = 'candidates should be able'
    for i in range(n):
        pageno, y, xmin, size, bold, txt = L[i]

        if size >= 14:
            if 'A Level content' in txt or 'A Level subject content' in txt:
                flush(); section, topic, sub, cur, pending = 'A2', None, None, None, None; continue
            if 'AS content' in txt or 'AS Level content' in txt or 'Subject content' in txt:
                if section is None: section = 'AS'
                continue
            if section and any(k in txt for k in ('Details of the assessment', 'Details of assessment', 'Additional information', 'What else')):
                flush(); section = None; continue
        if section is None or xmin >= LEFT_MAX:
            continue

        # A topic code line with no inline name -> this next line is the name.
        if need_name and not txt.lower().startswith(CAND) and not re.match(r'^\d+\.\d+', txt):
            topic['name'] = txt; need_name = False; continue
        need_name = False

        m2 = re.match(r'^(\d+\.\d+)\s*(.*)$', txt)
        if bold and m2:  # topic heading
            flush()
            topic = {'code': m2.group(1), 'name': m2.group(2).strip(), 'subtopics': []}
            out[section].append(topic); sub = None; pending = None; cur = None; last_y = None
            need_name = (topic['name'] == '')
            continue
        if txt.lower().startswith(CAND):
            flush()
            name = pending if pending else (topic['name'] if topic else '')
            sub = {'code': '', 'name': name, 'objectives': []}
            if topic is not None: topic['subtopics'].append(sub)
            pending = None; cur = None; last_y = None; last_page = pageno
            continue
        if txt == 'Notes and guidance':
            continue
        # A subtopic name is a left line whose NEXT left line is "Candidates..."
        nl = next_left(i)
        if nl and nl.lower().startswith(CAND):
            pending = txt; continue
        # otherwise objective text (only meaningful inside a subtopic)
        if sub is not None:
            if cur is None:
                cur = txt
            else:
                big = (last_page is not None and pageno != last_page) or (last_y is not None and (y - last_y) > GAP)
                if big:
                    flush(); cur = txt
                else:
                    cur = (cur + ' ' + txt).strip()
            last_y = y; last_page = pageno

    flush()
    # Synthesise subtopic codes (PDF has none) and drop empties.
    for k in out:
        for tp in out[k]:
            keep = [s for s in tp['subtopics'] if s['objectives']]
            for si, s in enumerate(keep):
                s['code'] = f"{tp['code']}.{si + 1}"
            tp['subtopics'] = keep
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
        print(f'{sec}: {len(tp)} topics, {subs} subtopics, {objs} objectives')
