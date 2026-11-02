// Tầng L1–L2: họ tên + ngày sinh → tín hiệu G1, G2, G4, G5, G6, SU (+ các bước trung gian cho L5).
// Bản JS của ASS3_Pha0-1/engine/engine.py › numerology() + KB04 đầy đủ (TZ, quyết định D6).
// Tri thức (bảng chữ, chữ ghép, bảng thứ) truyền vào qua `kb` – không hard-code để Admin sửa được.

/** PY00 – Phillips: tối đa 2 lần, nếu n > 11 và n ≠ 22 thì n = ⌊n/10⌋ + n mod 10 (F-PY00, Trace B24:B25). */
export function py00(n) {
  for (let i = 0; i < 2; i++) if (!(n <= 11 || n === 22)) n = Math.floor(n / 10) + (n % 10);
  return n;
}
/** Soul Urge: rút gọn ≤ 11, không giữ 22 (F-SU, Trace B45:B46). */
export function suReduce(n) {
  for (let i = 0; i < 2; i++) if (n > 11) n = Math.floor(n / 10) + (n % 10);
  return n;
}
/** Căn số 1–9: (n − 1) mod 9 + 1 (mod kiểu Python, an toàn với n ≤ 0). */
export const root9 = (n) => ((((n - 1) % 9) + 9) % 9) + 1;
/** Số → archetype: 10 → 1 (F-ARCH). */
export const toArchetype = (n) => (n === 10 ? 1 : n);

/**
 * Chuẩn hóa tên (GEN): Đ → D, bỏ dấu, viết hoa, giữ ranh giới âm tiết, bỏ ký tự ngoài A–Z (D12, có cảnh báo).
 * @returns {{ words: string[], spaced: string, normalized: string, removed: string[], rawWordCount: number }}
 */
export function normalizeName(fullName) {
  const s = String(fullName).replace(/Đ/g, 'D').replace(/đ/g, 'd').normalize('NFD').replace(/\p{Mn}/gu, '').toUpperCase();
  const raw = s.split(/\s+/).filter(Boolean);
  const removed = [];
  const words = raw.map((w) => [...w].filter((c) => { const ok = c >= 'A' && c <= 'Z'; if (!ok) removed.push(c); return ok; }).join(''));
  return { words, spaced: words.join(' '), normalized: words.join(''), removed, rawWordCount: String(fullName).trim().split(/\s+/).filter(Boolean).length };
}

const countIn = (word, pair) => (word.match(new RegExp(pair, 'g')) || []).length;

