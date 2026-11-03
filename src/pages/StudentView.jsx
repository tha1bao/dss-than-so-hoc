// Hồ sơ một học sinh: L0 (4 khu vực) → L1…L7. Kết quả gốc do server tính + lưu; What-if tính lại trên trình duyệt (engine dùng chung).
import { useEffect, useMemo, useState } from 'react';
import { computeSignals } from '../../shared/engine/index.js';
import { computeView, sanitizeOptions, findMajor } from '../../shared/engine/view.js';
import { api, getKnowledge } from '../api.js';
import { envName } from '../format.js';
import Dashboard from '../components/Dashboard.jsx';
import { L1, L2, L3, L4, L5, L6, L7 } from '../components/Layers.jsx';
import { t, tr, localizeKb } from '../i18n.js';

export const LAYERS = [
  ['l0', 'Kết quả', 'Results'], ['l1', 'Vì sao?', 'Why?'], ['l2', 'Con số của bạn', 'Your numbers'], ['l3', 'Kết nối', 'Connections'],
  ['l4', 'Công thức', 'Formulas'], ['l5', 'Bảng xếp hạng', 'Ranking'], ['l6', 'Nguồn', 'Sources'], ['l7', 'Dữ liệu', 'Data'],
];
const personaOf = (role) => ({ student: 'HS', parent: 'PH', counselor: 'TVV' }[role] ?? 'TVV');
const targetFields = (kb, text) => {
  if (!text) return {};
  const m = findMajor(kb, text);
  return m ? { targetMajorId: m.id } : { targetText: text };
};

/**
 * source = { kind: 'student', id } | { kind: 'guest', person: {fullName, dob, skills, env, tops, target, exam} }
 */
