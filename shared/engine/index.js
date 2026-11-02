// Engine DSS Thần số học – dùng chung server (Node) và client (Vite/React).
// Khớp ENGINE CHUẨN ASS3_Pha0-1/engine/engine.py (test hồi quy: tests/engine.regression.test.js).
export * from './numerology.js';
export * from './score.js';
export * from './validity.js';
export * from './kpi.js';
export * from './explain.js';
import { computeSignals } from './numerology.js';
import { scoreWithOptions, targetAnalysis, stability } from './score.js';
import { evaluateValidity } from './validity.js';
import { computeKpis } from './kpi.js';

export const ENGINE_VERSION = 'js-1.0.0/v6A-KB04'; // ≤ 20 ký tự (cột run.engine_version)

/**
 * Một lần tính đầy đủ: tín hiệu → 35 hồ sơ → Bước 5 → KPI → cảnh báo.
 * @param person { fullName, dob, skills:{1:r…}, env, tops:[…], targetText?, simulated? }
 * @param kb     tri thức (xem kb.js / API /api/knowledge)
 * @param opt    tùy chọn What-if (xem scoreWithOptions)
 * @param extra  { findMajor(text) → major|null, admission(majorId) → benchmark|null, stability?: number (0–5), exam?: {A00:…} , rules? }
 */
export function runAll(person, kb, opt = {}, extra = {}) {
  const sig = person.sig ?? computeSignals(person.fullName, person.dob, kb); // sig có sẵn (từ server) → không cần tên/ngày sinh
  const input = { arch: sig.arch, skills: person.skills, env: person.env, tops: person.tops };
  const result = scoreWithOptions(input, kb, opt);
  const stab = stability(input, kb, { wset: opt.weights ? 'A' : (opt.wset ?? 'A'), normalize: opt.normalize ?? true });
  const params = opt.positional === false ? { ...kb.params, p: [1, 1, 1] } : kb.params;
  let target = null;
  if (person.targetText || person.targetMajorId) {
    const major = extra.findMajor ? extra.findMajor(person.targetMajorId ?? person.targetText) : null;
    const analysis = major ? targetAnalysis(result, major.profile_id ?? major.profile, params) : null;
    const bench = major && extra.admission ? extra.admission(major.id) : null;
    target = { text: person.targetText ?? String(person.targetMajorId), major, analysis, inPilot: !!bench, benchmark: bench };
  }
  const kpis = computeKpis(result, { stability: stab.count, target, exam: extra.exam, params, thresholds: extra.thresholds });
  const warnings = evaluateValidity({ sig, result, target, params, simulated: person.simulated }, extra.rules);
  return { engine: ENGINE_VERSION, sig, result, target, stability: stab, kpis, warnings };
}
