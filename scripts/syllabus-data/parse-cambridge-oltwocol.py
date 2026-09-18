# Parse a Cambridge O Level "two-column statement" syllabus PDF (e.g. O Level
# Mathematics D 4024) into our outline JSON. O Level has no AS/A2 split, so the
# whole outline goes in the "AS" bucket (gen-sql-olevel loads it into O1 + O2).
#
# Layout (verified on 4024):
#   unit heading   "N Name"    bold size ~13   -> our TOPIC
#   topic heading  "N.M Name"  bold size ~10   -> our SUBTOPIC
#   LEFT column (x < 290): objective statements (no bullets, no "Candidates..."),
#     one objective per vertical block; a larger y-gap starts a new objective.
#   RIGHT column (x >= 290): "Notes and examples" -> ignored.
#
# Works at VISUAL-LINE granularity (PyMuPDF groups spans on a baseline into one
# dict line), which already joins "1.2" + "Sets" -> "1.2 Sets".
#
# Usage: python parse-cambridge-oltwocol.py <pdf> <out.json>
import fitz, re, json, sys

BOLD = 16
LEFT_MAX = 290
GAP = 16

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
    topic = None; sub = None; cur = None; last_y = None; last_page = None
    name_target = None   # heading dict awaiting its name from the next left line
    bulleted = False     # current subtopic uses bullet objectives (not gap-grouped)

    def flush():
        nonlocal cur
        if sub is not None and cur:
            sub['objectives'].append(cur.strip())
        cur = None

    for pageno, y, xmin, size, bold, txt in lines:
        if size >= 15:
            if ('Subject content' in txt) or ('Syllabus content' in txt and 'at a glance' not in txt):
                started = True; continue
            if started and any(k in txt for k in ('Details of the assessment', 'Details of assessment', 'Additional information', 'What else', 'Mathematical formulae', 'List of formulae')):
                flush(); started = False; continue
        if not started or xmin >= LEFT_MAX:
            continue
        # Skip page headers/footers (top/bottom margins + boilerplate).
        if y < 30 or y > 795:
            continue
        if txt.startswith('Cambridge O Level') or txt.startswith('Cambridge International') or txt == 'Back to contents page':
            continue

        # Named unit headings, e.g. Geography "Theme 1: Population and settlement".
        mt = re.match(r'^(?:Theme|Section|Unit|Part)\s+(\d+)\s*[:.\-]?\s*(.*)$', txt)
        if mt and size >= 13:
            flush()
            topic = {'code': mt.group(1), 'name': mt.group(2).strip(), 'subtopics': []}
            topics.append(topic); sub = None; cur = None; last_y = None; bulleted = False
            if not topic['name']: name_target = topic
            continue

        mu = re.match(r'^(\d+)(?:\s+(.*))?$', txt)
        ms = re.match(r'^(\d+\.\d+)(?:\s+(.*))?$', txt)
        # A heading seen with no inline name -> this next line is its name.
        if name_target is not None:
            if not ((bold and (ms or (mu and size >= 12))) or txt == 'Notes and examples'):
                name_target['name'] = txt; name_target = None; continue
            name_target = None
        if bold and ms:
            flush()
            sub = {'code': ms.group(1), 'name': (ms.group(2) or '').strip(), 'objectives': []}
            if topic is not None: topic['subtopics'].append(sub)
            cur = None; last_y = None; bulleted = False
            if not sub['name']: name_target = sub
            continue
        if mu and ((bold and size >= 12) or size >= 12.5):
            flush()
            topic = {'code': mu.group(1), 'name': (mu.group(2) or '').strip(), 'subtopics': []}
            topics.append(topic); sub = None; cur = None; last_y = None; bulleted = False
            if not topic['name']: name_target = topic
            continue
        # Three-level subjects (e.g. Sociology): a "X.Y.Z" line is a discrete
        # objective statement under the current X.Y subtopic.
        mi = re.match(r'^(\d+\.\d+\.\d+[a-z]?)(?:[\t ]+(.*))?$', txt)
        if mi and sub is not None:
            flush()
            cur = (mi.group(2) or '').strip()
            bulleted = True; last_y = y; last_page = pageno
            continue

        if txt == 'Notes and examples' or txt.lower().startswith('candidates should'):
            continue
        if sub is not None:
            if txt.startswith('•'):
                # bullet -> a new objective (some subjects use bullets, not gaps)
                flush(); cur = txt.lstrip('•').strip(); bulleted = True
            elif bulleted:
                cur = ((cur or '') + ' ' + txt).strip()   # wrapped bullet text
            else:
                # statement format: group by vertical gap
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
    # merge "(continued)" units + subtopics by code
    cont = re.compile(r'\s*\(continued\)\s*$', re.I)
    merged, by = [], {}
    for tp in topics:
        tp['name'] = cont.sub('', tp['name']).strip()
        if tp['code'] in by:
            by[tp['code']]['subtopics'].extend(tp['subtopics'])
        else:
            by[tp['code']] = tp; merged.append(tp)
    for tp in merged:
        ms2, bc = [], {}
        for s in tp['subtopics']:
            s['name'] = cont.sub('', s['name']).strip()
            if s['code'] in bc:
                bc[s['code']]['objectives'].extend(s['objectives'])
            else:
                bc[s['code']] = s; ms2.append(s)
        tp['subtopics'] = ms2
    topics = [tp for tp in merged if tp['subtopics']]
    return {'AS': topics, 'A2': []}

if __name__ == '__main__':
    pdf, outp = sys.argv[1], sys.argv[2]
    data = parse(pdf)
    with open(outp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tp = data['AS']
    subs = sum(len(t['subtopics']) for t in tp)
    objs = sum(len(s['objectives']) for t in tp for s in t['subtopics'])
    withobj = sum(1 for t in tp for s in t['subtopics'] if s['objectives'])
    print(f'{len(tp)} topics, {subs} subtopics, {objs} objectives ({withobj}/{subs} have objectives)')
