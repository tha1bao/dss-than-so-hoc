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

function formFromSample(id) {
  const s = SAMPLES.find((x) => x.id === id);
  return { name: s.name, dob: s.dob, skills: { ...s.skills }, top: s.top, env: s.env, sampleId: id };
}

/** Điểm mạnh (Q5, STR) = 3 kỹ năng có điểm cao nhất; bằng điểm thì kỹ năng đứng trước trong danh sách SK01…SK33. */
export function topStrengths(skills) {
  return SKILLS.map((code, i) => ({ code, v: skills[code], i }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .slice(0, 3)
    .map((x) => Number(x.code.slice(2)));
}

export function validate(form) {
  const errors = {};
  if (form.name.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w)).length < 2) errors.name = true;
  const y = Number(form.dob.slice(0, 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dob) || y < 1950 || y > 2020) errors.dob = true;
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
      skills: form.skills,
      top: form.top ?? topStrengths(form.skills),
      env: form.env,
    };
  }, [ready, profile, form]);

  const result = useMemo(() => (student ? scoreAll(student, opt) : null), [student, opt]);
  const baseline = useMemo(() => (student ? scoreAll(student, defaultOptions()) : null), [student]);

  // Sửa kỹ năng thì điểm mạnh được tính lại từ 12 mức (hồ sơ mẫu giữ top_strength gốc của dữ liệu)
  const updateForm = (patch) => setForm((f) => ({ ...f, ...patch, sampleId: null,
    top: 'skills' in patch ? null : f.top }));
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
            onSample={loadSample} strengths={form.top ?? topStrengths(form.skills)} />
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
