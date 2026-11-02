// ETL bước 2 (Node): knowledge_inventory.json + db/etl/out/prepared.json → TiDB/MySQL.
// Chạy (từ web/):  DEMO_PASSWORD=... node db/etl/etl.js [--reset]
//   --reset : xóa CÁC BẢNG/VIEW CỦA LƯỢC ĐỒ NÀY (đọc tên từ schema.sql) rồi tạo lại từ schema.sql.
// Kết nối: .env ở web/ hoặc thư mục cha (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '../..');
const ROOT = path.resolve(WEB, '..');
for (const p of [path.join(WEB, '.env'), path.join(ROOT, '.env')]) if (fs.existsSync(p)) { dotenv.config({ path: p, quiet: true }); break; }

const RESET = process.argv.includes('--reset');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD) { console.error('Thiếu biến môi trường DEMO_PASSWORD (mật khẩu demo – không ghi vào file).'); process.exit(1); }

const K = JSON.parse(fs.readFileSync(path.join(ROOT, 'ASS3_Pha0-1/knowledge_inventory.json'), 'utf8'));
const PEOPLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'ASS3_Pha0-1/sim/people.json'), 'utf8'));
const PREP = JSON.parse(fs.readFileSync(path.join(HERE, 'out/prepared.json'), 'utf8'));
const SCHEMA = fs.readFileSync(path.join(WEB, 'db/schema.sql'), 'utf8');

// ---------- tiện ích ----------
const strip = ({ _src, ...rest }) => rest;
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const SCHOOL = { Pythagoras: 'PY', Kabala: 'KB', Vedic: 'VE', 'Vệ Đà': 'VE' };
const ENV = {
  'Leadership & autonomy': ['LEAD', 'Lãnh đạo & tự chủ'],
  'Collaboration & people': ['COLLAB', 'Hợp tác & con người'],
  'Creativity & expression': ['CREATE', 'Sáng tạo & biểu đạt'],
  'Structure, expertise & depth': ['STRUCT', 'Cấu trúc, chuyên môn & chiều sâu'],
};
const env = (name) => { if (!ENV[name]) throw new Error('Env lạ: ' + name); return ENV[name][0]; };
const SKILL_VI = { // nhãn thân thiện – lấy từ src/i18n.js của web cũ
  SK01: 'Chủ động, tự chủ, lãnh đạo, ra quyết định', SK02: 'Lắng nghe, kết nối, hòa giải, điều phối',
  SK03: 'Giao tiếp, kể chuyện, thuyết trình, tạo nội dung', SK04: 'Tổ chức, lập kế hoạch, kiểm soát quy trình, kiên trì',
  SK05: 'Thích nghi, ứng biến, trải nghiệm', SK06: 'Hỗ trợ, hướng dẫn, chăm sóc người khác',
  SK07: 'Phân tích sâu, quan sát, nghiên cứu, tự học', SK08: 'Quản lý nguồn lực, tài chính, đàm phán',
  SK09: 'Thấu cảm, tầm nhìn rộng, phục vụ cộng đồng', SK11: 'Thấu hiểu người, tạo ý tưởng, truyền động lực',
  SK22: 'Biến tầm nhìn thành hệ thống, quản lý dự án lớn', SK33: 'Dẫn dắt bằng thấu cảm, giáo dục, chữa lành',
};
const skillCode = (n) => `SK${String(n).padStart(2, '0')}`;
/** "Nguyễn Gia Hà" → "N. G. Hà" (che tên trên màn hình tổng hợp). */
export const maskName = (full) => {
  const w = full.trim().split(/\s+/);
  return w.length < 2 ? w[0] : [...w.slice(0, -1).map((x) => x[0].toUpperCase() + '.'), w.at(-1)].join(' ');
};
const PERSONA = (s) => (s.startsWith('Học sinh') ? 'HS' : s.startsWith('Phụ huynh') ? 'PH' : 'TVV');
const LABEL = (s) => (s ? String(s).replace(/\s*\(.*\)$/, '') : null);
// Nguồn trích dẫn: nhận diện tác giả trong ghi chú nguồn (không suy diễn ngoài văn bản gốc)
const AUTHOR_KEYS = [['S01', /Phillips/i], ['S02', /Johari/i], ['S03', /Sepharial/i], ['S04', /Quỳnh Hương|\bQH\b/],
  ['S05', /Decoz/i], ['S06', /Santhanam|BPHS/i], ['S07', /Kaplan|Sefer/i]];
const citesOf = (text) => (text ? AUTHOR_KEYS.filter(([, re]) => re.test(text)).map(([c]) => c) : []);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 4000), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME, multipleStatements: true,
  supportBigNumbers: true, bigNumberStrings: true, dateStrings: true,
  ssl: process.env.DB_SSL === 'false' ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: true },
});
const insert = async (table, rows) => {
  if (!rows.length) return 0;
  const cols = Object.keys(rows[0]);
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => cols.map((c) => {
      const v = r[c]; return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
    }));
    await conn.query(`INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES ?`, [chunk]);
  }
  return rows.length;
};

// ---------- 0. reset + DDL ----------
const ourTables = [...SCHEMA.matchAll(/CREATE TABLE (\w+)/g)].map((m) => m[1]);
const ourViews = [...SCHEMA.matchAll(/CREATE VIEW (\w+)/g)].map((m) => m[1]);
const [existing] = await conn.query('SELECT table_name n FROM information_schema.tables WHERE table_schema = DATABASE()');
const foreign = existing.map((r) => r.n).filter((n) => !ourTables.includes(n) && !ourViews.includes(n));
if (foreign.length) { console.error('DB có bảng lạ, dừng để an toàn:', foreign); process.exit(1); }
if (existing.length && !RESET) { console.error(`DB đã có ${existing.length} bảng của lược đồ. Thêm --reset để nạp lại từ đầu.`); process.exit(1); }
await conn.query('SET FOREIGN_KEY_CHECKS = 0');
for (const v of ourViews) await conn.query(`DROP VIEW IF EXISTS \`${v}\``);
for (const t of ourTables) await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
await conn.query('SET FOREIGN_KEY_CHECKS = 1');
for (const stmt of SCHEMA.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) await conn.query(stmt);
console.log(`DDL: ${ourTables.length} bảng, ${ourViews.length} view`);

