import { useEffect, useMemo, useState } from 'react';
import { makeT } from './i18n.js';
import { computeProfile } from './lib/numerology.js';
import { scoreAll, defaultOptions, SKILLS, PARAMS } from './lib/engine.js';
import SAMPLES from './data/samples.json';
import InputPanel from './components/InputPanel.jsx';
import ProfileCard from './components/ProfileCard.jsx';
import Results from './components/Results.jsx';
import WhatIf from './components/WhatIf.jsx';
import AllProfiles from './components/AllProfiles.jsx';

const SAMPLE_ORDER = ['HS001', 'HS021', 'HS015'];
const toCode = (n) => `SK${String(n).padStart(2, '0')}`;

function formFromSample(id) {
  const s = SAMPLES.find((x) => x.id === id);
  return { name: s.name, dob: s.dob, top: s.top.map(toCode), env: s.env, baseSkills: s.skills, sampleId: id };
}

/** Ba kỹ năng mạnh nhất → 5 / 4 / 4, còn lại 3 (mức trung bình của thang 1–5). */
function skillsFromTop(top) {
  const s = Object.fromEntries(SKILLS.map((k) => [k, 3]));
  top.forEach((code, i) => { if (code) s[code] = i === 0 ? 5 : 4; });
  return s;
}

export function validate(form) {
  const errors = {};
  if (form.name.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w)).length < 2) errors.name = true;
  const y = Number(form.dob.slice(0, 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dob) || y < 1950 || y > 2020) errors.dob = true;
  if (form.top.some((x) => !x) || new Set(form.top).size < 3) errors.top = true;
  if (!form.env) errors.env = true;
  return errors;
}

export default function App() {
  const [lang, setLang] = useState('vi');
  const [form, setForm] = useState(() => formFromSample('HS001'));
  const [opt, setOpt] = useState(defaultOptions);
  const t = makeT(lang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const errors = validate(form);
  const profileOk = !errors.name && !errors.dob;
  const ready = Object.keys(errors).length === 0;

  const profile = useMemo(() => (profileOk ? computeProfile(form.name, form.dob) : null),
    [profileOk, form.name, form.dob]);

  const student = useMemo(() => {
    if (!ready || !profile) return null;
    return {
      signals: profile.signals,
      skills: form.baseSkills ?? skillsFromTop(form.top),
      top: form.top.map((c) => Number(c.slice(2))),
      env: form.env,
    };
  }, [ready, profile, form]);

  const result = useMemo(() => (student ? scoreAll(student, opt) : null), [student, opt]);
  const baseline = useMemo(() => (student ? scoreAll(student, defaultOptions()) : null), [student]);

  const updateForm = (patch) => setForm((f) => ({ ...f, ...patch, sampleId: null,
    baseSkills: 'top' in patch ? null : f.baseSkills }));
  const loadSample = (id) => { setForm(formFromSample(id)); setOpt(defaultOptions()); };

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead-text">
          <p className="course">{t.course}</p>
          <h1>{t.title}</h1>
          <p className="lede">{t.subtitle}</p>
        </div>
        <button type="button" className="lang" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
          lang={lang === 'vi' ? 'en' : 'vi'}>
          {t.langSwitch}
        </button>
      </header>

      <main className="layout">
        <aside className="side">
          <InputPanel t={t} form={form} errors={errors} onChange={updateForm}
            samples={SAMPLE_ORDER.map((id) => SAMPLES.find((s) => s.id === id))}
            onSample={loadSample} />
          {student && (
            <WhatIf t={t} opt={opt} setOpt={setOpt} student={student} result={result}
              onReset={() => setOpt({ ...defaultOptions(), targetMajor: opt.targetMajor })}
              personas={PARAMS.personas} />
          )}
        </aside>

        <section className="main">
          {profile && <ProfileCard t={t} profile={profile} flags={opt.flags} />}
          {result ? (
            <>
              <Results t={t} result={result} baseline={baseline} opt={opt} />
              <AllProfiles t={t} result={result} />
            </>
          ) : (
            <p className="empty">{t.emptyResult}</p>
          )}
        </section>
      </main>

      <footer className="foot">
        <p>{t.footer}</p>
        <p>{t.footerVerify}</p>
      </footer>
    </div>
  );
}
