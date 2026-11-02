// Tầng L1 "Vì sao?": điền số thật vào mẫu câu (bảng explanation_template). Chỉ diễn giải công thức F-*, không thêm quy tắc mới.
import { LABELS } from './score.js';

/** Số kiểu vi-VN: dấu phẩy thập phân. */
export const fmt = (x, d = 3) => (x === null || x === undefined ? '–' : Number(x).toFixed(d).replace('.', ','));
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));

/**
 * @param result   kết quả score()
 * @param row      một dòng của result.rows
 * @param T        { code: template_vi }
 * @param names    { env: {code: name_vi}, group: {G1: 'Số chủ đạo', …}, profile?: (row) => string }
 * @returns [{ code, text }]
 */
export function explainRow(result, row, T, names = {}, params = {}) {
  const envName = (c) => names.env?.[c] ?? c;
  const pName = names.profile ? names.profile(row) : row.profile;
  const out = [];
  const say = (code, vars) => { if (T[code]) out.push({ code, text: fill(T[code], vars) }); };
  if (row.EC >= 1) {
    say('WHY_C', { profile: pName, C: fmt(row.C), rank: row.rank, n_ranked: result.ranked.length,
      c_nf: fmt(row.contrib.NF), c_sr: fmt(row.contrib.SR), c_env: fmt(row.contrib.ENV) });
    say('WHY_NF', { ec: row.EC, nf: fmt(row.NF), groups: row.matched.map((g) => names.group?.[g] ?? g).join(', ') });
  } else say('WHY_NF_NONE', {});
  const kn = row.A.map((a, i) => `SK${String(a).padStart(2, '0')} = ${row.KN[i]}`).join(', ');
  const srMin = params.SR_min ?? 0.625;
  say('WHY_SR', { kn, sr: fmt(row.SR), sr_cmp: row.SR >= srMin - 1e-9 ? '≥' : '<' });
  say(row.ENV ? 'WHY_ENV_YES' : 'WHY_ENV_NO', { env: envName(result.env), profile_env: envName(row.env) });
  const weak = row.weakList.map((w) => `${w.skill} = ${w.level}`).join(', ');
  if (row.label === LABELS.NONE) say('LABEL_NONE', {});
  else if (row.label === LABELS.CHALLENGE) say('LABEL_CHALLENGE', { weak });
  else if (row.label === LABELS.PRIORITY) say('LABEL_PRIORITY', { ec: row.EC, sr: fmt(row.SR) });
  else {
    const why = [row.EC < (params.EC_min ?? 2) ? `EC = ${row.EC} < 2` : null, row.SR < srMin - 1e-9 ? `SR = ${fmt(row.SR)} < 0,625` : null].filter(Boolean).join('; ');
    say('LABEL_CONSIDER', { why });
  }
  if (row.EC >= 1) {
    const tied = result.ranked.filter((r) => r !== row && Math.abs(r.C - row.C) <= 1e-9);
    if (tied.length) say('TIE', { n: tied.length + 1, C: fmt(row.C) });
  }
  return out;
}

/** Câu Bước 5 cho ngành mục tiêu. */
export function explainTarget(analysis, majorName, T) {
  if (!analysis) return [];
  const v = { target: majorName, ec: analysis.row.EC, steps_weak: analysis.stepsWeak, gap: fmt(analysis.gap, 1), steps_main: analysis.stepsMain };
  const code = analysis.status === 'EC0' ? 'STEP5_EC0' : analysis.status === 'EC_LOW' ? 'STEP5_EC_LOW' : 'STEP5';
  return T[code] ? [{ code, text: fill(T[code], v) }] : [];
}

/** Câu L0 khi Top-1 là Thử thách. */
export function explainBestPriority(result, T, names = {}) {
  const b = result.bestPriority;
  if (!b || !T.BEST_PRIORITY) return null;
  return { code: 'BEST_PRIORITY', text: fill(T.BEST_PRIORITY, { profile: names.profile ? names.profile(b) : b.profile, rank: b.rank }) };
}