await conn.beginTransaction();
try {
  // ---------- 1. tri thức nguồn ----------
  await insert('school', [
    { code: 'PY', name_vi: 'Pythagoras', name_en: 'Pythagorean', main_source: 'S01' },
    { code: 'KB', name_vi: 'Kabala', name_en: 'Kabbalah (Sepharial)', main_source: 'S03' },
    { code: 'VE', name_vi: 'Vệ Đà', name_en: 'Vedic', main_source: 'S02' },
  ]);
  // URL điểm chuẩn → mã W2024, W2025… (nếu một năm có >1 URL thì thêm a, b…)
  const webRows = []; const urlCode = {}; const perYear = {};
  for (const r of K.admission_pilot) for (const y of ['2024', '2025', '2026']) {
    const url = r[`Nguồn ${y}`]; if (!url || urlCode[url]) continue;
    perYear[y] = (perYear[y] || 0) + 1; urlCode[url] = perYear[y] === 1 ? `W${y}` : `W${y}${String.fromCharCode(96 + perYear[y])}`;
    webRows.push({ code: urlCode[url], kind: 'web', author: null, title: `Điểm chuẩn ĐH Công nghiệp Hà Nội ${y}`, role_in_dss: 'Admission_Pilot', used_for: 'KPI khả năng đỗ', locator: url, src_ref: 'v6 › Admission_Pilot' });
  }
  await insert('source_book', [...K.sources.map((s) => ({
    code: s.Source_ID, kind: /team/i.test(s.Author) ? 'team' : 'book', author: s.Author, title: s['Title / edition'],
    role_in_dss: s['Role in DSS'], used_for: s['Used for'], locator: s['Locator / note'], src_ref: s._src,
  })), ...webRows, ...PREP.evidence.map((e) => ({ code: e.code, kind: 'evidence', author: null, title: e.title,
    role_in_dss: 'Bằng chứng xếp hạng tiêu chí cho trọng số persona', used_for: 'persona_weight (bộ A, B)', locator: null, src_ref: e.src }))]);
  await insert('glossary', PREP.glossary.map((g) => ({ term: g.term, group_code: g.group, full_name: g.full, plain_vi: g.plain,
    plain_en: null, appears_in: g.appears.slice(0, 200), src_ref: g.src })));
  await insert('letter_mapping', [
    ...K.letter_mapping.map((r) => ({ letter: r.Letter, is_digraph: false, pythagorean: num(r['Pythagorean/Phillips']),
      vedic_unit: num(r['Vedic Unit System used here (= Pythagorean; Johari table image missing in PDF – unverified)']),
      hebraic: num(r['Kabala – Sepharial Hebraic value (p.30)']), is_vowel: r['Vowel/Consonant rule (Y = consonant, Phillips p.173)'] === 'Vowel',
      note: r.Letter === 'Y' ? 'Y = phụ âm (Phillips tr.173); biến thể Y nguyên âm chỉ dùng trong What-if' : null, src_ref: r._src })),
    ...K.digraphs.map((r) => ({ letter: r.Letter.slice(0, 2), is_digraph: true, pythagorean: null, vedic_unit: null,
      hebraic: num(r['Kabala – Sepharial Hebraic value (p.30)']), is_vowel: false,
      note: `Pythagoras: ${r['Pythagorean/Phillips']}. ${r['Vowel/Consonant rule (Y = consonant, Phillips p.173)']}`, src_ref: r._src })),
  ]);
  const ruleSchool = (s) => SCHOOL[s] ?? null;
  await insert('calc_rule', K.calculation_rules.map((r) => ({ code: r.Rule_ID, school_code: ruleSchool(r.School), indicator: r.Indicator,
    pseudocode: r['Pseudocode / Formula'], example: r.Example, source_note: r['Source note'], src_ref: r._src })));
  const FRULE = { 'F-PY00': 'PY00', 'F-G1': 'PY01', 'F-G2': 'VE01', 'F-G4': 'KB03', 'F-G5': 'PY07', 'F-SU': 'PY05', 'F-G6': 'KB04' };
  await insert('formula', K.formulas.map((f) => ({ code: f.code, layer: f.layer, name_vi: f.name, expr: f.expr, explain_vi: null,
    rule_code: FRULE[f.code] ?? null, src_ref: f.src })));

  // ---------- 2. ánh xạ ----------
  await insert('env_code', Object.entries(ENV).map(([en, [code, vi]]) => ({ code, name_en: en, name_vi: vi })));
  await insert('archetype', K.archetypes.map((a) => ({ code: a.Archetype_Code, number: num(a.Number),
    trait: a['Trait text (exact, as in Major_Data)'], skill_cluster: a['Skill cluster text (exact)'], motivation: a['Motivation text (exact)'],
    typical_env: env(a['Typical environment (most frequent in Major_Data)']), link_text: a['Link from student numerology indicator'],
    evidence: a.Evidence, status: /^Inferred/.test(a.Status) ? 'Suy luận – chờ xác nhận (Data_Gap #11)' : a.Status, src_ref: a._src })));
  await insert('number_archetype_map', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22, 33].map((n) => ({ number: n, archetype_no: n === 10 ? 1 : n,
    rule_note: n === 10 ? 'Phillips không có Ruling 1 – số 10 thay cho 1' : n >= 11 ? 'Master number giữ nguyên' : 'giữ nguyên',
    src_ref: 'v6 › Trace_Dashboard › E55:E60 (F-ARCH)' })));
  await insert('number_meaning', K.number_meanings.map((r) => ({ school_code: SCHOOL[r.School], number: r.Number === '22/4' ? 22 : num(r.Number),
    indicator: r['Indicator/Layer'], meaning: r['Meaning / interpretation'], vocations: r['Suitable vocations (source)'],
    archetype_code: r['Archetype link (Number_Archetype_Map)'] || null, dss_use: r['DSS use'], source_note: r.Source, src_ref: r._src })));
  await insert('skill', K.archetypes.map((a) => ({ code: a.Skill_Code, archetype_no: num(a.Number), name_vi: SKILL_VI[a.Skill_Code],
    description: a['Skill cluster text (exact)'] })));
  await insert('major_profile', K.major_profiles.map((p, i) => ({ id: p.Profile_ID, sort_order: i + 1, env_code: env(p.Env_Code), name_vi: null,
    example_majors: p['Ngành ví dụ (≤4)'], major_groups: p['Nhóm ngành'], src_ref: p._src })));
  await insert('profile_signal', K.major_profiles.flatMap((p) => [p['A1 (chính)'], p.A2, p.A3].map((a, i) => ({ profile_id: p.Profile_ID, position: i + 1, archetype_no: num(a) }))));
  await insert('major', K.majors.map((m) => ({ id: num(m.ID), category: m['Major Category'], name_vi: m['Academic Major'].trim(),
    traits: m['Suitable Personality Traits'], competencies: m['Dominant Competencies & Skills'], motivations: m['Intrinsic Motivations'],
    ideal_env_text: m['Ideal Work Environment'], skill_codes: m.Skill_Codes, env_code: env(m.Env_Code), profile_id: m.Profile_ID, src_ref: m._src })));
  await insert('admission_benchmark', K.admission_pilot.map((r) => ({ major_id: num(r['Major ID (Major_Data)']), haui_name: r['Ngành (HaUI)'], haui_code: String(r['Mã']),
    combos_2026: r['Tổ hợp 2026'], has_A00: !!r.A00, has_A01: !!r.A01, has_D01: !!r.D01, has_B00: !!r.B00,
    cutoff_2024: num(r['ĐC 2024']), cutoff_2025: num(r['ĐC 2025']), cutoff_2026: num(r['ĐC 2026']), delta_used: num(r['Δ dùng']),
    mapping_note: r['Ghi chú ánh xạ'], src_2024: urlCode[r['Nguồn 2024']] ?? null, src_2025: urlCode[r['Nguồn 2025']] ?? null,
    src_2026: urlCode[r['Nguồn 2026']] ?? null, src_ref: r._src })));

  // trích dẫn (nhận diện tác giả trong ghi chú nguồn gốc)
  const [nmRows] = await conn.query('SELECT id, source_note FROM number_meaning');
  await insert('citation', [
    ...K.calculation_rules.flatMap((r) => citesOf(r['Source note']).map((s) => ({ source_code: s, target_type: 'calc_rule', target_key: r.Rule_ID, locator: null, note: r['Source note'] }))),
    ...nmRows.flatMap((r) => citesOf(r.source_note).map((s) => ({ source_code: s, target_type: 'number_meaning', target_key: String(r.id), locator: null, note: r.source_note }))),
    ...K.admission_pilot.flatMap((r) => ['2024', '2025', '2026'].filter((y) => urlCode[r[`Nguồn ${y}`]]).map((y) => ({ source_code: urlCode[r[`Nguồn ${y}`]], target_type: 'admission', target_key: String(num(r['Major ID (Major_Data)'])), locator: `ĐC ${y}`, note: null }))),
  ]);

  // ---------- 3. mô hình ----------
  const P = PREP.params;
  const SETS = [
    { code: 'v6', method: 'Nhóm ASS2 (v6)', normalize: false, isDefault: false, note: 'Trọng số ASS2 – chỉ để so sánh trong What-if' },
    { code: 'A', method: 'ROC (rank-order centroid)', normalize: true, isDefault: true, note: 'Mặc định ASS3 (quyết định nhóm 02/11/2026)' },
    { code: 'B', method: 'α = 1/3 cố định + centroid SR/ENV', normalize: true, isDefault: false, note: 'Bộ so sánh B – α = 1/3 là giả định thiết kế, không có tài liệu (Phụ lục B3.1); chỉ để so sánh trong What-if' },
  ];
  const setId = {};
  for (const s of SETS) {
    const [r] = await conn.query(`INSERT INTO parameter_set (code, version, status, is_default, method, normalize_minmax, p1, p2, p3, ec_min, sr_min, weak_max, note, activated_at, src_ref)
      VALUES (?, 1, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [s.code, s.isDefault, s.method, s.normalize, P.p[0], P.p[1], P.p[2], P.EC_min, P.SR_min, P.Weak_max, s.note, 'v6 › Parameters › B4:B24; Trace_Dashboard › A164:G173']);
    setId[s.code] = r.insertId;
  }
  const SG = Object.fromEntries(K.signal_groups.map((g) => [g.code, g]));
  await insert('signal_group', [
    ...['G1', 'G2', 'G4', 'G5', 'G6'].map((c) => ({ code: c, name_vi: SG[c].name, school_code: SCHOOL[SG[c].school], rule_code: SG[c].rule.split(' ')[0],
      formula_code: `F-${c}`, in_nf: true, src_ref: SG[c]._src })),
    { code: 'SU', name_vi: 'Soul Urge (chỉ dùng cho SAT)', school_code: 'PY', rule_code: 'PY05', formula_code: 'F-SU', in_nf: false, src_ref: 'v6 › Trace_Dashboard › B44:B46' },
  ]);
  await insert('signal_weight', SETS.flatMap((s) => Object.entries(P.w).map(([g, w]) => ({ param_set_id: setId[s.code], group_code: g, w }))));
  // thứ hạng tiêu chí + mã bằng chứng lấy từ Phụ lục B3.1 (bảng 7), vd 'ENV > SR > NF (E2, E3, E10)'
  const PE = Object.fromEntries(Object.entries(PREP.persona_evidence).map(([pe, txt]) => {
    const m = txt.match(/^(.*?)\s*\((.*)\)\s*$/); return [pe, { rank: m[1], ev: m[2] }];
  }));
  const EXPR = { A: { HS: '1/9 · 5/18 · 11/18', PH: '1/6 · 2/3 · 1/6', TVV: '1/6 · 5/12 · 5/12' },
    B: { HS: '1/3 · 1/6 · 1/2', PH: '1/3 · 1/2 · 1/6', TVV: '1/3 · 1/3 · 1/3' } };
  await insert('persona_weight', K.weight_sets.map((w) => ({ param_set_id: setId[w.set], persona: w.persona, alpha: w.alpha, beta: w.beta, gamma: w.gamma,
    expr: EXPR[w.set]?.[w.persona] ?? null, criteria_rank: w.set === 'v6' ? null : PE[w.persona].rank,
    evidence: w.set === 'v6' ? 'Nhóm ASS2 (không có thứ hạng tài liệu)' : PE[w.persona].ev })));
  const expandE = (s) => s.split(/,\s*/).flatMap((x) => { const m = x.match(/^E(\d+)–E(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => `E${+m[1] + i}`) : [x]; });
  await insert('citation', ['A', 'B'].flatMap((set) => Object.entries(PE).flatMap(([pe, { rank, ev }]) => expandE(ev).map((e) => ({
    source_code: e, target_type: 'persona_weight', target_key: `${set}:${pe}`, locator: 'Phụ lục B3.1', note: `Thứ hạng ${rank}` })))));
  await insert('citation', [['E11', 'F-ROC'], ['E12', 'F-ROC'], ['E10', 'F-C']].map(([e, f]) => ({ source_code: e, target_type: 'formula', target_key: f,
    locator: 'Phụ lục B3.1–B3.2', note: e === 'E10' ? 'Thần số học không có giá trị dự báo khoa học' : 'Trọng số ROC / hiệu ứng phạm vi' })));
  await insert('label_rule', SETS.flatMap((s) => K.label_rules.map((l) => ({ param_set_id: setId[s.code], seq: l.order, cond_text: l.cond, label: l.label, src_ref: l._src }))));
  const WD_VI = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
  await insert('weekday_map', K.weekday_map.map((w) => ({ iso_weekday: w.excel_weekday, name_vi: WD_VI[w.excel_weekday], name_en: w.weekday, planet: w.planet, key_number: w.key, src_ref: w._src })));
  const QCODE = { 'Tổng': 'C', 'Bước 5': 'STEP5' };
  const qSeen = new Set();
  await insert('decision_question', K.kpi_chain.filter((r) => !qSeen.has(r.Q) && qSeen.add(r.Q)).map((r) => ({ code: QCODE[r.Q] ?? r.Q,
    users_text: r['Người dùng & đặc điểm'], question_vi: r['Câu hỏi quyết định'], criterion: r['Tiêu chí'], output_text: r['Khuyến nghị đầu ra'], src_ref: r._src })));
  await insert('kpi', [
    { code: 'K_LABEL', name_vi: 'Nhãn khuyến nghị của Top-1', question_code: 'C', formula_code: 'F-LABEL', unit: null, description: 'Luật nhãn theo thứ tự', sort_order: 1 },
    { code: 'K_EC', name_vi: 'Số nhóm tín hiệu ủng hộ Top-1 (EC)', question_code: 'Q1', formula_code: 'F-EC', unit: '/5', description: 'EC_min = 2', sort_order: 2 },
    { code: 'K_SR', name_vi: 'Mức sẵn sàng kỹ năng (SR)', question_code: 'Q2', formula_code: 'F-SR', unit: '0–1', description: 'SR_min = 0,625; 0,5 ⇔ điểm TB 3/5', sort_order: 3 },
    { code: 'K_WEAK', name_vi: 'Số kỹ năng yếu', question_code: 'Q2', formula_code: 'F-WEAK', unit: 'kỹ năng', description: 'Weak_max = 2', sort_order: 4 },
    { code: 'K_STAB', name_vi: 'Độ ổn định Top-1 qua 5 cấu hình', question_code: 'C', formula_code: null, unit: '/5', description: 'Từ sensitivity_result (3 persona, chỉ Pythagoras, vị trí bằng nhau)', sort_order: 5 },
    { code: 'K_ADMIT', name_vi: 'Khả năng đỗ (18 ngành HaUI)', question_code: 'STEP5', formula_code: 'F-ADM', unit: null, description: 'Biên = điểm thi − điểm chuẩn so với Δ', sort_order: 6 },
  ]);
  const TH = [
    ['K_LABEL', 'green', null, null, 'Ưu tiên', 'Luật nhãn'], ['K_LABEL', 'yellow', null, null, 'Cân nhắc', 'Luật nhãn'], ['K_LABEL', 'red', null, null, 'Thử thách; Không đề xuất', 'Luật nhãn'],
    ['K_EC', 'green', 2, null, null, 'EC_min'], ['K_EC', 'yellow', 1, 2, null, 'EC = 1'], ['K_EC', 'red', null, 1, null, 'EC = 0'],
    ['K_SR', 'green', 0.625, null, null, 'SR_min'], ['K_SR', 'yellow', 0.5, 0.625, null, '0,5 ⇔ TB 3/5'], ['K_SR', 'red', null, 0.5, null, '< TB 3/5'],
    ['K_WEAK', 'green', null, 1, null, '0 kỹ năng yếu'], ['K_WEAK', 'yellow', 1, 2, null, '1 kỹ năng yếu'], ['K_WEAK', 'red', 2, null, null, '≥ 2 kỹ năng yếu'],
    ['K_STAB', 'green', 5, null, null, '5/5 cấu hình'], ['K_STAB', 'yellow', 3, 5, null, '3–4/5'], ['K_STAB', 'red', null, 3, null, '≤ 2/5'],
    ['K_ADMIT', 'green', null, null, 'An toàn', 'Biên ≥ Δ'], ['K_ADMIT', 'yellow', null, null, 'Vừa sức', '0 ≤ Biên < Δ'],
    ['K_ADMIT', 'red', null, null, 'Với cao; Khó', 'Biên < 0'], ['K_ADMIT', 'grey', null, null, 'Chưa có dữ liệu', 'Ngành ngoài pilot'],
  ];
  await insert('threshold', SETS.flatMap((s) => TH.map(([k, level, mn, mx, txt, why]) => ({ param_set_id: setId[s.code], kpi_code: k, level,
    min_value: mn, max_value: mx, match_text: txt, rationale: why + ' (mục 1.5 – nhóm duyệt D10)' }))));
  const VR = (code, level, cond, msg, params = null) => ({ code, level, condition_text: cond, message_vi: msg, message_en: null, params_json: params, src_ref: 'ASS3 Pha 0–1 › mục 1.7; CLAUDE.md' });
  await insert('validity_rule', [
    VR('V_DOB', 'yellow', 'năm sinh ngoài 2009–2011', 'Năm sinh ngoài dải dữ liệu 2009–2011', { year_min: 2009, year_max: 2011 }),
    VR('V_NAME_LEN', 'yellow', 'số âm tiết của tên ≠ 3', 'Tên không phải 3 âm tiết (dữ liệu chuẩn: 3)', { syllables: 3 }),
    VR('V_CHAR', 'yellow', 'tên có ký tự ngoài A–Z sau khi bỏ dấu', 'Tên có ký tự ngoài A–Z – đã bỏ khi tính'),
    VR('V_TZ', 'yellow', 'tên có chữ ghép TZ', 'Có chữ ghép TZ – áp KB04 (khác Excel v6)'),
    VR('V_MAJOR', 'red', 'ngành mục tiêu không có trong 300 ngành', 'Ngành mục tiêu không có trong 300 ngành – không chấm được'),
    VR('V_EC0', 'red', 'ngành/hồ sơ mục tiêu có EC = 0', 'Ngành mục tiêu EC = 0 – hồ sơ bị loại khỏi xếp hạng'),
    VR('V_EC1', 'yellow', 'Top-1 có EC = 1', 'Chỉ 1 nhóm tín hiệu ủng hộ – bằng chứng yếu'),
    VR('V_ONE_PROFILE', 'yellow', 'chỉ 1 hồ sơ có EC ≥ 1', 'Chỉ 1 hồ sơ đủ điều kiện – chuẩn hóa min–max mất ý nghĩa'),
    VR('V_CONFLICT', 'yellow', 'SR mục tiêu cao nhưng EC = 0', 'Xung đột: kỹ năng sẵn sàng cao nhưng không có tín hiệu thần số học – trình bày cả hai phía'),
    VR('V_TIE', 'grey', 'nhiều hồ sơ cùng C', 'Có hồ sơ hòa điểm – thứ tự do luật phá hòa (hồ sơ đứng trước)'),
    VR('V_SELF', 'grey', 'luôn', 'Kỹ năng là tự đánh giá (Data_Gap #6)'),
    VR('V_ADMIT', 'grey', 'ngành ngoài 18 ngành pilot', 'Chưa có dữ liệu điểm chuẩn cho ngành này'),
    VR('V_SIM', 'grey', 'luôn', 'Dữ liệu mô phỏng – thần số học không có giá trị dự báo khoa học (E10)'),
  ]);

  // mẫu câu "Vì sao?" – chỉ diễn giải công thức đã có (F-*), không thêm quy tắc thần số học mới
  const T = (code, layer, vi) => ({ code, layer, template_vi: vi, template_en: null });
  await insert('explanation_template', [
    T('WHY_C', 'L1', '{profile} có mức tương hợp tương đối {C}, xếp hạng {rank}/{n_ranked}. Đóng góp: thần số học α·NF* = {c_nf}, kỹ năng β·SR* = {c_sr}, môi trường γ·ENV* = {c_env}. Đây không phải xác suất thành công.'),
    T('WHY_NF', 'L1', '{ec}/5 nhóm tín hiệu khớp archetype của hồ sơ ({groups}). NF = {nf}.'),
    T('WHY_NF_NONE', 'L1', 'Không nhóm tín hiệu nào khớp archetype của hồ sơ (EC = 0) nên hồ sơ không được xếp hạng.'),
    T('WHY_SR', 'L1', 'Kỹ năng tự đánh giá cho 3 archetype của hồ sơ: {kn}. SR = {sr} ({sr_cmp} ngưỡng 0,625 ⇔ trung bình 3,5/5).'),
    T('WHY_ENV_YES', 'L1', 'Môi trường bạn mong muốn ({env}) trùng môi trường đặc trưng của hồ sơ.'),
    T('WHY_ENV_NO', 'L1', 'Môi trường bạn mong muốn ({env}) khác môi trường của hồ sơ ({profile_env}).'),
    T('LABEL_NONE', 'L1', 'Nhãn "Không đề xuất": luật 1 – EC = 0.'),
    T('LABEL_CHALLENGE', 'L1', 'Nhãn "Thử thách": luật 2 – có kỹ năng ≤ 2 ({weak}).'),
    T('LABEL_PRIORITY', 'L1', 'Nhãn "Ưu tiên": luật 3 – EC = {ec} ≥ 2 và SR = {sr} ≥ 0,625, không có kỹ năng yếu.'),
    T('LABEL_CONSIDER', 'L1', 'Nhãn "Cân nhắc": luật 4 – không có kỹ năng yếu nhưng chưa đạt EC ≥ 2 và SR ≥ 0,625 ({why}).'),
    T('BEST_PRIORITY', 'L0', 'Top-1 đang là "Thử thách". Hồ sơ "Ưu tiên" tốt nhất là {profile} (hạng {rank}).'),
    T('TIE', 'L1', '{n} hồ sơ cùng mức {C}; thứ tự giữa chúng do luật phá hòa (hồ sơ đứng trước trong danh sách 35 hồ sơ).'),
    T('STEP5', 'L1', 'Để {target} đạt "Ưu tiên": cần tăng {steps_weak} bậc ở kỹ năng yếu và bù {gap} điểm có trọng số tới SR_min (≈ {steps_main} bậc ở kỹ năng chính).'),
    T('STEP5_EC_LOW', 'L1', '{target}: tối đa "Cân nhắc" vì EC = {ec} < 2 – tín hiệu thần số học cố định, không cải thiện được bằng kỹ năng.'),
    T('STEP5_EC0', 'L1', '{target}: EC = 0 – không có tín hiệu thần số học ủng hộ (cố định).'),
    T('DISCLAIMER', 'L0', 'Hệ thống tham khảo trên dữ liệu mô phỏng. Thần số học không có giá trị dự báo khoa học (E10).'),
  ]);

  // ảnh chụp tri thức ảnh hưởng tới điểm
  const snapshot = {
    letters: K.letter_mapping.map((r) => [r.Letter, num(r['Pythagorean/Phillips']), num(r['Kabala – Sepharial Hebraic value (p.30)']), r['Vowel/Consonant rule (Y = consonant, Phillips p.173)'] === 'Vowel']),
    digraphs: { TH: 9, PH: 8, TZ: 9 },
    weekday: K.weekday_map.map((w) => [w.excel_weekday, w.key]),
    profiles: K.major_profiles.map((p) => [p.Profile_ID, [num(p['A1 (chính)']), num(p.A2), num(p.A3)], env(p.Env_Code)]),
    majors: K.majors.map((m) => [num(m.ID), m.Profile_ID]),
    number_archetype: { 10: 1 },
  };
  const snapJson = JSON.stringify(snapshot);
  await insert('kb_release', [{ label: 'v6-ETL-2026-11-02', content_hash: crypto.createHash('sha256').update(snapJson).digest('hex'),
    snapshot_json: snapJson, note: 'Nạp lần đầu từ knowledge_inventory.json (Excel v6)' }]);

  await insert('ref_document', [
    ...K.data_gap.map((r, i) => ({ doc_type: 'data_gap', item_key: String(num(r['#'])), seq: i + 1, content: strip(r), src_ref: r._src })),
    ...K.change_log.map((r, i) => ({ doc_type: 'change_log', item_key: r.Change_ID, seq: i + 1, content: strip(r), src_ref: r._src })),
    ...K.data_dictionary.map((r, i) => ({ doc_type: 'data_dictionary', item_key: `DD${String(i + 1).padStart(2, '0')}`, seq: i + 1, content: strip(r), src_ref: r._src })),
    ...K.major_data_dictionary.map((r, i) => ({ doc_type: 'major_data_dictionary', item_key: r.Field, seq: i + 1, content: strip(r), src_ref: r._src })),
    ...K.model_card_sheet.map((r, i) => ({ doc_type: 'model_card', item_key: `MC${String(i + 1).padStart(2, '0')}`, seq: i + 1, content: strip(r), src_ref: r._src })),
    ...K.member_contribution.map((r, i) => ({ doc_type: 'member_contribution', item_key: `M${i + 1}`, seq: i + 1, content: strip(r), src_ref: r._src })),
    ...K.sensitivity_summary.map((r, i) => ({ doc_type: 'sensitivity_summary', item_key: `v6:${i + 1}`, seq: i + 1, content: strip(r), src_ref: r._src })),
    ...['A', 'B'].flatMap((w, j) => Object.entries(PREP.sensitivity_summary[w]).map(([cfg, m], i) => ({ doc_type: 'sensitivity_summary',
      item_key: `${w}:${cfg}`, seq: 10 * (j + 1) + i, content: { set: w, config: cfg, keep_top1: m.keep, top3_overlap: m.ov, top3_full: m.full, top1_ec2: m.ec2, top1_c: m.c },
      src_ref: 'db/etl/prepare.py (engine.py, chạy lại 02/11/2026)' }))),
  ]);

  // ---------- 4. người dùng ----------
  const majorByName = new Map();
  for (const m of [...K.majors].sort((a, b) => num(a.ID) - num(b.ID))) { const k = m['Academic Major'].trim().toLowerCase(); if (!majorByName.has(k)) majorByName.set(k, num(m.ID)); }
  const SCOPE = { 'SIM-AD01': 'kb', 'SIM-AD02': 'major', 'SIM-AD03': 'auditor', 'SIM-AD04': 'system', 'SIM-AD05': 'demo' };
  const people = [
    ...PEOPLE.students.map((p) => ({ code: p.id, role: 'student', name: p.full_name })),
    ...PEOPLE.parents.map((p) => ({ code: p.id, role: 'parent', name: p.full_name })),
    ...PEOPLE.counselors.map((p) => ({ code: p.id, role: 'counselor', name: p.full_name })),
    ...PEOPLE.admins.map((p) => ({ code: p.id, role: 'admin', name: p.full_name })),
  ];
  for (const p of people) {
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await conn.query('INSERT INTO app_user (username, password_hash, role, admin_scope, display_name, person_code) VALUES (?, ?, ?, ?, ?, ?)',
      [p.code.toLowerCase(), hash, p.role, SCOPE[p.code] ?? null, p.role === 'admin' && /demo/i.test(p.name) ? p.name : maskName(p.name), p.code]);
  }
  const [users] = await conn.query('SELECT id, person_code FROM app_user');
  const uid = Object.fromEntries(users.map((u) => [u.person_code, u.id]));

  const GENDER = { Female: 'Nữ', Male: 'Nam', 'Nữ': 'Nữ', Nam: 'Nam' };
  const studentRows = [
    ...PREP.s300.map((s) => ({ id: s.id, dataset: 'ASS2_300', user_id: null, full_name: s.full_name, name_masked: maskName(s.full_name),
      gender: GENDER[s.gender] ?? 'Khác', dob: s.dob, grade: s.grade, school_year: s.school_year, preferred_env: env(s.env),
      top_strength_1: s.tops[0], top_strength_2: s.tops[1], top_strength_3: s.tops[2], target_major_text: null, target_major_id: null,
      edge_case: null, is_simulated: true, src_ref: s.src })),
    ...PEOPLE.students.map((p) => ({ id: p.id, dataset: 'SIM_120', user_id: uid[p.id], full_name: p.full_name, name_masked: maskName(p.full_name),
      gender: GENDER[p.gender] ?? 'Khác', dob: p.dob, grade: Number.isInteger(p.grade) ? p.grade : null /* 'Tự do (thi lại)' – E1 */, school_year: '2026-2027', preferred_env: env(p.env),
      top_strength_1: p.top_strength[0], top_strength_2: p.top_strength[1], top_strength_3: p.top_strength[2],
      target_major_text: p.target_major, target_major_id: majorByName.get(p.target_major.trim().toLowerCase()) ?? null,
      edge_case: p.edge_case || null, is_simulated: true, src_ref: 'ASS3_Pha0-1 › sim/people.json' })),
  ];
  await insert('student', studentRows);
  await insert('student_context', PEOPLE.students.map((p) => ({ student_id: p.id, school_name: p.school, province: p.province, region: p.region,
    school_type: p.school_type, area: p.area, ethnicity: p.ethnicity, income_band: p.income, family: p.family, birth_order: p.birth_order,
    academic_level: p.hoc_luc, interest: p.interest })));
  await insert('student_skill', [
    ...PREP.s300.flatMap((s) => Object.entries(s.skills).map(([a, lv]) => ({ student_id: s.id, skill_code: skillCode(a), level: lv }))),
    ...PEOPLE.students.flatMap((p) => Object.entries(p.skills).map(([a, lv]) => ({ student_id: p.id, skill_code: skillCode(a), level: lv }))),
  ]);
  await insert('student_exam', PEOPLE.students.flatMap((p) => Object.entries(p.exam || {}).map(([combo, score]) => ({ student_id: p.id, combo, score }))));
  const sigRows = (id, sig) => sig.map((g) => ({ student_id: id, group_code: g.g, raw_total: g.raw, value: g.v, archetype_no: g.a, trace_json: g.t, engine_version: PREP.engine_version }));
  await insert('student_signal', [...PREP.s300.flatMap((s) => sigRows(s.id, s.sig)), ...PREP.sim.map((s) => sigRows(s.person.id, s.sig)).flat()]);
  await insert('parent', PEOPLE.parents.map((p) => ({ id: p.id, user_id: uid[p.id], full_name: p.full_name, name_masked: maskName(p.full_name), relation: p.relation,
    child_id: p.child_id, occupation: p.occupation, social_group: p.social_group, income_band: p.income, education: p.education, attitude: p.attitude })));
  await insert('counselor', PEOPLE.counselors.map((c) => ({ id: c.id, user_id: uid[c.id], full_name: c.full_name, name_masked: maskName(c.full_name),
    role_title: c.role, organization: c.organization, years: c.years, numerology_view: c.numerology_view })));
  await insert('counselor_assignment', PEOPLE.counselors.flatMap((c) => c.assigned.map((s) => ({ counselor_id: c.id, student_id: s }))));

  // ---------- 5. kịch bản & kiểm thử ----------
  await insert('whatif_scenario', K.whatif_scenarios.map((w) => ({ code: w.ID, situation: w['Tình huống'], change_text: w['Kịch bản / thay đổi'], student_id: w['Học sinh'],
    persona: PERSONA(w.Persona), param_set_id: setId.v6,
    options_json: { flags: { G1: w.f_G1, G5: w.f_G5, G6: w.f_G6, G4: w.f_G4, G2: w.f_G2 }, positional: !!w.pm, y_vowel: !!w.Y, normalize_minmax: false,
      target_major: num(w['Ngành mục tiêu (ID)']), delta: Object.fromEntries(Object.keys(SKILL_VI).map((k) => [k, num(w[`Δ ${k}`]) ?? 0])) },
    expected_json: { top: [1, 2, 3].map((i) => ({ profile: w[`Top-${i} hồ sơ`], label: LABEL(w[`Top-${i} nhãn`]) })), top1_c: num(w['Top-1 C']),
      target: { major: w['Ngành mục tiêu'], profile: w['Hồ sơ mục tiêu'], c: num(w['C mục tiêu']), ec: num(w['EC mục tiêu']), sr: num(w['SR mục tiêu']),
        label: LABEL(w['Nhãn mục tiêu']), rank: num(w['Hạng mục tiêu (/35)']), sat: num(w['SAT mục tiêu']) }, top3_overlap_S1: num(w['Top-3 trùng với S1 (0–3)']) },
    interpretation: w['Diễn giải'], src_ref: w._src })));
  await insert('sensitivity_result', PREP.sensitivity.map((r) => ({ param_set_id: setId[r.set], student_id: r.student, config_code: r.cfg,
    top1_profile: r.top1, top3_overlap: r.overlap, top1_ec: r.ec, top1_c: r.c })));
  const ROLE = { 'Học sinh': 'student', 'Phụ huynh': 'parent', 'Tư vấn viên': 'counselor' };
  await insert('test_case', PREP.test_cases.map((t) => ({ code: t.code, role: ROLE[t.role] ?? 'admin',
    question_code: (t.question || '').match(/Q\d/)?.[0] ?? null, title_vi: t.action.slice(0, 200),
    steps: t.action.replace(/\b(hs|ph)(\d{3})\b/g, 'sim-$1$2') + (t.layer ? ` [${t.layer}]` : ''), expected: t.expected,
    persona_ref: t.action.match(/SIM-HS\d{3}/)?.[0] ?? (t.action.match(/\b(hs|ph)\d{3}\b/)?.[0] ? `SIM-${t.action.match(/\b(hs|ph)\d{3}\b/)[0].toUpperCase()}` : null) })));

  await conn.query(`INSERT INTO audit_log (action, table_name, row_key, after_json, param_set_id, kb_release_id, reason)
    SELECT 'INSERT', '*', 'ETL', JSON_OBJECT('source', 'knowledge_inventory.json + people.json + prepared.json'), ?, MAX(id), 'Nạp dữ liệu lần đầu (Pha 2)' FROM kb_release`, [setId.A]);
  await conn.commit();
} catch (e) { await conn.rollback(); console.error('ETL lỗi → rollback:', e.message); await conn.end(); process.exit(1); }

// ---------- 6. kiểm chứng ----------
const EXPECT = { school: 3, letter_mapping: 29, calc_rule: 20, formula: 25, number_meaning: 29, env_code: 4, archetype: 12, number_archetype_map: 13, skill: 12,
  major_profile: 35, profile_signal: 105, major: 300, admission_benchmark: 18, parameter_set: 3, signal_group: 6, signal_weight: 15, persona_weight: 9,
  label_rule: 12, weekday_map: 7, decision_question: 7, kpi: 6, threshold: 57, kb_release: 1, whatif_scenario: 12, sensitivity_result: 4500,
  app_user: 120, student: 375, student_context: 75, student_skill: 4500, student_exam: 300, student_signal: 2250, parent: 30, counselor: 10,
  counselor_assignment: 75, test_case: 18, glossary: 83, source_book: 25, explanation_template: 16 };
let fail = 0;
for (const [t, n] of Object.entries(EXPECT)) {
  const [[r]] = await conn.query(`SELECT COUNT(*) n FROM \`${t}\``);
  const ok = Number(r.n) === n; fail += !ok;
  console.log(`${ok ? '✓' : '✗'} ${t.padEnd(22)} ${String(r.n).padStart(5)}${ok ? '' : `  (cần ${n})`}`);
}
const extra = [
  ['letter_mapping: 26 chữ + 3 chữ ghép', "SELECT CONCAT(SUM(NOT is_digraph),'+',SUM(is_digraph)) v FROM letter_mapping", '26+3'],
  ['number_meaning PY/VE/KB', "SELECT GROUP_CONCAT(CONCAT(school_code,':',n) ORDER BY school_code) v FROM (SELECT school_code, COUNT(*) n FROM number_meaning GROUP BY school_code) x", 'KB:9,PY:11,VE:9'],
  ['app_user theo vai trò', "SELECT GROUP_CONCAT(CONCAT(role,':',n) ORDER BY role) v FROM (SELECT role, COUNT(*) n FROM app_user GROUP BY role) x", 'student:75,parent:30,counselor:10,admin:5'],
  ['bộ mặc định', "SELECT GROUP_CONCAT(code) v FROM parameter_set WHERE is_default", 'A'],
  ['HS mô phỏng không tìm được ngành mục tiêu', "SELECT GROUP_CONCAT(CONCAT(id,' \"',target_major_text,'\"')) v FROM student WHERE dataset='SIM_120' AND target_major_id IS NULL", 'SIM-HS073 "Y khoa"'],
  ['sensitivity A: % giữ Top-1 (PH)', "SELECT ROUND(AVG(s.top1_profile=b.top1_profile),4) v FROM sensitivity_result s JOIN sensitivity_result b ON b.student_id=s.student_id AND b.param_set_id=s.param_set_id AND b.config_code='BASE_HS' JOIN parameter_set p ON p.id=s.param_set_id WHERE p.code='A' AND s.config_code='PH'", null],
  ['citation', 'SELECT COUNT(*) v FROM citation', null],
  ['α bộ A, HS giữ đúng 1/9 (DOUBLE)', "SELECT CAST(w.alpha AS CHAR) v FROM persona_weight w JOIN parameter_set p ON p.id=w.param_set_id WHERE p.code='A' AND w.persona='HS'", String(1 / 9)],
  ['nguồn E1–E13 có trích dẫn', "SELECT COUNT(DISTINCT source_code) v FROM citation WHERE source_code LIKE 'E%'", '13'],
];
for (const [name, sql, want] of extra) {
  const [[r]] = await conn.query(sql); const v = String(r.v);
  const ok = want === null || (want.includes(',') ? want.split(',').sort().join(',') === v.split(',').sort().join(',') : v === want); fail += !ok;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${v}${ok || want === null ? '' : `  (cần ${want})`}`);
}
await conn.end();
console.log(fail ? `\n${fail} kiểm chứng KHÔNG đạt` : '\nTất cả kiểm chứng đạt');
process.exit(fail ? 1 : 0);
