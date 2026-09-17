import subprocess, re, json, sys, os

NOISE = [
    'www.cambridgeinternational.org', 'Back to contents page', 'syllabus for',
    'Subject content', 'subject content', 'Cambridge International', 'Cambridge IGCSE',
    'AS Level subject content', 'A Level subject content',
]
SUBTOPIC = re.compile(r'^(\d+\.\d+)\s+(.+)$')
TOPIC = re.compile(r'^(\d{1,2})\s+(.+)$')
OBJ = re.compile(r'^(\d+)\s*(.*)$')
# Start of the subject-content section: "AS/A Level subject content" (A Level) or
# "[N] Subject content" (O Level / IGCSE). Excludes the running page header and the
# dotted contents-page entry (both have trailing text, so the $ anchor rejects them).
SECTION = re.compile(r'^(A[S]? Level subject content|\d*\s*Subject content)$', re.I)

def clean(s):
    s = s.replace('�', '-')            # dropped en-dash -> hyphen (house rule)
    s = s.replace('–', '-').replace('—', '-')
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def parse(pdf, first=1, last=60, max_topic=99):
    txt = subprocess.run(['pdftotext', '-layout', '-enc', 'UTF-8', '-f', str(first), '-l', str(last), pdf, '-'],
                         capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
    cl = [clean(x) for x in txt.split('\n')]
    n = len(cl)

    def meaningful(j):
        lj = cl[j]
        return lj and '....' not in lj and not any(x in lj for x in NOISE)

    # A numbered line is a TOPIC (not an objective that happens to start with a
    # number) only if a matching "num.M" subtopic follows within a few lines. This
    # works for both A Level (lowercase objectives) and O Level (capitalised ones),
    # where letter-case can't tell a topic from an objective.
    def topic_confirmed(i, num):
        seen = 0; j = i + 1
        while j < n and seen < 8:
            if meaningful(j):
                mm = SUBTOPIC.match(cl[j])
                if mm:
                    return int(mm.group(1).split('.')[0]) == num
                seen += 1
            j += 1
        return False

    topics = []
    expected = 1
    cur_t = cur_s = None
    in_obj = False
    obj_n = 0
    insec = False
    for i in range(n):
        line = cl[i]
        if not line:
            continue
        if not insec:
            if SECTION.match(line):
                insec = True
            continue
        if '....' in line or any(x in line for x in NOISE):
            continue
        if 'Candidates should be able to' in line:
            in_obj = True; obj_n = 0; continue
        if topics and re.match(r'^\d+\s+(Details of the assessment|Practical assessment|Additional information|Appendix)', line):
            break
        m = SUBTOPIC.match(line)
        if m and cur_t is not None:
            code = m.group(1); name = clean(m.group(2))
            # Page-break continuation ("1.5 Forces continued") - reuse existing subtopic.
            if re.search(r'\bcontinued$', name, re.I):
                base = re.sub(r'\s*continued$', '', name, flags=re.I).strip()
                existing = next((s for s in cur_t['subtopics'] if s['code'] == code or s['name'] == base), None)
                if existing:
                    cur_s = existing; in_obj = True; obj_n = 0; continue
            cur_s = {'code': code, 'name': name, 'objectives': []}
            # Objectives may follow directly (O Level) or after a "Candidates should
            # be able to:" line (A Level) - either way, start collecting now.
            cur_t['subtopics'].append(cur_s); in_obj = True; obj_n = 0; continue
        m = TOPIC.match(line)
        if m:
            num = int(m.group(1)); name = clean(m.group(2))
            if num == expected and num <= max_topic and topic_confirmed(i, num):
                cur_t = {'code': str(num), 'name': name, 'subtopics': []}
                topics.append(cur_t); expected += 1; cur_s = None; in_obj = False
                continue
        if in_obj and cur_s is not None:
            mo = OBJ.match(line)
            if mo and mo.group(2) and int(mo.group(1)) == obj_n + 1:
                obj_n = int(mo.group(1)); cur_s['objectives'].append(clean(mo.group(2)))
            elif cur_s['objectives']:
                cur_s['objectives'][-1] = clean(cur_s['objectives'][-1] + ' ' + line)
    return topics

if __name__ == '__main__':
    pdf = sys.argv[1]
    topics = parse(pdf)
    nsub = sum(len(t['subtopics']) for t in topics)
    nobj = sum(len(s['objectives']) for t in topics for s in t['subtopics'])
    print(f'topics={len(topics)} subtopics={nsub} objectives={nobj}')
    for t in topics:
        print(f"  {t['code']} {t['name']}  [{len(t['subtopics'])} sub]")
    out = sys.argv[2] if len(sys.argv) > 2 else None
    if out:
        json.dump(topics, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('WROTE', out)
