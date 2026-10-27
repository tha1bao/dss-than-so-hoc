import { useState } from 'react';
import { SKILLS, ENVS } from '../lib/engine.js';

export default function InputPanel({ t, form, errors, onChange, samples, onSample }) {
  const [touched, setTouched] = useState({});
  const show = (k) => touched[k] && errors[k];
  const touch = (k) => setTouched((s) => ({ ...s, [k]: true }));

  const setTop = (i, code) => {
    const top = [...form.top];
    top[i] = code;
    onChange({ top });
    touch('top');
  };

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
        <legend>{t.strengths}</legend>
        {[0, 1, 2].map((i) => (
          <label key={i} className="strength">
            <span className="strength-n" aria-hidden="true">{i + 1}</span>
            <select value={form.top[i]} onChange={(e) => setTop(i, e.target.value)} aria-label={t.strengthN(i + 1)}>
              <option value="">—</option>
              {SKILLS.map((code) => (
                <option key={code} value={code}
                  disabled={form.top.includes(code) && form.top[i] !== code}>
                  {t.skill(code)}
                </option>
              ))}
            </select>
          </label>
        ))}
        <small className="hint">{t.strengthsHint}</small>
        {show('top') && <small className="err">{t.errTop}</small>}
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
