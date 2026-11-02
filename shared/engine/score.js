// Tầng L3–L6: chấm 35 hồ sơ ngành. Bản JS của engine.py › score() – giữ ĐÚNG thứ tự phép tính để khớp số thực.
// C = α·NF* + β·SR* + γ·ENV*  (* = min–max trên hồ sơ EC ≥ 1 của chính HS; tắt chuẩn hóa → công thức v6).

export const GROUPS = ['G1', 'G5', 'G6', 'G4', 'G2']; // thứ tự cố định = thứ tự cộng trong engine.py
export const SKILL_ARCHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];
export const LABELS = { NONE: 'Không đề xuất', CHALLENGE: 'Thử thách', PRIORITY: 'Ưu tiên', CONSIDER: 'Cân nhắc' };
export const skillCode = (a) => `SK${String(a).padStart(2, '0')}`;
/** Cộng bù Neumaier – giống sum() của Python ≥ 3.12 để số thực khớp engine.py tới bit cuối. */
export function fsum(xs) {
  let s = 0, c = 0;
  for (const x of xs) {
    const t = s + x;
    c += Math.abs(s) >= Math.abs(x) ? (s - t) + x : (x - t) + s;
    s = t;
  }
  return s + c;
}
const sum = fsum;
/** Dung sai so sánh: hòa điểm, ngưỡng SR_min, min = max (giá trị bằng nhau về toán học). */
export const EPS = 1e-9;
const eq = (x, y) => Math.abs(x - y) <= EPS;

/**
 * Áp tùy chọn What-if lên đầu vào rồi chấm điểm.
 * @param {object} input  { arch:{G1,G5,G6,G4,G2,SU,SU_Y}, skills:{1:r,…,33:r}, env, tops:[a,a,a] }
 * @param {object} kb     { profiles:[{id,A:[a1,a2,a3],env}], params:{w,p,EC_min,SR_min,Weak_max}, weights:{set:{HS:[α,β,γ]}} }
 * @param {object} opt    { persona:'HS'|'PH'|'TVV', wset:'A'|'v6'|'B', weights?:[α,β,γ], normalize?:bool,
 *                          flags?:{G1:1,…}, positional?:bool, envOverride?:string, yVowel?:bool, delta?:{1:+1,…} }
 */
export function scoreWithOptions(input, kb, opt = {}) {
  const flags = opt.flags || {};
  const groups = GROUPS.filter((g) => (flags[g] ?? 1) ? true : false);
  const params = opt.positional === false ? { ...kb.params, p: [1, 1, 1] } : kb.params;
  const skills = Object.fromEntries(Object.entries(input.skills).map(([a, r]) =>
    [a, Math.max(1, Math.min(5, Number(r) + Number(opt.delta?.[a] ?? 0)))]));
  const arch = opt.yVowel ? { ...input.arch, SU: input.arch.SU_Y } : input.arch;
  return score(arch, skills, opt.envOverride || input.env, input.tops, kb, {
    persona: opt.persona ?? 'HS', wset: opt.weights ?? opt.wset ?? 'A', normalize: opt.normalize ?? true, groups, params,
  });
}

/**
 * Lõi chấm điểm (= engine.py › score).
 * @param signals  {G1,G5,G6,G4,G2,SU} archetype
 * @param skills   {archetype: r 1–5}
 */
