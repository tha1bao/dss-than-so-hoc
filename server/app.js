// REST API – DSS Thần số học (ASS3). Engine tính ở shared/engine (dùng chung client).
import crypto from 'node:crypto';
import express from 'express';
import { q, q1, tx } from './db.js';
import { loadKb, invalidateKb } from './kb.js';
import { login, authenticate, requireRole, requireAdminScope, visibleStudentIds, assertCanSee, canSeePii, canSeeContext,
  defaultPersona, publicUser, HttpError } from './auth.js';
import { audit } from './audit.js';
import { loadStudent, loadStudents, sanitizeOptions, redactSignals, computeFor, persistRun } from './compute.js';
import { ENGINE_VERSION, LABELS } from '../shared/engine/index.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.set({ 'X-Request-Id': req.id, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
  next();
});
const api = express.Router();
app.use('/api', api);

// ---------------- hệ thống ----------------
api.get('/health', async (_req, res) => {
  const v = await q1('SELECT VERSION() AS v');
  res.json({ ok: true, db: v.v, engine: ENGINE_VERSION });
});

// ---------------- xác thực ----------------
api.post('/auth/login', async (req, res) => res.json(await login(req.body?.username, req.body?.password, req.id)));
api.get('/auth/me', authenticate(), async (req, res) => {
  const u = await q1('SELECT id, username, role, admin_scope, display_name, person_code, locale FROM app_user WHERE id = ?', [req.user.id]);
  if (!u) throw HttpError(401, 'Tài khoản không còn tồn tại');
  res.json(publicUser(u));
});

// ---------------- tri thức (công khai – không có dữ liệu cá nhân) ----------------
api.get('/knowledge', async (req, res) => {
  const kb = await loadKb(req.query.set || null);
  res.set('Cache-Control', 'public, max-age=300').json(kb);
});

// ---------------- học sinh ----------------
const maskRow = (s, user) => ({
  id: s.id, dataset: s.dataset, name: canSeePii(user) ? s.full_name : s.name_masked, nameMasked: s.name_masked,
  dob: canSeePii(user) ? s.dob : null, birthYear: s.birth_year, gender: s.gender, grade: s.grade, preferredEnv: s.preferred_env,
  targetMajorText: s.target_major_text, targetMajorId: s.target_major_id, edgeCase: s.edge_case, simulated: !!s.is_simulated,
});

