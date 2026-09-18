# Headings-only extractor for AS & A Level science-style syllabi. Pulls the
# Topic (N Title) -> Subtopic (N.M Title) tree and splits it into AS vs A2 at the
# "A Level subject content" heading (AS candidates study the topics before it; A2
# adds the ones after). Objectives are NOT extracted here (left for the objective
# parser or manual entry) - this is about a reliable, correct topic/subtopic tree.
import subprocess, re, json, sys

NOISE = ['www.cambridgeinternational.org', 'Back to contents', 'syllabus for', 'Cambridge International', 'Cambridge O Level']
TOPIC = re.compile(r'^(\d{1,2}) ([A-Z].+)$')
SUB = re.compile(r'^(\d{1,2}\.\d+) (.+)$')
AS_HDR = re.compile(r'^AS Level subject content$', re.I)
A_HDR = re.compile(r'^A Level subject content$', re.I)

def clean(s):
    s = s.replace('�', '-').replace('–', '-').replace('—', '-')
    return re.sub(r'\s+', ' ', s).strip()

def extract(pdf):
    txt = subprocess.run(['pdftotext','-layout','-enc','UTF-8',pdf,'-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
    cl = [clean(x) for x in txt.split('\n')]
    n = len(cl)
    def meaningful(j): return cl[j] and '....' not in cl[j] and not any(x in cl[j] for x in NOISE)
    def sub_follows(i, num):
        seen=0; j=i+1
        while j<n and seen<20:
            if meaningful(j):
                m=SUB.match(cl[j])
                if m: return int(m.group(1).split('.')[0])==num
                seen+=1
            j+=1
        return False
    topics=[]; cur=None; started=False; a2=False; expected=1
    for i in range(n):
        line=cl[i]
        if not line: continue
        if AS_HDR.match(line): started=True; continue
        if A_HDR.match(line): a2=True; continue     # everything after is A2
        if not started: continue
        if '....' in line or any(x in line for x in NOISE): continue
        if re.match(r'^\d+ (Details of the assessment|Practical assessment|Additional information|Appendix)', line): break
        ms=SUB.match(line)
        if ms and cur is not None:
            cur['subtopics'].append({'code':ms.group(1),'name':clean(ms.group(2)),'objectives':[]}); continue
        mt=TOPIC.match(line)
        if mt:
            num=int(mt.group(1))
            if num>=expected and sub_follows(i,num):
                cur={'code':str(num),'name':clean(mt.group(2)),'subtopics':[],'level':'a2' if a2 else 'as'}
                topics.append(cur); expected=num+1
    as_t=[t for t in topics if t['level']=='as']
    a2_t=[t for t in topics if t['level']=='a2']
    for t in topics: t.pop('level',None)
    return as_t, a2_t

if __name__=='__main__':
    pdf=sys.argv[1]
    ast,a2t=extract(pdf)
    def stat(ts): return f"{len(ts)} topics, {sum(len(t['subtopics']) for t in ts)} subtopics"
    print('AS:', stat(ast)); print('A2:', stat(a2t))
    for t in ast: print('  AS',t['code'],t['name'],f"[{len(t['subtopics'])}]")
    if len(sys.argv)>2:
        json.dump({'as':ast,'a2':a2t}, open(sys.argv[2],'w',encoding='utf-8'), ensure_ascii=False, indent=1)
        print('WROTE',sys.argv[2])
