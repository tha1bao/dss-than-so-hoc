// Quy tắc đăng ký tài khoản – dùng chung cho form (client) và API (server) để thông báo lỗi giống nhau.
// Vai trò được tự đăng ký: học sinh, phụ huynh (kích hoạt ngay); tư vấn viên (chờ Quản trị hệ thống duyệt).
// Quản trị KHÔNG tự đăng ký được – do nhóm cấp.
import { SKILL_ARCHS } from './engine/score.js';
import { normalizeName, parseDob } from './engine/numerology.js';

export const SELF_ROLES = ['student', 'parent', 'counselor'];
/** Vai trò cần duyệt trước khi đăng nhập được (TVV được xem hồ sơ HS khác nên phải xác minh). */
export const NEEDS_APPROVAL = new Set(['counselor']);
export const RELATIONS = ['Bố', 'Mẹ', 'Người giám hộ'];
export const EXAM_COMBOS = ['A00', 'A01', 'D01', 'B00'];
export const GENDERS = ['Nam', 'Nữ', 'Khác'];

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const normUsername = (u) => String(u ?? '').trim().toLowerCase();

export function checkUsername(u) {
  const x = normUsername(u);
  if (!x) return 'Nhập tên đăng nhập';
  if (!USERNAME_RE.test(x)) return 'Tên đăng nhập dài 3–30 ký tự, chỉ gồm chữ thường không dấu, số và . _ -';
  if (x.startsWith('sim-')) return 'Tên bắt đầu bằng "sim-" dành cho tài khoản mô phỏng – hãy chọn tên khác';
  return null;
}

export function checkPassword(p, username = '') {
  const s = String(p ?? '');
  if (s.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự';
  if (new TextEncoder().encode(s).length > 72) return 'Mật khẩu quá dài (tối đa 72 byte)';
  if (!/\p{L}/u.test(s) || !/\d/.test(s)) return 'Mật khẩu cần có cả chữ và số';
  if (username && s.toLowerCase().includes(normUsername(username))) return 'Mật khẩu không được chứa tên đăng nhập';
  return null;
}

export function checkFullName(n) {
  const s = String(n ?? '').trim();
  if (s.length > 120) return 'Họ tên quá dài';
  if (normalizeName(s).words.filter(Boolean).length < 2) return 'Nhập họ và tên đầy đủ (ít nhất 2 âm tiết)';
  return null;
}

/** Ngày sinh HS: hợp lệ và trong khoảng tuổi THPT mở rộng (10–25 tuổi tại thời điểm đăng ký). */
export function checkStudentDob(dob, now = new Date()) {
  let p;
  try { p = parseDob(dob); } catch { return 'Ngày sinh không hợp lệ'; }
  const age = now.getUTCFullYear() - p.y;
  if (age < 10 || age > 25) return 'Ngày sinh cần nằm trong độ tuổi học sinh (10–25 tuổi)';
  return null;
}

/** "Nguyễn Gia Hà" → "N. G. Hà" – cùng quy ước với dữ liệu mô phỏng. */
export const maskName = (full) => {
  const w = String(full).trim().split(/\s+/);
  return w.length < 2 ? w[0] : [...w.slice(0, -1).map((x) => x[0].toUpperCase() + '.'), w.at(-1)].join(' ');
};

/**
 * Kiểm tra toàn bộ phiếu đăng ký. Trả về { errors: {field: message}, value } – value đã chuẩn hóa để server ghi DB.
 * @param {object} b      body gửi lên
 * @param {object} envs   bảng môi trường hợp lệ (kb.envs) – chỉ cần cho HS
 */
export function validateRegistration(b, { envs = null, now = new Date() } = {}) {
  const errors = {};
  const role = b?.role;
  if (!SELF_ROLES.includes(role)) errors.role = 'Chọn vai trò: học sinh, phụ huynh hoặc tư vấn viên';
  const username = normUsername(b?.username);
  const eu = checkUsername(username); if (eu) errors.username = eu;
  const ep = checkPassword(b?.password, username); if (ep) errors.password = ep;
  const ef = checkFullName(b?.fullName); if (ef) errors.fullName = ef;
  if (!b?.consent) errors.consent = 'Cần đồng ý với cách hệ thống dùng thông tin của bạn';
  const value = { role, username, password: String(b?.password ?? ''), fullName: String(b?.fullName ?? '').trim().replace(/\s+/g, ' ') };

  if (role === 'student') {
    const ed = checkStudentDob(b?.dob, now); if (ed) errors.dob = ed;
    if (b?.gender != null && b.gender !== '' && !GENDERS.includes(b.gender)) errors.gender = 'Giới tính không hợp lệ';
    const grade = b?.grade == null || b.grade === '' ? null : Number(b.grade);
    if (grade != null && ![10, 11, 12].includes(grade)) errors.grade = 'Lớp phải là 10, 11 hoặc 12';
    if (!b?.env || (envs && !(b.env in envs))) errors.env = 'Chọn môi trường làm việc bạn thích';
    const skills = {};
    for (const a of SKILL_ARCHS) {
      const v = Number(b?.skills?.[a]);
      if (!Number.isInteger(v) || v < 1 || v > 5) { errors.skills = 'Chấm đủ 12 kỹ năng (1–5)'; break; }
      skills[a] = v;
    }
    const exam = {};
    for (const c of EXAM_COMBOS) {
      const raw = b?.exam?.[c];
      if (raw == null || raw === '') continue;
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0 || v > 30) { errors.exam = `Điểm ${c} phải từ 0 đến 30`; break; }
      exam[c] = Math.round(v * 100) / 100;
    }
    const target = String(b?.target ?? '').trim().slice(0, 200);
    Object.assign(value, { dob: String(b?.dob ?? '').slice(0, 10), gender: b?.gender || null, grade, env: b?.env, skills, exam, target: target || null });
  } else if (role === 'parent') {
    const child = normUsername(b?.childUsername);
    if (!child) errors.childUsername = 'Nhập tên đăng nhập của con';
    const code = String(b?.linkCode ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-Z2-9]{8}$/.test(code)) errors.linkCode = 'Mã liên kết gồm 8 ký tự (lấy trong tài khoản của con)';
    if (!RELATIONS.includes(b?.relation)) errors.relation = 'Chọn quan hệ với học sinh';
    Object.assign(value, { childUsername: child, linkCode: code, relation: b?.relation });
  } else if (role === 'counselor') {
    const org = String(b?.organization ?? '').trim();
    if (org.length < 3 || org.length > 160) errors.organization = 'Nhập tên trường / đơn vị công tác';
    const title = String(b?.roleTitle ?? '').trim().slice(0, 120);
    const years = b?.years == null || b.years === '' ? null : Number(b.years);
    if (years != null && (!Number.isInteger(years) || years < 0 || years > 60)) errors.years = 'Số năm kinh nghiệm không hợp lệ';
    Object.assign(value, { organization: org, roleTitle: title || null, years });
  }
  return { errors, value };
}

/** Bảng chữ cho mã liên kết: bỏ 0/O/1/I/L để đọc – chép không nhầm. */
export const LINK_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