/** Danh sách HS được xem (tên che với Admin) + tóm tắt Top-1 tính tại chỗ theo persona của người xem. */
api.get('/students', authenticate(), async (req, res) => {
  const ids = await visibleStudentIds(req.user);
  const dataset = req.query.dataset === 'ASS2_300' ? 'ASS2_300' : 'SIM_120';
  let rows;
  if (ids === null) rows = await q('SELECT * FROM student WHERE dataset = ? ORDER BY id', [dataset]);
  else if (!ids.length) rows = [];
  else rows = await q(`SELECT * FROM student WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids);
  const kb = await loadKb();
  const persona = ['HS', 'PH', 'TVV'].includes(req.query.persona) ? req.query.persona : defaultPersona(req.user.role);
  const out = [];
  for (const full of await loadStudents(rows)) {
    const s = full;
    const r = computeFor(full, kb, sanitizeOptions({ persona }, kb, persona));
    const t1 = r.result.top[0];
    // màn hình tổng hợp: luôn tên viết tắt + năm sinh, kể cả với TVV (Ch6, TC08)
    out.push({ ...maskRow(s, { role: 'admin' }), top1: t1 ? { profile: t1.profile, label: t1.label, C: t1.C, EC: t1.EC } : null,
      worstWarning: r.warnings.some((w) => w.level === 'red') ? 'red' : r.warnings.some((w) => w.level === 'yellow') ? 'yellow' : 'grey' });
  }
  const label = req.query.label;
  res.json({ persona, students: label ? out.filter((s) => s.top1?.label === label) : out });
});

api.get('/students/:id', authenticate(), async (req, res) => {
  await assertCanSee(req.user, req.params.id);
  const s = await loadStudent(req.params.id);
  const body = { ...maskRow(s, req.user), skills: s.skills, exam: s.exam, topStrengths: [s.top_strength_1, s.top_strength_2, s.top_strength_3] };
  if (canSeeContext(req.user)) body.context = await q1('SELECT * FROM student_context WHERE student_id = ?', [s.id]);
  res.json(body);
});

/** Tính (và lưu) kết quả. body = tùy chọn What-if; save=false để thử nhanh không ghi DB. */
api.post('/students/:id/runs', authenticate(), requireRole('student', 'parent', 'counselor', 'admin'), async (req, res) => {
  await assertCanSee(req.user, req.params.id);
  const kb = await loadKb();
  const s = await loadStudent(req.params.id);
  const opt = sanitizeOptions(req.body, kb, defaultPersona(req.user.role));
  const targetMajorId = req.body?.targetMajorId != null && /^\d+$/.test(String(req.body.targetMajorId)) ? Number(req.body.targetMajorId) : undefined;
  const out = computeFor(s, kb, opt, { targetMajorId });
  const isWhatif = Boolean(req.body?.whatif);
  let runId = null;
  const readOnlyAdmin = req.user.role === 'admin' && ['auditor', 'demo'].includes(req.user.scope);
  if (req.body?.save !== false && !readOnlyAdmin) runId = await persistRun(out, { studentId: s.id, userId: req.user.id, kb, isWhatif });
  if (!canSeePii(req.user)) out.sig = redactSignals(out.sig); // Admin: không trả tên, ngày/tháng sinh, dãy chữ số
  res.json({ runId, ...out });
});

api.get('/students/:id/runs', authenticate(), async (req, res) => {
  await assertCanSee(req.user, req.params.id);
  res.json(await q(`SELECT r.id, r.persona, p.code AS param_set, r.normalize_minmax, r.is_whatif, r.created_at, rr.profile_id AS top1, rr.label AS top1_label
    FROM run r JOIN parameter_set p ON p.id = r.param_set_id LEFT JOIN run_result rr ON rr.run_id = r.id AND rr.rank_no = 1
    WHERE r.student_id = ? ORDER BY r.created_at DESC LIMIT 50`, [req.params.id]));
});

api.get('/runs/:id', authenticate(), async (req, res) => {
  const run = await q1('SELECT r.*, p.code AS param_set FROM run r JOIN parameter_set p ON p.id = r.param_set_id WHERE r.id = ?', [req.params.id]);
  if (!run) throw HttpError(404, 'Không tìm thấy lần tính');
  await assertCanSee(req.user, run.student_id);
  const [results, warnings, explanations] = await Promise.all([
    q('SELECT * FROM run_result WHERE run_id = ? ORDER BY rank_no IS NULL, rank_no, profile_id', [run.id]),
    q('SELECT * FROM run_warning WHERE run_id = ? ORDER BY seq', [run.id]),
    q('SELECT profile_id, template_code, text_vi FROM explanation WHERE run_id = ?', [run.id]),
  ]);
  res.json({ run, results, warnings, explanations });
});

// ---------------- tầng giải thích L3 / L6 / L7 (công khai, chỉ tri thức) ----------------
api.get('/layers/l3', async (_req, res) => {
  res.json({ mapping: await q('SELECT * FROM v_l3_mapping ORDER BY archetype_no, profile_id, major_id'),
    numberArchetype: await q('SELECT * FROM number_archetype_map ORDER BY number') });
});
api.get('/layers/l6', async (_req, res) => {
  const [meanings, rules, formulas, sources, citations, glossary] = await Promise.all([
    q('SELECT * FROM number_meaning ORDER BY school_code, number'), q('SELECT * FROM calc_rule ORDER BY code'),
    q('SELECT * FROM formula ORDER BY layer, code'), q('SELECT * FROM source_book ORDER BY kind, code'),
    q('SELECT * FROM v_l6_rule_citation'), q('SELECT * FROM glossary ORDER BY group_code, term'),
  ]);
  res.json({ meanings, rules, formulas, sources, citations, glossary });
});
api.get('/layers/l7', async (_req, res) => {
  const [docs, lineage, release] = await Promise.all([
    q('SELECT doc_type, item_key, seq, content, src_ref FROM ref_document ORDER BY doc_type, seq'),
    q(`SELECT 'major' AS tbl, COUNT(*) AS n, MIN(src_ref) AS example_src FROM major UNION ALL SELECT 'major_profile', COUNT(*), MIN(src_ref) FROM major_profile
       UNION ALL SELECT 'number_meaning', COUNT(*), MIN(src_ref) FROM number_meaning UNION ALL SELECT 'calc_rule', COUNT(*), MIN(src_ref) FROM calc_rule
       UNION ALL SELECT 'letter_mapping', COUNT(*), MIN(src_ref) FROM letter_mapping UNION ALL SELECT 'archetype', COUNT(*), MIN(src_ref) FROM archetype
       UNION ALL SELECT 'admission_benchmark', COUNT(*), MIN(src_ref) FROM admission_benchmark UNION ALL SELECT 'whatif_scenario', COUNT(*), MIN(src_ref) FROM whatif_scenario`),
    q1('SELECT id, label, content_hash, created_at, note FROM kb_release ORDER BY id DESC LIMIT 1'),
  ]);
  res.json({ docs, lineage, release });
});

// ---------------- Admin ----------------
api.get('/admin/audit', authenticate(), requireRole('admin'), async (req, res) => {
  res.json(await q(`SELECT a.id, a.at, u.display_name AS user, a.action, a.table_name, a.row_key, a.before_json, a.after_json, a.reason
    FROM audit_log a LEFT JOIN app_user u ON u.id = a.user_id ORDER BY a.at DESC LIMIT 200`));
});

/** TC11: Admin tri thức sửa ý nghĩa con số → audit_log cùng transaction; khóa lạc quan bằng row_version. */
api.put('/admin/number-meanings/:id', authenticate(), requireAdminScope('kb'), async (req, res) => {
  const { meaning, vocations, reason, rowVersion } = req.body || {};
  if (!reason || String(reason).trim().length < 5) throw HttpError(400, 'Cần nhập lý do thay đổi (≥ 5 ký tự)');
  if (meaning != null && !String(meaning).trim()) throw HttpError(400, 'Ý nghĩa không được để trống');
  const result = await tx(async (conn) => {
    const [[before]] = await conn.execute('SELECT * FROM number_meaning WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!before) throw HttpError(404, 'Không tìm thấy');
    if (rowVersion != null && Number(rowVersion) !== before.row_version) throw HttpError(409, 'Dữ liệu đã được người khác sửa – tải lại rồi thử lại');
    const after = { ...before, meaning: meaning ?? before.meaning, vocations: vocations ?? before.vocations, row_version: before.row_version + 1 };
    await conn.execute('UPDATE number_meaning SET meaning = ?, vocations = ?, row_version = ?, updated_by = ? WHERE id = ?',
      [after.meaning, after.vocations, after.row_version, req.user.id, before.id]);
    await audit({ conn, userId: req.user.id, action: 'UPDATE', table: 'number_meaning', rowKey: String(before.id),
      before: { meaning: before.meaning, vocations: before.vocations, row_version: before.row_version },
      after: { meaning: after.meaning, vocations: after.vocations, row_version: after.row_version }, reason, requestId: req.id });
    return after;
  });
  invalidateKb();
  res.json(result);
});

// ---------------- lỗi ----------------
api.use((_req, _res, next) => next(HttpError(404, 'Không có API này')));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(`[${req.id}]`, err);
  res.status(status).json({ error: status >= 500 ? 'Lỗi máy chủ' : err.message, requestId: req.id });
});

export { LABELS };
