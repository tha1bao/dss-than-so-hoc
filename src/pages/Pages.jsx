// Đăng nhập · danh sách học sinh (tên viết tắt) · tự nhập (khách, không lưu) · Admin (audit + sửa tri thức).
import { useEffect, useMemo, useState } from 'react';
import { SKILL_ARCHS, skillCode, LABELS, parseDob, normalizeName } from '../../shared/engine/index.js';
import { api, getKnowledge, setSession, clearLayers } from '../api.js';
import { fmt, envName, skillName, PERSONA_NAME, ROLE_NAME } from '../format.js';
import { LabelChip, StatusIcon, Term } from '../components/common.jsx';
import { envScenario, skillPlain, RATING_WORDS } from '../data/plain_inputs.js';
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
        <p className="guest-cta"><a className="btn primary" href="#/guest">{tr('Chưa có tài khoản? Dùng thử ngay, không cần đăng nhập →', 'No account? Try it now without logging in →')}</a></p>
        <h2 style={{ marginBottom: 4 }}>{t('Đăng nhập')}</h2>
        <p className="small muted" style={{ marginBottom: 10 }}>{tr('Dành cho học sinh, phụ huynh và tư vấn viên đã được nhà trường cấp tài khoản.', 'For students, parents and counselors who were given an account.')}</p>
        <label className="field"><span>{t('Tên đăng nhập')}</span><input type="text" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required /></label>
        <label className="field"><span>{t('Mật khẩu')}</span><input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? t('Đang đăng nhập…') : t('Đăng nhập')}</button>
        <p className="small muted" style={{ marginTop: 10 }}>{t('Sai 10 lần trong 15 phút sẽ bị khóa tạm. Phiên hết hạn sau 8 giờ hoặc khi đóng tab.')}</p>
      </form>
      <section className="panel">
        <h2 style={{ marginBottom: 6 }}>{t('Tài khoản mô phỏng')} <span className="small muted">({tr('dành cho kiểm thử', 'for testing')})</span></h2>
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
  const [kbErr, setKbErr] = useState(null);
  // Kỹ năng KHÔNG chọn sẵn (null) để học sinh không bỏ qua; bản cũ đã lưu trong phiên vẫn dùng lại được.
  const [f, setF] = useState(initial ?? { fullName: '', dob: '', skills: Object.fromEntries(SKILL_ARCHS.map((a) => [a, null])), env: '', target: '', exam: {} });
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  useEffect(() => { getKnowledge().then(setKb).catch((e) => setKbErr(e.message)); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [step]);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const errs = {};
  if (normalizeName(f.fullName).words.filter(Boolean).length < 2) errs.fullName = t('Nhập họ và tên (ít nhất 2 âm tiết)');
  try { parseDob(f.dob); } catch { errs.dob = t('Ngày sinh không hợp lệ'); }
  if (!f.env) errs.env = tr('Chọn một tình huống giống bạn nhất', 'Pick the situation most like you');
  const unrated = SKILL_ARCHS.filter((a) => !f.skills[a]);
  if (unrated.length) errs.skills = tr(`Bạn còn ${unrated.length} kỹ năng chưa chấm`, `${unrated.length} skill(s) still to rate`);
  const stepErr = [errs.fullName || errs.dob, errs.env, errs.skills, null];
  const STEPS = [tr('Bạn là ai', 'About you'), tr('Bạn thích làm việc thế nào', 'How you like to work'), tr('Bạn giỏi gì', 'What you are good at'), tr('Ngành & điểm thi', 'Major & exam')];

  if (kbErr) return <p className="empty">{tr('Không tải được dữ liệu', 'Could not load data')}: {kbErr}</p>;
  if (!kb) return <p className="empty">{t('Đang tải tri thức…')}</p>;
  const kbL = localizeKb(kb);
  const next = () => { setTouched(true); if (!stepErr[step]) { setTouched(false); setStep((x) => Math.min(3, x + 1)); } };
  const back = () => { setTouched(false); setStep((x) => Math.max(0, x - 1)); };
  const submit = (e) => {
    e.preventDefault();
    if (step < 3) { next(); return; }
    const firstBad = stepErr.findIndex(Boolean);
    if (firstBad >= 0) { setStep(firstBad); setTouched(true); return; }
    onSubmit({ ...f, tops: topStrengths(f.skills) });
  };
  const words = RATING_WORDS();

  return (
    <form className="panel wizard" onSubmit={submit} noValidate>
      <div className="wizard-head">
        <h2>{tr('Khám phá nhóm ngành hợp với bạn', 'Find majors that fit you')}</h2>
        <p className="small muted">{tr('Khoảng 3 phút · tính ngay trên máy của bạn, không gửi họ tên/ngày sinh đi đâu và không lưu lại.', 'About 3 minutes · computed on your device; your name and birth date are not sent anywhere or saved.')}</p>
        <ol className="wizard-steps" aria-label={tr('Các bước', 'Steps')}>
          {STEPS.map((x, i) => (
            <li key={x} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
              <button type="button" onClick={() => (i < step ? setStep(i) : null)} disabled={i > step}><span className="num">{i < step ? '✓' : i + 1}</span> {x}</button>
            </li>
          ))}
        </ol>
        <div className="wizard-progress" aria-hidden="true"><span style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
      </div>

      {step === 0 && (
        <div className="wizard-body">
          <label className="field"><span>{tr('Họ và tên đầy đủ (có dấu)', 'Full name (with accents)')}</span>
            <input type="text" value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} autoComplete="off" placeholder={tr('Ví dụ: Nguyễn Minh Anh', 'e.g. Nguyen Minh Anh')} autoFocus />
            {errs.fullName && (touched || f.fullName) && <small className="err">{errs.fullName}</small>}</label>
          <label className="field"><span>{t('Ngày sinh')}</span>
            <input type="date" value={f.dob} min="1990-01-01" max="2015-12-31" onChange={(e) => set({ dob: e.target.value })} />
            {errs.dob && touched && <small className="err">{errs.dob}</small>}</label>
          <p className="small muted">{tr('Họ tên và ngày sinh dùng để tính các con số theo ', 'Your name and birth date are used to compute numbers in ')}<Term k="Thần số học" />{tr(' – một phần nhỏ của kết quả, chỉ để tham khảo.', ' – a small part of the result, for reflection only.')}</p>
        </div>
      )}

      {step === 1 && (
        <fieldset className="wizard-body" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="wizard-q">{tr('Ở trường, bạn thấy vui và hứng thú nhất khi…', 'At school, you feel happiest and most engaged when…')}</legend>
          <p className="small muted">{tr('Chọn một ý giống bạn nhất. Đây là phần quan trọng nhất của kết quả, nên hãy chọn theo điều bạn thật sự thích, không phải điều người khác mong đợi.', 'Pick the one most like you. This is the biggest part of the result, so choose what you truly enjoy, not what others expect.')}</p>
          <div className="env-cards" role="radiogroup">
            {Object.keys(kbL.envs).map((k) => {
              const sc = envScenario(k);
              return (
                <label key={k} className={`env-card ${f.env === k ? 'on' : ''}`}>
                  <input type="radio" name="env" value={k} checked={f.env === k} onChange={() => set({ env: k })} aria-label={sc ? `${sc.title}: ${sc.desc}` : kbL.envs[k]} />
                  <span className="env-icon" aria-hidden="true">{sc?.icon}</span>
                  <b>{sc?.title ?? kbL.envs[k]}</b>
                  <span className="small">{sc?.desc}</span>
                  <span className="small muted">→ {tr('Môi trường', 'Environment')}: {kbL.envs[k]}</span>
                </label>
              );
            })}
          </div>
          {errs.env && touched && <p className="small err">{errs.env}</p>}
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="wizard-body" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="wizard-q">{tr('Bạn tự thấy mình làm những việc này tốt đến đâu?', 'How good are you at these?')}</legend>
          <p className="small muted">{tr('Chấm theo những gì bạn đã thật sự làm ở trường, ở nhà hay câu lạc bộ. Không có đáp án đúng sai.', 'Rate based on what you have actually done at school, at home or in clubs. There are no right or wrong answers.')}</p>
          <div className="rating-legend small muted" aria-hidden="true">{words.map((w, i) => <span key={w}><b>{i + 1}</b> {w}</span>)}</div>
          <div className="likert">
            {SKILL_ARCHS.map((a) => {
              const sp = skillPlain(a);
              const missing = touched && !f.skills[a];
              return (
                <div key={a} className={`likert-row ${missing ? 'missing' : ''}`}>
                  <span id={`lk-${a}`} className="likert-label"><b>{sp?.name ?? skillName(kbL, a)}</b><span className="small muted">{sp?.example}</span></span>
                  <span className="likert-scale" role="radiogroup" aria-labelledby={`lk-${a}`}>
                    {[1, 2, 3, 4, 5].map((v) => <button key={v} type="button" role="radio" aria-checked={f.skills[a] === v} aria-label={`${v} – ${words[v - 1]}`} title={words[v - 1]} onClick={() => set({ skills: { ...f.skills, [a]: v } })}>{v}</button>)}
                  </span>
                </div>
              );
            })}
          </div>
          {errs.skills && <p className={`small ${touched ? 'err' : 'muted'}`} role="status">{errs.skills}</p>}
        </fieldset>
      )}

      {step === 3 && (
        <div className="wizard-body">
          <label className="field"><span>{tr('Bạn đã có ngành muốn học chưa? (không bắt buộc)', 'Do you already have a major in mind? (optional)')}</span>
            <input type="search" list="majors-guest" value={f.target} onChange={(e) => set({ target: e.target.value })} placeholder={t('Gõ tên ngành…')} />
            <datalist id="majors-guest">{kb.majors.map((m) => <option key={m.id} value={m.name_vi} />)}</datalist>
            <small className="muted">{tr('Nếu có, hệ thống sẽ cho bạn biết ngành đó hợp đến đâu và cần cải thiện gì.', 'If so, you will see how well it fits and what to improve.')}</small></label>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, fontSize: '0.86rem' }}>{tr('Điểm thi thử theo khối (không bắt buộc)', 'Practice exam score by subject block (optional)')}</legend>
            <p className="small muted" style={{ margin: '0 0 6px' }}>{tr('Tổng 3 môn, thang 30. Hiện chỉ so được với điểm chuẩn của 18 ngành tại Trường ĐH Công nghiệp Hà Nội.', 'Sum of 3 subjects, out of 30. Currently only compared with cut-offs of 18 majors at Hanoi University of Industry.')}</p>
            <div className="checks exam-grid">{[['A00', tr('Toán · Lý · Hóa', 'Maths · Physics · Chem')], ['A01', tr('Toán · Lý · Anh', 'Maths · Physics · English')], ['D01', tr('Toán · Văn · Anh', 'Maths · Lit · English')], ['B00', tr('Toán · Hóa · Sinh', 'Maths · Chem · Bio')]].map(([c, lbl]) => (
              <label key={c}><span><b>{c}</b> <span className="small muted">{lbl}</span></span><input type="number" min="0" max="30" step="0.25" value={f.exam[c] ?? ''}
                onChange={(e) => set({ exam: { ...f.exam, [c]: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label>
            ))}</div>
          </fieldset>
        </div>
      )}

      {touched && stepErr[step] && <p className="small err" role="alert">{stepErr[step]}</p>}
      <div className="wizard-nav">
        {step > 0 ? <button type="button" className="btn" onClick={back}>← {tr('Quay lại', 'Back')}</button> : <a className="btn ghost" href="#/">← {tr('Trang đầu', 'Home')}</a>}
        {step < 3
          ? <button type="submit" className="btn primary">{tr('Tiếp tục', 'Next')} →</button>
          : <button type="submit" className="btn primary">{t('Xem kết quả')} →</button>}
      </div>
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

// ---------------- trang giới thiệu (trang đầu cho người chưa đăng nhập) ----------------
export function Home() {
  const steps = [
    ['✍️', tr('Trả lời 4 bước ngắn', 'Answer 4 short steps'), tr('Họ tên, ngày sinh, cách bạn thích làm việc và bạn giỏi gì.', 'Name, birth date, how you like to work and what you are good at.')],
    ['🧭', tr('Xem nhóm ngành hợp với bạn', 'See major groups that fit'), tr('Hệ thống xếp 35 nhóm ngành (300 ngành) theo mức phù hợp.', '35 major groups (300 majors) ranked by fit.')],
    ['💬', tr('Hiểu vì sao và thử thay đổi', 'Understand why and try changes'), tr('Mỗi gợi ý đều có giải thích bằng lời; đổi thử kỹ năng để xem kết quả thay đổi.', 'Every suggestion is explained in plain words; change a skill to see what moves.')],
  ];
  return (
    <div className="home">
      <section className="panel home-hero">
        <span className="eyebrow">{tr('Hỗ trợ chọn ngành đại học cho học sinh THPT', 'Helping high-school students choose a university major')}</span>
        <h2>{tr('Ngành nào hợp với bạn?', 'Which major fits you?')}</h2>
        <p>{tr('Kết hợp ', 'Combines ')}<b>{tr('cách bạn thích làm việc', 'how you like to work')}</b>{tr(', ', ', ')}<b>{tr('kỹ năng bạn tự đánh giá', 'your self-rated skills')}</b>{tr(' và một phần nhỏ từ ', ' and a small part from ')}<Term k="Thần số học" />{tr(' để gợi ý nhóm ngành nên tìm hiểu.', ' to suggest major groups worth exploring.')}</p>
        <div className="home-cta">
          <a className="btn primary big" href="#/guest">{tr('Bắt đầu khám phá ngành →', 'Start exploring →')}</a>
          <span className="small muted">{tr('Khoảng 3 phút · không cần tài khoản · không lưu thông tin của bạn', 'About 3 minutes · no account · nothing is saved')}</span>
        </div>
      </section>
      <section className="home-steps">
        {steps.map(([ic, h, d], i) => (
          <div key={h} className="panel home-step"><span className="home-step-ic" aria-hidden="true">{ic}</span><b>{i + 1}. {h}</b><span className="small muted">{d}</span></div>
        ))}
      </section>
      <section className="panel home-note">
        <p className="small"><b>{tr('Lưu ý quan trọng', 'Important')}:</b> {tr('Đây là công cụ tham khảo do nhóm sinh viên DSS301 xây dựng với dữ liệu mô phỏng. Thần số học không có giá trị dự báo khoa học. Hãy dùng kết quả để trò chuyện với gia đình và thầy cô, kết hợp với sở thích, học lực và điểm thi của bạn.', 'This is a reference tool built by a DSS301 student group with simulated data. Numerology has no scientific predictive value. Use the results to talk with family and teachers, alongside your interests, grades and exam scores.')}</p>
        <p className="small muted" style={{ marginTop: 6 }}>{tr('Đã có tài khoản do nhà trường cấp?', 'Have an account from your school?')} <a href="#/login">{t('Đăng nhập')}</a></p>
      </section>
    </div>
  );
}
