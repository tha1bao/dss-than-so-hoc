// Đăng ký tài khoản mới + mã liên kết phụ huynh + duyệt tài khoản tư vấn viên.
// Không cần đổi schema: dùng app_user (is_active, is_simulated=FALSE), student (dataset='LIVE'), parent, counselor, audit_log.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { q, q1, tx } from './db.js';
import { audit } from './audit.js';
import { HttpError, issueToken } from './auth.js';
import { loadKb } from './kb.js';
import { SKILL_ARCHS, skillCode } from '../shared/engine/index.js';
import { validateRegistration, maskName, NEEDS_APPROVAL, LINK_ALPHABET } from '../shared/register.js';

const BCRYPT_ROUNDS = 10;

/** Mã liên kết PH ↔ HS: HMAC(JWT_SECRET, id HS) → 8 ký tự dễ đọc. Không lưu DB; đổi JWT_SECRET là đổi mã. */
export function linkCodeFor(studentId) {
  const mac = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`parent-link:${studentId}`).digest();
  return [...mac.subarray(0, 8)].map((b) => LINK_ALPHABET[b % LINK_ALPHABET.length]).join('');
}
const sameCode = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** id dạng LS3K9QZ2 (HS), LP… (PH), LT… (TVV) – vừa VARCHAR(12), không đoán được thứ tự. */
const newId = (prefix) => prefix + [...crypto.randomBytes(6)].map((b) => LINK_ALPHABET[b % LINK_ALPHABET.length]).join('');

// Giới hạn đơn giản theo IP: 10 lần đăng ký / giờ / tiến trình (serverless: mỗi instance riêng – đủ chặn spam thô).
const hits = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const h = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (h.length >= 10) throw HttpError(429, 'Đăng ký quá nhiều lần từ thiết bị này, thử lại sau 1 giờ');
  h.push(now); hits.set(ip, h);
}
export const _resetRateLimit = () => hits.clear();

const fieldError = (errors) => Object.assign(HttpError(400, Object.values(errors)[0]), { fields: errors });

