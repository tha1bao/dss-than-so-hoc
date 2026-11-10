// Đăng ký tài khoản: quy tắc dùng chung + luồng API (HS / PH liên kết bằng mã / TVV chờ duyệt) trên DB giả lập trong bộ nhớ.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { validateRegistration, checkUsername, checkPassword, maskName } from '../shared/register.js';

const H = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-register';
  const db = { users: [], students: [], skills: [], exams: [], parents: [], counselors: [], audit: [], nextId: 1000 };
  const handle = (sql, p = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.startsWith('SELECT id FROM app_user WHERE username')) return [db.users.filter((u) => u.username === p[0]).map((u) => ({ id: u.id }))];
    if (s.startsWith('SELECT id, username, password_hash')) return [db.users.filter((u) => u.username === p[0])];
    if (s.startsWith('SELECT s.id FROM app_user u JOIN student s')) {
      const u = db.users.find((x) => x.username === p[0] && x.role === 'student' && x.is_active);
      return [u ? db.students.filter((st) => st.user_id === u.id).map((st) => ({ id: st.id })) : []];
    }
    if (s.startsWith('INSERT INTO app_user')) {
      if (db.users.some((u) => u.username === p[0])) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
      const id = String(db.nextId++);
      db.users.push({ id, username: p[0], password_hash: p[1], role: p[2], display_name: p[3], person_code: p[4], is_active: !!p[5], admin_scope: null, locale: 'vi', created_at: '2026-11-11 02:00:00' });
      return [{ insertId: id }];
    }
    if (s.startsWith('INSERT INTO student ')) { db.students.push({ id: p[0], user_id: p[1], full_name: p[2], name_masked: p[3], gender: p[4], dob: p[5], grade: p[6], env: p[7], tops: [p[8], p[9], p[10]], target_text: p[11], target_id: p[12] }); return [{}]; }
    if (s.startsWith('INSERT INTO student_skill')) { db.skills.push(...p[0]); return [{}]; }
    if (s.startsWith('INSERT INTO student_exam')) { db.exams.push(...p[0]); return [{}]; }
    if (s.startsWith('INSERT INTO parent')) { db.parents.push({ id: p[0], user_id: p[1], full_name: p[2], name_masked: p[3], relation: p[4], child_id: p[5] }); return [{}]; }
    if (s.startsWith('INSERT INTO counselor')) { db.counselors.push({ id: p[0], user_id: p[1], full_name: p[2], name_masked: p[3], role_title: p[4], organization: p[5], years: p[6] }); return [{}]; }
    if (s.startsWith('SELECT id FROM student WHERE user_id')) return [db.students.filter((x) => x.user_id === p[0]).map((x) => ({ id: x.id }))];
    if (s.startsWith('SELECT name_masked, relation FROM parent')) return [db.parents.filter((x) => x.child_id === p[0])];
    if (s.startsWith('SELECT u.id, u.username, u.role, u.created_at, c.full_name')) {
      return [db.users.filter((u) => !u.is_active && u.role === 'counselor').map((u) => ({ ...u, ...db.counselors.find((c) => c.user_id === u.id), id: u.id }))];
    }
    if (s.startsWith('SELECT id, username, role, is_active FROM app_user WHERE id')) return [db.users.filter((u) => u.id === String(p[0]))];
    if (s.startsWith('UPDATE app_user SET is_active = TRUE')) { db.users.find((u) => u.id === String(p[0])).is_active = true; return [{}]; }
    if (s.startsWith('UPDATE app_user SET last_login_at')) return [{}];
    if (s.startsWith('DELETE FROM counselor')) { db.counselors = db.counselors.filter((c) => c.user_id !== String(p[0])); return [{}]; }
    if (s.startsWith('DELETE FROM app_user')) { db.users = db.users.filter((u) => u.id !== String(p[0])); return [{}]; }
    if (s.startsWith('SELECT id, username, role, admin_scope, display_name')) return [db.users.filter((u) => u.id === String(p[0]))];
    throw new Error(`SQL chưa giả lập: ${s.slice(0, 80)}`);
  };
  return { db, handle };
});

vi.mock('../server/db.js', () => {
  const conn = { execute: async (sql, p) => H.handle(sql, p), query: async (sql, p) => H.handle(sql, p) };
  return {
    pool: conn,
    q: async (sql, p) => H.handle(sql, p)[0],
    q1: async (sql, p) => H.handle(sql, p)[0][0] ?? null,
    tx: async (fn) => fn(conn),
  };
});
vi.mock('../server/audit.js', () => ({ audit: async (e) => { H.db.audit.push(e); } }));
vi.mock('../server/kb.js', () => ({
  loadKb: async () => ({ envs: { COLLAB: 'Hợp tác', CREATE: 'Sáng tạo', LEAD: 'Lãnh đạo', STRUCT: 'Cấu trúc' }, majors: [{ id: 7, name_vi: 'Kế toán' }] }),
  invalidateKb: () => {},
}));

