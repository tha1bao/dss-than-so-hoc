// Test API trên DB thật theo 18 kịch bản test (KichBan_Test). Chạy: DEMO_PASSWORD=... npm run test:api
// Chỉ lưu 1 lần tính (xóa ở cuối); bản ghi audit đăng nhập được giữ (audit_log chỉ thêm, không xóa).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { pool, q } from '../server/db.js';

const PW = process.env.DEMO_PASSWORD;
const tokens = {};
const as = (u) => ({ Authorization: `Bearer ${tokens[u]}` });
const login = async (u) => { const r = await request(app).post('/api/auth/login').send({ username: u, password: PW }); expect(r.status).toBe(200); tokens[u] = r.body.token; return r.body; };
const run = (u, id, body = {}) => request(app).post(`/api/students/${id}/runs`).set(as(u)).send({ save: false, ...body });
const savedRuns = [];

beforeAll(async () => {
  if (!PW) throw new Error('Đặt DEMO_PASSWORD trước khi chạy test API');
  for (const u of ['sim-hs001', 'sim-hs004', 'sim-ph001', 'sim-tvv01', 'sim-ad01', 'sim-ad03', 'sim-ad04']) await login(u);
});
afterAll(async () => {
  for (const id of savedRuns) await q('DELETE FROM run WHERE id = ?', [id]);
  await pool.end();
});

describe('Tri thức DB = tri thức của engine.py (fixture)', () => {
  it('bảng chữ, chữ ghép, bảng thứ, 35 hồ sơ, w, p, ngưỡng, α/β/γ v6/A/B trùng khớp', async () => {
    const { default: FX } = await import('./fixtures/engine_py.json');
    const kb = (await request(app).get('/api/knowledge')).body;
    expect(kb.letters).toEqual(FX.kb.letters);
    expect(kb.digraphs).toEqual(FX.kb.digraphs);
    expect(kb.weekdayKey).toEqual(FX.kb.weekdayKey);
    expect(kb.profiles.map((p) => ({ id: p.id, A: p.A, env: kb.envsEn[p.env] }))).toEqual(FX.kb.profiles);
    expect(kb.params).toEqual(FX.kb.params);
    expect(kb.weights).toEqual(FX.kb.weights);
    expect(kb.paramSet.code).toBe('A');
  });
});

describe('Hệ thống & đăng nhập', () => {
  it('health: DB TiDB + engine', async () => {
    const r = await request(app).get('/api/health');
    expect(r.body.ok).toBe(true); expect(r.body.db).toMatch(/TiDB/);
  });
  it('sai mật khẩu → 401, không lộ lý do', async () => {
    const r = await request(app).post('/api/auth/login').send({ username: 'sim-hs001', password: 'sai' });
    expect(r.status).toBe(401); expect(r.body.error).toBe('Sai tên đăng nhập hoặc mật khẩu');
  });
  it('không có token → 401', async () => expect((await request(app).get('/api/students')).status).toBe(401));
  it('/auth/me trả vai trò, tên viết tắt', async () => {
    const r = await request(app).get('/api/auth/me').set(as('sim-hs001'));
    expect(r.body).toMatchObject({ role: 'student', personCode: 'SIM-HS001', displayName: 'L. N. Trang' });
  });
});

