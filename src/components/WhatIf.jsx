import { useMemo } from 'react';
import { GROUPS, SKILLS, ENVS, MAJORS, PARAMS, targetAnalysis, alphaSweep } from '../lib/engine.js';
import { LabelChip } from './Results.jsx';

const KEYS = ['alpha', 'beta', 'gamma'];

const categories = (() => {
  const m = new Map();
  for (const x of MAJORS) {
    if (!m.has(x.category)) m.set(x.category, []);
    m.get(x.category).push(x);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
})();

export default function WhatIf({ t, opt, setOpt, student, result, onReset, personas }) {
  const set = (patch) => setOpt((o) => ({ ...o, ...patch }));
  const pct = opt.weights.map((w) => Math.round(w * 100));

  const choosePersona = (p) => set({ persona: p, weights: [...personas[p]] });
  const setWeight = (i, v) => {
    const raw = [...pct];
    raw[i] = Number(v);
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    set({ persona: 'custom', weights: raw.map((x) => x / sum) });
  };
  const step = (code, d) => {
    const cur = student.skills[code] + (opt.delta[code] || 0);
    const next = Math.max(1, Math.min(5, cur + d));
    set({ delta: { ...opt.delta, [code]: next - student.skills[code] } });
  };

  const target = opt.targetMajor ? targetAnalysis(result, opt.targetMajor) : null;
  const sweep = useMemo(() => alphaSweep(student, opt), [student, opt]);

  return (
    <section className="panel whatif" aria-labelledby="whatif-head">
      <div className="whatif-top">
        <h2 id="whatif-head">{t.whatifHead}</h2>
        <button type="button" className="link" onClick={onReset}>{t.reset}</button>
      </div>
      <p className="hint">{t.whatifSub}</p>

      <fieldset className="field">
        <legend>{t.personaHead}</legend>
        <div className="seg" role="radiogroup">
          {Object.keys(personas).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={opt.persona === p}
              className={opt.persona === p ? 'on' : ''} onClick={() => choosePersona(p)}>
              {t.persona(p)}
            </button>
          ))}
        </div>
        <small className="hint">{t.personaHint}</small>
        {KEYS.map((k, i) => (
          <label key={k} className="slider">
            <span>{t[k]}</span>
            <input type="range" min="0" max="100" step="5" value={pct[i]}
              onChange={(e) => setWeight(i, e.target.value)} />
            <output>{t.num(opt.weights[i], 2)}</output>
          </label>
        ))}
        <small className="hint">{t.weightSum}</small>
      </fieldset>

      <fieldset className="field">
        <legend>{t.groupsHead}</legend>
        {GROUPS.map((g) => (
          <label key={g} className="check">
            <input type="checkbox" checked={!!opt.flags[g]}
              onChange={(e) => set({ flags: { ...opt.flags, [g]: e.target.checked ? 1 : 0 } })} />
            <span>{t.sig(g)} <small>{t.school(g)}, w = {t.num(PARAMS.w[g], 2)}</small></span>
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={opt.positional} onChange={(e) => set({ positional: e.target.checked })} />
          <span>{t.positional}</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={opt.yVowel} onChange={(e) => set({ yVowel: e.target.checked })} />
          <span>{t.yRule}</span>
        </label>
        <label className="field inline">
          <span>{t.envOverride}</span>
          <select value={opt.envOverride} onChange={(e) => set({ envOverride: e.target.value })}>
            <option value="">{t.envSame}</option>
            {ENVS.map((e) => <option key={e} value={e}>{t.env(e)}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="field">
        <legend>{t.skillsHead}</legend>
        <small className="hint">{t.skillsHint}</small>
        <ul className="skills">
          {SKILLS.map((code) => {
            const base = student.skills[code];
            const eff = result.effectiveSkills[code];
            const d = eff - base;
            return (
              <li key={code} className={eff <= PARAMS.weakMax ? 'weak' : ''}>
                <span className="sk-name">{t.skill(code)}</span>
                <span className="stepper">
                  <button type="button" onClick={() => step(code, -1)} disabled={eff <= 1}
                    aria-label={`${t.skill(code)} −1`}>−</button>
                  <b>{eff}</b>
                  <button type="button" onClick={() => step(code, 1)} disabled={eff >= 5}
                    aria-label={`${t.skill(code)} +1`}>+</button>
                </span>
                <small className="delta">{d ? (d > 0 ? `+${d}` : d) : ''}</small>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="field">
        <legend>{t.targetHead}</legend>
        <select value={opt.targetMajor ?? ''} onChange={(e) => set({ targetMajor: e.target.value || null })}>
          <option value="">{t.targetPh}</option>
          {categories.map(([cat, list]) => (
            <optgroup key={cat} label={cat}>
              {list.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </optgroup>
          ))}
        </select>
        {target && (
          <div className="target">
            <p>
              <strong>{target.major.name}</strong>, {target.row.profile.id} ({target.row.profile.a.join(' – ')})
            </p>
            <dl className="metrics">
              <div><dt>{t.targetLabel}</dt><dd><LabelChip t={t} label={target.row.label} /></dd></div>
              <div><dt>{t.targetRank}</dt><dd>{target.row.rank ? `${target.row.rank} / 35` : t.targetNone}</dd></div>
              <div><dt>C</dt><dd>{t.num(target.row.c)}</dd></div>
              <div><dt>{t.ec}</dt><dd>{target.row.ec}</dd></div>
              <div><dt>{t.sr}</dt><dd>{t.num(target.row.sr)}</dd></div>
              <div><dt>{t.sat}</dt><dd>{target.row.sat} / 3</dd></div>
            </dl>
            {target.row.label === 'priority' ? (
              <p className="note good">{t.alreadyPriority}</p>
            ) : (
              <div className="note">
                {target.stepsWeak > 0 && <p>{t.stepsWeak(target.stepsWeak)}</p>}
                {target.stepsMain > 0 && (
                  <p>{t.stepsMain(target.stepsMain, t.skill(`SK${String(target.row.profile.a[0]).padStart(2, '0')}`))}</p>
                )}
                <p className={target.reachable ? 'good' : 'bad'}>{target.reachable ? t.reachYes : t.reachNo}</p>
              </div>
            )}
          </div>
        )}
      </fieldset>

      <div className="sweep">
        <h3>{t.sweepHead}</h3>
        <table>
          <thead>
            <tr><th scope="row">α</th>{sweep.map((s) => <th key={s.alpha} scope="col">{t.num(s.alpha, 1)}</th>)}</tr>
          </thead>
          <tbody>
            <tr><th scope="row">{t.sweepTop}</th>{sweep.map((s) => <td key={s.alpha}>{s.top1}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
