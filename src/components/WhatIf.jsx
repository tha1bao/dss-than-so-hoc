// (d) What-if – tính lại ngay trên trình duyệt bằng engine dùng chung (shared/engine), cùng tri thức từ /api/knowledge.
import { useState } from 'react';
import { GROUPS, SKILL_ARCHS, skillCode } from '../../shared/engine/index.js';
import { fmt, signed, skillName, envName, groupName, PERSONA_NAME, SET_NAME } from '../format.js';

const Seg = ({ value, options, onChange, label }) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map(([v, t]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{t}</button>)}
  </div>
);

export default function WhatIf({ kb, out, base, opt, setOpt, person, target, setTarget, onReset, onSave, saveState, canSave, dirty }) {
  const [showSkills, setShowSkills] = useState(true);
  const set = (patch) => setOpt((o) => ({ ...o, ...patch }));
  const flags = { G1: 1, G5: 1, G6: 1, G4: 1, G2: 1, ...(opt.flags ?? {}) };
  const nOn = GROUPS.filter((g) => flags[g]).length;
  const delta = opt.delta ?? {};
  const setDelta = (a, d) => {
    const now = Math.max(1, Math.min(5, person.skills[a] + d));
    set({ delta: { ...delta, [a]: now - person.skills[a] } });
  };
  const w = out.result.weights;
  const custom = Array.isArray(opt.weights);
  const setW = (i, v) => { const ws = [...(custom ? opt.weights : w)]; ws[i] = v; set({ weights: ws }); };

  const b1 = base?.result.top[0], c1 = out.result.top[0];
  const bt = base?.target?.analysis, ct = out.target?.analysis;
  const changed = dirty;

  return (
    <div className="wi">
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <h2 id="z-d">What-if</h2>
        <span className="zone-tag">khu vực d · tính lại ngay</span>
      </div>

      <fieldset>
        <legend>Góc nhìn (persona) & bộ trọng số</legend>
        <div style={{ display: 'grid', gap: 6 }}>
          <Seg label="Persona" value={opt.persona} onChange={(v) => set({ persona: v })} options={Object.entries(PERSONA_NAME)} />
          <Seg label="Bộ trọng số" value={custom ? 'custom' : (opt.wset ?? kb.paramSet.code)}
            onChange={(v) => setOpt((o) => { const { weights: _w, ...rest } = o; return { ...rest, wset: v, normalize: kb.sets.find((s) => s.code === v)?.normalize }; })}
            options={kb.sets.map((s) => [s.code, SET_NAME[s.code] ?? s.code])} />
          <label className="checks"><input type="checkbox" checked={out.result.normalize} onChange={(e) => set({ normalize: e.target.checked })} /> Chuẩn hóa min–max (mặc định bật)</label>
          <label className="checks"><input type="checkbox" checked={custom} onChange={(e) => (e.target.checked ? set({ weights: [...w] }) : setOpt((o) => { const { weights: _w, ...r } = o; return r; }))} /> Tự chỉnh α/β/γ (tự quy về tổng 1)</label>
          {['α · NF', 'β · SR', 'γ · ENV'].map((n, i) => (
            <div key={n} className="slider">
              <span>{n}</span>
              <input type="range" min="0" max="1" step="0.05" disabled={!custom} value={custom ? opt.weights[i] : w[i]} onChange={(e) => setW(i, Number(e.target.value))} aria-label={n} />
              <span className="num">{fmt(w[i], 2)}</span>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Tín hiệu thần số học</legend>
        <div className="checks">
          {GROUPS.map((g) => (
            <label key={g} title={groupName(kb, g)}>
              <input type="checkbox" checked={!!flags[g]} disabled={flags[g] && nOn === 1}
                onChange={(e) => set({ flags: { ...flags, [g]: e.target.checked ? 1 : 0 } })} />{g}
            </label>
          ))}
        </div>
        <div className="checks" style={{ marginTop: 4 }}>
          <label><input type="checkbox" checked={opt.positional !== false} onChange={(e) => set({ positional: e.target.checked ? undefined : false })} /> Trọng số vị trí p = 1 / 0,8 / 0,6</label>
          <label><input type="checkbox" checked={!!opt.yVowel} onChange={(e) => set({ yVowel: e.target.checked || undefined })} /> Y là nguyên âm (chỉ đổi SU → SAT)</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Môi trường & ngành mục tiêu</legend>
        <div style={{ display: 'grid', gap: 6 }}>
          <select value={opt.envOverride ?? ''} onChange={(e) => set({ envOverride: e.target.value || undefined })} aria-label="Môi trường mong muốn">
            <option value="">Môi trường: {envName(kb, person.env)} (đã khai)</option>
            {Object.keys(kb.envs).filter((e) => e !== person.env).map((e) => <option key={e} value={e}>Thử: {envName(kb, e)}</option>)}
          </select>
          <input type="search" list="majors-300" placeholder="Gõ tên ngành (300 ngành)…" value={target ?? ''} onChange={(e) => setTarget(e.target.value)} aria-label="Ngành mục tiêu" />
          <datalist id="majors-300">{kb.majors.map((m) => <option key={m.id} value={m.name_vi} />)}</datalist>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Kỹ năng tự đánh giá (1–5){' '}
          <button type="button" className="btn ghost small" onClick={() => setShowSkills((x) => !x)}>{showSkills ? 'thu gọn' : 'mở'}</button>
        </legend>
        {showSkills && (
          <div className="skills-wi">
            {SKILL_ARCHS.map((a) => {
              const now = Math.max(1, Math.min(5, person.skills[a] + (delta[a] ?? 0)));
              return (
                <div key={a} className={`sk ${now <= kb.params.Weak_max ? 'weak' : ''}`} title={skillName(kb, a)}>
                  <span className="sk-name">{skillCode(a)}</span>
                  <span className="stepper">
                    <button type="button" aria-label={`Giảm ${skillCode(a)}`} onClick={() => setDelta(a, -1)} disabled={now <= 1}>−</button>
                    <span className={`num ${delta[a] ? 'chg' : ''}`}>{now}{delta[a] ? <sup>{delta[a] > 0 ? '+' : ''}{delta[a]}</sup> : null}</span>
                    <button type="button" aria-label={`Tăng ${skillCode(a)}`} onClick={() => setDelta(a, 1)} disabled={now >= 5}>+</button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="diff" aria-live="polite">
        <b>So với kết quả gốc</b>
        <span>Top-1: {b1?.profile ?? '–'} ({b1?.label ?? '–'}) → <b>{c1?.profile ?? '–'}</b> ({c1?.label ?? '–'}) · C {fmt(c1?.C)} {b1 && c1 && b1.profile === c1.profile ? `(${signed(c1.C - b1.C)})` : ''}</span>
        {ct && <span>Bước 5 – {out.target.major.name_vi}: SR {fmt(bt?.row.SR)} → <b>{fmt(ct.row.SR)}</b>; nhãn {bt?.row.label ?? '–'} → <b>{ct.row.label}</b>; còn {ct.stepsWeak} bậc để hết kỹ năng yếu, thiếu {fmt(ct.gap, 1)} điểm SR</span>}
        <span className="muted">Độ ổn định Top-1: {base?.stability.count ?? '–'}/5 → {out.stability.count}/5</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn" onClick={onReset} disabled={!changed}>Đặt lại</button>
        {canSave && <button type="button" className="btn primary" onClick={onSave} disabled={!changed || saveState === 'saving'}>{saveState === 'saving' ? 'Đang lưu…' : 'Lưu kịch bản'}</button>}
        {saveState?.startsWith?.('ok:') && <span className="small muted">Đã lưu lần tính #{saveState.slice(3, 9)}…</span>}
        {saveState?.startsWith?.('err:') && <span className="small err">{saveState.slice(4)}</span>}
      </div>
    </div>
  );
}
