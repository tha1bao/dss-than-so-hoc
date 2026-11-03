// Thử thay đổi (What-if) – tính lại ngay trên trình duyệt bằng engine dùng chung. Trọng số cố định bộ A (ROC);
// người dùng chỉ đổi góc nhìn, môi trường, ngành mục tiêu và mức kỹ năng.
import { useState, useMemo } from 'react';
import { SKILL_ARCHS } from '../../shared/engine/index.js';
import { skillName, envName, PERSONA_NAME } from '../format.js';
import { t, tr } from '../i18n.js';
import { pct, repMajor } from '../plain.js';

const Seg = ({ value, options, onChange, label }) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map(([v, name]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{name}</button>)}
  </div>
);

const RUBRIC = [
  [1, 'Mới bắt đầu / Rất yếu', 'Chưa từng làm hoặc rất lúng túng khi gặp phải.', 'Beginner / Very weak'],
  [2, 'Dưới trung bình', 'Cần có người hướng dẫn từng bước mới hoàn thành được.', 'Below average'],
  [3, 'Đạt yêu cầu THPT', 'Độc lập hoàn thành tốt bài tập và nhiệm vụ phổ thông.', 'Basic / Meets requirement'],
  [4, 'Tự tin / Thành thạo', 'Làm tốt, chủ động và có thể hướng dẫn bạn bè.', 'Confident / Proficient'],
  [5, 'Xuất sắc / Đam mê', 'Thế mạnh vượt trội, tự học nâng cao hoặc có giải thưởng.', 'Master / Passionate'],
];
const LEVEL_SHORT = ['', 'Yếu', 'Cần kèm', 'Cơ bản', 'Thành thạo', 'Xuất sắc'];

export default function WhatIf({ kb, out, base, opt, setOpt, person, target, setTarget, onReset, onSave, saveState, canSave, dirty }) {
  const [allSkills, setAllSkills] = useState(false);
  const [showRubric, setShowRubric] = useState(false);
  const set = (patch) => setOpt((o) => ({ ...o, ...patch }));
  const delta = opt.delta ?? {};

  const setDelta = (a, d) => setOpt((o) => {
    const cur = o.delta ?? {};
    const now = Math.max(1, Math.min(5, person.skills[a] + (cur[a] ?? 0) + d));
    return { ...o, delta: { ...cur, [a]: now - person.skills[a] } };
  });

  const setVal = (a, targetVal) => setOpt((o) => {
    const cur = o.delta ?? {};
    return { ...o, delta: { ...cur, [a]: targetVal - person.skills[a] } };
  });

  // kỹ năng liên quan = nét tính cách của 4 nhóm ngành đứng đầu (gốc) + kỹ năng đang yếu + kỹ năng đã chỉnh
  const top4 = (base ?? out).result.rows.filter((r) => r.rank && r.rank <= 4);
  const relevant = new Set([...top4.flatMap((r) => r.A), ...Object.keys(delta).map(Number)]);
  for (const a of SKILL_ARCHS) if (person.skills[a] <= kb.params.Weak_max) relevant.add(a);
  const shown = allSkills ? SKILL_ARCHS : SKILL_ARCHS.filter((a) => relevant.has(a));

  const pilotIds = useMemo(() => new Set((kb.admission ?? []).map((a) => a.major_id)), [kb.admission]);

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
        <datalist id="majors-300">
          {kb.majors.map((m) => (
            <option key={m.id} value={m.name_vi}>
              {pilotIds.has(m.id) ? tr('★ Có điểm chuẩn tuyển sinh 2026', '★ Has 2026 admission benchmark') : ''}
            </option>
          ))}
        </datalist>
      </label>

      <div>
        <div className="wi-row" style={{ marginBottom: 4 }}>
          <span className="wi-label">{t('Kỹ năng (1–5)')}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn ghost small" onClick={() => setShowRubric((x) => !x)}>
              {showRubric ? tr('✕ Đóng tiêu chí', '✕ Close rubric') : tr('ⓘ Tiêu chí chấm 1–5', 'ⓘ 1–5 Rubric')}
            </button>
            <button type="button" className="btn ghost small" onClick={() => setAllSkills((x) => !x)}>
              {allSkills ? t('chỉ kỹ năng liên quan') : tr('hiện tất cả kỹ năng', 'show all skills')}
            </button>
          </div>
        </div>

        {showRubric && (
          <div className="rubric-box" role="region" aria-label="Tiêu chuẩn chấm kỹ năng">
            <b className="small">{tr('Hướng dẫn tự chấm kỹ năng (thang 1–5):', 'Self-rating rubric (1–5 scale):')}</b>
            <ul className="rubric-list">
              {RUBRIC.map(([lvl, title, desc, titleEn]) => (
                <li key={lvl}>
                  <span className={`rubric-badge lvl-${lvl}`}>{lvl}</span>
                  <div><b>{tr(title, titleEn)}:</b> <span>{desc}</span></div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="skills-wi">
          {shown.map((a) => {
            const orig = person.skills[a];
            const chg = delta[a] ?? 0;
            const now = Math.max(1, Math.min(5, orig + chg));
            const nm = skillName(kb, a);
            const isWeak = now <= kb.params.Weak_max;
            return (
              <div key={a} className={`sk-row ${isWeak ? 'weak' : ''} ${chg ? 'changed' : ''}`}>
                <div className="sk-header">
                  <span className="sk-name" title={nm}>{nm}</span>
                  <span className={`sk-level-tag lvl-${now}`}>
                    {tr(LEVEL_SHORT[now], LEVEL_SHORT[now])} ({now}/5)
                    {chg > 0 && <span className="diff-tag up">+{chg}</span>}
                    {chg < 0 && <span className="diff-tag down">{chg}</span>}
                  </span>
                </div>
                <div className="sk-rating-bar" role="radiogroup" aria-label={`${nm}: chọn từ 1 đến 5`}>
                  <button type="button" className="sk-step-btn" aria-label={`${tr('Giảm', 'Decrease')} ${nm}`} onClick={() => setDelta(a, -1)} disabled={now <= 1}>−</button>
                  <div className="sk-pills">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        role="radio"
                        aria-checked={now === val}
                        className={`sk-pill ${now === val ? 'active' : ''} ${val === orig ? 'orig' : ''}`}
                        onClick={() => setVal(a, val)}
                        title={`${val}/5: ${tr(RUBRIC[val - 1][1], RUBRIC[val - 1][3])}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="sk-step-btn" aria-label={`${tr('Tăng', 'Increase')} ${nm}`} onClick={() => setDelta(a, 1)} disabled={now >= 5}>+</button>
                </div>
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
