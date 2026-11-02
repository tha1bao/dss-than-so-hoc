"""ETL bước 1 (Python): dùng ENGINE CHUẨN engine.py để tính tín hiệu + Sensitivity, gom mọi nguồn thành 1 file JSON.

Chạy (từ thư mục web/):  python db/etl/prepare.py
Cần: openpyxl (đọc KichBan_Test). Đầu ra: db/etl/out/prepared.json (không commit).
Kiểm chứng in ra màn hình:
  * 300 HS ASS2: G1/G2/G4/G5/G6/SU tính lại == giá trị trong Students_300 (Excel v6)
  * 75 HS mô phỏng: tín hiệu == people.json; Top-3 persona HS bộ A == people.json
  * Sensitivity v6 (không chuẩn hóa) tổng hợp == sheet Sensitivity của v6
"""
import json, sys, datetime as dt, collections, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]           # DSS301_Ass2/
P01 = ROOT / 'ASS3_Pha0-1'
sys.path.insert(0, str(P01 / 'engine'))
from engine import numerology, score, PARAMS, WEIGHTS  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')
K = json.load(open(P01 / 'knowledge_inventory.json', encoding='utf-8'))
PEOPLE = json.load(open(P01 / 'sim' / 'people.json', encoding='utf-8'))

LETTERS = {r['Letter']: (int(r['Pythagorean/Phillips']), int(r['Kabala – Sepharial Hebraic value (p.30)']),
                         r['Vowel/Consonant rule (Y = consonant, Phillips p.173)'] == 'Vowel') for r in K['letter_mapping']}
PROFILES = [dict(id=r['Profile_ID'], A=(int(r['A1 (chính)']), int(r['A2']), int(r['A3'])), env=r['Env_Code'])
            for r in K['major_profiles']]
SK = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]
K_WD = {r['excel_weekday']: r['key'] for r in K['weekday_map']}


def signals(full_name, dob):
    """engine.numerology + KB04 đầy đủ (TZ = 9 → trừ 2/TZ, quyết định D6) – giống sim/gen_people.py."""
    n = numerology(full_name, dob, LETTERS)
    tz = sum(w.count('TZ') for w in n['name_spaced'].split())
    n['TZ'] = tz
    if tz:
        n['heb_adj'] -= 2 * tz
        n['G6'] = (n['heb_adj'] - 1) % 9 + 1
        n['arch']['G6'] = n['G6']
    return n


def signal_rows(n):
    """6 dòng student_signal: (group, raw_total, value, archetype, trace)."""
    return [
        dict(g='G1', raw=n['ruling_raw'], v=n['G1'], a=n['arch']['G1'], t=dict(digits=n['digits'])),
        dict(g='G2', raw=n['day'], v=n['G2'], a=n['arch']['G2'], t=dict(day=n['day'])),
        dict(g='G4', raw=n['weekday'], v=n['G4'], a=n['arch']['G4'],
             t=dict(iso_weekday=n['weekday'], weekday=n['weekday_name'][0], planet=n['weekday_name'][1])),
        dict(g='G5', raw=n['name_total'], v=n['G5'], a=n['arch']['G5'], t=dict(name=n['name_spaced'])),
        dict(g='G6', raw=n['heb_adj'], v=n['G6'], a=n['arch']['G6'],
             t=dict(heb_total=n['heb_total'], TH=n['TH'], PH=n['PH'], TZ=n['TZ'])),
        dict(g='SU', raw=n['vowel_total'], v=n['soul_urge'], a=n['arch']['SU'], t={}),
    ]


# ---------------- 300 HS ASS2 ----------------
s300 = []
chk = collections.Counter(); bad = []
MAP = {'G1': 'py_ruling_number', 'G5': 'py_complete_name_number', 'G6': 'kab_name_key', 'G4': 'kab_day_key',
       'G2': 'vedic_psychic_number', 'soul_urge': 'py_soul_urge_number'}
for s in K['students_300']:
    dob = dt.date.fromisoformat(s['date_of_birth'][:10])
    n = signals(s['full_name'], dob)
    for k, col in MAP.items():
        if int(n[k]) == int(s[col]): chk[k] += 1
        else: bad.append((s['student_id'], k, n[k], s[col]))
    skills = {k: int(s[f'skill_SK{k:02d}']) for k in SK}
    tops = [int(str(s[f'top_strength_{i}'])[2:]) for i in (1, 2, 3)]
    s300.append(dict(id=s['student_id'], full_name=s['full_name'], gender=s['gender'], dob=str(dob), grade=int(s['grade']),
                     school_year=s['school_year'], env=s['preferred_work_env'], skills=skills, tops=tops,
                     n=n, sig=signal_rows(n), src=s['_src']))
print('300 HS – tín hiệu khớp Excel v6:', dict(chk), 'lệch:', bad[:5])