describe('Học sinh', () => {
  it('TC01: sim-hs001 – Top-1 P06 · Cân nhắc · EC 1; lưu lần tính đủ 35 hồ sơ', async () => {
    const r = await run('sim-hs001', 'SIM-HS001', { save: true });
    expect(r.status).toBe(200);
    const t = r.body.result.top[0];
    expect([t.profile, t.label, t.EC]).toEqual(['P06', 'Cân nhắc', 1]);
    expect(typeof r.body.runId).toBe('string');
    savedRuns.push(r.body.runId);
    const g = await request(app).get(`/api/runs/${r.body.runId}`).set(as('sim-hs001'));
    expect(g.body.results).toHaveLength(35);
    expect(g.body.results[0]).toMatchObject({ profile_id: 'P06', rank_no: 1, label: 'Cân nhắc' });
    expect(g.body.explanations.length).toBeGreaterThan(0);
  });
  it('TC02: thanh đóng góp α·NF* + β·SR* + γ·ENV* = C; KPI đủ 6', async () => {
    const r = await run('sim-hs001', 'SIM-HS001');
    for (const row of r.body.result.top) expect(row.contrib.NF + row.contrib.SR + row.contrib.ENV).toBeCloseTo(row.C, 12);
    expect(r.body.kpis.map((k) => k.code)).toEqual(['K_LABEL', 'K_EC', 'K_SR', 'K_WEAK', 'K_STAB', 'K_ADMIT']);
    expect(r.body.explanations.P06[0].text).toMatch(/mức tương hợp tương đối/);
  });
  it('TC03: G1 = 2 từ tổng 20', async () => {
    const r = await run('sim-hs001', 'SIM-HS001');
    expect([r.body.sig.rulingRaw, r.body.sig.G1]).toEqual([20, 2]);
  });
  it('TC04: SIM-HS004 Top-1 Thử thách → "Ưu tiên tốt nhất" = P11 (hạng 6)', async () => {
    const r = await run('sim-hs004', 'SIM-HS004');
    expect(r.body.result.top[0].label).toBe('Thử thách');
    expect([r.body.result.bestPriority.profile, r.body.result.bestPriority.rank]).toEqual(['P11', 6]);
    expect(r.body.bestPriorityText.text).toMatch(/P11/);
  });
  it('TC05: What-if tăng kỹ năng yếu nhất của ngành mục tiêu +1 → Bước 5 giảm số bậc', async () => {
    const r0 = await run('sim-hs001', 'SIM-HS001');
    const t = r0.body.target.analysis;
    const weakest = t.row.A[t.row.KN.indexOf(Math.min(...t.row.KN))];
    const r1 = await run('sim-hs001', 'SIM-HS001', { delta: { [weakest]: 1 }, whatif: true });
    expect(r1.body.target.analysis.stepsWeak).toBeLessThanOrEqual(t.stepsWeak);
    expect(r1.body.target.analysis.row.SR).toBeGreaterThan(t.row.SR);
  });
});

describe('Phụ huynh & phân quyền', () => {
  it('TC06: sim-ph001 xem con SIM-HS002, persona PH: Top-1 P03 (Thử thách)', async () => {
    const r = await run('sim-ph001', 'SIM-HS002');
    expect(r.body.result.persona).toBe('PH');
    expect([r.body.result.top[0].profile, r.body.result.top[0].label]).toEqual(['P03', 'Thử thách']);
  });
  it('TC07: phụ huynh mở hồ sơ HS khác → 403', async () => {
    expect((await request(app).get('/api/students/SIM-HS003').set(as('sim-ph001'))).status).toBe(403);
    expect((await run('sim-ph001', 'SIM-HS003')).status).toBe(403);
  });
  it('HS không xem được HS khác', async () => expect((await request(app).get('/api/students/SIM-HS002').set(as('sim-hs001'))).status).toBe(403));
});

describe('Tư vấn viên', () => {
  it('TC08: danh sách HS phụ trách, lọc Thử thách, tên viết tắt', async () => {
    const all = await request(app).get('/api/students').set(as('sim-tvv01'));
    const assigned = (await q("SELECT student_id FROM counselor_assignment WHERE counselor_id = 'SIM-TVV01'")).map((x) => x.student_id).sort();
    expect(all.body.students.map((s) => s.id).sort()).toEqual(assigned);
    for (const s of all.body.students) { expect(s.name).toBe(s.nameMasked); expect(s.dob).toBeNull(); }
    const f = await request(app).get('/api/students?label=Thử thách').set(as('sim-tvv01'));
    expect(f.body.students.every((s) => s.top1.label === 'Thử thách')).toBe(true);
  });
  it('TC09: so sánh 3 persona + độ ổn định Top-1', async () => {
    const out = {};
    for (const p of ['HS', 'PH', 'TVV']) out[p] = (await run('sim-tvv01', 'SIM-HS001', { persona: p })).body;
    expect(Object.values(out).every((b) => b.result.top.length === 3)).toBe(true);
    expect(out.HS.stability.of).toBe(5);
    expect(out.HS.kpis.find((k) => k.code === 'K_STAB').value).toBe(out.HS.stability.count);
  });
  it('TVV thấy hoàn cảnh HS phụ trách; HS không thấy', async () => {
    expect((await request(app).get('/api/students/SIM-HS001').set(as('sim-tvv01'))).body.context).toBeTruthy();
    expect((await request(app).get('/api/students/SIM-HS001').set(as('sim-hs001'))).body.context).toBeUndefined();
  });
  it('TC10: L6–L7 có nguồn tệp › sheet › dòng và trích dẫn sách', async () => {
    const l6 = (await request(app).get('/api/layers/l6')).body;
    expect(l6.meanings.every((m) => /›/.test(m.src_ref))).toBe(true);
    expect(l6.citations.length).toBeGreaterThan(100);
    const l7 = (await request(app).get('/api/layers/l7')).body;
    expect(l7.lineage.find((x) => x.tbl === 'major').n).toBe(300);
  });
});

