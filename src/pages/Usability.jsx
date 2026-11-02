// Pha 4 – trang test khả dụng tích hợp (người điều phối dùng): đồng ý → 3 nhiệm vụ (đo thời gian, lỗi, thành công) → SUS 10 câu → lưu.
// Người tham gia làm nhiệm vụ trên TAB KHÁC (đăng nhập tài khoản mô phỏng); tab này chỉ để điều phối & ghi.
import { useEffect, useMemo, useRef, useState } from 'react';
import { SUS_ITEMS, TASKS, susScore, susGrade, validateSession } from '../../shared/usability.js';
import { api } from '../api.js';
import { fmt } from '../format.js';
import { useTip } from '../components/common.jsx';

const ROLE_VI = { student: 'Học sinh', parent: 'Phụ huynh', counselor: 'Tư vấn viên', teacher: 'Giảng viên / người đánh giá' };
const LIKERT = ['Hoàn toàn không đồng ý', 'Không đồng ý', 'Trung lập', 'Đồng ý', 'Hoàn toàn đồng ý'];
const UI_VERSION = 'v1';

function useTimer(running) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!running) return undefined; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [running]);
  return now;
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function TestRunner() {
  const [step, setStep] = useState('setup'); // setup → task0..2 → sus → done
  const [meta, setMeta] = useState({ participantCode: '', role: 'student', device: '', uiVersion: UI_VERSION, consent: false, notes: '' });
  const [tasks, setTasks] = useState([]);
  const [cur, setCur] = useState({ start: null, end: null, errors: 0, success: null, observation: '' });
  const [sus, setSus] = useState(Array(10).fill(null));
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const startedAt = useRef(null);
  const now = useTimer(cur.start && !cur.end);
  const def = TASKS[meta.role];
  const ti = step.startsWith('task') ? Number(step.slice(4)) : null;
  const task = ti != null ? def.list[ti] : null;
  const elapsed = cur.start ? Math.round(((cur.end ?? now) - cur.start) / 1000) : 0;

  const setupOk = /^U\d{2,3}$/.test(meta.participantCode) && meta.consent;
  const nextTask = () => {
    const rec = { taskNo: task.no, testCaseCode: task.tc, timeSec: elapsed, errors: cur.errors, success: cur.success, observation: cur.observation.trim() || null };
    const all = [...tasks, rec];
    setTasks(all);
    setCur({ start: null, end: null, errors: 0, success: null, observation: '' });
    setStep(ti < 2 ? `task${ti + 1}` : 'sus');
  };
  const submit = async () => {
    const body = { ...meta, startedAt: startedAt.current, endedAt: Date.now(), tasks, sus };
    const v = validateSession(body);
    if (v.length) { setErr(v.join('; ')); return; }
    setErr(null);
    try { setResult(await api('/usability/sessions', { method: 'POST', body })); setStep('done'); } catch (e) { setErr(e.message); }
  };
  const reset = () => { setStep('setup'); setTasks([]); setSus(Array(10).fill(null)); setResult(null); setMeta((m) => ({ ...m, participantCode: '', consent: false, notes: '', device: '' })); };

  return (
    <section className="panel" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="panel-head">
        <h2>Test khả dụng với người thật</h2>
        <span className="small muted">Bước {step === 'setup' ? 1 : step === 'sus' ? 5 : step === 'done' ? 6 : ti + 2} / 6 · <a href="#/test/report">Báo cáo</a></span>
      </div>

      {step === 'setup' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <p className="small muted">Người điều phối điền phần này. Không ghi tên thật – chỉ mã người tham gia (U01, U02 …). Người tham gia làm nhiệm vụ trên một tab/máy khác, đăng nhập bằng tài khoản mô phỏng.</p>
          <div className="grid2">
            <label className="field"><span>Mã người tham gia</span><input type="text" value={meta.participantCode} placeholder="U01" onChange={(e) => setMeta({ ...meta, participantCode: e.target.value.toUpperCase().trim() })} /></label>
            <label className="field"><span>Vai trò của người tham gia</span>
              <select value={meta.role} onChange={(e) => setMeta({ ...meta, role: e.target.value })}>{Object.entries(ROLE_VI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="field"><span>Thiết bị</span><input type="text" value={meta.device} placeholder="vd: laptop Chrome / điện thoại Android" onChange={(e) => setMeta({ ...meta, device: e.target.value })} /></label>
            <label className="field"><span>Phiên bản giao diện</span><input type="text" value={meta.uiVersion} onChange={(e) => setMeta({ ...meta, uiVersion: e.target.value.trim() })} />
              <small className="muted">"v1" = trước cải tiến; đặt "v2" cho vòng test sau cải tiến.</small></label>
          </div>
          <div className="best-note" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>
            <b>Lời mời & đồng ý (đọc cho người tham gia):</b> Nhóm 2 môn DSS301 nhờ bạn dùng thử một trang web gợi ý nhóm ngành trong khoảng 15 phút. Chúng tôi đánh giá <i>trang web</i>, không đánh giá bạn. Bạn dùng tài khoản mô phỏng, không nhập thông tin cá nhân. Chúng tôi ghi thời gian, số lần thao tác sai và câu trả lời phiếu SUS dưới mã ẩn danh; có thể dừng bất cứ lúc nào. Thần số học không có giá trị dự báo khoa học – đây chỉ là bài tập môn học.
          </div>
          <label className="checks"><input type="checkbox" checked={meta.consent} onChange={(e) => setMeta({ ...meta, consent: e.target.checked })} /> Người tham gia đã đồng ý</label>
          <p className="small">Tài khoản người tham gia dùng: <b>{def.account}</b> (mật khẩu demo do người điều phối đọc). <a href="/#/login" target="_blank" rel="noreferrer">Mở trang đăng nhập ở tab mới ↗</a></p>
          <div><button type="button" className="btn primary" disabled={!setupOk} onClick={() => { startedAt.current = Date.now(); setStep('task0'); }}>Bắt đầu nhiệm vụ 1</button></div>
        </div>
      )}

      {task && (
        <div style={{ display: 'grid', gap: 10 }}>
          <p className="small muted">Nhiệm vụ {task.no}/3 · kịch bản {task.tc}{task.q ? ` · câu hỏi quyết định ${task.q}` : ''} · tài khoản {def.account}</p>
          <p style={{ fontSize: '1.15rem', fontWeight: 600 }}>{task.text}</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="num" style={{ fontSize: '1.8rem', fontWeight: 800, minWidth: 90 }} aria-live="off">{mmss(elapsed)}</span>
            {!cur.start && <button type="button" className="btn primary" onClick={() => setCur({ ...cur, start: Date.now() })}>Bắt đầu tính giờ</button>}
            {cur.start && !cur.end && <button type="button" className="btn primary" onClick={() => setCur({ ...cur, end: Date.now() })}>Người tham gia trả lời xong</button>}
            {cur.start && !cur.end && (
              <span className="stepper" aria-label="Số lỗi">
                <button type="button" onClick={() => setCur({ ...cur, errors: Math.max(0, cur.errors - 1) })} aria-label="Bớt lỗi">−</button>
                <span>{cur.errors}</span>
                <button type="button" onClick={() => setCur({ ...cur, errors: cur.errors + 1 })} aria-label="Thêm lỗi">+</button>
              </span>
            )}
            {cur.start && !cur.end && <span className="small muted">lỗi = bấm sai chỗ, đi lạc trang, hỏi trợ giúp</span>}
          </div>
          {cur.end && (
            <div style={{ display: 'grid', gap: 6 }}>
              <p className="small"><b>Đáp án đúng (chỉ người điều phối xem):</b> {task.answer}</p>
              <div className="checks">
                <span className="small" style={{ fontWeight: 600 }}>Kết quả:</span>
                <label><input type="radio" name="succ" checked={cur.success === true} onChange={() => setCur({ ...cur, success: true })} /> Thành công</label>
                <label><input type="radio" name="succ" checked={cur.success === false} onChange={() => setCur({ ...cur, success: false })} /> Không thành công</label>
                <span className="small">· lỗi:</span>
                <span className="stepper"><button type="button" onClick={() => setCur({ ...cur, errors: Math.max(0, cur.errors - 1) })} aria-label="Bớt lỗi">−</button><span>{cur.errors}</span><button type="button" onClick={() => setCur({ ...cur, errors: cur.errors + 1 })} aria-label="Thêm lỗi">+</button></span>
              </div>
              <textarea rows={3} placeholder="Quan sát: người tham gia nói gì, vướng ở đâu, gợi ý cải tiến…" value={cur.observation} onChange={(e) => setCur({ ...cur, observation: e.target.value })} aria-label="Quan sát" />
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn" onClick={() => setCur({ ...cur, end: null })}>Tiếp tục tính giờ</button>
                <button type="button" className="btn primary" disabled={cur.success == null} onClick={nextTask}>{ti < 2 ? `Sang nhiệm vụ ${ti + 2}` : 'Sang phiếu SUS'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'sus' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <p className="small muted">Đưa màn hình này cho người tham gia tự chọn. Chọn mức đồng ý với từng câu – không có đúng/sai.</p>
          {SUS_ITEMS.map((it, i) => (
            <fieldset key={i} style={{ border: '1px solid var(--line-2)', borderRadius: 8, padding: '6px 10px', margin: 0 }}>
              <legend className="small" style={{ fontWeight: 700 }}>{i + 1}. {it}</legend>
              <div className="likert-scale" role="radiogroup" aria-label={`Câu ${i + 1}`} style={{ flexWrap: 'wrap', gap: 4 }}>
                {LIKERT.map((l, v) => (
                  <button key={v} type="button" role="radio" aria-checked={sus[i] === v + 1} style={{ width: 'auto', padding: '0 8px' }}
                    onClick={() => setSus((s) => s.map((x, j) => (j === i ? v + 1 : x)))}>{v + 1} · {l}</button>
                ))}
              </div>
            </fieldset>
          ))}
          <label className="field"><span>Ghi chú chung (không bắt buộc)</span><textarea rows={2} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} /></label>
          {err && <p className="err" role="alert">{err}</p>}
          <div><button type="button" className="btn primary" disabled={sus.includes(null)} onClick={submit}>Lưu buổi test</button></div>
        </div>
      )}

      {step === 'done' && result && (
        <div style={{ display: 'grid', gap: 8 }}>
          <p>Đã lưu buổi test của <b>{meta.participantCode}</b>. Điểm SUS: <b className="num">{fmt(result.sus, 1)}</b> / 100 ({susGrade(result.sus)}).</p>
          <p className="small muted">Thành công {tasks.filter((t) => t.success).length}/3 nhiệm vụ · tổng thời gian {mmss(tasks.reduce((s, t) => s + t.timeSec, 0))} · {tasks.reduce((s, t) => s + t.errors, 0)} lỗi.</p>
          <div style={{ display: 'flex', gap: 6 }}><button type="button" className="btn primary" onClick={reset}>Người tham gia tiếp theo</button><a className="btn" href="#/test/report">Xem báo cáo</a></div>
        </div>
      )}
    </section>
  );
}

// ---------------- báo cáo ----------------
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function SusChart({ sessions, versions }) {
  const tip = useTip();
  const color = (v) => (versions.indexOf(v) === 0 ? 'var(--c-sr)' : 'var(--c-v2)');
  return (
    <div aria-label="Điểm SUS từng người tham gia" style={{ display: 'grid', gap: 4 }}>
      {versions.length > 1 && <div className="legend">{versions.map((v) => <span key={v}><i style={{ background: color(v) }} />{v}</span>)}</div>}
      <div style={{ position: 'relative', display: 'grid', gap: 4 }}>
        {sessions.map((s) => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 44px', gap: 6, alignItems: 'center', fontSize: '0.8rem' }}>
            <span>{s.participant_code} · {s.ui_version}</span>
            <div style={{ position: 'relative', height: 14 }} tabIndex={0} {...tip(`${s.participant_code} (${s.ui_version}, ${ROLE_VI[s.role] ?? s.role}): SUS ${fmt(s.sus, 1)} – ${susGrade(s.sus)}`)}>
              <div style={{ width: `${s.sus ?? 0}%`, height: '100%', background: color(s.ui_version), borderRadius: '0 4px 4px 0' }} />
              <div style={{ position: 'absolute', left: '68%', top: -2, bottom: -2, borderLeft: '2px dashed var(--ink-3)' }} />
            </div>
            <span className="num" style={{ textAlign: 'right' }}>{fmt(s.sus, 1)}</span>
          </div>
        ))}
      </div>
      <p className="small muted">Vạch đứt = 68, mức trung bình chung của SUS (Sauro, 2011). Trục 0–100.</p>
    </div>
  );
}

export function TestReport({ user }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => api('/usability/report').then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const versions = useMemo(() => [...new Set((d?.sessions ?? []).map((s) => s.ui_version))], [d]);
  if (err) return <p className="panel err">{err}</p>;
  if (!d) return <p className="empty">Đang tải…</p>;
  const S = d.sessions;
  const byVer = versions.map((v) => {
    const ss = S.filter((s) => s.ui_version === v);
    const t = ss.flatMap((s) => s.tasks);
    return { v, n: ss.length, sus: mean(ss.map((s) => s.sus).filter((x) => x != null)),
      task: [1, 2, 3].map((no) => { const x = t.filter((k) => k.task_no === no); return { no, n: x.length, ok: x.filter((k) => k.success).length, medTime: median(x.map((k) => k.time_sec)), errs: mean(x.map((k) => k.errors)) }; }) };
  });
  const exportCsv = () => {
    const head = ['session_id', 'participant', 'role', 'ui_version', 'device', 'started_at', 'sus', ...[1, 2, 3].flatMap((n) => [`t${n}_case`, `t${n}_time_s`, `t${n}_errors`, `t${n}_success`, `t${n}_observation`]), ...SUS_ITEMS.map((_, i) => `sus_q${i + 1}`), 'notes'];
    const rows = S.map((s) => [s.id, s.participant_code, s.role, s.ui_version, s.device, s.started_at, s.sus,
      ...[1, 2, 3].flatMap((n) => { const t = s.tasks.find((k) => k.task_no === n) ?? {}; return [t.test_case_code, t.time_sec, t.errors, t.success == null ? '' : t.success ? 1 : 0, t.observation]; }),
      ...Array.from({ length: 10 }, (_, i) => s.answers[i]), s.notes]);
    const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `usability_${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };
  const del = async (id) => { try { await api(`/usability/sessions/${id}`, { method: 'DELETE' }); load(); } catch (e) { setErr(e.message); } };
  return (
    <>
      <section className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-head">
          <h2>Báo cáo test khả dụng ({S.length} buổi)</h2>
          <div style={{ display: 'flex', gap: 6 }}><a className="btn" href="#/test">+ Buổi test mới</a><button type="button" className="btn" onClick={exportCsv} disabled={!S.length}>Xuất CSV</button></div>
        </div>
        {!S.length ? <p className="empty">Chưa có buổi test nào. Đề bài yêu cầu tối thiểu 2–3 người thật.</p> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Phiên bản</th><th className="r">Số người</th><th className="r">SUS TB</th><th>Xếp loại</th>{[1, 2, 3].map((n) => <th key={n}>Nhiệm vụ {n}: thành công · trung vị thời gian · lỗi TB</th>)}</tr></thead>
            <tbody>{byVer.map((b) => (
              <tr key={b.v}><td>{b.v}</td><td className="r">{b.n}</td><td className="r"><b>{fmt(b.sus, 1)}</b></td><td>{susGrade(b.sus)}</td>
                {b.task.map((t) => <td key={t.no} className="num">{t.ok}/{t.n} · {t.medTime == null ? '–' : mmss(Math.round(t.medTime))} · {fmt(t.errs, 1)}</td>)}</tr>
            ))}</tbody>
          </table></div>
        )}
        {S.length > 0 && <div style={{ marginTop: 10 }}><SusChart sessions={S} versions={versions} /></div>}
        <p className="small muted" style={{ marginTop: 6 }}>SUS = 2,5 × Σ(câu lẻ: điểm − 1; câu chẵn: 5 − điểm) – view v_sus_score. Xếp loại theo thang tính từ của Bangor, Kortum & Miller (2009).</p>
      </section>
      {S.length > 0 && (
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>Chi tiết từng buổi</h2>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Mã</th><th>Vai trò</th><th>Phiên bản</th><th>Thiết bị</th><th className="r">SUS</th><th>Nhiệm vụ (thời gian · lỗi · kết quả)</th><th>Quan sát</th><th /></tr></thead>
            <tbody>{S.map((s) => (
              <tr key={s.id}><td>{s.participant_code}</td><td>{ROLE_VI[s.role] ?? s.role}</td><td>{s.ui_version}</td><td className="small">{s.device}</td><td className="r">{fmt(s.sus, 1)}</td>
                <td className="small">{s.tasks.map((t) => <div key={t.task_no}>{t.task_no}. {t.test_case_code}: {mmss(t.time_sec)} · {t.errors} lỗi · {t.success ? '✓ thành công' : '✗ không'}</div>)}</td>
                <td className="small">{s.tasks.map((t) => t.observation).filter(Boolean).join(' | ')}{s.notes ? ` | ${s.notes}` : ''}</td>
                <td>{user.role === 'admin' && user.adminScope === 'system' && <button type="button" className="btn" onClick={() => del(s.id)}>Xóa</button>}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