# ---------------- 75 HS mô phỏng ----------------
sim = []; sim_bad = []; top_bad = []
for s in PEOPLE['students']:
    n = signals(s['full_name'], dt.date.fromisoformat(s['dob']))
    for g in ('G1', 'G2', 'G4', 'G5', 'G6', 'SU'):
        if n['arch'][g] != s['arch'][g]: sim_bad.append((s['id'], g))
    skills = {int(k): v for k, v in s['skills'].items()}
    r = score(n['arch'], skills, s['env'], s['top_strength'], PROFILES, persona='HS', wset='A', normalize_mm=True)
    if [t['profile'] for t in r['top']] != [t['profile'] for t in s['result_HS']['top']]: top_bad.append(s['id'])
    sim.append(dict(person=s, n=n, sig=signal_rows(n)))
print('75 HS mô phỏng – tín hiệu lệch people.json:', sim_bad, '· Top-3 (HS, bộ A) lệch:', top_bad)

# ---------------- Sensitivity 300 × 5 × {v6, A, B} ----------------
CFGS = [('BASE_HS', dict(persona='HS')), ('PH', dict(persona='PH')), ('TVV', dict(persona='TVV')),
        ('PY_ONLY', dict(persona='HS', groups=('G1', 'G5'))), ('EQUAL_P', dict(persona='HS', params={**PARAMS, 'p': (1, 1, 1)}))]
sens = []; summ = {}
for wset, norm in (('v6', False), ('A', True), ('B', True)):
    agg = collections.defaultdict(lambda: collections.Counter())
    for s in s300:
        res = [(code, score(s['n']['arch'], s['skills'], s['env'], s['tops'], PROFILES, wset=wset, normalize_mm=norm, **cfg))
               for code, cfg in CFGS]
        base_top = res[0][1]['top']; base = {r['profile'] for r in base_top}
        for code, rs in res:
            t1 = rs['top'][0] if rs['top'] else None
            ov = len(base & {r['profile'] for r in rs['top']})
            sens.append(dict(set=wset, student=s['id'], cfg=code, top1=t1 and t1['profile'], overlap=ov,
                             ec=t1 and t1['EC'], c=t1 and round(t1['C'], 6)))
            a = agg[code]; a['n'] += 1; a['keep'] += int(t1['profile'] == base_top[0]['profile']); a['ov'] += ov
            a['full'] += int(ov == 3); a['ec2'] += int(t1['EC'] >= 2); a['c'] += t1['C']
    summ[wset] = {c: dict(keep=a['keep'] / a['n'], ov=a['ov'] / a['n'], full=a['full'] / a['n'], ec2=a['ec2'] / a['n'],
                          c=a['c'] / a['n']) for c, a in agg.items()}
# đối chiếu v6 với sheet Sensitivity (5 dòng tổng hợp, cùng thứ tự cấu hình)
ok = 0
for (code, _), row in zip(CFGS, K['sensitivity_summary']):
    m = summ['v6'][code]
    exp = (row['% HS giữ nguyên Top-1'], row['TB số hồ sơ Top-3 trùng (0–3)'], row['% HS Top-3 trùng hoàn toàn'],
           row['% HS Top-1 có EC ≥ 2'], row['TB C của Top-1'])
    got = (m['keep'], m['ov'], m['full'], m['ec2'], m['c'])
    same = all(abs(float(e) - g) < 1e-4 for e, g in zip(exp, got)); ok += same
    if not same: print('  lệch', code, exp, got)
print(f'Sensitivity v6 – tổng hợp khớp sheet Sensitivity: {ok}/5 cấu hình')
for w in ('A', 'B'):
    print(f'Sensitivity {w}:', {c: f"giữ Top-1 {m['keep']:.0%} · Top-3 trùng {m['ov']:.2f}" for c, m in summ[w].items()})

# ---------------- 18 kịch bản test ----------------
tcs = []
try:
    import openpyxl
    wb = openpyxl.load_workbook(P01 / 'DSS_ASS3_GiaLap_120_nguoi.xlsx', read_only=True)
    rows = list(wb['KichBan_Test'].iter_rows(values_only=True))
    for r in rows[1:]:
        if r and r[0]: tcs.append(dict(zip(['code', 'role', 'action', 'expected', 'layer', 'question'], r)))
except ImportError:
    print('!! thiếu openpyxl – bỏ qua test_case')
print('Kịch bản test:', len(tcs))