describe('Admin', () => {
  it('TC11: sim-ad01 sửa ý nghĩa số 7 → audit_log trước/sau; khôi phục lại', async () => {
    const m = (await q("SELECT * FROM number_meaning WHERE school_code = 'PY' AND number = 7"))[0];
    const r = await request(app).put(`/api/admin/number-meanings/${m.id}`).set(as('sim-ad01'))
      .send({ meaning: `${m.meaning} [test]`, reason: 'Kiểm thử TC11', rowVersion: m.row_version });
    expect(r.status).toBe(200);
    const a = (await q("SELECT * FROM audit_log WHERE table_name = 'number_meaning' AND row_key = ? ORDER BY at DESC LIMIT 1", [String(m.id)]))[0];
    expect(a.before_json.meaning).toBe(m.meaning); expect(a.after_json.meaning).toBe(`${m.meaning} [test]`); expect(a.reason).toBe('Kiểm thử TC11');
    const stale = await request(app).put(`/api/admin/number-meanings/${m.id}`).set(as('sim-ad01')).send({ meaning: 'x', reason: 'thử ghi đè', rowVersion: m.row_version });
    expect(stale.status).toBe(409);
    const back = await request(app).put(`/api/admin/number-meanings/${m.id}`).set(as('sim-ad01'))
      .send({ meaning: m.meaning, reason: 'Khôi phục sau kiểm thử TC11', rowVersion: m.row_version + 1 });
    expect(back.status).toBe(200);
  });
  it('TC12: sim-ad03 (kiểm định) sửa dữ liệu → 403', async () => {
    const r = await request(app).put('/api/admin/number-meanings/1').set(as('sim-ad03')).send({ meaning: 'x', reason: 'thử sửa' });
    expect(r.status).toBe(403);
  });
  it('Admin chỉ thấy tên viết tắt, không có ngày sinh', async () => {
    const r = await request(app).get('/api/students/SIM-HS001').set(as('sim-ad04'));
    expect(r.body.name).toBe('L. N. Trang'); expect(r.body.dob).toBeNull();
  });
});

describe('Client What-if = server (engine dùng chung)', () => {
  it('tính lại từ sig đã che (Admin) cho đúng Top-3, C, nhãn, KPI, cảnh báo; không lộ ngày sinh', async () => {
    const { computeView, sanitizeOptions, findMajor } = await import('../shared/engine/view.js');
    const kb = (await request(app).get('/api/knowledge')).body;
    for (const id of ['SIM-HS001', 'SIM-HS004', 'SIM-HS073', 'SIM-HS011']) {
      const srv = (await run('sim-ad04', id, { persona: 'HS', delta: { 7: 1 } })).body;
      expect(srv.sig.redacted).toBe(true);
      expect(srv.sig.digits).toBeUndefined(); expect(srv.sig.input).toEqual({ year: srv.sig.input.year }); expect(srv.sig.name.words).toBeUndefined();
      const s = (await request(app).get(`/api/students/${id}`).set(as('sim-ad04'))).body;
      const m = s.targetMajorId ? { targetMajorId: s.targetMajorId } : s.targetMajorText ? { targetText: findMajor(kb, s.targetMajorText) ? undefined : s.targetMajorText } : {};
      const cli = computeView({ sig: srv.sig, skills: s.skills, env: s.preferredEnv, tops: s.topStrengths.filter((x) => x != null), simulated: s.simulated, exam: s.exam, ...m },
        kb, sanitizeOptions({ persona: 'HS', delta: { 7: 1 } }, kb, 'TVV'));
      expect(cli.result.top.map((r) => [r.profile, r.C, r.label])).toEqual(srv.result.top.map((r) => [r.profile, r.C, r.label]));
      expect(cli.kpis).toEqual(srv.kpis);
      expect(cli.warnings).toEqual(srv.warnings);
    }
  });
});

describe('Cảnh báo ngoài phạm vi (TC-E1 … TC-E6)', () => {
  const cases = [['SIM-HS071', ['V_DOB']], ['SIM-HS072', ['V_TZ']], ['SIM-HS073', ['V_MAJOR']], ['SIM-HS074', ['V_EC0']],
    ['SIM-HS075', ['V_EC0', 'V_CONFLICT']], ['SIM-HS011', ['V_CHAR', 'V_NAME_LEN']]];
  for (const [id, codes] of cases) {
    it(`${id}: ${codes.join(', ')}`, async () => {
      const r = await run('sim-ad04', id, { persona: 'HS' });
      const got = r.body.warnings.filter((w) => w.level !== 'grey').map((w) => w.code);
      for (const c of codes) expect(got).toContain(c);
    });
  }
});
