// (d) What-if – tính lại ngay trên trình duyệt bằng engine dùng chung (shared/engine), cùng tri thức từ /api/knowledge.
// Mặc định chỉ các nút người dùng hay đổi (persona, môi trường, ngành mục tiêu, kỹ năng của Top-3); phần mô hình nằm trong "Nâng cao".
import { useState } from 'react';
import { GROUPS, SKILL_ARCHS, skillCode } from '../../shared/engine/index.js';
import { fmt, signed, skillName, envName, groupName, PERSONA_NAME, SET_NAME } from '../format.js';
import { t, tr } from '../i18n.js';

const Seg = ({ value, options, onChange, label }) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map(([v, name]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{name}</button>)}
  </div>
);

export default function WhatIf({ kb, out, base, opt, setOpt, person, target, setTarget, onReset, onSave, saveState, canSave, dirty }) {
  const [allSkills, setAllSkills] = useState(false);
  const set = (patch) => setOpt((o) => ({ ...o, ...patch }));
  const flags = { G1: 1, G5: 1, G6: 1, G4: 1, G2: 1, ...(opt.flags ?? {}) };
  const nOn = GROUPS.filter((g) => flags[g]).length;
  const delta = opt.delta ?? {};
  const setDelta = (a, d) => setOpt((o) => { // tính từ mức hiện tại (gốc + delta), dạng hàm để bấm nhanh không mất lượt
    const cur = o.delta ?? {};
    const now = Math.max(1, Math.min(5, person.skills[a] + (cur[a] ?? 0) + d));
    return { ...o, delta: { ...cur, [a]: now - person.skills[a] } };
  });
  const w = out.result.weights;
  const custom = Array.isArray(opt.weights);
  const setW = (i, v) => { const ws = [...(custom ? opt.weights : w)]; ws[i] = v; set({ weights: ws }); };
  const advanced = custom || opt.flags || opt.positional === false || opt.yVowel || (opt.wset && opt.wset !== kb.paramSet.code) || typeof opt.normalize === 'boolean';

  // kỹ năng liên quan = archetype của Top-3 (gốc) + kỹ năng đang yếu + kỹ năng đã chỉnh
  const relevant = new Set([...(base ?? out).result.top.flatMap((r) => r.A), ...Object.keys(delta).map(Number)]);
  for (const a of SKILL_ARCHS) if (person.skills[a] <= kb.params.Weak_max) relevant.add(a);
  const shown = allSkills ? SKILL_ARCHS : SKILL_ARCHS.filter((a) => relevant.has(a));

  const b1 = base?.result.top[0], c1 = out.result.top[0];
  const bt = base?.target?.analysis, ct = out.target?.analysis;

  return (
    <div className="wi">
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <h2 id="z-d">{t('Thử thay đổi')}</h2>
        <span className="small muted">{t('kết quả tính lại ngay')}</span>
      </div>

      <div className="wi-row">
        <span className="wi-label">{t('Góc nhìn')}</span>
        <Seg label="Persona" value={opt.persona} onChange={(v) => set({ persona: v })} options={Object.entries(PERSONA_NAME)} />
      </div>
      <label className="wi-row">
        <span className="wi-label">{t('Môi trường')}</span>
        <select value={opt.envOverride ?? ''} onChange={(e) => set({ envOverride: e.target.value || undefined })}>
          <option value="">{envName(kb, person.env)} ({tr('đã khai', 'declared')})</option>
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
          <button type="button" className="btn ghost small" onClick={() => setAllSkills((x) => !x)}>{allSkills ? t('chỉ kỹ năng liên quan') : tr(`hiện cả ${SKILL_ARCHS.length} kỹ năng`, `show all ${SKILL_ARCHS.length} skills`)}</button>
        </div>
        <div className="skills-wi">
          {shown.map((a) => {
            const now = Math.max(1, Math.min(5, person.skills[a] + (delta[a] ?? 0)));
            return (
              <div key={a} className={`sk ${now <= kb.params.Weak_max ? 'weak' : ''}`} title={skillName(kb, a)}>
                <span className="sk-name">{skillCode(a)} <span className="muted">{skillName(kb, a)}</span></span>
                <span className="stepper">
                  <button type="button" aria-label={`${tr('Giảm', 'Decrease')} ${skillCode(a)}`} onClick={() => setDelta(a, -1)} disabled={now <= 1}>−</button>
                  <span className={`num ${delta[a] ? 'chg' : ''}`}>{now}{delta[a] ? <sup>{delta[a] > 0 ? '+' : ''}{delta[a]}</sup> : null}</span>
                  <button type="button" aria-label={`${tr('Tăng', 'Increase')} ${skillCode(a)}`} onClick={() => setDelta(a, 1)} disabled={now >= 5}>+</button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <details className="wi-adv" open={advanced || undefined}>
        <summary>{t('Nâng cao: trọng số, nhóm tín hiệu, chuẩn hóa')}</summary>
        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
          <Seg label={t('Bộ trọng số')} value={custom ? 'custom' : (opt.wset ?? kb.paramSet.code)}
            onChange={(v) => setOpt((o) => { const { weights: _w, ...rest } = o; return { ...rest, wset: v, normalize: kb.sets.find((s) => s.code === v)?.normalize }; })}
            options={kb.sets.map((s) => [s.code, SET_NAME[s.code] ?? s.code])} />
          <label className="checks"><input type="checkbox" checked={out.result.normalize} onChange={(e) => set({ normalize: e.target.checked })} /> {t('Chuẩn hóa min–max (mặc định bật)')}</label>
          <label className="checks"><input type="checkbox" checked={custom} onChange={(e) => (e.target.checked ? set({ weights: [...w] }) : setOpt((o) => { const { weights: _w, ...r } = o; return r; }))} /> {t('Tự chỉnh α/β/γ (tự quy về tổng 1)')}</label>
          {['α · NF', 'β · SR', 'γ · ENV'].map((n, i) => (
            <div key={n} className="slider">
              <span>{n}</span>
              <input type="range" min="0" max="1" step="0.05" disabled={!custom} value={custom ? opt.weights[i] : w[i]} onChange={(e) => setW(i, Number(e.target.value))} aria-label={n} />
              <span className="num">{fmt(w[i], 2)}</span>
            </div>
          ))}
          <div className="checks">
            {GROUPS.map((g) => (
              <label key={g} title={groupName(kb, g)}>
                <input type="checkbox" checked={!!flags[g]} disabled={flags[g] && nOn === 1}
                  onChange={(e) => set({ flags: { ...flags, [g]: e.target.checked ? 1 : 0 } })} />{g}
              </label>
            ))}
          </div>
          <label className="checks"><input type="checkbox" checked={opt.positional !== false} onChange={(e) => set({ positional: e.target.checked ? undefined : false })} /> {t('Trọng số vị trí p = 1 / 0,8 / 0,6')}</label>
          <label className="checks"><input type="checkbox" checked={!!opt.yVowel} onChange={(e) => set({ yVowel: e.target.checked || undefined })} /> {t('Y là nguyên âm (chỉ đổi SU → SAT)')}</label>
        </div>
      </details>

      {dirty && (
        <div className="diff" aria-live="polite">
          <span>Top-1: {b1?.profile ?? '–'} ({b1 ? t(b1.label) : '–'}) → <b>{c1?.profile ?? '–'}</b> ({c1 ? t(c1.label) : '–'}) · C {fmt(c1?.C)} {b1 && c1 && b1.profile === c1.profile ? `(${signed(c1.C - b1.C)})` : ''}</span>
          {ct && <span>{out.target.major.name_vi}: {tr('nhãn', 'label')} {bt ? t(bt.row.label) : '–'} → <b>{t(ct.row.label)}</b> · SR {fmt(bt?.row.SR)} → <b>{fmt(ct.row.SR)}</b></span>}
          <span className="muted">{t('Độ ổn định Top-1')}: {base?.stability.count ?? '–'}/5 → {out.stability.count}/5</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn" onClick={onReset} disabled={!dirty}>{t('Đặt lại')}</button>
        {canSave && <button type="button" className="btn primary" onClick={onSave} disabled={!dirty || saveState === 'saving'}>{saveState === 'saving' ? t('Đang lưu…') : t('Lưu kịch bản')}</button>}
        {saveState?.startsWith?.('ok:') && <span className="small muted">{tr('Đã lưu lần tính', 'Saved run')} #{saveState.slice(3, 9)}…</span>}
        {saveState?.startsWith?.('err:') && <span className="small err">{saveState.slice(4)}</span>}
      </div>
    </div>
  );
}