# ---------------- Phụ lục (docx): thuật ngữ A1–A5, nguồn E1–E13, persona → E ----------------
glossary, evidence, persona_e = [], [], {}
try:
    import docx, re
    d = docx.Document(next(ROOT.glob('Phụ lục ASS2 – Thuật ngữ & Công thức – Nhóm 2.docx')))
    for gi, t in enumerate(d.tables[:5], 1):
        for r in t.rows[1:]:
            c = [x.text.strip() for x in r.cells]
            glossary.append(dict(term=c[0], group=f'A{gi}', full=c[1], plain=c[2], appears=c[3],
                                 src=f'Phụ lục ASS2 (Nhóm 2) › A{gi}'))
    for p in d.paragraphs:
        m = re.match(r'^(.*)\s+–\s+(E\d{1,2})$', p.text.strip())
        if m: evidence.append(dict(code=m.group(2), title=m.group(1), src='Phụ lục ASS2 (Nhóm 2) › Tài liệu tham khảo'))
    for r in d.tables[6].rows[1:]:
        c = [x.text.strip() for x in r.cells]
        persona_e[{'Học sinh': 'HS', 'Phụ huynh': 'PH', 'Tư vấn viên': 'TVV'}[c[0]]] = c[1]
except ImportError:
    print('!! thiếu python-docx – bỏ qua glossary/E1–E13')
print(f'Phụ lục: {len(glossary)} thuật ngữ, {len(evidence)} nguồn E, persona→E {persona_e}')

# ---------------- Fixture hồi quy cho engine JS (tests/fixtures/engine_py.json) ----------------
def sig_dict(n):
    return {k: n[k] for k in ('G1', 'G2', 'G4', 'G5', 'G6', 'soul_urge', 'ruling_raw', 'name_total', 'vowel_total',
                              'heb_total', 'heb_adj', 'TH', 'PH', 'TZ', 'normalized')} | {'arch': n['arch']}
fx_students = [dict(id=s['id'], name=s['full_name'], dob=s['dob'], skills=s['skills'], tops=s['tops'], env=s['env'],
                    sig=sig_dict(s['n'])) for s in s300]
fx_students += [dict(id=x['person']['id'], name=x['person']['full_name'], dob=x['person']['dob'],
                     skills={int(k): v for k, v in x['person']['skills'].items()}, tops=x['person']['top_strength'],
                     env=x['person']['env'], sig=sig_dict(x['n'])) for x in sim]
CONFIGS = [(w, norm, pe) for w, norm in (('v6', False), ('A', True), ('B', True)) for pe in ('HS', 'PH', 'TVV')]
FULL_IDS = {s['id'] for s in fx_students[:25]} | {s['id'] for s in fx_students[300:]}
top3, full = {}, {}
for s in fx_students:
    top3[s['id']] = []
    for w, norm, pe in CONFIGS:
        r = score(s['sig']['arch'], s['skills'], s['env'], s['tops'], PROFILES, persona=pe, wset=w, normalize_mm=norm)
        top3[s['id']].append([[t['profile'], t['C'], t['label'], t['EC']] for t in r['top']])
        if s['id'] in FULL_IDS and (s['id'].startswith('HS') or w == 'A'):
            full[f"{s['id']}|{w}|{pe}"] = [[x['profile'], x['NF'], x['SR'], x['EC'], x['ENV'], x['C_raw'], x['C'], x['label'],
                                           x['rank'], x['SAT'], x['STR'], x['weak']] for x in r['rows']]
fx = dict(_note='Sinh bởi db/etl/prepare.py từ ASS3_Pha0-1/engine/engine.py (engine chuẩn). Dữ liệu mô phỏng.',
          kb=dict(letters={k: list(v) for k, v in LETTERS.items()}, digraphs={'TH': 9, 'PH': 8, 'TZ': 9},
                  weekdayKey={str(k): v for k, v in K_WD.items()}, profiles=[dict(id=p['id'], A=list(p['A']), env=p['env']) for p in PROFILES],
                  params=dict(w=PARAMS['w'], p=list(PARAMS['p']), EC_min=PARAMS['EC_min'], SR_min=PARAMS['SR_min'], Weak_max=PARAMS['Weak_max']),
                  weights={k: {pe: list(v) for pe, v in d.items()} for k, d in WEIGHTS.items()}),
          configs=CONFIGS, students=fx_students, top3=top3, full=full, sensitivity=sens)
fxp = Path(__file__).resolve().parents[2] / 'tests' / 'fixtures'; fxp.mkdir(parents=True, exist_ok=True)
json.dump(fx, open(fxp / 'engine_py.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
print(f'Fixture engine JS: {len(fx_students)} HS, {len(CONFIGS)} cấu hình, {len(full)} bảng đầy đủ → {fxp / "engine_py.json"}')

out = Path(__file__).parent / 'out'; out.mkdir(exist_ok=True)
json.dump(dict(engine_version='engine.py@v6A+KB04', s300=s300, sim=sim, sensitivity=sens, sensitivity_summary=summ,
               test_cases=tcs, weights=WEIGHTS, params=PARAMS, glossary=glossary, evidence=evidence, persona_evidence=persona_e),
          open(out / 'prepared.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
print('→', out / 'prepared.json')
