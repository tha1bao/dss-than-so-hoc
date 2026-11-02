// Đăng nhập 4 vai trò (bcrypt + JWT) và kiểm soát truy cập theo HS (Ch6 – chỉ ai liên quan mới thấy dữ liệu HS).
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { q, q1 } from './db.js';
import { audit } from './audit.js';

const SECRET = process.env.JWT_SECRET;
const TTL = process.env.JWT_TTL || '8h';
export const HttpError = (status, message) => Object.assign(new Error(message), { status });

// chống dò mật khẩu đơn giản: tối đa 10 lần sai / 15 phút / tên đăng nhập (bộ nhớ tiến trình)
const fails = new Map();
const tooMany = (u) => { const f = fails.get(u); return f && f.n >= 10 && Date.now() - f.at < 15 * 60 * 1000; };

export async function login(username, password, reqId) {
  const u = String(username || '').trim().toLowerCase();
  if (!u || !password) throw HttpError(400, 'Thiếu tên đăng nhập hoặc mật khẩu');
  if (tooMany(u)) throw HttpError(429, 'Sai quá nhiều lần, thử lại sau 15 phút');
  const user = await q1('SELECT id, username, password_hash, role, admin_scope, display_name, person_code, locale, is_active FROM app_user WHERE username = ?', [u]);
  const ok = user && user.is_active && (await bcrypt.compare(String(password), user.password_hash));
  if (!ok) {
    const f = fails.get(u) ?? { n: 0, at: Date.now() }; f.n += 1; f.at = Date.now(); fails.set(u, f);
    await audit({ userId: user?.id ?? null, action: 'LOGIN_FAIL', table: 'app_user', rowKey: u, requestId: reqId });
    throw HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu');
  }
  fails.delete(u);
  await q('UPDATE app_user SET last_login_at = NOW() WHERE id = ?', [user.id]);
  await audit({ userId: user.id, action: 'LOGIN', table: 'app_user', rowKey: u, requestId: reqId });
  const claims = { sub: user.id, role: user.role, scope: user.admin_scope, person: user.person_code };
  return { token: jwt.sign(claims, SECRET, { expiresIn: TTL }), user: publicUser(user) };
}

export const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role, adminScope: u.admin_scope ?? null,
  displayName: u.display_name, personCode: u.person_code, locale: u.locale ?? 'vi' });

/** Middleware: đọc Bearer token. `required=false` cho route công khai (vẫn gắn req.user nếu có). */
export const authenticate = (required = true) => (req, _res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return required ? next(HttpError(401, 'Cần đăng nhập')) : next();
  try {
    const c = jwt.verify(token, SECRET);
    req.user = { id: String(c.sub), role: c.role, scope: c.scope ?? null, person: c.person };
    next();
  } catch { next(HttpError(401, 'Phiên đăng nhập hết hạn hoặc không hợp lệ')); }
};

export const requireRole = (...roles) => (req, _res, next) =>
  (roles.includes(req.user?.role) ? next() : next(HttpError(403, 'Vai trò không có quyền này')));

/** Admin có phạm vi: kb (tri thức), major (ngành), system; auditor/demo chỉ xem (TC12). */
export const requireAdminScope = (...scopes) => (req, _res, next) =>
  (req.user?.role === 'admin' && scopes.includes(req.user.scope) ? next() : next(HttpError(403, 'Tài khoản chỉ có quyền xem')));

/** Danh sách id HS mà người dùng được xem; null = tất cả (admin). */
export async function visibleStudentIds(user) {
  switch (user.role) {
    case 'admin': return null;
    case 'student': return [user.person];
    case 'parent': return (await q('SELECT child_id FROM parent WHERE id = ?', [user.person])).map((r) => r.child_id);
    case 'counselor': return (await q('SELECT student_id FROM counselor_assignment WHERE counselor_id = ?', [user.person])).map((r) => r.student_id);
    default: return [];
  }
}

export async function assertCanSee(user, studentId) {
  const ids = await visibleStudentIds(user);
  if (ids !== null && !ids.includes(studentId)) throw HttpError(403, 'Bạn không có quyền xem hồ sơ học sinh này');
}

/** Có được thấy họ tên đầy đủ + ngày sinh không: HS chính mình, PH của HS, TVV phụ trách. Admin chỉ thấy bản che. */
export const canSeePii = (user) => ['student', 'parent', 'counselor'].includes(user.role);
/** Thông tin hoàn cảnh (dân tộc, thu nhập…): chỉ TVV phụ trách và Admin. */
export const canSeeContext = (user) => ['counselor', 'admin'].includes(user.role);
/** Persona mặc định theo vai trò. */
export const defaultPersona = (role) => ({ student: 'HS', parent: 'PH', counselor: 'TVV' }[role] ?? 'TVV');
