"""Build the body-only local corpus from explicitly identified Sefaria export editions."""
import gzip, hashlib, json, pathlib, re, sqlite3, sys, tempfile, unicodedata, urllib.request, urllib.parse
from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf-8')

ROOT = pathlib.Path(__file__).resolve().parents[1]
AUDIT = json.loads((ROOT.parent / 'docs/research/shulchan-arukh-harav-audit.json').read_text(encoding='utf-8'))
CACHE = pathlib.Path(tempfile.gettempdir()) / 'sterni-shulchan-arukh-research'
OUT = ROOT / 'app/src/main/assets/sah'
OUT.mkdir(parents=True, exist_ok=True)

def normalize(s):
    return re.sub(r'[^\u05d0-\u05eaA-Za-z0-9]+', ' ', ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c))).strip()

def load(version):
    item = next(i for i in AUDIT['exports'] if i['title'] == 'Shulchan Arukh HaRav' and i['version'] == version)
    cached = CACHE / (hashlib.sha256((item['url'].replace('https://storage.googleapis.com/sefaria-export/', '')).encode()).hexdigest() + '.json')
    # Research cache filenames include the unescaped object path and timestamp.
    for path in CACHE.glob('*.json'):
        doc = json.loads(path.read_text(encoding='utf-8'))
        if doc.get('title') == item['title'] and doc.get('versionTitle') == version:
            raw = path.read_bytes()
            if hashlib.sha256(raw).hexdigest() == item['sha256']: return doc, item
    raw = urllib.request.urlopen(item['url'], timeout=60).read()
    assert hashlib.sha256(raw).hexdigest() == item['sha256'], 'Source snapshot changed; re-audit it'
    return json.loads(raw), item

def leaves(v, p=()):
    if isinstance(v, dict):
        for k, child in v.items(): yield from leaves(child, p+(k,))
    elif isinstance(v, list):
        for n, child in enumerate(v, 1): yield from leaves(child, p+(n,))
    elif isinstance(v, str) and v.strip(): yield p, v

def clean(html):
    s = BeautifulSoup(html, 'html.parser')
    for element in s.select('sup, img, script, style, [data-commentator], .footnote, .footnote-marker'): element.decompose()
    for element in list(s.find_all(True)):
        if element.name not in ('b', 'strong', 'i', 'em', 'br', 'p', 'div'): element.unwrap()
        else: element.attrs = {}
    clean_html = str(s)
    for br in s.find_all('br'): br.replace_with('\n')
    for block in s.find_all(['p', 'div']): block.append('\n')
    plain = re.sub(r'[ \t]+', ' ', s.get_text()).strip()
    plain = re.sub(r'\n[ \t]*\n+', '\n\n', plain)
    assert not re.search(r'<(?:sup|img)|data-commentator|class=', clean_html)
    return clean_html, plain

def gematria(s):
    values = dict(zip('אבגדהוזחטיכלמנסעפצקרשת', [1,2,3,4,5,6,7,8,9,10,20,30,40,50,60,70,80,90,100,200,300,400]))
    return sum(values.get(c, 0) for c in s)

base, base_meta = load('Kehot Publication Society')
vocal, vocal_meta = load('Vocalized Edition - Kehot Publication Society')
combined = dict(leaves(base['text']))
edition = {p: base['versionTitle'] for p in combined}
for p, value in leaves(vocal['text']): combined[p] = value; edition[p] = vocal['versionTitle']
assert len(combined) == 7147
catalog = json.loads((ROOT.parent/'docs/research/shulchan-arukh-harav-catalog.json').read_text(encoding='utf-8'))
topic_map = {}
for part in catalog['parts']:
    if part['heading'].startswith('קו'): continue
    for ti, topic in enumerate(part['topics']):
        for chapter in topic.get('chapters', []):
            tokens = chapter['heading'].split()
            n = gematria(tokens[1] if tokens[0] == 'סימן' else tokens[0])
            if part['heading'].startswith('אורח חיים'):
                branch = 'second' if ti == 0 and part['heading'].endswith('א') else 'main'
                topic_map[('oc', branch, n)] = (str(topic['id']), topic['heading'], part['heading'])
            elif part['heading'] == 'יורה דעה':
                topic_map[('yd', 'main', n)] = (str(topic['id']), topic['heading'], part['heading'])