/** Ngày dạng 'YYYY-MM-DD' → { y, m, d, iso } với iso 1 = Thứ Hai … 7 = Chủ nhật. */
export function parseDob(dob) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob));
  if (!m) throw new Error(`Ngày sinh không hợp lệ: ${dob}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) throw new Error(`Ngày sinh không tồn tại: ${dob}`);
  const wd = dt.getUTCDay();
  return { y, m: mo, d, iso: wd === 0 ? 7 : wd };
}

/**
 * @param {string} fullName  họ tên có dấu
 * @param {string} dob       'YYYY-MM-DD'
 * @param {object} kb        { letters: {A:[pyth, hebraic, isVowel]}, digraphs: {TH:9, PH:8, TZ:9}, weekdayKey: {1:2,…,7:1} }
 */
export function computeSignals(fullName, dob, kb) {
  const { y, m, d, iso } = parseDob(dob);
  const digits = `${String(d).padStart(2, '0')}${String(m).padStart(2, '0')}${y}`.split('').map(Number);
  const rulingRaw = digits.reduce((a, b) => a + b, 0);
  const G1 = py00(rulingRaw); // F-G1
  const G2 = root9(d); // F-G2
  const G4 = Number(kb.weekdayKey[iso]); // F-G4

  const nm = normalizeName(fullName);
  const chars = [...nm.normalized];
  const L = (c) => kb.letters[c];
  let nameTotal = 0, vowelTotal = 0, hebTotal = 0;
  for (const c of chars) { const [py, heb, vow] = L(c); nameTotal += py; hebTotal += heb; if (vow) vowelTotal += py; }
  const yCount = chars.filter((c) => c === 'Y').length;
  // KB04: chữ ghép đếm trong từng âm tiết; điều chỉnh = h(c1) + h(c2) − giá trị chữ ghép (TH 3, PH 8, TZ 2)
  const digraph = {};
  let hebAdj = hebTotal;
  for (const [pair, val] of Object.entries(kb.digraphs)) {
    const n = nm.words.reduce((s, w) => s + countIn(w, pair), 0);
    digraph[pair] = n;
    hebAdj -= n * (L(pair[0])[1] + L(pair[1])[1] - val);
  }
  const G5 = py00(nameTotal); // F-G5
  const soulUrge = suReduce(vowelTotal); // F-SU
  const soulUrgeY = suReduce(vowelTotal + yCount * L('Y')[0]); // biến thể "Y là nguyên âm" (What-if)
  const G6 = root9(hebAdj); // F-G6

  return {
    input: { dob: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, month: m, year: y, isoWeekday: iso },
    name: nm, digits, rulingRaw, nameTotal, vowelTotal, hebTotal, hebAdj, digraph, yCount,
    G1, G2, G4, G5, G6, soulUrge, soulUrgeY,
    arch: { G1: toArchetype(G1), G5: toArchetype(G5), G6, G4, G2, SU: toArchetype(soulUrge), SU_Y: toArchetype(soulUrgeY) },
  };
}

// ---------- Chỉ số bổ sung chỉ để hiển thị ở L2/L5 (không vào C) – giữ nguyên quy tắc đã khớp Excel v4 ----------
const digitSum = (n) => String(n).split('').reduce((s, x) => s + Number(x), 0);
const reduceSingle = (n) => { while (n > 9) n = digitSum(n); return n; };
function phillipsLegacy(n, keep22 = true) { // PY00 dạng sách (v4), dùng cho Outer Expression
  const raw = n;
  while (n > 11 && !(keep22 && n === 22)) n = digitSum(n);
  if (n === 1 && raw !== 1) n = 10;
  return n;
}
export const PLANET_BY_KEY = { 1: 'Sun', 2: 'Moon (New)', 3: 'Jupiter', 4: 'Earth or Sun', 5: 'Mercury', 6: 'Venus', 7: 'Moon (Full)', 8: 'Saturn', 9: 'Mars' };
const ARROWS = [
  ['1-2-3', [1, 2, 3], 'Arrow of the Planner', null], ['4-5-6', [4, 5, 6], 'Arrow of Will', 'Arrow of Frustration'],
  ['7-8-9', [7, 8, 9], 'Arrow of Activity', 'Arrow of Passivity'], ['1-4-7', [1, 4, 7], 'Arrow of Practicality', 'Arrow of Disorder'],
  ['2-5-8', [2, 5, 8], 'Arrow of Emotional Balance', 'Arrow of Hypersensitivity'], ['3-6-9', [3, 6, 9], 'Arrow of Intellect', 'Arrow of Poor Memory'],
  ['1-5-9', [1, 5, 9], 'Arrow of Determination', 'Arrow of Procrastination'], ['3-5-7', [3, 5, 7], 'Arrow of Spirituality', 'Arrow of Scepticism'],
];
const WEEKDAY_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** PY02–PY04, PY06, VE02–VE03, KB01 – hiển thị (tầng L2, L5). */
export function computeExtras(sig, kb) {
  const chart = {};
  for (let k = 1; k <= 9; k++) chart[k] = sig.digits.filter((x) => x === k).length;
  const missing = Object.keys(chart).map(Number).filter((k) => chart[k] === 0);
  const arrows = [];
  for (const [code, set, strong, weak] of ARROWS) {
    if (set.every((k) => chart[k] > 0)) arrows.push(`${code}: ${strong}`);
    else if (weak && set.every((k) => chart[k] === 0)) arrows.push(`${code}: ${weak}`);
  }
  const consonantTotal = sig.nameTotal - sig.vowelTotal;
  const { day: d, month, year } = sig.input;
  const birthKey = reduceSingle(d + month + year);
  return {
    birthChart: chart, missing, arrows, consonantTotal, outer: phillipsLegacy(consonantTotal),
    rulingSpecial: sig.G1 === 10 ? 'Compound 10' : sig.G1 === 11 ? 'Master 11' : sig.G1 === 22 ? 'Master 22/4' : sig.G1 === 2 ? 'Rare 2' : 'Regular',
    vedic: { psychicType: d <= 9 ? 'Pure' : 'Compound', destiny: reduceSingle(sig.rulingRaw), name: reduceSingle(sig.nameTotal) },
    kabala: { birthKeyRaw: d + month + year, birthKey, birthPlanet: PLANET_BY_KEY[birthKey], weekday: WEEKDAY_EN[sig.input.isoWeekday],
      nameKey: sig.G6, namePlanet: PLANET_BY_KEY[sig.G6] },
  };
}
