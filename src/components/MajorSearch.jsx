import { useId, useMemo, useState } from 'react';
import { MAJORS } from '../lib/engine.js';

// Bỏ dấu để gõ "khoa hoc may tinh" vẫn tìm ra "Khoa học máy tính"
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase();
const INDEX = MAJORS.map((m) => ({ ...m, key: fold(`${m.name} ${m.category}`) }));
const LIMIT = 8;

export default function MajorSearch({ t, value, onChange }) {
  const id = useId();
  const selected = MAJORS.find((m) => m.id === Number(value));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return INDEX.filter((m) => words.every((w) => m.key.includes(w)));
  }, [query]);
  const shown = matches.slice(0, LIMIT);

  const pick = (m) => {
    onChange(m.id);
    setQuery('');
    setOpen(false);
  };

  const onKey = (e) => {
    if (!shown.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); pick(shown[active]); }
    if (e.key === 'Escape') setOpen(false);
  };

  if (selected) {
    return (
      <div className="major-picked">
        <span>
          <strong>{selected.name}</strong>
          <small>{selected.category}</small>
        </span>
        <button type="button" className="link" onClick={() => onChange(null)}>{t.targetChange}</button>
      </div>
    );
  }

  return (
    <div className="major-search">
      <input type="search" role="combobox" aria-expanded={open && shown.length > 0} aria-controls={`${id}-list`}
        aria-autocomplete="list" aria-activedescendant={shown.length ? `${id}-${active}` : undefined}
        placeholder={t.targetPh} value={query} autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey} />
      {open && query.trim() && (
        <ul className="major-results" id={`${id}-list`} role="listbox">
          {shown.length === 0 && <li className="none">{t.targetNoMatch}</li>}
          {shown.map((m, i) => (
            <li key={m.id} id={`${id}-${i}`} role="option" aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }} onMouseEnter={() => setActive(i)}>
              <span>{m.name}</span>
              <small>{m.category}</small>
            </li>
          ))}
          {matches.length > LIMIT && <li className="none">{t.targetMore(matches.length - LIMIT)}</li>}
        </ul>
      )}
    </div>
  );
}
