// Tính hồ sơ thần số học 3 trường phái từ họ tên + ngày sinh.
// Mỗi hàm ứng với một Rule_ID trong sheet Calculation_Rules (data package v4).

const PY = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 1, K: 2, L: 3, M: 4,
  N: 5, O: 6, P: 7, Q: 8, R: 9, S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8 };
// Sepharial – giá trị Hebraic (p.30)
const HEB = { A: 1, B: 2, C: 2, D: 4, E: 5, F: 8, G: 3, H: 8, I: 1, J: 1, K: 2, L: 3, M: 4,
  N: 5, O: 7, P: 8, Q: 1, R: 2, S: 3, T: 4, U: 6, V: 6, W: 6, X: 6, Y: 1, Z: 7 };
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

export const PLANET_BY_KEY = { 1: 'Sun', 2: 'Moon (New)', 3: 'Jupiter', 4: 'Earth or Sun', 5: 'Mercury',
  6: 'Venus', 7: 'Moon (Full)', 8: 'Saturn', 9: 'Mars' };
// KB03: thứ trong tuần → hành tinh cai quản → khóa Minor Key
const DAY_RULER = [
  ['Sunday', 'Sun', 1], ['Monday', 'Moon', 2], ['Tuesday', 'Mars', 9], ['Wednesday', 'Mercury', 5],
  ['Thursday', 'Jupiter', 3], ['Friday', 'Venus', 6], ['Saturday', 'Saturn', 8],
];

const digitSum = (n) => String(n).split('').reduce((s, d) => s + Number(d), 0);

/** Rút gọn về 1 chữ số (Vedic / Kabala). */
export function reduceSingle(n) {
  while (n > 9) n = digitSum(n);
  return n;
}

/** PY00 – rút gọn Phillips: giữ 10, 11 (và 22 nếu cho phép); kết quả 1 thành 10 trừ khi tổng đúng bằng 1. */
export function phillips(n, { keep22 = true } = {}) {
  const raw = n;
  while (n > 11 && !(keep22 && n === 22)) n = digitSum(n);
  if (n === 1 && raw !== 1) n = 10;
  return n;
}

/** Bỏ dấu tiếng Việt, Đ → D, viết hoa; trả về danh sách âm tiết. */
export function syllables(fullName) {
  return fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
}

/** KB04 – tổng Hebraic theo từng âm tiết, TH = 9, PH = 8, TZ = 9. */
function hebraicTotal(sylls) {
  let total = 0;
  for (const s of sylls) {
    for (let i = 0; i < s.length; i++) {
      const pair = s.slice(i, i + 2);
      if (pair === 'TH' || pair === 'TZ') { total += 9; i++; continue; }
      if (pair === 'PH') { total += 8; i++; continue; }
      total += HEB[s[i]] || 0;
    }
  }
  return total;
}

const ARROWS = [
  ['1-2-3', [1, 2, 3], 'Arrow of the Planner', null],
  ['4-5-6', [4, 5, 6], 'Arrow of Will', 'Arrow of Frustration'],
  ['7-8-9', [7, 8, 9], 'Arrow of Activity', 'Arrow of Passivity'],
  ['1-4-7', [1, 4, 7], 'Arrow of Practicality', 'Arrow of Disorder'],
  ['2-5-8', [2, 5, 8], 'Arrow of Emotional Balance', 'Arrow of Hypersensitivity'],
  ['3-6-9', [3, 6, 9], 'Arrow of Intellect', 'Arrow of Poor Memory'],
  ['1-5-9', [1, 5, 9], 'Arrow of Determination', 'Arrow of Procrastination'],
  ['3-5-7', [3, 5, 7], 'Arrow of Spirituality', 'Arrow of Scepticism'],
];

/** Quy về archetype: 10 → 1 (Phillips không có Ruling 1, 10 thay cho 1). */
export const toArchetype = (n) => (n === 10 ? 1 : n);

/**
 * Tính toàn bộ hồ sơ.
 * @param {string} fullName họ tên có dấu
 * @param {string} dob 'YYYY-MM-DD'
 */
export function computeProfile(fullName, dob) {
  const [y, m, d] = dob.split('-').map(Number);
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const digits = `${dd}${mm}${y}`.split('').map(Number);
  const sylls = syllables(fullName);
  const letters = sylls.join('').split('');

  // Pythagoras
  const rulingRaw = digits.reduce((a, b) => a + b, 0);
  const ruling = phillips(rulingRaw); // PY01
  const special = ruling === 10 ? 'Compound 10' : ruling === 11 ? 'Master 11' : ruling === 22 ? 'Master 22/4'
    : ruling === 2 ? 'Rare 2' : 'Regular';
  const chart = {};
  for (let k = 1; k <= 9; k++) chart[k] = digits.filter((x) => x === k).length; // PY02
  const missing = Object.keys(chart).map(Number).filter((k) => chart[k] === 0); // PY03
  const arrows = []; // PY04
  for (const [code, set, strong, weak] of ARROWS) {
    if (set.every((k) => chart[k] > 0)) arrows.push(`${code}: ${strong}`);
    else if (weak && set.every((k) => chart[k] === 0)) arrows.push(`${code}: ${weak}`);
  }
  const vowelTotal = letters.filter((c) => VOWELS.has(c)).reduce((s, c) => s + PY[c], 0);
  const consonantTotal = letters.filter((c) => !VOWELS.has(c)).reduce((s, c) => s + PY[c], 0);
  const soulUrge = phillips(vowelTotal, { keep22: false }); // PY05
  const outer = phillips(consonantTotal); // PY06
  const nameTotal = vowelTotal + consonantTotal;
  const completeName = phillips(nameTotal); // PY07
  // Biến thể: Y là nguyên âm (sách VN) – chỉ ảnh hưởng Soul Urge / SAT
  const yCount = letters.filter((c) => c === 'Y').length;
  const soulUrgeY = phillips(vowelTotal + 7 * yCount, { keep22: false });

  // Vedic (Johari)
  const psychic = reduceSingle(d); // VE01
  const psychicType = d <= 9 ? 'Pure' : 'Compound';
  const destiny = reduceSingle(rulingRaw); // VE02
  const vedicName = reduceSingle(nameTotal); // VE03

  // Kabala (Sepharial)
  const birthKey = reduceSingle(d + m + y); // KB01
  const weekdayIdx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const [weekday, dayPlanet, dayKey] = DAY_RULER[weekdayIdx]; // KB03
  const hebTotal = hebraicTotal(sylls);
  const nameKey = reduceSingle(hebTotal); // KB04

  return {
    normalizedName: sylls.join(''),
    pythagoras: { rulingRaw, ruling, special, chart, missing, arrows, vowelTotal, soulUrge, consonantTotal,
      outer, nameTotal, completeName, soulUrgeY, yCount },
    vedic: { psychic, psychicType, destinyRaw: rulingRaw, destiny, name: vedicName },
    kabala: { birthKeyRaw: d + m + y, birthKey, birthPlanet: PLANET_BY_KEY[birthKey], weekday, dayPlanet, dayKey,
      hebrewTotal: hebTotal, nameKey, namePlanet: PLANET_BY_KEY[nameKey] },
    // 5 nhóm tín hiệu độc lập (SC01) dùng trong mô hình
    signals: {
      G1: toArchetype(ruling),
      G5: toArchetype(completeName),
      G6: nameKey,
      G4: dayKey,
      G2: psychic,
      soul: toArchetype(soulUrge),
      soulY: toArchetype(soulUrgeY),
    },
  };
}
