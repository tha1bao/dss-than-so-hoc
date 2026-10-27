import { useState } from 'react';
import { LabelChip } from './Results.jsx';

export default function AllProfiles({ t, result }) {
  const [open, setOpen] = useState(false);
  const rows = [...result.ranked, ...result.rows.filter((r) => r.rank === null)];
  return (
    <section className="panel all" aria-labelledby="all-head">
      <div className="whatif-top">
        <h2 id="all-head">{t.allHead}</h2>
        <button type="button" className="link" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t.allHide : t.allShow}
        </button>
      </div>
      {open && (
        <div className="table-wrap">
          <table className="all-table">
            <thead>
              <tr>
                <th scope="col">{t.rank}</th>
                <th scope="col">{t.profile}</th>
                <th scope="col" className="num">C</th>
                <th scope="col" className="num">NF</th>
                <th scope="col" className="num">EC</th>
                <th scope="col" className="num">SR</th>
                <th scope="col" className="num">ENV</th>
                <th scope="col">{t.label}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.profile.id} className={r.rank === null ? 'muted' : ''}>
                  <td>{r.rank ?? '–'}</td>
                  <td className="pname">
                    <span>{t.profileName(r.profile)}</span>
                    <small>{r.profile.examples.split('; ').slice(0, 2).join(', ')}{r.profile.n > 2 ? ` (+${r.profile.n - 2})` : ''}</small>
                  </td>
                  <td className="num">{t.num(r.c)}</td>
                  <td className="num">{t.num(r.nf)}</td>
                  <td className="num">{r.ec}</td>
                  <td className="num">{t.num(r.sr)}</td>
                  <td className="num">{r.env}</td>
                  <td><LabelChip t={t} label={r.label} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
