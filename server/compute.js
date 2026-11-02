// Dịch vụ tính: đọc HS từ DB → engine dùng chung → giải thích → (tùy chọn) lưu run / run_result / run_warning / explanation.
import { q, q1, tx } from './db.js';
import { HttpError } from './auth.js';
import { ENGINE_VERSION } from '../shared/engine/index.js';
import { computeView } from '../shared/engine/view.js';

export async function loadStudent(id) {
  const s = await q1('SELECT * FROM student WHERE id = ?', [id]);
  if (!s) throw HttpError(404, 'Không tìm thấy học sinh');
  const [skills, exam] = await Promise.all([
    q('SELECT k.archetype_no, s.level FROM student_skill s JOIN skill k ON k.code = s.skill_code WHERE s.student_id = ?', [id]),
    q('SELECT combo, score FROM student_exam WHERE student_id = ?', [id]),
  ]);
  s.skills = Object.fromEntries(skills.map((r) => [r.archetype_no, r.level]));
  s.exam = exam.length ? Object.fromEntries(exam.map((r) => [r.combo, Number(r.score)])) : null;
  return s;
}

/** Nạp nhiều HS một lượt (3 truy vấn) cho trang danh sách. */
export async function loadStudents(students) {
  if (!students.length) return [];
  const ids = students.map((s) => s.id);
  const ph = ids.map(() => '?').join(',');
  const [skills, exams] = await Promise.all([
    q(`SELECT s.student_id, k.archetype_no, s.level FROM student_skill s JOIN skill k ON k.code = s.skill_code WHERE s.student_id IN (${ph})`, ids),
    q(`SELECT student_id, combo, score FROM student_exam WHERE student_id IN (${ph})`, ids),
  ]);
  return students.map((s) => {
    const ex = exams.filter((e) => e.student_id === s.id);
    return { ...s, skills: Object.fromEntries(skills.filter((k) => k.student_id === s.id).map((k) => [k.archetype_no, k.level])),
      exam: ex.length ? Object.fromEntries(ex.map((e) => [e.combo, Number(e.score)])) : null };
  });
}

export { sanitizeOptions, redactSignals } from '../shared/engine/view.js';

/** Tính đầy đủ cho một HS (engine + giải thích – shared/engine/view.js). */
export function computeFor(student, kb, opt, { targetMajorId } = {}) {
  const tm = targetMajorId ?? student.target_major_id ?? null;
  return computeView({
    fullName: student.full_name, dob: student.dob, skills: student.skills, env: student.preferred_env,
    tops: [student.top_strength_1, student.top_strength_2, student.top_strength_3].filter((x) => x != null),
    targetMajorId: tm, targetText: tm ? null : student.target_major_text, simulated: !!student.is_simulated, exam: student.exam,
  }, kb, opt);
}

/** Lưu lần tính – mọi thứ cần để tái lập (bộ tham số, kb_release, tùy chọn, trọng số thực dùng, min–max). */
export async function persistRun(out, { studentId, userId, kb, isWhatif, scenarioCode = null }) {
  const set = kb.sets.find((s) => s.code === out.options.wset);
  return tx(async (conn) => {
    const [res] = await conn.execute(
      `INSERT INTO run (student_id, requested_by, persona, param_set_id, kb_release_id, normalize_minmax, is_whatif, scenario_code,
        options_json, weights_used, minmax_json, target_major_id, engine_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, userId, out.result.persona, set.id, kb.kbRelease.id, out.result.normalize, isWhatif, scenarioCode,
        JSON.stringify(out.options), JSON.stringify(out.result.weights), JSON.stringify(out.result.minmax),
        out.target?.major?.id ?? null, ENGINE_VERSION]);
    const runId = String(res.insertId);
    const rows = out.result.rows.map((r) => [runId, r.profile, r.rank, r.EC, r.NF, r.SR, r.ENV, r.NF_n, r.SR_n, r.ENV_n, r.C_raw, r.C,
      r.label, r.weak, JSON.stringify(r.KN), JSON.stringify(r.khop), r.SAT, r.STR]);
    await conn.query(`INSERT INTO run_result (run_id, profile_id, rank_no, ec, nf, sr, env_fit, nf_n, sr_n, env_n, c_raw, c, label,
      weak_count, kn_json, match_json, sat, str_count) VALUES ?`, [rows]);
    if (out.warnings.length) {
      await conn.query('INSERT INTO run_warning (run_id, seq, validity_code, level, message_vi) VALUES ?',
        [out.warnings.map((w, i) => [runId, i + 1, w.code, w.level, w.message.slice(0, 300)])]);
    }
    const ex = Object.entries(out.explanations).flatMap(([pid, list]) => list.map((e) => [runId, pid, e.code, e.text]));
    if (ex.length) await conn.query('INSERT INTO explanation (run_id, profile_id, template_code, text_vi) VALUES ?', [ex]);
    return runId;
  });
}
