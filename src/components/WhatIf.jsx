// Thử thay đổi (What-if) – tính lại ngay trên trình duyệt bằng engine dùng chung. Trọng số cố định bộ A (ROC);
// người dùng chỉ đổi góc nhìn, môi trường, ngành mục tiêu và mức kỹ năng.
import { useState } from 'react';
import { SKILL_ARCHS } from '../../shared/engine/index.js';
import { skillName, envName, PERSONA_NAME } from '../format.js';
import { t, tr } from '../i18n.js';
import { pct, repMajor } from '../plain.js';

const Seg = ({ value, options, onChange, label }) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map(([v, name]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{name}</button>)}
  </div>
);

export default function WhatIf({ kb, out, base, opt, setOpt, person, target, setTarget, onReset, onSave, saveState, canSave, dirty }) {
  const [allSkills, setAllSkills] = useState(false);
  const set = (patch) => setOpt((o) => ({ ...o, ...patch }));
  const delta = opt.delta ?? {};
  const setDelta = (a, d) => setOpt((o) => { // tính từ mức hiện tại (gốc + delta), dạng hàm để bấm nhanh không mất lượt
    const cur = o.delta ?? {};
    const now = Math.max(1, Math.min(5, person.skills[a] + (cur[a] ?? 0) + d));
    return { ...o, delta: { ...cur, [a]: now - person.skills[a] } };
  });

  // kỹ năng liên quan = nét tính cách của 4 nhóm ngành đứng đầu (gốc) + kỹ năng đang yếu + kỹ năng đã chỉnh
  const top4 = (base ?? out).result.rows.filter((r) => r.rank && r.rank <= 4);
  const relevant = new Set([...top4.flatMap((r) => r.A), ...Object.keys(delta).map(Number)]);
  for (const a of SKILL_ARCHS) if (person.skills[a] <= kb.params.Weak_max) relevant.add(a);
  const shown = allSkills ? SKILL_ARCHS : SKILL_ARCHS.filter((a) => relevant.has(a));

  const b1 = base?.result.top[0], c1 = out.result.top[0];
  const name = (o, r) => (r ? repMajor(kb, r.profile, o.result.env).name : '–');
  const bt = base?.target?.analysis, ct = out.target?.analysis;

  return (
    <div className="wi">
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <h2 id="z-d">{t('Thử thay đổi')}</h2>
        <span className="small muted">{t('kết quả tính lại ngay')}</span>
      </div>

      <div className="wi-row">
        <span className="wi-label">{t('Góc nhìn')}</span>
        <Seg label={t('Góc nhìn')} value={opt.persona} onChange={(v) => set({ persona: v })} options={Object.entries(PERSONA_NAME)} />
      </div>
      <label className="wi-row">
        <span className="wi-label">{t('Môi trường')}</span>
        <select value={opt.envOverride ?? ''} onChange={(e) => set({ envOverride: e.target.value || undefined })}>
          <option value="">{envName(kb, person.env)} ({tr('đã chọn', 'chosen')})</option>
          {Object.keys(kb.envs).filter((e) => e !== person.env).map((e) => <option key={e} value={e}>{tr('Thử', 'Try')}: {envName(kb, e)}</option>)}
        </select>
      </label>
      <label className="wi-row">
        <span className="wi-label">{t('Ngành mục tiêu')}</span>
        <input type="search" list="majors-300" placeholder={t('Gõ tên ngành (300 ngành)…')} value={target ?? ''} onChange={(e) => setTarget(e.target.value)} />
        <datalist id="majors-300">{kb.majors.map((m) => <option key={m.id} value={m.name_vi} />)}</datalist>
      </label>

      <div>
        <div className="wi-row" style={{ marginBottom: 4 }}>
          <span className="wi-label">{t('Kỹ năng (1–5)')}</span>
          <button type="button" className="btn ghost small" onClick={() => setAllSkills((x) => !x)}>{allSkills ? t('chỉ kỹ năng liên quan') : tr('hiện tất cả kỹ năng', 'show all skills')}</button>
        </div>
        <div className="skills-wi">
          {shown.map((a) => {
            const now = Math.max(1, Math.min(5, person.skills[a] + (delta[a] ?? 0)));
            const nm = skillName(kb, a);
            return (
              <div key={a} className={`sk ${now <= kb.params.Weak_max ? 'weak' : ''}`}>
                <span className="sk-name" title={nm}>{nm}</span>
                <span className="stepper">
                  <button type="button" aria-label={`${tr('Giảm', 'Decrease')} ${nm}`} onClick={() => setDelta(a, -1)} disabled={now <= 1}>−</button>
                  <span className={`num ${delta[a] ? 'chg' : ''}`}>{now}</span>
                  <button type="button" aria-label={`${tr('Tăng', 'Increase')} ${nm}`} onClick={() => setDelta(a, 1)} disabled={now >= 5}>+</button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {dirty && (
        <div className="diff" aria-live="polite">
          <span>{tr('Ngành phù hợp nhất', 'Best fit')}: {name(base, b1)} {b1 ? `(${pct(b1.C)}, ${t(b1.label)})` : ''} → <b>{name(out, c1)}</b> {c1 ? `(${pct(c1.C)}, ${t(c1.label)})` : ''}</span>
          {ct && <span>{out.target.major.name_vi}: {bt ? t(bt.row.label) : '–'} → <b>{t(ct.row.label)}</b></span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn" onClick={onReset} disabled={!dirty}>{t('Đặt lại')}</button>
        {canSave && <button type="button" className="btn primary" onClick={onSave} disabled={!dirty || saveState === 'saving'}>{saveState === 'saving' ? t('Đang lưu…') : t('Lưu kịch bản')}</button>}
        {saveState?.startsWith?.('ok:') && <span className="small muted">{tr('Đã lưu', 'Saved')}</span>}
        {saveState?.startsWith?.('err:') && <span className="small err">{saveState.slice(4)}</span>}
      </div>
    </div>
  );
}
