// Ráp kết quả hiển thị (dùng chung server + client): engine → giải thích → tên hiển thị.
// Server gọi qua server/compute.js; client (chế độ khách) gọi trực tiếp với kb từ /api/knowledge.
import { runAll } from './index.js';
import { SKILL_ARCHS, GROUPS } from './score.js';
import { explainRow, explainTarget, explainBestPriority } from './explain.js';

/** Tìm ngành theo id hoặc tên (không phân biệt hoa thường; trùng tên → ID nhỏ nhất). */
export function findMajor(kb, idOrText) {
  if (idOrText === null || idOrText === undefined || idOrText === '') return null;
  if (/^\d+$/.test(String(idOrText))) return kb.majors.find((m) => m.id === Number(idOrText)) ?? null;
  const t = String(idOrText).trim().toLowerCase();
  return kb.majors.find((m) => m.name_vi.trim().toLowerCase() === t) ?? null;
}

export const profileLabel = () => (row) => `${row.profile} (archetype ${row.A.join('·')})`;

/**
 * @param person { fullName, dob, skills:{archetype:r}, env, tops, targetMajorId?, targetText?, simulated, exam? }
 */
export function computeView(person, kb, opt) {
  const out = runAll(person, kb, opt, {
    findMajor: (x) => findMajor(kb, x),
    admission: (id) => kb.admission.find((a) => a.major_id === id) ?? null,
    exam: person.exam ?? null, rules: kb.rules, thresholds: kb.thresholds,
  });
  const names = { env: kb.envs, group: Object.fromEntries(kb.groups.map((g) => [g.code, g.name_vi])), profile: profileLabel(kb) };
  const explanations = {};
  for (const r of out.result.top) explanations[r.profile] = explainRow(out.result, r, kb.templates, names, kb.params);
  if (out.result.bestPriority) explanations[out.result.bestPriority.profile] ??= explainRow(out.result, out.result.bestPriority, kb.templates, names, kb.params);
  if (out.target?.analysis) {
    const t = out.target.analysis.row;
    explanations[t.profile] ??= explainRow(out.result, t, kb.templates, names, kb.params);
    out.target.explanation = explainTarget(out.target.analysis, out.target.major.name_vi, kb.templates);
  }
  out.bestPriorityText = explainBestPriority(out.result, kb.templates, names);
  out.explanations = explanations;
  out.options = opt;
  return out;
}

/** Câu giải thích cho một hồ sơ bất kỳ (khi người dùng bấm "Vì sao?" ở hồ sơ ngoài Top-3). */
export function explainProfile(out, kb, profileId) {
  const row = out.result.rows.find((r) => r.profile === profileId);
  if (!row) return [];
  const names = { env: kb.envs, group: Object.fromEntries(kb.groups.map((g) => [g.code, g.name_vi])), profile: profileLabel(kb) };
  return out.explanations?.[profileId] ?? explainRow(out.result, row, kb.templates, names, kb.params);
}

/** Kiểm tra + chuẩn hóa tùy chọn What-if từ client (không tin dữ liệu gửi lên). */
export function sanitizeOptions(body, kb, viewerPersona) {
  const o = body || {};
  const persona = ['HS', 'PH', 'TVV'].includes(o.persona) ? o.persona : viewerPersona;
  const wset = kb.weights[o.wset] ? o.wset : kb.paramSet.code;
  const setMeta = kb.sets.find((s) => s.code === wset);
  const out = { persona, wset, normalize: typeof o.normalize === 'boolean' ? o.normalize : setMeta.normalize };
  if (Array.isArray(o.weights) && o.weights.length === 3 && o.weights.every((x) => Number.isFinite(+x) && +x >= 0)) {
    const s = o.weights.reduce((a, b) => a + +b, 0);
    if (s > 0) out.weights = o.weights.map((x) => +x / s); // slider α/β/γ – luôn chuẩn hóa về tổng 1
  }
  if (o.flags && typeof o.flags === 'object') out.flags = Object.fromEntries(['G1', 'G5', 'G6', 'G4', 'G2'].map((g) => [g, o.flags[g] === 0 || o.flags[g] === false ? 0 : 1]));
  if (o.positional === false) out.positional = false;
  if (o.envOverride && kb.envs[o.envOverride]) out.envOverride = o.envOverride;
  if (o.yVowel === true) out.yVowel = true;
  if (o.delta && typeof o.delta === 'object') {
    out.delta = {};
    for (const a of SKILL_ARCHS) { const d = Math.trunc(Number(o.delta[a] ?? 0)); if (d) out.delta[a] = Math.max(-4, Math.min(4, d)); }
  }
  return out;
}

/** Bỏ thông tin định danh khỏi tín hiệu (Admin / màn hình tổng hợp): giữ năm sinh, số âm tiết, ký tự bị bỏ, đếm chữ ghép. */
export function redactSignals(sig) {
  const { input, name, digits: _d, ...rest } = sig;
  return { ...rest, redacted: true, input: { year: input.year },
    name: { removed: name.removed, rawWordCount: name.rawWordCount, wordCount: name.words.length, letterCount: name.normalized.length } };
}
