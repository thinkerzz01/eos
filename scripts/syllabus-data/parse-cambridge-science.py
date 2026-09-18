# Parse a Cambridge AS & A Level science-format syllabus PDF (the
# "Candidates should be able to:" style: Physics/Chemistry/Biology) into our
# outline JSON, split into AS and A2 sections.
#
# Structure signals (verified):
#   - section titles ("AS Level subject content", "A Level subject content") are
#     size ~16 bold spans.
#   - topic + subtopic HEADINGS are bold (flags & 16, typically flags==20):
#       topic     span text = "N\t",  name follows in the next bold span(s)
#       subtopic  span text = "N.M\t", name follows in the next bold span(s)
#   - objectives are regular spans (flags==4) after "Candidates should be able to:",
#     each starting with a "K\t" number span, text continuing until the next number
#     span or the next bold heading. A \x07 char is a stray bullet -> stripped.
#
# Usage: python parse-cambridge-science.py <pdf> <out.json>
#        writes {"AS":[...], "A2":[...]} where each item is
#        {code,name,subtopics:[{code,name,objectives:[...]}]}
import fitz, re, json, sys

BOLD = 16  # flags bitmask for bold in PyMuPDF

def clean(t):
    t = t.replace('\x07', '').replace(' ', ' ').replace(' ', ' ')
    # House style: plain hyphens and straight quotes (never en/em dashes or curly
    # quotes) since this content renders in the portal UI.
    for a, b in (('–', '-'), ('—', '-'), ('‑', '-'),
                 ('’', "'"), ('‘', "'"), ('“', '"'), ('”', '"')):
        t = t.replace(a, b)
    return t.strip()

def parse(pdf_path):
    doc = fitz.open(pdf_path)
    # Ordered spans across the whole doc: (size, is_bold, text)
    spans = []
    for page in doc:
        for b in page.get_text('dict')['blocks']:
            for line in b.get('lines', []):
                for s in line['spans']:
                    if s['text'].strip():
                        spans.append((round(s['size'], 1), bool(s['flags'] & BOLD), s['text']))

    section = None            # 'AS' | 'A2' | None
    out = {'AS': [], 'A2': []}
    topic = None
    sub = None
    mode = None               # 'objectives' when collecting
    cur_obj = None            # current objective text buffer

    def flush_obj():
        nonlocal cur_obj
        if sub is not None and cur_obj:
            txt = clean(cur_obj)
            if txt:
                sub['objectives'].append(txt)
        cur_obj = None

    i = 0
    n = len(spans)
    while i < n:
        size, bold, raw = spans[i]
        t = clean(raw)

        # Section boundaries (big titles; these are size ~16 and NOT bold)
        if size >= 14:
            if 'AS Level subject content' in t:
                flush_obj(); section, topic, sub, mode = 'AS', None, None, None; i += 1; continue
            if 'A Level subject content' in t:
                flush_obj(); section, topic, sub, mode = 'A2', None, None, None; i += 1; continue
            # any other big title ends the content region
            if section and any(k in t for k in ('Details of the assessment', 'Practical', 'Additional information', 'What else', 'assessment at a glance')):
                flush_obj(); section = None; i += 1; continue

        if section is None:
            i += 1; continue

        # A topic/subtopic heading is a BOLD span that starts with a code. The
        # PDF is inconsistent: sometimes the code is its own span ("1.1\t") with
        # the name in the following bold span(s); sometimes code + name share one
        # span ("10.1\tPractical circuits"). Handle both.
        # Size >= 9 excludes superscript digits (size ~7, e.g. the 1 in proton-1H)
        # which are bold and would otherwise look like a code.
        m_code = re.match(r'^(\d+(?:\.\d+)?)(?:[\t ]+(.*))?$', t) if (bold and size >= 9) else None
        if m_code:
            code = m_code.group(1)
            inline = (m_code.group(2) or '').strip()
            name_parts = [inline] if inline else []
            # gather following bold spans as more of the name (until non-bold or next real code)
            j = i + 1
            while j < n:
                s2, b2, r2 = spans[j]
                t2 = clean(r2)
                if not b2:
                    break
                if s2 >= 9 and re.match(r'^\d+(?:\.\d+)?(?:[\t ]|$)', t2):
                    break
                name_parts.append(t2.replace('\t', ' '))
                j += 1
            name = ' '.join(p for p in name_parts if p).strip()
            flush_obj()
            if '.' in code:
                sub = {'code': code, 'name': name, 'objectives': []}
                if topic is not None:
                    topic['subtopics'].append(sub)
                mode = None
            else:
                topic = {'code': code, 'name': name, 'subtopics': []}
                out[section].append(topic)
                sub = None
                mode = None
            i = j
            continue

        # Objective list trigger
        if not bold and t.lower().startswith('candidates should be able to'):
            flush_obj(); mode = 'objectives'; i += 1; continue

        if mode == 'objectives' and not bold:
            # An objective number span "K" starts a new objective (size >= 9 skips
            # superscript digits that appear inside objective text).
            if size >= 9 and re.match(r'^\d+$', t):
                flush_obj(); cur_obj = ''; i += 1; continue
            # otherwise append to current objective text
            if cur_obj is not None:
                cur_obj = (cur_obj + ' ' + t).strip()
            i += 1; continue

        i += 1

    flush_obj()
    # Merge page-break duplicates: a subtopic repeated across a page shows up as
    # "X.Y Name (continued)". Fold its objectives into the first occurrence.
    for k in out:
        for tp in out[k]:
            merged = []
            by_code = {}
            for s in tp['subtopics']:
                s['name'] = re.sub(r'\s*\(continued\)\s*$', '', s['name'])
                # Some subjects (e.g. Biology) print a bold "Learning outcomes"
                # label that gets swallowed into the heading - strip it.
                s['name'] = re.sub(r'\s*Learning outcomes\s*$', '', s['name']).strip()
                if s['code'] in by_code:
                    by_code[s['code']]['objectives'].extend(s['objectives'])
                    if len(s['name']) > len(by_code[s['code']]['name']):
                        by_code[s['code']]['name'] = s['name']
                else:
                    by_code[s['code']] = s
                    merged.append(s)
            tp['subtopics'] = merged
    # Drop empty topics (headers with no subtopics)
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
        withobj = sum(1 for t in tp for s in t['subtopics'] if s['objectives'])
        print(f'{sec}: {len(tp)} topics, {subs} subtopics, {objs} objectives ({withobj}/{subs} subtopics have objectives)')
