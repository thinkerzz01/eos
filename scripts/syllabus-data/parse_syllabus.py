import subprocess, re, json, sys, os

NOISE = [
    'www.cambridgeinternational.org', 'Back to contents page', 'syllabus for',
    'Subject content', 'subject content', 'Cambridge International', 'Cambridge IGCSE',
    'AS Level subject content', 'A Level subject content',
]
SUBTOPIC = re.compile(r'^(\d+\.\d+)\s+(.+)$')
TOPIC = re.compile(r'^(\d{1,2})\s+(.+)$')
OBJ = re.compile(r'^(\d+)\s*(.*)$')
SECTION = re.compile(r'^A[S]? Level subject content$', re.I)

def clean(s):
    s = s.replace('�', '-')            # dropped en-dash -> hyphen (house rule)
    s = s.replace('–', '-').replace('—', '-')
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def parse(pdf, first=1, last=60, max_topic=99):
    txt = subprocess.run(['pdftotext', '-layout', '-enc', 'UTF-8', '-f', str(first), '-l', str(last), pdf, '-'],
                         capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
    lines = txt.split('\n')
    topics = []
    expected = 1
    cur_t = cur_s = None
    in_obj = False
    obj_n = 0
    insec = False
    for raw in lines:
        line = clean(raw)
        if not line:
            continue
        if not insec:
            if SECTION.match(line):
                insec = True
            continue
        if '....' in line:
            continue
        if any(n in line for n in NOISE):
            continue
        if 'Candidates should be able to' in line:
            in_obj = True; obj_n = 0; continue
        # stop when the assessment section begins after we've collected topics
        if topics and re.match(r'^\d+\s+(Details of the assessment|Practical assessment|Additional information|Appendix)', line):
            break
        m = SUBTOPIC.match(line)
        if m and cur_t is not None:
            cur_s = {'code': m.group(1), 'name': clean(m.group(2)), 'objectives': []}
            cur_t['subtopics'].append(cur_s); in_obj = False; continue
        m = TOPIC.match(line)
        if m:
            num = int(m.group(1)); name = clean(m.group(2))
            if num == expected and name[:1].isupper() and num <= max_topic:
                cur_t = {'code': str(num), 'name': name, 'subtopics': []}
                topics.append(cur_t); expected += 1; cur_s = None; in_obj = False
                continue
        if in_obj and cur_s is not None:
            mo = OBJ.match(line)
            if mo and mo.group(2) and int(mo.group(1)) == obj_n + 1:
                obj_n = int(mo.group(1)); cur_s['objectives'].append(clean(mo.group(2)))
            else:
                if cur_s['objectives']:
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