schema_titles = {}
def walk_schema(node, path=()):
    for child in node.get('nodes', []):
        p = path + (child['enTitle'],)
        schema_titles[p] = child['heTitle']
        walk_schema(child, p)
walk_schema(base['schema'])

path = pathlib.Path(tempfile.gettempdir())/'sterni-sah-body-v1.sqlite'
if path.exists(): path.unlink()
db = sqlite3.connect(path)
db.executescript('''
PRAGMA user_version=1;
CREATE TABLE groups(id TEXT PRIMARY KEY,title TEXT NOT NULL,part TEXT NOT NULL,ord INTEGER NOT NULL);
CREATE TABLE chapters(id TEXT PRIMARY KEY,group_id TEXT NOT NULL,title TEXT NOT NULL,number INTEGER,ord INTEGER NOT NULL);
CREATE TABLE segments(id TEXT PRIMARY KEY,chapter_id TEXT NOT NULL,number INTEGER NOT NULL,html TEXT NOT NULL,text TEXT NOT NULL,edition TEXT NOT NULL,source_ref TEXT NOT NULL);
CREATE INDEX chapter_group ON chapters(group_id,ord);
CREATE INDEX segment_chapter ON segments(chapter_id,number);
CREATE VIRTUAL TABLE search USING fts4(segment_id,terms,tokenize=unicode61);
''')
group_ids = set(); chapter_ids = set(); order = 0
for p, raw in combined.items():
    html, text = clean(raw)
    if not text: raise ValueError('Empty body: '+str(p))
    root = p[0]
    if root == 'Orach Chayim':
        family = 'oc'; branch = {'':'main','Second Edition':'second','Last Edition':'last'}[p[1]]
        chapter_number = p[2]; section_number = p[3] if len(p)>3 else 1
        gid, group_title, part = topic_map.get((family, branch, chapter_number),
            ('oc-'+branch, schema_titles.get(p[:2]) or 'אורח חיים — סימנים נוספים', 'אורח חיים'))
        if branch == 'last': gid, group_title, part = 'oc-last','מהדורא בתרא','אורח חיים'
        cid = f'sah/oc/{branch}/{chapter_number}'
        chapter_title = f'סימן {chapter_number}'
    elif root == 'Yoreh Deah':
        family = 'yd'; branch = 'main' if p[1]=='' else 'interest'
        chapter_number = p[2] if branch=='main' else 0
        section_number = p[3] if len(p)>3 else p[2]
        gid, group_title, part = topic_map.get((family, branch, chapter_number),
            ('yd-'+branch, schema_titles.get(p[:2]) or 'יורה דעה', 'יורה דעה'))
        cid = f'sah/yd/{branch}/{chapter_number}'
        chapter_title = f'סימן {chapter_number}' if chapter_number else group_title
    elif root == 'Choshen Mishpat':
        branch = p[1]; gid = 'cm/'+branch; group_title = schema_titles[p[:2]]; part = 'חושן משפט'
        cid = 'sah/'+gid; chapter_number = 0; chapter_title = group_title; section_number = p[2]
    else:
        gid = 'introduction'; group_title = 'הקדמת בני המחבר'; part = 'הקדמה'
        cid = 'sah/introduction'; chapter_number = 0; chapter_title = group_title; section_number = p[1]
    if gid not in group_ids:
        db.execute('INSERT INTO groups VALUES(?,?,?,?)',(gid,group_title,part,len(group_ids))); group_ids.add(gid)
    if cid not in chapter_ids:
        # The original first bold heading supplies a meaningful chapter title, without inventing prose.
        heading = BeautifulSoup(html,'html.parser').find(['b','strong']) if section_number==1 else None
        if heading and chapter_number: chapter_title += ' · '+heading.get_text(strip=True).rstrip(':')
        db.execute('INSERT INTO chapters VALUES(?,?,?,?,?)',(cid,gid,chapter_title,chapter_number,order))
        chapter_ids.add(cid); order += 1
    sid = cid+'/'+str(section_number)
    ref_parts = ['Shulchan Arukh HaRav', *[str(v) for v in p if v!='']]
    source_ref = ', '.join(ref_parts)
    db.execute('INSERT INTO segments VALUES(?,?,?,?,?,?,?)',(sid,cid,section_number,html,text,edition[p],source_ref))
    chapter_title = db.execute('SELECT title FROM chapters WHERE id=?',(cid,)).fetchone()[0]
    db.execute('INSERT INTO search VALUES(?,?)',(sid,normalize(group_title+' '+chapter_title+' '+text)))