export function score(signals, skills, env, tops, kb, { persona = 'HS', wset = 'A', normalize = true, groups = GROUPS, params = kb.params } = {}) {
  const [a, b, g] = typeof wset === 'string' ? kb.weights[wset][persona] : wset;
  const { p, w } = params;
  const sw = sum(groups.map((G) => w[G]));
  const sp = sum(p);
  const rows = kb.profiles.map((pr, idx) => {
    const A = pr.A;
    const khop = {};
    for (const G of GROUPS) { const pos = A.indexOf(signals[G]); khop[G] = groups.includes(G) && pos >= 0 ? p[pos] : 0; }
    const nf = sum(GROUPS.map((G) => khop[G] * w[G])) / (sw * sp);
    const ec = GROUPS.filter((G) => khop[G] > 0).length;
    const kn = A.map((x) => skills[x]);
    const sr = sum([0, 1, 2].map((i) => p[i] * (kn[i] - 1))) / (4 * sp);
    const weakList = A.map((x, i) => ({ archetype: x, skill: skillCode(x), level: kn[i] })).filter((x) => x.level <= params.Weak_max);
    const envm = pr.env === env ? 1 : 0;
    let label, rule;
    if (ec === 0) { label = LABELS.NONE; rule = 1; }
    else if (weakList.length >= 1) { label = LABELS.CHALLENGE; rule = 2; }
    else if (ec >= params.EC_min && sr >= params.SR_min - EPS) { label = LABELS.PRIORITY; rule = 3; }
    else { label = LABELS.CONSIDER; rule = 4; }
    const sat = [signals.SU, signals.G2, signals.G6].filter((x) => A.includes(x)).length;
    const str = tops.filter((x) => A.includes(x)).length;
    return { idx, profile: pr.id, A, env: pr.env, khop, NF: nf, EC: ec, KN: kn, SR: sr, weak: weakList.length, weakList,
      ENV: envm, C_raw: a * nf + b * sr + g * envm, label, labelRule: rule, SAT: sat, STR: str,
      matched: GROUPS.filter((G) => khop[G] > 0) };
  });
  const E = rows.filter((r) => r.EC >= 1);
  const minmax = {};
  for (const k of ['NF', 'SR', 'ENV']) {
    const vals = E.length ? E.map((r) => r[k]) : [0];
    minmax[k] = [Math.min(...vals), Math.max(...vals)];
  }
  for (const r of rows) {
    if (r.EC >= 1) {
      for (const k of ['NF', 'SR', 'ENV']) { const [lo, hi] = minmax[k]; r[`${k}_n`] = eq(hi, lo) ? 0 : (r[k] - lo) / (hi - lo); }
      r.C = normalize ? a * r.NF_n + b * r.SR_n + g * r.ENV_n : r.C_raw;
      const [nfv, srv, envv] = normalize ? [r.NF_n, r.SR_n, r.ENV_n] : [r.NF, r.SR, r.ENV];
      r.contrib = { NF: a * nfv, SR: b * srv, ENV: g * envv }; // thanh đóng góp L1
    } else {
      r.C = r.C_raw; r.NF_n = r.SR_n = r.ENV_n = null; r.contrib = null;
    }
  }
  // Hạng: chỉ EC ≥ 1; hòa → hồ sơ đứng trước xếp trên (RANK + COUNTIF)
  const ys = rows.map((r) => (r.EC >= 1 ? r.C : -1));
  rows.forEach((r, i) => {
    r.rank = r.EC >= 1 ? ys.filter((y) => y > ys[i] + EPS).length + ys.slice(0, i + 1).filter((y) => eq(y, ys[i])).length : null;
  });
  const ranked = rows.filter((r) => r.rank).sort((x, y) => x.rank - y.rank);
  const top = ranked.slice(0, 3);
  const bestPriority = top[0]?.label === LABELS.CHALLENGE ? ranked.find((r) => r.label === LABELS.PRIORITY) ?? null : null;
  const ties = top.length ? ranked.filter((r) => eq(r.C, top[0].C)).map((r) => r.profile) : [];
  return { weights: [a, b, g], normalize, persona, groups, p, sumP: sp, env, minmax, rows, ranked, top, bestPriority,
    tiesWithTop1: ties.length > 1 ? ties : [], nEligible: E.length };
}

/** Bước 5 – ngành mục tiêu (Student_Report B54:B57, Phụ lục B2.9). */
export function targetAnalysis(result, profileId, params) {
  const row = result.rows.find((r) => r.profile === profileId);
  if (!row) return null;
  const p = result.p;
  const stepsWeak = sum(row.KN.map((r) => (r <= params.Weak_max ? params.Weak_max + 1 - r : 0))); // B55
  const gap = Math.max(0, params.SR_min * 4 * sum(p) - (p[0] * (row.KN[0] - 1) + p[1] * (row.KN[1] - 1) + p[2] * (row.KN[2] - 1))); // B56
  const stepsMain = Math.ceil(gap / p[0] - 1e-9); // ROUNDUP(B56/p1)
  const status = row.EC === 0 ? 'EC0' : row.EC < params.EC_min ? 'EC_LOW' : 'POSSIBLE'; // B57
  return { profile: profileId, row, stepsWeak, gap, stepsMain, status };
}

/** 5 cấu hình của Sensitivity – dùng cho KPI "độ ổn định Top-1" (K_STAB). */
export const STABILITY_CONFIGS = [
  ['BASE_HS', 'Gốc: Học sinh', { persona: 'HS' }], ['PH', 'Persona Phụ huynh', { persona: 'PH' }],
  ['TVV', 'Persona Tư vấn viên', { persona: 'TVV' }], ['PY_ONLY', 'Chỉ Pythagoras (G1, G5)', { persona: 'HS', flags: { G1: 1, G5: 1, G6: 0, G4: 0, G2: 0 } }],
  ['EQUAL_P', 'Trọng số vị trí bằng nhau', { persona: 'HS', positional: false }],
];
/** Số cấu hình (/5) giữ nguyên Top-1 của cấu hình gốc, cùng bộ trọng số + chuẩn hóa đang dùng. */
export function stability(input, kb, { wset = 'A', normalize = true } = {}) {
  const runs = STABILITY_CONFIGS.map(([code, name, o]) => {
    const r = scoreWithOptions(input, kb, { ...o, wset, normalize });
    return { code, name, top1: r.top[0]?.profile ?? null, top3: r.top.map((t) => t.profile) };
  });
  const base = runs[0];
  for (const r of runs) r.top3Overlap = r.top3.filter((p) => base.top3.includes(p)).length;
  return { count: runs.filter((r) => r.top1 === base.top1).length, of: runs.length, runs };
}

/** α-sweep (Student_Report AC:AH): α chạy 0 → 1, β/γ giữ tỉ lệ persona. */
export function alphaSweep(result, alphas = [0, 0.2, 0.4, 0.6, 0.8, 1]) {
  const [, b, g] = result.weights;
  return alphas.map((al) => {
    const ys = result.rows.map((r) => {
      if (r.EC < 1) return -1;
      const [nf, sr, env] = result.normalize ? [r.NF_n, r.SR_n, r.ENV_n] : [r.NF, r.SR, r.ENV];
      return al * nf + (1 - al) * (b * sr + g * env) / (b + g);
    });
    const best = ys.reduce((bi, y, i) => (y > ys[bi] + EPS ? i : bi), 0);
    return { alpha: al, top1: result.rows[best].profile, value: ys[best] };
  });
}
