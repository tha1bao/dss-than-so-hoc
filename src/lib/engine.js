// Engine chấm điểm DSS – cùng công thức với Student_Report / WhatIf_Scenarios trong v6.
// C = α·NF + β·SR + γ·ENV trên 35 hồ sơ ngành; chỉ xếp hạng hồ sơ có EC ≥ 1.
import PROFILES from '../data/profiles.json';
import MAJORS from '../data/majors.json';
import PARAMS from '../data/params.json';

export { PROFILES, MAJORS, PARAMS };

export const GROUPS = ['G1', 'G5', 'G6', 'G4', 'G2'];
export const SKILLS = ['SK01', 'SK02', 'SK03', 'SK04', 'SK05', 'SK06', 'SK07', 'SK08', 'SK09', 'SK11', 'SK22', 'SK33'];
export const ENVS = ['Leadership & autonomy', 'Collaboration & people', 'Creativity & expression',
  'Structure, expertise & depth'];
export const LABELS = { NONE: 'none', CHALLENGE: 'challenge', PRIORITY: 'priority', CONSIDER: 'consider' };

export const skillOf = (archetype) => `SK${String(archetype).padStart(2, '0')}`;
const clamp = (v) => Math.max(1, Math.min(5, v));

/**
 * Tùy chọn mặc định = cấu hình gốc (persona Học sinh, đủ 5 nhóm tín hiệu, có trọng số vị trí).
 */
export function defaultOptions() {
  return {
    persona: 'student',
    weights: [...PARAMS.personas.student], // [α, β, γ]
    flags: { G1: 1, G5: 1, G6: 1, G4: 1, G2: 1 },
    positional: true,
    envOverride: '',
    yVowel: false,
    delta: Object.fromEntries(SKILLS.map((s) => [s, 0])),
    targetMajor: null,
  };
}

/**
 * @param {object} student { signals:{G1,G5,G6,G4,G2,soul,soulY}, skills:{SKxx:1–5}, top:[n,n,n], env }
 * @param {object} opt     xem defaultOptions()
 */
export function scoreAll(student, opt) {
  const [alpha, beta, gamma] = opt.weights;
  const p = opt.positional ? PARAMS.p : [1, 1, 1];
  const sumP = p[0] + p[1] + p[2];
  const w = PARAMS.w;
  const wActive = GROUPS.reduce((s, g) => s + w[g] * opt.flags[g], 0);
  const env = opt.envOverride || student.env;
  const soul = opt.yVowel ? student.signals.soulY : student.signals.soul;
  const eff = Object.fromEntries(SKILLS.map((s) => [s, clamp(student.skills[s] + (opt.delta[s] || 0))]));

  const rows = PROFILES.map((pr, idx) => {
    const match = {};
    let num = 0;
    let ec = 0;
    for (const g of GROUPS) {
      const pos = pr.a.indexOf(student.signals[g]);
      const m = pos >= 0 ? p[pos] * opt.flags[g] : 0;
      match[g] = m;
      num += w[g] * m;
      if (m > 0) ec += 1;
    }
    const nf = wActive > 0 ? num / (wActive * sumP) : 0;
    const kn = pr.a.map((a) => eff[skillOf(a)]);
    const sr = kn.reduce((s, k, i) => s + p[i] * (k - 1), 0) / (4 * sumP);
    const weakSkills = pr.a.map((a, i) => ({ code: skillOf(a), level: kn[i] }))
      .filter((x) => x.level <= PARAMS.weakMax);
    const envFit = env === pr.env ? 1 : 0;
    const c = alpha * nf + beta * sr + gamma * envFit;
    let label;
    if (ec === 0) label = LABELS.NONE;
    else if (weakSkills.length > 0) label = LABELS.CHALLENGE;
    else if (ec >= PARAMS.ecMin && sr >= PARAMS.srMin) label = LABELS.PRIORITY;
    else label = LABELS.CONSIDER;
    const sat = [soul, student.signals.G2, student.signals.G6].filter((x) => pr.a.includes(x)).length;
    const str = student.top.filter((x) => pr.a.includes(x)).length;
    return {
      idx, profile: pr, match, nf, ec, kn, sr, weakSkills, env: envFit, c, label, sat, str,
      score: ec >= 1 ? c : -1,
      matchedGroups: GROUPS.filter((g) => match[g] > 0),
    };
  });

  // Hạng: chỉ hồ sơ có EC ≥ 1; hòa điểm → hồ sơ đứng trước xếp trên (RANK + COUNTIF)
  const ranked = rows.filter((r) => r.ec >= 1)
    .sort((a, b) => (Math.abs(b.score - a.score) > 1e-9 ? b.score - a.score : a.idx - b.idx));
  ranked.forEach((r, i) => { r.rank = i + 1; });
  rows.forEach((r) => { if (r.ec === 0) r.rank = null; });

  return { rows, ranked, top: ranked.slice(0, 3), env, soul, effectiveSkills: eff, sumP };
}

/** Bước 5 – phân tích ngành mục tiêu: nhãn, hạng và điều kiện để đạt "Ưu tiên". */
export function targetAnalysis(result, majorId) {
  const major = MAJORS.find((m) => m.id === Number(majorId));
  if (!major) return null;
  const row = result.rows.find((r) => r.profile.id === major.profile);
  const p = row.profile.a.map((_, i) => (result.sumP === 3 ? 1 : PARAMS.p[i]));
  // Bậc cần tăng để hết kỹ năng yếu (đưa mỗi kỹ năng ≤ Weak_max lên Weak_max + 1)
  const stepsWeak = row.weakSkills.reduce((s, x) => s + (PARAMS.weakMax + 1 - x.level), 0);
  // Điểm có trọng số còn thiếu tới SR_min sau khi đã hết kỹ năng yếu
  const knFixed = row.kn.map((k) => Math.max(k, PARAMS.weakMax + 1));
  const have = knFixed.reduce((s, k, i) => s + p[i] * (k - 1), 0);
  const need = PARAMS.srMin * 4 * result.sumP;
  const gap = Math.max(0, need - have);
  const stepsMain = Math.ceil(gap / p[0] - 1e-9);
  const headroom = 5 - knFixed[0];
  return {
    major, row,
    stepsWeak,
    gap,
    stepsMain,
    reachable: row.ec >= PARAMS.ecMin && stepsMain <= headroom,
  };
}

/** α-sweep: β, γ chia phần còn lại theo tỷ lệ persona. */
export function alphaSweep(student, opt, alphas = [0, 0.2, 0.4, 0.6, 0.8, 1]) {
  const [, b0, g0] = opt.weights;
  return alphas.map((a) => {
    const rest = 1 - a;
    const bg = b0 + g0 || 1;
    const res = scoreAll(student, { ...opt, weights: [a, (rest * b0) / bg, (rest * g0) / bg] });
    return { alpha: a, top1: res.top[0]?.profile.id ?? '–' };
  });
}

export const majorsOfProfile = (pid) => MAJORS.filter((m) => m.profile === pid);