wiki_sources = []
db.execute('INSERT INTO groups VALUES(?,?,?,?)',('talmud-torah','הלכות תלמוד תורה','יורה דעה',len(group_ids)))
group_ids.add('talmud-torah')
for chapter_number, (revision, expected) in enumerate([(1405924,14),(1405923,13),(941700,8),(3011240,19)],1):
    target = CACHE/f'wikisource-talmud-torah-{revision}.json'
    if not target.exists():
        url='https://he.wikisource.org/w/api.php?'+urllib.parse.urlencode({'action':'parse','oldid':revision,'format':'json','prop':'text|revid'})
        request=urllib.request.Request(url,headers={'User-Agent':'Sterni-TextResearch/1.0'})
        target.write_bytes(urllib.request.urlopen(request,timeout=45).read())
    wiki=json.loads(target.read_text(encoding='utf-8'))['parse']
    assert wiki['revid']==revision
    soup=BeautifulSoup(wiki['text']['*'],'html.parser')
    headings=[h for h in soup.find_all(['h2','h3','h4']) if h.get_text().startswith('סעיף ')]
    assert len(headings)==expected
    cid=f'sah/talmud-torah/{chapter_number}'
    title=f'הלכות תלמוד תורה · פרק {chapter_number}'
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?)',(cid,'talmud-torah',title,0,order))
    chapter_ids.add(cid);order+=1
    for number, heading in enumerate(headings,1):
        container=heading.parent if 'mw-heading' in heading.parent.get('class',[]) else heading
        parts=[]
        for sibling in container.next_siblings:
            if getattr(sibling,'name',None) in ('h2','h3','h4') or (getattr(sibling,'name',None)=='div' and 'mw-heading' in sibling.get('class',[])): break
            if getattr(sibling,'name',None)=='p': parts.append(str(sibling))
        html,text=clean(''.join(parts));assert text, (chapter_number,number)
        sid=cid+'/'+str(number)
        reference=f'שולחן ערוך הרב הלכות תלמוד תורה פרק {chapter_number} סעיף {number}'
        db.execute('INSERT INTO segments VALUES(?,?,?,?,?,?,?)',(sid,cid,number,html,text,'Wikisource CC-BY-SA 4.0',reference))
        db.execute('INSERT INTO search VALUES(?,?)',(sid,normalize(title+' '+text)))
    wiki_sources.append({'chapter':chapter_number,'revision':revision,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'source':f'https://he.wikisource.org/w/index.php?oldid={revision}','license':'CC-BY-SA 4.0'})

db.commit()
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert db.execute('SELECT COUNT(*) FROM segments').fetchone()[0]==7201
assert db.execute('SELECT COUNT(*) FROM search WHERE terms MATCH ?',(normalize('שבת'),)).fetchone()[0]>0
records=[]
for table in ('groups','chapters','segments','search'):
    for row in db.execute('SELECT * FROM '+table):
        records.append(json.dumps({'table':table,'values':row},ensure_ascii=False,separators=(',',':')))
db.close()
raw = ('\n'.join(records)+'\n').encode('utf-8'); compressed = gzip.compress(raw,compresslevel=9,mtime=0)
(OUT/'corpus-v2.pack').write_bytes(compressed)
(OUT/'body-v1.pack').unlink(missing_ok=True)
(OUT/'body-v1.sqlite.gz').unlink(missing_ok=True) # AAPT transparently strips/decompresses .gz assets.
manifest = {'version':2,'schemaVersion':1,'format':'ndjson','segments':7201,'chapters':len(chapter_ids),'groups':len(group_ids),
    'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'gzipBytes':len(compressed),
    'title':'שולחן ערוך אדמו״ר הזקן','source':'ספריא · קה״ת', 'license':'CC-BY-NC',
    'scope':'גוף שולחן ערוך הרב מהמהדורה המנוקדת, עם השלמה מהמהדורה הלא־מנוקדת. ללא הערות, איורים וקונטרס אחרון.',
    'editions':[base_meta,vocal_meta], 'talmudTorahSources':wiki_sources}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in manifest.items() if k not in ['editions']},ensure_ascii=False))
