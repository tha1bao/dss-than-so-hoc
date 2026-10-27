import { GROUPS } from '../lib/engine.js';

// Lưới Pythagoras: hàng trên 3-6-9, giữa 2-5-8, dưới 1-4-7
const GRID = [3, 6, 9, 2, 5, 8, 1, 4, 7];
const show22 = (n) => (n === 22 ? '22/4' : String(n));

const WEEKDAY_VI = { Sunday: 'Chủ nhật', Monday: 'Thứ hai', Tuesday: 'Thứ ba', Wednesday: 'Thứ tư',
  Thursday: 'Thứ năm', Friday: 'Thứ sáu', Saturday: 'Thứ bảy' };

export default function ProfileCard({ t, profile, flags }) {
  const { pythagoras: py, vedic, kabala: kb, signals } = profile;
  const raw = {
    G1: `${show22(py.ruling)}  (${py.rulingRaw})`,
    G5: `${show22(py.completeName)}  (${py.nameTotal})`,
    G6: `${kb.nameKey}  ${kb.namePlanet}`,
    G4: `${kb.dayKey}  ${t.lang === 'vi' ? WEEKDAY_VI[kb.weekday] : kb.weekday}, ${kb.dayPlanet}`,
    G2: `${vedic.psychic}  (${vedic.psychicType === 'Pure' ? (t.lang === 'vi' ? 'thuần' : 'pure')
      : (t.lang === 'vi' ? 'ghép' : 'compound')})`,
  };

  return (
    <section className="panel profile" aria-labelledby="profile-head">
      <div className="chart-block">
        <div className="ruling" aria-label={t.sig('G1')}>
          <span className="ruling-n">{show22(py.ruling)}</span>
          <span className="ruling-l">{t.sig('G1')}</span>
          <span className="ruling-a">{t.arch(signals.G1)}</span>
        </div>
        <figure className="chart">
          <figcaption id="profile-head">{t.chart}</figcaption>
          <div className="grid" role="img"
            aria-label={GRID.map((k) => `${k}: ${py.chart[k]}`).join(', ')}>
            {GRID.map((k) => (
              <div key={k} className={`cell ${py.chart[k] ? '' : 'miss'}`}>
                {py.chart[k] ? String(k).repeat(py.chart[k]) : k}
              </div>
            ))}
          </div>
          <dl className="chart-meta">
            <div><dt>{t.missing}</dt><dd>{py.missing.join(', ') || '–'}</dd></div>
            <div><dt>{t.arrows}</dt><dd>{py.arrows.length ? py.arrows.join('; ') : t.noArrow}</dd></div>
          </dl>
        </figure>
      </div>

      <div className="signals">
        <h3>{t.signals}</h3>
        <p className="hint">{t.signalsHint}</p>
        <ul>
          {GROUPS.map((g) => (
            <li key={g} className={flags[g] ? '' : 'off'}>
              <span className="sig-name">{t.sig(g)}<small>{t.school(g)}</small></span>
              <span className="sig-val">{raw[g]}</span>
              <span className="sig-arch"><b>{signals[g]}</b> {t.arch(signals[g])}</span>
            </li>
          ))}
          <li className="soul">
            <span className="sig-name">{t.soul}<small>{t.soulHint}</small></span>
            <span className="sig-val">{py.soulUrge}</span>
            <span className="sig-arch"><b>{signals.soul}</b> {t.arch(signals.soul)}</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
