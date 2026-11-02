// Đăng nhập · danh sách học sinh (tên viết tắt) · tự nhập (khách, không lưu) · Admin (audit + sửa tri thức).
import { useEffect, useMemo, useState } from 'react';
import { SKILL_ARCHS, skillCode, LABELS, parseDob, normalizeName } from '../../shared/engine/index.js';
import { api, getKnowledge, setSession, clearLayers } from '../api.js';
import { fmt, envName, skillName, PERSONA_NAME, ROLE_NAME } from '../format.js';
import { LabelChip, StatusIcon } from '../components/common.jsx';
import { t, tr, num, localizeKb } from '../i18n.js';

// ---------------- đăng nhập ----------------
const DEMO = [
  ['Học sinh', ['sim-hs001', 'sim-hs004', 'sim-hs021']], ['Phụ huynh', ['sim-ph001']], ['Tư vấn viên', ['sim-tvv01']],
  ['Quản trị', ['sim-ad01 (tri thức)', 'sim-ad03 (kiểm định – chỉ xem)', 'sim-ad05 (demo)']],
];
export function Login({ onLogin }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api('/auth/login', { method: 'POST', body: { username: u.trim(), password: p } }); setSession(r); onLogin(r); }
    catch (x) { setErr(x.message); } finally { setBusy(false); setP(''); }
  };
  return (
    <div className="login">
      <form className="panel" onSubmit={submit}>
        <h2 style={{ marginBottom: 10 }}>{t('Đăng nhập')}</h2>
        <label className="field"><span>{t('Tên đăng nhập')}</span><input type="text" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required /></label>
        <label className="field"><span>{t('Mật khẩu')}</span><input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? t('Đang đăng nhập…') : t('Đăng nhập')}</button>
        <p className="small muted" style={{ marginTop: 10 }}>{t('Sai 10 lần trong 15 phút sẽ bị khóa tạm. Phiên hết hạn sau 8 giờ hoặc khi đóng tab.')}</p>
        <p style={{ marginTop: 12 }}><a href="#/guest">{t('Dùng thử không cần đăng nhập (tự nhập, không lưu) →')}</a></p>
      </form>
      <section className="panel">
        <h2 style={{ marginBottom: 6 }}>{t('Tài khoản mô phỏng')}</h2>
        <p className="small muted" style={{ marginBottom: 8 }}>{t('120 người dùng giả lập (75 HS, 30 PH, 10 TVV, 5 Admin). Mật khẩu demo do nhóm cung cấp khi kiểm thử – không ghi trên trang.')}</p>
        <div className="demo-acc">
          {DEMO.map(([role, list]) => (
            <div key={role}><b className="small">{t(role)}</b>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {list.map((x) => <button key={x} type="button" className="btn" onClick={() => setU(x.split(' ')[0])}>{x.replace('(tri thức)', tr('(tri thức)', '(knowledge)')).replace('(kiểm định – chỉ xem)', tr('(kiểm định – chỉ xem)', '(auditor – read-only)'))}</button>)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------- danh sách học sinh ----------------
export function StudentList({ user, go }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [label, setLabel] = useState('');
  const [qry, setQry] = useState('');
  const [persona, setPersona] = useState('');
  const [dataset, setDataset] = useState('SIM_120');
  useEffect(() => {
    let on = true; setData(null);
    const qs = new URLSearchParams({ ...(persona ? { persona } : {}), dataset }).toString();
    api(`/students?${qs}`).then((d) => on && setData(d)).catch((e) => on && setErr(e.message));
    return () => { on = false; };
  }, [persona, dataset]);
  const rows = useMemo(() => (data?.students ?? []).filter((s) => (!label || s.top1?.label === label) && (!qry || `${s.id} ${s.name}`.toLowerCase().includes(qry.toLowerCase()))), [data, label, qry]);
  const counts = useMemo(() => Object.fromEntries(Object.values(LABELS).map((l) => [l, (data?.students ?? []).filter((s) => s.top1?.label === l).length])), [data]);
  const title = { parent: 'Con của bạn', counselor: 'Học sinh bạn phụ trách', admin: 'Tất cả học sinh' }[user.role] ?? 'Học sinh';
  return (
    <section className="panel">
      <div className="panel-head"><h2>{t(title)}</h2><span className="small muted">{t('Tên viết tắt + năm sinh (màn hình tổng hợp – Ch6). Top-1 tính tại chỗ theo persona.')}</span></div>
      <div className="filters">
        <input type="search" placeholder={t('Tìm mã / tên viết tắt…')} value={qry} onChange={(e) => setQry(e.target.value)} aria-label={t('Tìm học sinh')} />
        <select value={label} onChange={(e) => setLabel(e.target.value)} aria-label={t('Lọc theo nhãn Top-1')}>
          <option value="">{t('Mọi nhãn Top-1')}</option>
          {Object.values(LABELS).map((l) => <option key={l} value={l}>{t(l)} ({counts[l] ?? 0})</option>)}
        </select>
        <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Persona">
          <option value="">{tr('Persona mặc định', 'Default persona')} ({PERSONA_NAME[data?.persona] ?? '…'})</option>
          {Object.entries(PERSONA_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {user.role === 'admin' && (
          <select value={dataset} onChange={(e) => setDataset(e.target.value)} aria-label={t('Bộ dữ liệu')}>
            <option value="SIM_120">{t('75 HS mô phỏng (ASS3)')}</option><option value="ASS2_300">{t('300 HS ASS2')}</option>
          </select>
        )}
        <span className="small muted">{rows.length} {tr('học sinh', 'students')}</span>
      </div>
      {err && <p className="err">{err}</p>}
      {!data ? <p className="empty">{t('Đang tải và tính…')}</p> : (
        <div className="tbl-wrap" style={{ maxHeight: '64vh' }}>
          <table className="tbl">
            <thead><tr><th>{t('Mã')}</th><th>{t('Học sinh')}</th><th className="r">{t('Năm sinh')}</th><th className="r">{t('Lớp')}</th><th>{t('Môi trường')}</th><th>{t('Ngành mục tiêu')}</th><th>Top-1</th><th>{t('Nhãn')}</th><th className="r">C</th><th className="r">EC</th><th>{t('Cảnh báo')}</th></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id} onClick={() => go(`/s/${s.id}/l0`)} style={{ cursor: 'pointer' }}>
                <td><a href={`#/s/${s.id}/l0`}>{s.id}</a></td><td>{s.name}</td><td className="r">{s.birthYear}</td><td className="r">{s.grade ?? '—'}</td>
                <td className="small">{s.preferredEnv}</td><td className="small">{s.targetMajorText ?? '—'}</td>
                <td>{s.top1?.profile ?? '—'}</td><td>{s.top1 ? <LabelChip label={s.top1.label} /> : '—'}</td>
                <td className="r">{fmt(s.top1?.C)}</td><td className="r">{s.top1?.EC ?? 0}</td>
                <td><span className="status" title={s.worstWarning}><StatusIcon level={s.worstWarning === 'grey' ? 'grey' : s.worstWarning} />{s.worstWarning === 'red' ? ` ${t('ngoài phạm vi')}` : s.worstWarning === 'yellow' ? ` ${t('lưu ý')}` : ''}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------- tự nhập (khách) ----------------
/** Điểm mạnh STR = 3 kỹ năng cao nhất; bằng điểm → kỹ năng đứng trước (SK01 … SK33) – quy ước web ASS2. */
export const topStrengths = (skills) => SKILL_ARCHS.map((a, i) => ({ a, v: skills[a], i })).sort((x, y) => y.v - x.v || x.i - y.i).slice(0, 3).map((x) => x.a);

export function GuestForm({ initial, onSubmit }) {
  const [kb, setKb] = useState(null);
  const [f, setF] = useState(initial ?? { fullName: '', dob: '2010-01-01', skills: Object.fromEntries(SKILL_ARCHS.map((a) => [a, 3])), env: '', target: '', exam: {} });
  useEffect(() => { getKnowledge().then(setKb).catch(() => {}); }, []);
  const errs = {};
  if (normalizeName(f.fullName).words.filter(Boolean).length < 2) errs.fullName = t('Nhập họ và tên (ít nhất 2 âm tiết)');
  try { parseDob(f.dob); } catch { errs.dob = t('Ngày sinh không hợp lệ'); }
  if (!f.env) errs.env = t('Chọn môi trường mong muốn');
  const ok = !Object.keys(errs).length;
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  if (!kb) return <p className="empty">{t('Đang tải tri thức…')}</p>;
  const kbL = localizeKb(kb);
  return (
    <form className="panel" style={{ maxWidth: 860, margin: '0 auto' }} onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit({ ...f, tops: topStrengths(f.skills) }); }}>
      <h2 style={{ marginBottom: 4 }}>{t('Tự nhập thông tin')}</h2>
      <p className="small muted" style={{ marginBottom: 10 }}>{t('Tính hoàn toàn trên trình duyệt của bạn – không gửi họ tên/ngày sinh lên máy chủ, không lưu. Mô hình được xây trên dữ liệu học sinh sinh 2009–2011.')}</p>
      <div className="grid2">
        <div>
          <label className="field"><span>{t('Họ và tên (có dấu)')}</span><input type="text" value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} autoComplete="off" />{errs.fullName && f.fullName && <small className="err">{errs.fullName}</small>}</label>
          <label className="field"><span>{t('Ngày sinh')}</span><input type="date" value={f.dob} onChange={(e) => set({ dob: e.target.value })} />{errs.dob && <small className="err">{errs.dob}</small>}</label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 8px' }}>
            <legend style={{ fontWeight: 600, fontSize: '0.86rem' }}>{t('Môi trường làm việc mong muốn')}</legend>
            <div className="checks">{Object.entries(kbL.envs).map(([k, v]) => <label key={k}><input type="radio" name="env" checked={f.env === k} onChange={() => set({ env: k })} />{v}</label>)}</div>
          </fieldset>
          <label className="field"><span>{t('Ngành mục tiêu (không bắt buộc)')}</span>
            <input type="search" list="majors-guest" value={f.target} onChange={(e) => set({ target: e.target.value })} placeholder={t('Gõ tên ngành…')} />
            <datalist id="majors-guest">{kb.majors.map((m) => <option key={m.id} value={m.name_vi} />)}</datalist></label>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, fontSize: '0.86rem' }}>{t('Điểm thi dự kiến (không bắt buộc – chỉ dùng cho 18 ngành pilot HaUI)')}</legend>
            <div className="checks">{['A00', 'A01', 'D01', 'B00'].map((c) => (
              <label key={c}>{c} <input type="number" min="0" max="30" step="0.25" style={{ width: 70 }} value={f.exam[c] ?? ''}
                onChange={(e) => set({ exam: { ...f.exam, [c]: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label>
            ))}</div>
          </fieldset>
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: '0.86rem' }}>{t('Tự đánh giá 12 nhóm kỹ năng (1 = rất yếu … 5 = rất mạnh)')}</legend>
          <div className="likert">
            {SKILL_ARCHS.map((a) => (
              <div key={a} className="likert-row">
                <span id={`lk-${a}`}><b>{skillCode(a)}</b> {skillName(kbL, a)}</span>
                <span className="likert-scale" role="radiogroup" aria-labelledby={`lk-${a}`}>
                  {[1, 2, 3, 4, 5].map((v) => <button key={v} type="button" role="radio" aria-checked={f.skills[a] === v} onClick={() => set({ skills: { ...f.skills, [a]: v } })}>{v}</button>)}
                </span>
              </div>
            ))}
          </div>
        </fieldset>
      </div>
      {errs.env && <p className="small err">{errs.env}</p>}
      <button className="btn primary" disabled={!ok} style={{ marginTop: 8 }}>{t('Xem kết quả')}</button>
    </form>
  );
}

// ---------------- Admin ----------------
export function Admin({ user }) {
  const [tab, setTab] = useState('meanings');
  const [audit, setAudit] = useState(null);
  const [meanings, setMeanings] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const canEdit = user.adminScope === 'kb';
  const load = () => {
    api('/admin/audit').then(setAudit).catch((e) => setMsg(e.message));
    clearLayers(); api('/layers/l6').then((d) => setMeanings(d.meanings)).catch((e) => setMsg(e.message));
  };
  useEffect(load, []);
  const save = async () => {
    setMsg(null);
    try {
      await api(`/admin/number-meanings/${edit.id}`, { method: 'PUT', body: { meaning: edit.meaning, vocations: edit.vocations, reason: edit.reason, rowVersion: edit.row_version } });
      setEdit(null); setMsg(t('Đã lưu – audit_log đã ghi trước/sau.')); getKnowledge(true); load();
    } catch (e) { setMsg(e.message); }
  };
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('Quản trị tri thức')}</h2>
        <span className="small muted">{user.displayName} · {tr('phạm vi', 'scope')} {user.adminScope}{canEdit ? '' : tr(' – chỉ xem', ' – read-only')}</span>
      </div>
      <div className="seg" role="group" style={{ marginBottom: 10 }}>
        <button type="button" aria-pressed={tab === 'meanings'} onClick={() => setTab('meanings')}>{t('Ý nghĩa con số')} ({meanings?.length ?? '…'})</button>
        <button type="button" aria-pressed={tab === 'audit'} onClick={() => setTab('audit')}>{t('Nhật ký audit')} ({audit?.length ?? '…'})</button>
      </div>
      {msg && <p className="small" role="status" style={{ marginBottom: 8 }}>{msg}</p>}
      {tab === 'meanings' && meanings && (
        <div className="tbl-wrap" style={{ maxHeight: '64vh' }}>
          <table className="tbl">
            <thead><tr><th>{t('Trường phái · số')}</th><th>{t('Ý nghĩa')}</th><th>{t('Nghề phù hợp')}</th><th className="r">{t('Phiên bản')}</th><th /></tr></thead>
            <tbody>{meanings.map((m) => (edit?.id === m.id ? (
              <tr key={m.id}><td>{m.school_code} · {m.number}</td>
                <td><textarea rows={4} style={{ width: '100%' }} value={edit.meaning} onChange={(e) => setEdit({ ...edit, meaning: e.target.value })} aria-label={t('Ý nghĩa')} /></td>
                <td><textarea rows={4} style={{ width: '100%' }} value={edit.vocations ?? ''} onChange={(e) => setEdit({ ...edit, vocations: e.target.value })} aria-label={t('Nghề phù hợp')} /></td>
                <td colSpan={2}><input type="text" placeholder={t('Lý do thay đổi (bắt buộc)')} value={edit.reason ?? ''} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} aria-label={t('Lý do')} />
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}><button type="button" className="btn primary" onClick={save} disabled={(edit.reason ?? '').trim().length < 5}>{t('Lưu')}</button><button type="button" className="btn" onClick={() => setEdit(null)}>{t('Hủy')}</button></div></td></tr>
            ) : (
              <tr key={m.id}><td>{m.school_code} · {m.number}<br /><span className="src">{m.src_ref}</span></td><td className="small">{m.meaning}</td><td className="small">{m.vocations}</td>
                <td className="r">v{m.row_version}</td><td>{canEdit && <button type="button" className="btn" onClick={() => setEdit({ ...m, reason: '' })}>{t('Sửa')}</button>}</td></tr>
            )))}</tbody>
          </table>
        </div>
      )}
      {tab === 'audit' && audit && (
        <div className="tbl-wrap" style={{ maxHeight: '64vh' }}>
          <table className="tbl">
            <thead><tr><th>{t('Thời điểm (UTC)')}</th><th>{t('Người')}</th><th>{t('Hành động')}</th><th>{t('Bảng · khóa')}</th><th>{t('Lý do')}</th><th>{t('Trước → sau')}</th></tr></thead>
            <tbody>{audit.map((a) => (
              <tr key={a.id}><td className="num small">{a.at}</td><td>{a.user ?? '—'}</td><td>{a.action}</td><td>{a.table_name ?? '—'} {a.row_key ?? ''}</td><td className="small">{a.reason}</td>
                <td className="small">{a.before_json || a.after_json ? `${JSON.stringify(a.before_json)?.slice(0, 80) ?? '∅'} → ${JSON.stringify(a.after_json)?.slice(0, 80) ?? '∅'}` : ''}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export { ROLE_NAME, envName };