const { app } = await import('../server/app.js');
const { linkCodeFor, _resetRateLimit } = await import('../server/register.js');
const { issueToken } = await import('../server/auth.js');

const SKILLS = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33].map((a) => [a, 3]));
const student = (o = {}) => ({ role: 'student', username: 'minhanh.2010', password: 'hocsinh2026', consent: true, fullName: 'Nguyễn Minh Anh',
  dob: '2010-01-01', env: 'CREATE', skills: { ...SKILLS, 3: 5 }, grade: 11, gender: 'Nữ', target: 'kế toán', exam: { A01: 24.5 }, ...o });

beforeEach(() => { _resetRateLimit(); });

describe('Quy tắc dùng chung', () => {
  it('tên đăng nhập, mật khẩu, che tên', () => {
    expect(checkUsername('Ab')).toMatch(/3–30/);
    expect(checkUsername('sim-hs999')).toMatch(/mô phỏng/);
    expect(checkUsername('minh.anh_01')).toBeNull();
    expect(checkPassword('short1')).toMatch(/8 ký tự/);
    expect(checkPassword('chiconchu')).toMatch(/chữ và số/);
    expect(checkPassword('minhanh123', 'minhanh')).toMatch(/không được chứa/);
    expect(maskName('Nguyễn Minh Anh')).toBe('N. M. Anh');
  });
  it('không cho tự đăng ký quản trị', () => {
    expect(validateRegistration({ ...student(), role: 'admin' }).errors.role).toBeTruthy();
  });
  it('HS: thiếu kỹ năng / môi trường sai / ngoài độ tuổi đều bị chặn', () => {
    const { errors } = validateRegistration(student({ skills: { 1: 3 }, env: 'XYZ', dob: '1980-01-01' }), { envs: { CREATE: 1 }, now: new Date('2026-11-11') });
    expect(Object.keys(errors).sort()).toEqual(['dob', 'env', 'skills']);
  });
});