export async function register(body, { ip = 'unknown', requestId = null } = {}) {
  rateLimit(ip);
  const kb = body?.role === 'student' ? await loadKb() : null;
  const { errors, value: v } = validateRegistration(body, { envs: kb?.envs });
  if (Object.keys(errors).length) throw fieldError(errors);

  if (await q1('SELECT id FROM app_user WHERE username = ?', [v.username])) throw fieldError({ username: 'Tên đăng nhập này đã có người dùng' });

  // PH: xác minh con bằng tên đăng nhập + mã liên kết (cùng một thông báo cho mọi trường hợp sai, tránh dò tài khoản)
  let child = null;
  if (v.role === 'parent') {
    child = await q1(`SELECT s.id FROM app_user u JOIN student s ON s.user_id = u.id WHERE u.username = ? AND u.role = 'student' AND u.is_active`, [v.childUsername]);
    if (!child || !sameCode(linkCodeFor(child.id), v.linkCode)) throw fieldError({ linkCode: 'Tên đăng nhập của con hoặc mã liên kết không đúng' });
  }

  const hash = await bcrypt.hash(v.password, BCRYPT_ROUNDS);
  const active = !NEEDS_APPROVAL.has(v.role);
  const masked = maskName(v.fullName);
  const prefix = { student: 'LS', parent: 'LP', counselor: 'LT' }[v.role];
  const personId = newId(prefix);
  const targetMajor = v.target && kb ? kb.majors.find((m) => m.name_vi.toLowerCase() === v.target.toLowerCase()) : null;

  const user = await tx(async (conn) => {
    const [r] = await conn.execute(`INSERT INTO app_user (username, password_hash, role, display_name, person_code, is_active, is_simulated)
      VALUES (?, ?, ?, ?, ?, ?, FALSE)`, [v.username, hash, v.role, masked, personId, active]);
    const userId = String(r.insertId);
    if (v.role === 'student') {
      const tops = SKILL_ARCHS.map((a, i) => ({ a, s: v.skills[a], i })).sort((x, y) => y.s - x.s || x.i - y.i).slice(0, 3).map((x) => x.a);
      await conn.execute(`INSERT INTO student (id, dataset, user_id, full_name, name_masked, gender, dob, grade, preferred_env,
        top_strength_1, top_strength_2, top_strength_3, target_major_text, target_major_id, is_simulated, src_ref)
        VALUES (?, 'LIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, 'Tự đăng ký trên web')`,
      [personId, userId, v.fullName, masked, v.gender, v.dob, v.grade, v.env, ...tops, v.target, targetMajor?.id ?? null]);
      await conn.query('INSERT INTO student_skill (student_id, skill_code, level) VALUES ?', [SKILL_ARCHS.map((a) => [personId, skillCode(a), v.skills[a]])]);
      const ex = Object.entries(v.exam);
      if (ex.length) await conn.query('INSERT INTO student_exam (student_id, combo, score) VALUES ?', [ex.map(([c, s]) => [personId, c, s])]);
    } else if (v.role === 'parent') {
      await conn.execute('INSERT INTO parent (id, user_id, full_name, name_masked, relation, child_id) VALUES (?, ?, ?, ?, ?, ?)',
        [personId, userId, v.fullName, masked, v.relation, child.id]);
    } else {
      await conn.execute('INSERT INTO counselor (id, user_id, full_name, name_masked, role_title, organization, years) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [personId, userId, v.fullName, masked, v.roleTitle, v.organization, v.years]);
    }
    await audit({ conn, userId, action: 'INSERT', table: 'app_user', rowKey: v.username, requestId,
      after: { role: v.role, person: personId, active, consent: true, ...(child ? { child: child.id } : {}) }, reason: 'Tự đăng ký' });
    return { id: userId, username: v.username, role: v.role, admin_scope: null, display_name: masked, person_code: personId, locale: 'vi' };
  }).catch((e) => {
    if (e?.code === 'ER_DUP_ENTRY') throw fieldError({ username: 'Tên đăng nhập này đã có người dùng' }); // hai người bấm cùng lúc
    throw e;
  });

  if (!active) return { pending: true, message: 'Đã gửi đăng ký. Tài khoản tư vấn viên cần quản trị viên duyệt trước khi đăng nhập.' };
  return issueToken(user);
}

/** HS xem mã liên kết của mình để đưa cho bố mẹ. */
export async function myLinkCode(user) {
  if (user.role !== 'student') throw HttpError(403, 'Chỉ học sinh có mã liên kết');
  const s = await q1('SELECT id FROM student WHERE user_id = ?', [user.id]);
  if (!s) throw HttpError(404, 'Không tìm thấy hồ sơ học sinh');
  const linked = await q('SELECT name_masked, relation FROM parent WHERE child_id = ?', [s.id]);
  return { code: linkCodeFor(s.id), parents: linked.map((p) => ({ name: p.name_masked, relation: p.relation })) };
}

/** Tài khoản chờ duyệt (TVV tự đăng ký). */
export const pendingUsers = () => q(`SELECT u.id, u.username, u.role, u.created_at, c.full_name, c.organization, c.role_title, c.years
  FROM app_user u JOIN counselor c ON c.user_id = u.id WHERE u.is_active = FALSE AND u.is_simulated = FALSE ORDER BY u.created_at`);

export async function decide(adminId, userId, approve, requestId) {
  return tx(async (conn) => {
    const [[u]] = await conn.execute('SELECT id, username, role, is_active FROM app_user WHERE id = ? AND is_simulated = FALSE FOR UPDATE', [userId]);
    if (!u) throw HttpError(404, 'Không tìm thấy tài khoản');
    if (u.is_active) throw HttpError(409, 'Tài khoản đã được kích hoạt');
    if (approve) {
      await conn.execute('UPDATE app_user SET is_active = TRUE WHERE id = ?', [u.id]);
      await audit({ conn, userId: adminId, action: 'ACTIVATE', table: 'app_user', rowKey: u.username, before: { is_active: false }, after: { is_active: true }, reason: 'Duyệt đăng ký tư vấn viên', requestId });
    } else {
      await conn.execute('DELETE FROM counselor WHERE user_id = ?', [u.id]);
      await conn.execute('DELETE FROM app_user WHERE id = ?', [u.id]);
      await audit({ conn, userId: adminId, action: 'DELETE', table: 'app_user', rowKey: u.username, before: { role: u.role, is_active: false }, reason: 'Từ chối đăng ký tư vấn viên', requestId });
    }
    return { id: String(u.id), username: u.username, approved: approve };
  });
}
