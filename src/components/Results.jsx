import { useState } from 'react';
import { majorsOfProfile } from '../lib/engine.js';

export function LabelChip({ t, label }) {
  return <span className={`label label-${label}`}>{t.labelName(label)}</span>;
}

function ProfileResult({ t, row, baseRank }) {
  const [open, setOpen] = useState(false);
  const majors = majorsOfProfile(row.profile.id);
  const moved = baseRank ? baseRank - row.rank : null;
  return (
    <li className="result">
      <div className="result-head">
        <span className="result-rank" aria-label={`${t.rank} ${row.rank}`}>{row.rank}</span>
        <div className="result-title">
          <h3>{row.profile.a.map((a) => t.arch(a)).join(' + ')}</h3>
          <p>
            {row.profile.id}, archetype {row.profile.a.join(' – ')}, {t.env(row.profile.env)}
          </p>
        </div>
        <LabelChip t={t} label={row.label} />
      </div>

      <div className="score">
        <div className="score-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(0, row.c) * 100}%` }} />
        </div>
        <span className="score-n">C = {t.num(row.c)}</span>
        <span className={`base ${moved > 0 ? 'up' : moved < 0 ? 'down' : ''}`}>{t.baseRank(baseRank)}</span>
      </div>

      <dl className="metrics">
        <div><dt>{t.nf}</dt><dd>{t.num(row.nf)}</dd></div>
        <div><dt>{t.ec}</dt><dd>{row.ec} / 5</dd></div>
        <div><dt>{t.sr}</dt><dd>{t.num(row.sr)}</dd></div>
        <div><dt>{t.envFit}</dt><dd>{row.env}</dd></div>
        <div><dt>{t.sat}</dt><dd>{row.sat} / 3</dd></div>
        <div><dt>{t.str}</dt><dd>{row.str} / 3</dd></div>
      </dl>

      <dl className="why">
        <div>
          <dt>{t.matched}</dt>
          <dd>{row.matchedGroups.map((g) => t.sig(g)).join(', ') || t.nothing}</dd>
        </div>
        <div>
          <dt>{t.develop}</dt>
          <dd>{row.weakSkills.length
            ? row.weakSkills.map((w) => `${t.skill(w.code)} (${w.level}/5)`).join('; ')
            : t.nothing}</dd>
        </div>
      </dl>

      <button type="button" className="link" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? t.hideMajors : t.majors(majors.length)}
      </button>
      {open && (
        <ul className="majors">
          {majors.map((m) => (
            <li key={m.id}><span>{m.name}</span><small>{m.category}</small></li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Results({ t, result, baseline, opt }) {
  const baseRank = Object.fromEntries(baseline.rows.map((r) => [r.profile.id, r.rank]));
  return (
    <section className="panel results" aria-labelledby="results-head" aria-live="polite">
      <h2 id="results-head">{t.resultsHead}</h2>
      <p className="hint">{t.resultsSub(t.persona(opt.persona))}</p>
      {result.top.length === 0 ? (
        <p className="empty">{t.noTop}</p>
      ) : (
        <ol className="result-list">
          {result.top.map((row) => (
            <ProfileResult key={row.profile.id} t={t} row={row} baseRank={baseRank[row.profile.id]} />
          ))}
        </ol>
      )}
    </section>
  );
}
