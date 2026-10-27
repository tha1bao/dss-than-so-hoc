import { useState } from 'react';
import { SKILLS, ENVS, PARAMS } from '../lib/engine.js';

export default function InputPanel({ t, form, errors, onChange, samples, onSample, strengths }) {
  const [touched, setTouched] = useState({});
  const show = (k) => touched[k] && errors[k];
  const touch = (k) => setTouched((s) => ({ ...s, [k]: true }));

  const setSkill = (code, v) => onChange({ skills: { ...form.skills, [code]: v } });

  return (
    <section className="panel input-panel" aria-labelledby="input-head">
      <h2 id="input-head">{t.inputHead}</h2>

      <label className="field">
        <span>{t.name}</span>
        <input type="text" value={form.name} placeholder={t.namePh} autoComplete="off"
          onChange={(e) => onChange({ name: e.target.value })} onBlur={() => touch('name')}
          aria-invalid={!!show('name')} />
        {show('name') && <small className="err">{t.errName}</small>}
      </label>

      <label className="field">
        <span>{t.dob}</span>
        <input type="date" value={form.dob} min="1950-01-01" max="2020-12-31"
          onChange={(e) => onChange({ dob: e.target.value })} onBlur={() => touch('dob')}
          aria-invalid={!!show('dob')} />
        {show('dob') && <small className="err">{t.errDob}</small>}
      </label>

      <fieldset className="field">
        <legend>{t.skillsInput}</legend>
        <small className="hint">{t.skillsInputHint}</small>
        <ul className="likert">
          {SKILLS.map((code) => (
            <li key={code} className={form.skills[code] <= PARAMS.weakMax ? 'weak' : ''}>
              <span className="likert-name" id={`lk-${code}`}>{t.skill(code)}</span>
              <span className="likert-scale" role="radiogroup" aria-labelledby={`lk-${code}`}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={form.skills[code] === v}
                    aria-label={`${v}`} className={form.skills[code] === v ? 'on' : ''}
                    onClick={() => setSkill(code, v)}>
                    {v}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="strengths-line">
          <b>{t.strengthsDerived}</b> {strengths.map((n) => t.skill(`SK${String(n).padStart(2, '0')}`)).join('; ')}
        </p>
      </fieldset>

      <fieldset className="field">
        <legend>{t.envHead}</legend>
        <div className="env-grid">
          {ENVS.map((e) => (
            <label key={e} className={`chip ${form.env === e ? 'on' : ''}`}>
              <input type="radio" name="env" value={e} checked={form.env === e}
                onChange={() => onChange({ env: e })} />
              {t.env(e)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="samples">
        <p>{t.samples}</p>
        <div className="sample-list">
          {samples.map((s) => (
            <button key={s.id} type="button" className={`sample ${form.sampleId === s.id ? 'on' : ''}`}
              onClick={() => { onSample(s.id); setTouched({}); }}>
              <strong>{s.id}</strong> {s.name}
              <span>{t.sampleNote[s.id]}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