export default function StudentView({ source, user, layer, sel: selParam, go }) {
  const [kb, setKb] = useState(null);
  const [stu, setStu] = useState(null);
  const [baseRun, setBaseRun] = useState(null);
  const [err, setErr] = useState(null);
  const [opt, setOpt] = useState(null);
  const [target, setTarget] = useState('');
  const [saveState, setSaveState] = useState(null);
  const isGuest = source.kind === 'guest';
  const sid = isGuest ? 'guest' : source.id;

  useEffect(() => {
    let on = true;
    setErr(null); setStu(null); setBaseRun(null); setOpt(null); setSaveState(null);
    (async () => {
      const k = await getKnowledge();
      if (isGuest) {
        const g = source.person;
        const sig = computeSignals(g.fullName, g.dob, k);
        if (!on) return;
        setKb(k);
        setStu({ id: 'KHÁCH', name: g.fullName, birthYear: sig.input.year, skills: g.skills, preferredEnv: g.env, topStrengths: g.tops,
          simulated: false, exam: g.exam, sig, targetDefault: g.target ?? '' });
        setOpt({ persona: 'HS' }); setTarget(g.target ?? '');
        return;
      }
      const [s, run] = await Promise.all([api(`/students/${source.id}`), api(`/students/${source.id}/runs`, { method: 'POST', body: { save: true } })]);
      if (!on) return;
      const tDefault = s.targetMajorId ? (k.majors.find((m) => m.id === s.targetMajorId)?.name_vi ?? '') : (s.targetMajorText ?? '');
      setKb(k); setStu({ ...s, sig: run.sig, targetDefault: tDefault }); setBaseRun(run);
      setOpt({ persona: run.result.persona }); setTarget(tDefault);
    })().catch((e) => on && setErr(e));
    return () => { on = false; };
  }, [sid]); // eslint-disable-line react-hooks/exhaustive-deps

  const kbL = localizeKb(kb); // tri thức theo ngôn ngữ (chỉ đổi chuỗi hiển thị)
  const person = useMemo(() => stu && ({
    sig: stu.sig, skills: stu.skills, env: stu.preferredEnv, tops: (stu.topStrengths ?? []).filter((x) => x != null),
    simulated: stu.simulated, exam: stu.exam, targetDefault: stu.targetDefault,
  }), [stu]);
  const basePersona = baseRun?.result.persona ?? (isGuest ? 'HS' : personaOf(user?.role));
  const base = useMemo(() => (kbL && person ? computeView({ ...person, ...targetFields(kbL, person.targetDefault) }, kbL, sanitizeOptions({ persona: basePersona }, kbL, basePersona)) : null), [kbL, person, basePersona]);
  const out = useMemo(() => (kbL && person && opt ? computeView({ ...person, ...targetFields(kbL, target) }, kbL, sanitizeOptions(opt, kbL, basePersona)) : null), [kbL, person, opt, target, basePersona]);

  const compare = useMemo(() => (kbL && person && opt ? ['HS', 'PH', 'TVV'].map((ps) => ({ persona: ps,
    out: computeView({ ...person, ...targetFields(kbL, target) }, kbL, sanitizeOptions({ ...opt, persona: ps, weights: undefined }, kbL, basePersona)) })) : null), [kbL, person, opt, target, basePersona]);

  useEffect(() => { // engine client phải khớp kết quả server đã lưu
    if (base && baseRun && base.result.top.map((r) => r.profile).join() !== baseRun.result.top.map((r) => r.profile).join()) console.warn('Client/server lệch Top-3', base.result.top, baseRun.result.top);
  }, [base, baseRun]);

  if (err) return <div className="panel empty"><p>{err.status === 403 ? t('Bạn không có quyền xem hồ sơ này.') : err.status === 404 ? t('Không tìm thấy học sinh.') : `${tr('Lỗi', 'Error')}: ${err.message}`}</p><p><a href="#/">{t('← về trang chính')}</a></p></div>;
  if (!out) return <p className="empty">{t('Đang tính…')}</p>;

  const base0 = `/${isGuest ? 'guest' : `s/${sid}`}`;
  const sel = selParam && out.result.rows.some((r) => r.profile === selParam) ? selParam : (out.result.top[0]?.profile ?? out.result.rows[0].profile);
  const goLayer = (l, p) => {
    if (l === 'whatif') { go(`/${isGuest ? 'guest' : `s/${sid}`}/l0`); setTimeout(() => document.getElementById('whatif')?.scrollIntoView({ behavior: 'smooth' }), 50); return; }
    go(`/${isGuest ? 'guest' : `s/${sid}`}/${l}${p ? `?p=${p}` : ''}`);
  };
  const setSel = (p) => goLayer(layer, p);
  const skillsNow = Object.fromEntries(Object.entries(person.skills).map(([a, r]) => [a, Math.max(1, Math.min(5, r + (opt.delta?.[a] ?? 0)))]));
  const p2 = { ...person, skillsNow };
  const dirty = JSON.stringify(opt) !== JSON.stringify({ persona: basePersona }) || target !== person.targetDefault;
  const readOnlyAdmin = user?.role === 'admin' && ['auditor', 'demo'].includes(user.adminScope);
  const save = async () => {
    setSaveState('saving');
    try {
      const m = findMajor(kbL, target);
      const r = await api(`/students/${sid}/runs`, { method: 'POST', body: { ...opt, whatif: true, save: true, ...(m ? { targetMajorId: m.id } : {}) } });
      setSaveState(`ok:${r.runId}`);
    } catch (e) { setSaveState(`err:${e.message}`); }
  };
  const whatif = {
    opt, setOpt, person, target, setTarget, dirty, saveState, canSave: !isGuest && !readOnlyAdmin, onSave: save,
    onReset: () => { setOpt({ persona: basePersona }); setTarget(person.targetDefault); setSaveState(null); },
  };
  const props = { out, kb: kbL, person: p2, sel, setSel };

  return (
    <>
      <nav className="crumbs" aria-label={t('Đường dẫn')}>
        {!isGuest && user?.role !== 'student' && <><a href="#/students">{t('Danh sách học sinh')}</a><span>›</span></>}
        {isGuest && <><a href="#/guest">{t('Tự nhập')}</a><span>›</span></>}
        {layer !== 'l0' ? <a href={`#${base0}/l0`}><b>{stu.id}</b></a> : <b>{stu.id}</b>}<span>{stu.name}</span>
        <span className="muted">· {stu.birthYear}{stu.grade ? ` · ${tr('lớp', 'grade')} ${stu.grade}` : ''} · {envName(kbL, stu.preferredEnv)}</span>
      </nav>
      {layer !== 'l0' && (
        <nav className="layers" aria-label={t('Tầng giải thích')}>
          <a href={`#${base0}/l0`} className="back">{t('← Kết quả')}</a>
          {LAYERS.slice(1).map(([k, vi, en]) => <a key={k} href={`#${base0}/${k}?p=${sel}`} aria-current={layer === k ? 'page' : undefined}><small>{k.toUpperCase()}</small> {tr(vi, en)}</a>)}
        </nav>
      )}
      {layer === 'l0' && <Dashboard out={out} base={base} kb={kbL} onGo={goLayer} whatif={whatif} />}
      {layer === 'l1' && <L1 {...props} />}
      {layer === 'l2' && <L2 {...props} />}
      {layer === 'l3' && <L3 {...props} />}
      {layer === 'l4' && <L4 {...props} />}
      {layer === 'l5' && <L5 {...props} compare={compare} />}
      {layer === 'l6' && <L6 {...props} />}
      {layer === 'l7' && <L7 {...props} meta={{ runId: baseRun?.runId, simulated: stu.simulated }} />}
      {layer !== 'l0' && dirty && <p className="small muted" style={{ marginTop: 8 }}>{tr('Đang hiển thị kết quả đã thử thay đổi', 'Showing your what-if changes')} (<a href="#" onClick={(e) => { e.preventDefault(); goLayer('whatif'); }}>{tr('đặt lại ở trang Kết quả', 'reset on the Results page')}</a>).</p>}
    </>
  );
}
