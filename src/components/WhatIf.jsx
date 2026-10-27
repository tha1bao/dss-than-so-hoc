import { useMemo } from 'react';
import { GROUPS, PARAMS, targetAnalysis, alphaSweep } from '../lib/engine.js';
import MajorSearch from './MajorSearch.jsx';
import { LabelChip } from './Results.jsx';

const KEYS = ['alpha', 'beta', 'gamma'];

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
      </fieldset>

      <fieldset className="field">
        <legend>{t.targetHead}</legend>
        <MajorSearch t={t} value={opt.targetMajor} onChange={(v) => set({ targetMajor: v })} />
        {target && (
          <div className="target">
            <p>
              {t.inProfile} <strong>{t.profileName(target.row.profile)}</strong>
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
                {target.stepsWeak > 0 && (
                  <p>{t.stepsWeak(target.stepsWeak, target.row.weakSkills
                    .map((w) => `${t.skill(w.code)} (${w.level} → ${PARAMS.weakMax + 1})`).join('; '))}</p>
                )}
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
            <tr><th scope="col">α</th><th scope="col">{t.sweepTop}</th></tr>
          </thead>
          <tbody>
            {sweep.map((s) => (
              <tr key={s.alpha} className={Math.abs(s.alpha - opt.weights[0]) < 0.001 ? 'cur' : ''}>
                <td>{t.num(s.alpha, 1)}</td>
                <td>{s.a.length ? t.profileName({ a: s.a }) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