describe('API đăng ký', () => {
  let studentToken;
  it('HS đăng ký → tạo app_user + student LIVE + 12 kỹ năng + điểm thi, đăng nhập luôn', async () => {
    const r = await request(app).post('/api/auth/register').send(student());
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ username: 'minhanh.2010', role: 'student', displayName: 'N. M. Anh' });
    expect(r.body.token).toBeTruthy();
    studentToken = r.body.token;
    const st = H.db.students[0];
    expect(st).toMatchObject({ full_name: 'Nguyễn Minh Anh', dob: '2010-01-01', env: 'CREATE', grade: 11, target_id: 7 });
    expect(st.tops[0]).toBe(3); // kỹ năng cao nhất
    expect(H.db.skills).toHaveLength(12);
    expect(H.db.exams).toEqual([[st.id, 'A01', 24.5]]);
    expect(H.db.users[0].password_hash).not.toContain('hocsinh2026');
    expect(H.db.audit.at(-1)).toMatchObject({ action: 'INSERT', table: 'app_user', reason: 'Tự đăng ký' });
  });

  it('trùng tên đăng nhập → 400 kèm lỗi theo trường', async () => {
    const r = await request(app).post('/api/auth/register').send(student());
    expect(r.status).toBe(400);
    expect(r.body.fields.username).toMatch(/đã có/);
  });

  it('HS lấy mã liên kết; PH đăng ký sai mã bị chặn, đúng mã thì liên kết với con', async () => {
    const lc = await request(app).get('/api/auth/link-code').set('Authorization', `Bearer ${studentToken}`);
    expect(lc.status).toBe(200);
    expect(lc.body.code).toBe(linkCodeFor(H.db.students[0].id));
    expect(lc.body.code).toMatch(/^[A-Z2-9]{8}$/);
    const parent = { role: 'parent', username: 'me.minhanh', password: 'phuhuynh2026', consent: true, fullName: 'Trần Thị Lan', relation: 'Mẹ', childUsername: 'minhanh.2010' };
    const bad = await request(app).post('/api/auth/register').send({ ...parent, linkCode: 'AAAA2222' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields.linkCode).toBeTruthy();
    const ok = await request(app).post('/api/auth/register').send({ ...parent, linkCode: `${lc.body.code.slice(0, 4)}-${lc.body.code.slice(4).toLowerCase()}` });
    expect(ok.status).toBe(201);
    expect(ok.body.user.role).toBe('parent');
    expect(H.db.parents[0]).toMatchObject({ child_id: H.db.students[0].id, relation: 'Mẹ' });
    const again = await request(app).get('/api/auth/link-code').set('Authorization', `Bearer ${studentToken}`);
    expect(again.body.parents).toEqual([{ name: 'T. T. Lan', relation: 'Mẹ' }]);
  });

  it('PH không lấy được mã liên kết (chỉ HS)', async () => {
    const tok = issueToken(H.db.users.find((u) => u.role === 'parent')).token;
    expect((await request(app).get('/api/auth/link-code').set('Authorization', `Bearer ${tok}`)).status).toBe(403);
  });

  it('TVV đăng ký → chờ duyệt, đăng nhập bị báo chờ; Admin hệ thống duyệt thì đăng nhập được', async () => {
    const body = { role: 'counselor', username: 'cohuong.tv', password: 'tuvan2026x', consent: true, fullName: 'Lê Thu Hương', organization: 'THPT Chu Văn An', roleTitle: 'GV chủ nhiệm', years: 8 };
    const r = await request(app).post('/api/auth/register').send(body);
    expect(r.status).toBe(201);
    expect(r.body.pending).toBe(true);
    expect(r.body.token).toBeUndefined();
    const login1 = await request(app).post('/api/auth/login').send({ username: 'cohuong.tv', password: 'tuvan2026x' });
    expect(login1.status).toBe(403);
    expect(login1.body.error).toMatch(/chờ quản trị viên duyệt/);

    const kbAdmin = issueToken({ id: '1', username: 'sim-ad01', role: 'admin', admin_scope: 'kb', display_name: 'AD', person_code: 'SIM-AD01' }).token;
    const sysAdmin = issueToken({ id: '2', username: 'sim-ad04', role: 'admin', admin_scope: 'system', display_name: 'AD', person_code: 'SIM-AD04' }).token;
    const list = await request(app).get('/api/admin/pending-users').set('Authorization', `Bearer ${kbAdmin}`);
    expect(list.body.map((u) => u.username)).toEqual(['cohuong.tv']);
    const id = list.body[0].id;
    expect((await request(app).post(`/api/admin/users/${id}/approve`).set('Authorization', `Bearer ${kbAdmin}`)).status).toBe(403);
    const ap = await request(app).post(`/api/admin/users/${id}/approve`).set('Authorization', `Bearer ${sysAdmin}`);
    expect(ap.status).toBe(200);
    expect(H.db.audit.at(-1)).toMatchObject({ action: 'ACTIVATE' });
    const login2 = await request(app).post('/api/auth/login').send({ username: 'cohuong.tv', password: 'tuvan2026x' });
    expect(login2.status).toBe(200);
    expect(login2.body.user.role).toBe('counselor');
  });

  it('Admin hệ thống từ chối → xóa đăng ký TVV', async () => {
    const body = { role: 'counselor', username: 'gia.mao', password: 'tuvan2026y', consent: true, fullName: 'Phạm Văn Giả', organization: 'Không rõ' };
    await request(app).post('/api/auth/register').send(body);
    const id = H.db.users.find((u) => u.username === 'gia.mao').id;
    const sysAdmin = issueToken({ id: '2', username: 'sim-ad04', role: 'admin', admin_scope: 'system', display_name: 'AD', person_code: 'SIM-AD04' }).token;
    expect((await request(app).post(`/api/admin/users/${id}/reject`).set('Authorization', `Bearer ${sysAdmin}`)).status).toBe(200);
    expect(H.db.users.some((u) => u.username === 'gia.mao')).toBe(false);
    expect(H.db.counselors.some((c) => c.user_id === id)).toBe(false);
  });

  it('không tự đăng ký quản trị được; giới hạn 10 lần / giờ / IP', async () => {
    const adm = await request(app).post('/api/auth/register').send({ ...student({ username: 'hacker1' }), role: 'admin' });
    expect(adm.status).toBe(400);
    expect(H.db.users.some((u) => u.username === 'hacker1')).toBe(false);
    for (let i = 0; i < 9; i++) await request(app).post('/api/auth/register').set('X-Forwarded-For', '9.9.9.9').send({ role: 'student' });
    const last = await request(app).post('/api/auth/register').set('X-Forwarded-For', '9.9.9.9').send({ role: 'student' });
    expect(last.status).toBe(400);
    const blocked = await request(app).post('/api/auth/register').set('X-Forwarded-For', '9.9.9.9').send({ role: 'student' });
    expect(blocked.status).toBe(429);
  });
});
