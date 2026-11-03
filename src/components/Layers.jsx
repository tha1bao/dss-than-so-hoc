// Tầng giải thích L1–L7 (mỗi số truy vết được tới công thức F-* và nguồn tệp › sheet › dòng).
import { useEffect, useMemo, useState } from 'react';
import { GROUPS, skillCode, targetAnalysis, alphaSweep, computeExtras, LABELS } from '../../shared/engine/index.js';
import { explainProfile } from '../../shared/engine/view.js';
import { getLayer } from '../api.js';
import { fmt, envName, groupName, skillName, profileMajors, GROUP_SCHOOL, PERSONA_NAME } from '../format.js';
import { LabelChip, ContribBar, ContribLegend, Axis01, Warnings } from './common.jsx';
import { LabelDistribution } from './Dashboard.jsx';
import { t, tr, num, localizeKb } from '../i18n.js';

const WEEKDAY_VI = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const WEEKDAY_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekday = (i) => tr(WEEKDAY_VI[i], WEEKDAY_EN[i]);
const SIG_KEYS = [...GROUPS, 'SU'];

function useLayer(name) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { let on = true; getLayer(name).then((x) => on && setD(x)).catch((e) => on && setErr(e.message)); return () => { on = false; }; }, [name]);
  return [d, err];
}
const Loading = ({ err }) => <p className="empty">{err ? `${tr('Không tải được', 'Could not load')}: ${err}` : t('Đang tải…')}</p>;
const Src = ({ children }) => (children ? <span className="src">{tr('nguồn', 'source')}: {children}</span> : null);

export function ProfilePicker({ out, sel, setSel }) {
  const r = out.result;
  const special = [...r.top.map((x) => x.profile), r.bestPriority?.profile, out.target?.analysis?.profile].filter(Boolean);
  return (
    <label className="filters" style={{ marginBottom: 6 }}>
      <span className="small" style={{ fontWeight: 600 }}>{t('Hồ sơ đang xem:')}</span>
      <select value={sel} onChange={(e) => setSel(e.target.value)}>
        {r.rows.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.idx - b.idx).map((x) => (
          <option key={x.profile} value={x.profile}>
            {x.rank ? `#${x.rank}` : '—'} {x.profile} · {t(x.label)}{special.includes(x.profile) ? (x.profile === out.target?.analysis?.profile ? tr(' · ngành mục tiêu', ' · target major') : ' ★') : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------- L1 Vì sao? ----------------
export function L1({ out, kb, sel, setSel }) {
  const r = out.result;
  const row = r.rows.find((x) => x.profile === sel) ?? r.top[0];
  if (!row) return <p className="empty">{t('Không có hồ sơ.')}</p>;
  const sentences = explainProfile(out, kb, row.profile);
  const isTarget = out.target?.analysis?.profile === row.profile;
  const comp = [['NF', 'Tương hợp thần số học', 0], ['SR', 'Sẵn sàng kỹ năng', 1], ['ENV', 'Môi trường', 2]];
  return (
    <div className="grid2">
      <section className="panel">
        <ProfilePicker out={out} sel={row.profile} setSel={setSel} />
        <div className="rank-title" style={{ marginBottom: 6 }}><h2>{row.profile}</h2><LabelChip label={row.label} />
          <span className="small muted">{tr('hạng', 'rank')} {row.rank ?? '–'} / {r.ranked.length}</span></div>
        <p className="small muted" style={{ marginBottom: 8 }}>{profileMajors(kb, row.profile, 6).join(' · ')}</p>
        <ul className="insights">{sentences.map((s) => <li key={s.code}>{num(s.text)} <span className="src">[{s.code}]</span></li>)}</ul>
        {isTarget && out.target.explanation?.map((e) => <p key={e.code} className="best-note">{num(e.text)}</p>)}
      </section>
      <section className="panel">
        <h2 style={{ marginBottom: 8 }}>{t('Phân rã C = α·NF* + β·SR* + γ·ENV*')}</h2>
        <ContribLegend />
        <div className="rank-row" style={{ marginTop: 8 }}><span /><ContribBar row={row} weights={r.weights} normalize={r.normalize} /><span className="c-col num" style={{ fontWeight: 800 }}>{row.EC >= 1 ? fmt(row.C) : '—'}</span></div>
        <Axis01 />
        <div className="tbl-wrap" style={{ marginTop: 8 }}>
          <table className="tbl">
            <thead><tr><th>{t('Thành phần')}</th><th className="r">{t('Thô')}</th><th className="r">min</th><th className="r">max</th><th className="r">{t('Chuẩn hóa')}</th><th className="r">{t('Trọng số')}</th><th className="r">{t('Đóng góp')}</th></tr></thead>
            <tbody>
              {comp.map(([k, name, i]) => (
                <tr key={k}>
                  <td>{t(name)} ({k})</td><td className="r">{fmt(row[k])}</td>
                  <td className="r">{fmt(r.minmax[k][0])}</td><td className="r">{fmt(r.minmax[k][1])}</td>
                  <td className="r">{r.normalize ? fmt(row[`${k}_n`]) : '—'}</td><td className="r">{fmt(r.weights[i])}</td>
                  <td className="r"><b>{fmt(row.contrib?.[k])}</b></td>
                </tr>
              ))}
              <tr><td colSpan={6}><b>{t('C – mức tương hợp tương đối')}</b></td><td className="r"><b>{fmt(row.C)}</b></td></tr>
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>{tr(`min/max lấy trên ${r.nEligible} hồ sơ có EC ≥ 1 của chính học sinh (F-MM). C chỉ dùng để so sánh các hồ sơ của cùng một học sinh – không phải xác suất hay phần trăm.`, `min/max taken over the student's own ${r.nEligible} profiles with EC ≥ 1 (F-MM). C only compares profiles of the same student – it is not a probability or a percentage.`)}</p>
      </section>
    </div>
  );
}

// ---------------- L2 tín hiệu ----------------
function derivation(g, sig) {
  const R = sig.redacted;
  switch (g) {
    case 'G1': return R ? `${tr('Tổng 8 chữ số ngày sinh', 'Sum of the 8 birth-date digits')} = ${sig.rulingRaw} → PY00 → ${sig.G1}` : `${sig.digits.join(' + ')} = ${sig.rulingRaw} → PY00 → ${sig.G1}`;
    case 'G2': return R ? `(${tr('ngày sinh', 'birth day')} − 1) mod 9 + 1 = ${sig.G2}` : `${tr('ngày', 'day')} ${sig.input.day}: (${sig.input.day} − 1) mod 9 + 1 = ${sig.G2}`;
    case 'G4': return R ? `${tr('thứ trong tuần → khóa', 'weekday → key')} ${sig.G4}` : `${weekday(sig.input.isoWeekday)} → ${tr('khóa', 'key')} ${sig.G4} (${tr('bảng T2 2 · T3 9 · T4 5 · T5 3 · T6 6 · T7 8 · CN 1', 'table Mon 2 · Tue 9 · Wed 5 · Thu 3 · Fri 6 · Sat 8 · Sun 1')})`;
    case 'G5': return `${tr('Σ Pythagoras của tên', 'Σ Pythagorean of the name')} = ${sig.nameTotal} → PY00 → ${sig.G5}`;
    case 'G6': return `Σ Hebraic ${sig.hebTotal} − ${tr('chữ ghép', 'digraphs')} (TH ${sig.digraph.TH}, PH ${sig.digraph.PH}, TZ ${sig.digraph.TZ ?? 0}) = ${sig.hebAdj} → (x − 1) mod 9 + 1 = ${sig.G6}`;
    case 'SU': return `${tr('Σ nguyên âm', 'Σ vowels')} ${sig.vowelTotal} → ${tr('rút gọn', 'reduce')} ≤ 11 → ${sig.soulUrge}${sig.yCount ? ` (${tr('nếu Y là nguyên âm', 'if Y is a vowel')}: ${sig.soulUrgeY})` : ''}`;
    default: return '';
  }
}
export function L2({ out, kb, sel, setSel }) {
  const { sig, result } = out;
  const row = result.rows.find((x) => x.profile === sel) ?? result.top[0];
  const extras = useMemo(() => (sig.redacted ? null : computeExtras(sig, kb)), [sig, kb]);
  const value = { G1: sig.G1, G2: sig.G2, G4: sig.G4, G5: sig.G5, G6: sig.G6, SU: sig.soulUrge };
  const groupMeta = (g) => kb.groups.find((x) => x.code === g);
  return (
    <>
      <section className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-head"><h2>{t('Tín hiệu thần số học (5 nhóm vào NF + SU)')}</h2>{row && <ProfilePicker out={out} sel={row.profile} setSel={setSel} />}</div>
        <div className="sig-cards">
          {SIG_KEYS.map((g) => {
            const on = g === 'SU' ? null : result.groups.includes(g);
            const hit = row && g !== 'SU' && row.khop[g] > 0;
            const m = groupMeta(g);
            return (
              <div key={g} className={`sig ${hit ? 'on' : ''}`}>
                <span className="small muted">{g} · {GROUP_SCHOOL[g] ?? 'Pythagoras'} · {m?.rule_code}</span>
                <b>{groupName(kb, g)}</b>
                <span className="big num">{value[g]}{sig.arch[g] !== value[g] ? <span className="small"> → archetype {sig.arch[g]}</span> : null}</span>
                <span className="small">{derivation(g, sig)}</span>
                <span className="small muted">
                  {g === 'SU' ? tr('không vào NF – chỉ dùng cho SAT', 'not in NF – used for SAT only') : on ? (hit ? `${tr('khớp vị trí', 'matches position')} ${row.A.indexOf(sig.arch[g]) + 1} ${tr('của', 'of')} ${row.profile} (p = ${fmt(row.khop[g], 1)}) · w = ${fmt(kb.params.w[g], 2)}` : `${tr('không có trong', 'not in')} ${row?.profile ?? tr('hồ sơ', 'profile')} · w = ${fmt(kb.params.w[g], 2)}`) : tr('đang TẮT trong What-if', 'turned OFF in What-if')}
                </span>
                <Src>{m?.formula_code}</Src>
              </div>
            );
          })}
        </div>
        <Warnings warnings={out.warnings.filter((w) => ['V_DOB', 'V_CHAR', 'V_NAME_LEN', 'V_TZ'].includes(w.code))} />
      </section>
      {sig.redacted ? (
        <p className="panel small muted">{t('Họ tên và ngày sinh được che với vai trò Quản trị (Ch6 – bảo vệ dữ liệu cá nhân). Chỉ hiển thị tổng và kết quả.')}</p>
      ) : (
        <div className="grid2">
          <section className="panel">
            <h2 style={{ marginBottom: 6 }}>{t('Tên đã chuẩn hóa → giá trị từng chữ')}</h2>
            <p className="small muted" style={{ marginBottom: 8 }}>{t('Bỏ dấu, Đ → D, viết hoa, bỏ ký tự ngoài A–Z (GEN). Nền đậm = nguyên âm, viền xanh = chữ ghép TH/PH/TZ; số trên Pythagoras, số dưới Hebraic.')}</p>
            {sig.name.words.map((w, wi) => {
              const marks = new Set();
              for (const pair of Object.keys(kb.digraphs)) { let i = w.indexOf(pair); while (i >= 0) { marks.add(i); marks.add(i + 1); i = w.indexOf(pair, i + 1); } }
              return (
                <div key={wi} className="letters" style={{ marginBottom: 6 }}>
                  {[...w].map((c, i) => (
                    <span key={i} className={`letter ${kb.letters[c][2] ? 'vowel' : ''} ${marks.has(i) ? 'digraph' : ''}`}>
                      <b>{c}</b><span className="num">{kb.letters[c][0]}</span><br /><span className="num muted">{kb.letters[c][1]}</span>
                    </span>
                  ))}
                </div>
              );
            })}
            <table className="tbl" style={{ marginTop: 6 }}><tbody>
              <tr><td>{t('Σ Pythagoras (G5)')}</td><td className="r">{sig.nameTotal}</td></tr>
              <tr><td>{t('Σ nguyên âm (SU)')}</td><td className="r">{sig.vowelTotal}</td></tr>
              <tr><td>{t('Σ Hebraic → sau điều chỉnh chữ ghép (G6, KB04)')}</td><td className="r">{sig.hebTotal} → {sig.hebAdj}</td></tr>
            </tbody></table>
          </section>
          {extras && (
            <section className="panel">
              <h2 style={{ marginBottom: 6 }}>{t('Chỉ số bổ sung (chỉ hiển thị – không vào C)')}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: 3, margin: '6px 0' }} aria-label={t('Biểu đồ ngày sinh 3×3')}>
                {[3, 6, 9, 2, 5, 8, 1, 4, 7].map((k) => (
                  <div key={k} className="letter" style={{ height: 40 }}><b>{extras.birthChart[k] ? String(k).repeat(extras.birthChart[k]) : '·'}</b></div>
                ))}
              </div>
              <table className="tbl"><tbody>
                <tr><td>{t('Số thiếu (PY03)')}</td><td>{extras.missing.join(', ') || tr('không', 'none')}</td></tr>
                <tr><td>{t('Mũi tên (PY04)')}</td><td>{extras.arrows.join('; ') || tr('không', 'none')}</td></tr>
                <tr><td>Outer expression (PY06)</td><td className="r">{extras.outer}</td></tr>
                <tr><td>Vedic: psychic / destiny / name</td><td className="r">{extras.vedic.psychicType} · {extras.vedic.destiny} · {extras.vedic.name}</td></tr>
                <tr><td>{t('Kabala: khóa ngày sinh · hành tinh')}</td><td className="r">{extras.kabala.birthKey} · {extras.kabala.birthPlanet}</td></tr>
              </tbody></table>
            </section>
          )}
        </div>
      )}
    </>
  );
}

// ---------------- L3 ánh xạ ----------------
export function L3({ out, kb, person, sel, setSel }) {
  const { sig, result } = out;
  const row = result.rows.find((x) => x.profile === sel) ?? result.top[0];
  const sigArch = new Set(result.groups.map((g) => sig.arch[g]));
  const archs = [...new Set([...sigArch, ...(row?.A ?? [])])].sort((a, b) => a - b);
  const profiles = result.rows.filter((r) => r.EC >= 1).sort((a, b) => a.rank - b.rank);
  const majors = row ? kb.majors.filter((m) => m.profile_id === row.profile) : [];
  return (
    <>
      <section className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-head"><h2>{t('Tín hiệu → archetype → hồ sơ → ngành')}</h2>
          <span className="small muted">{t('Bấm một hồ sơ để đổi. Số 10 → archetype 1 (F-ARCH); 11, 22 giữ nguyên.')}</span></div>
        <div className="flow">
          <div className="flow-col"><h3>{t('1 · Nhóm tín hiệu')}</h3>
            {result.groups.map((g) => <div key={g} className={`node ${row?.khop[g] > 0 ? 'on' : 'dim'}`}>{g} = {sig.arch[g]} <span className="muted">· {groupName(kb, g)}</span></div>)}
          </div>
          <div className="flow-col"><h3>{t('2 · Archetype ↔ kỹ năng (mức hiện tại)')}</h3>
            {archs.map((a) => (
              <div key={a} className={`node ${row?.A.includes(a) ? 'on' : sigArch.has(a) ? '' : 'dim'}`} title={skillName(kb, a)}>
                {a} · {skillCode(a)} = <b>{person.skillsNow[a]}</b>{sigArch.has(a) ? '' : <span className="muted"> {t('(không có tín hiệu)')}</span>}
              </div>
            ))}
          </div>
          <div className="flow-col"><h3>3 · {tr('Hồ sơ có EC ≥ 1', 'Profiles with EC ≥ 1')} ({profiles.length}/35)</h3>
            <div style={{ display: 'grid', gap: 3, maxHeight: 360, overflowY: 'auto' }}>
              {profiles.map((p) => (
                <button key={p.profile} type="button" className={`node ${p.profile === row?.profile ? 'on' : ''}`} onClick={() => setSel(p.profile)}>
                  #{p.rank} {p.profile} [{p.A.join('·')}] EC {p.EC} · {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flow-col"><h3>4 · {tr('Ngành thuộc', 'Majors in')} {row?.profile} ({majors.length})</h3>
            <div style={{ display: 'grid', gap: 3, maxHeight: 360, overflowY: 'auto' }}>
              {majors.map((m) => <div key={m.id} className="node">{m.name_vi} <span className="muted">· {envName(kb, m.env_code)}</span></div>)}
            </div>
          </div>
        </div>
      </section>
      {row && (
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{tr('Bảng khớp của', 'Match table for')} {row.profile} (F-KHOP, F-EC)</h2>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>{t('Vị trí')}</th><th>Archetype</th><th className="r">p</th><th>{t('Nhóm tín hiệu trùng')}</th><th>{t('Kỹ năng')}</th><th className="r">{t('Mức')}</th></tr></thead>
            <tbody>{row.A.map((a, i) => (
              <tr key={i} className={row.KN[i] <= kb.params.Weak_max ? 'hl' : ''}>
                <td>{i + 1}</td><td>{a}</td><td className="r">{fmt(result.p[i], 1)}</td>
                <td>{result.groups.filter((g) => sig.arch[g] === a).join(', ') || '—'}</td>
                <td>{skillCode(a)} · {skillName(kb, a)}</td><td className="r">{row.KN[i]}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <p className="small muted" style={{ marginTop: 6 }}>{tr('Môi trường hồ sơ', 'Profile environment')}: {envName(kb, row.env)} · {tr('của học sinh', 'student')}: {envName(kb, result.env)} → ENV = {row.ENV}. {tr('Dòng tô vàng = kỹ năng ≤ 2.', 'Highlighted rows = skills ≤ 2.')}</p>
        </section>
      )}
    </>
  );
}

// ---------------- L4 công thức có số thật ----------------
function Formula({ code, f, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <h3>{code} · {f?.name_vi}</h3>
      {f?.expr && <p className="small muted">{f.expr}</p>}
      <div className="formula">{children}</div>
      <Src>{f?.src_ref}</Src>
    </div>
  );
}
export function L4({ out, kb, sel, setSel }) {
  const [l6, err] = useLayer('l6');
  const { result, sig } = out;
  const row = result.rows.find((x) => x.profile === sel) ?? result.top[0];
  if (!row) return <p className="empty">{t('Không có hồ sơ.')}</p>;
  const F = Object.fromEntries((l6?.formulas ?? []).map((f) => [f.code, f]));
  const { w } = kb.params; const p = result.p; const sp = result.sumP;
  const sw = result.groups.reduce((s, g) => s + w[g], 0);
  const nfNum = GROUPS.map((g) => `${fmt(w[g], 2)}×${fmt(row.khop[g], 1)}`).join(' + ');
  const ta = targetAnalysis(result, row.profile, { ...kb.params, p });
  const mm = (k) => { const [a, b] = result.minmax[k]; return `${k}* = (${fmt(row[k])} − ${fmt(a)}) / (${fmt(b)} − ${fmt(a)}) = ${row[`${k}_n`] == null ? '—' : fmt(row[`${k}_n`])}${Math.abs(b - a) <= 1e-9 ? '  (max = min → 0)' : ''}`; };
  const srMin = kb.params.SR_min;
  return (
    <section className="panel">
      <div className="panel-head"><h2>{tr('Công thức với số thật', 'Formulas with real numbers')} – {row.profile}</h2><ProfilePicker out={out} sel={row.profile} setSel={setSel} /></div>
      {!l6 && <Loading err={err} />}
      <div className="grid2">
        <div>
          <Formula code="F-KHOP" f={F['F-KHOP']}>{GROUPS.map((g) => `${g}: ${tr('số', 'number')} ${sig.arch[g]} ${row.A.includes(sig.arch[g]) && result.groups.includes(g) ? `${tr('ở vị trí', 'at position')} ${row.A.indexOf(sig.arch[g]) + 1} ${tr('của', 'of')} [${row.A.join(', ')}] → ${tr('khớp', 'match')} = ${fmt(row.khop[g], 1)}` : `→ ${tr('khớp', 'match')} = 0${result.groups.includes(g) ? '' : tr(' (nhóm đang tắt)', ' (group off)')}`}`).join('\n')}</Formula>
          <Formula code="F-NF" f={F['F-NF']}>{`NF = Σ w·khớp ÷ (Σ w·cờ × Σp)\n   = (${nfNum}) ÷ (${fmt(sw, 2)} × ${fmt(sp, 1)})\n   = ${fmt(row.NF)}`}</Formula>
          <Formula code="F-EC" f={F['F-EC']}>{`EC = ${tr('số nhóm có khớp > 0', 'number of groups with match > 0')} = ${row.EC}  (${row.matched.join(', ') || tr('không nhóm nào', 'no group')})`}</Formula>
          <Formula code="F-SR" f={F['F-SR']}>{`SR = Σ p·(r − 1) ÷ (4 × Σp)\n   = (${row.KN.map((r, i) => `${fmt(p[i], 1)}×(${r}−1)`).join(' + ')}) ÷ (4 × ${fmt(sp, 1)})\n   = ${fmt(row.SR)}`}</Formula>
          <Formula code="F-ENV" f={F['F-ENV']}>{`ENV = [${tr('môi trường HS = môi trường hồ sơ', 'student environment = profile environment')}] = [${result.env} = ${row.env}] = ${row.ENV}`}</Formula>
        </div>
        <div>
          {result.normalize && row.EC >= 1 && <Formula code="F-MM" f={F['F-MM']}>{['NF', 'SR', 'ENV'].map(mm).join('\n')}</Formula>}
          <Formula code="F-C" f={F['F-C']}>{row.EC >= 1
            ? `C = α·${result.normalize ? 'NF*' : 'NF'} + β·${result.normalize ? 'SR*' : 'SR'} + γ·${result.normalize ? 'ENV*' : 'ENV'}\n  = ${fmt(result.weights[0])}×${fmt(result.normalize ? row.NF_n : row.NF)} + ${fmt(result.weights[1])}×${fmt(result.normalize ? row.SR_n : row.SR)} + ${fmt(result.weights[2])}×${fmt(result.normalize ? row.ENV_n : row.ENV)}\n  = ${fmt(row.C)}   → hạng ${row.rank}/${result.ranked.length}`
            : tr('EC = 0 → hồ sơ không được xếp hạng (F-RANK)', 'EC = 0 → profile is not ranked (F-RANK)')}</Formula>
          <Formula code="F-LABEL" f={F['F-LABEL']}>{[
            `1) EC = 0 ? ${row.EC === 0 ? tr('ĐÚNG → Không đề xuất', 'TRUE → Not recommended') : tr('sai', 'false')}`,
            row.EC > 0 && `2) ${tr('có kỹ năng ≤ 2', 'any skill ≤ 2')} ? ${row.weak ? `${tr('ĐÚNG', 'TRUE')} (${row.weakList.map((x) => `${x.skill}=${x.level}`).join(', ')}) → ${t('Thử thách')}` : tr('sai', 'false')}`,
            row.EC > 0 && !row.weak && `3) EC ≥ 2 ${tr('và', 'and')} SR ≥ ${fmt(srMin)} ? ${row.label === LABELS.PRIORITY ? tr('ĐÚNG → Ưu tiên', 'TRUE → Priority') : `${tr('sai', 'false')} (EC ${row.EC}, SR ${fmt(row.SR)})`}`,
            row.label === LABELS.CONSIDER && tr('4) còn lại → Cân nhắc', '4) otherwise → Consider'),
          ].filter(Boolean).join('\n')}</Formula>
          {ta && <Formula code="F-STEP5" f={F['F-STEP5a']}>{`${tr('Bậc cần tăng để hết kỹ năng yếu = Σ(3 − r) với r ≤ 2', 'Levels needed to clear weak skills = Σ(3 − r) for r ≤ 2')} = ${ta.stepsWeak}\n${tr('Điểm SR còn thiếu', 'Missing SR points')} = max(0; ${fmt(srMin)}×4×${fmt(sp, 1)} − Σp(r−1)) = ${fmt(ta.gap, 2)}\n${tr('Số bậc trên kỹ năng chính', 'Levels on the main skill')} = ⌈${fmt(ta.gap, 2)} ÷ ${fmt(p[0], 1)}⌉ = ${ta.stepsMain}\n${tr('Trạng thái', 'Status')}: ${ta.status === 'EC0' ? tr('EC = 0 – không đạt được bằng kỹ năng', 'EC = 0 – not reachable through skills') : ta.status === 'EC_LOW' ? tr('EC < 2 → tối đa Cân nhắc', 'EC < 2 → at most Consider') : tr('có thể đạt Ưu tiên', 'Priority is reachable')}`}</Formula>}
        </div>
      </div>
      {sig.redacted && <p className="small muted">{t('Dãy chữ số ngày sinh được che với vai trò Quản trị.')}</p>}
    </section>
  );
}

// ---------------- L5 tính toán chi tiết ----------------
export function L5({ out, kb, sel, setSel, compare }) {
  const { result, stability } = out;
  const [order, setOrder] = useState('rank');
  const rows = order === 'rank' ? result.rows.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.idx - b.idx) : result.rows;
  const sweep = useMemo(() => alphaSweep(result), [result]);
  const n = result.normalize;
  return (
    <>
      <section className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-head">
          <h2>{t('35 hồ sơ – toàn bộ phép tính')}</h2>
          <div className="seg" role="group" aria-label={t('Sắp xếp')}>
            <button type="button" aria-pressed={order === 'rank'} onClick={() => setOrder('rank')}>{t('theo hạng')}</button>
            <button type="button" aria-pressed={order === 'id'} onClick={() => setOrder('id')}>{t('theo mã hồ sơ')}</button>
          </div>
        </div>
        <p className="small muted" style={{ marginBottom: 6 }}>α/β/γ = {result.weights.map((x) => fmt(x)).join(' / ')} · p = {result.p.map((x) => fmt(x, 1)).join(' / ')} · {tr('nhóm bật', 'groups on')}: {result.groups.join(', ')} ·
          min–max (EC ≥ 1): NF [{result.minmax.NF.map((x) => fmt(x)).join('; ')}], SR [{result.minmax.SR.map((x) => fmt(x)).join('; ')}], ENV [{result.minmax.ENV.join('; ')}]</p>
        <div className="tbl-wrap" style={{ maxHeight: 520 }}>
          <table className="tbl">
            <thead><tr>
              <th className="r">{t('Hạng')}</th><th>{t('Hồ sơ')}</th><th>A1·A2·A3</th>{GROUPS.map((g) => <th key={g} className="r">{g}</th>)}
              <th className="r">NF</th><th className="r">EC</th><th>KN</th><th className="r">SR</th><th className="r">ENV</th>
              {n && <><th className="r">NF*</th><th className="r">SR*</th><th className="r">ENV*</th></>}
              <th className="r">C</th><th>{t('Nhãn')}</th><th className="r">SAT</th><th className="r">STR</th>
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.profile} className={r.profile === sel ? 'hl' : r.EC === 0 ? 'dim' : ''} onClick={() => setSel(r.profile)} style={{ cursor: 'pointer' }}>
                <td className="r">{r.rank ?? '—'}</td><td>{r.profile}</td><td>{r.A.join('·')}</td>
                {GROUPS.map((g) => <td key={g} className="r">{r.khop[g] ? fmt(r.khop[g], 1) : '·'}</td>)}
                <td className="r">{fmt(r.NF)}</td><td className="r">{r.EC}</td><td>{r.KN.join('·')}</td><td className="r">{fmt(r.SR)}</td><td className="r">{r.ENV}</td>
                {n && <><td className="r">{fmt(r.NF_n)}</td><td className="r">{fmt(r.SR_n)}</td><td className="r">{fmt(r.ENV_n)}</td></>}
                <td className="r"><b>{fmt(r.C)}</b></td><td><LabelChip label={r.label} /></td><td className="r">{r.SAT}</td><td className="r">{r.STR}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      {compare && (
        <section className="panel" style={{ marginBottom: 12 }}>
          <h2 style={{ marginBottom: 6 }}>{tr('So sánh 3 persona (cùng bộ trọng số', 'Compare 3 personas (same weight set')} {out.options.wset ?? 'A'}, {tr('cùng What-if)', 'same What-if)')}</h2>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Persona</th><th className="r">α / β / γ</th><th>Top-1</th><th>Top-2</th><th>Top-3</th><th>{t('Ưu tiên tốt nhất')}</th></tr></thead>
            <tbody>{compare.map(({ persona, out: o }) => (
              <tr key={persona} className={o.result.top[0]?.profile !== compare[0].out.result.top[0]?.profile ? 'hl' : ''}>
                <td>{PERSONA_NAME[persona]}</td><td className="r">{o.result.weights.map((x) => fmt(x)).join(' / ')}</td>
                {[0, 1, 2].map((i) => { const r = o.result.top[i]; return <td key={i}>{r ? <>{r.profile} · {fmt(r.C)} <LabelChip label={r.label} /></> : '—'}</td>; })}
                <td>{o.result.bestPriority ? `${o.result.bestPriority.profile} (${tr('hạng', 'rank')} ${o.result.bestPriority.rank})` : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <p className="small muted" style={{ marginTop: 6 }}>{t('Persona chỉ đổi α/β/γ (Phụ lục B3.1) – tín hiệu và kỹ năng giữ nguyên. Dòng tô vàng = Top-1 khác góc nhìn Học sinh.')}</p>
        </section>
      )}
      <div className="grid2">
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{t('Phân bố nhãn – 35 hồ sơ')}</h2>
          <LabelDistribution rows={result.rows} />
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{t('Độ ổn định Top-1')} – {stability.count}/{stability.of} {tr('cấu hình', 'configurations')}</h2>
          <table className="tbl"><thead><tr><th>{t('Cấu hình')}</th><th>Top-1</th><th>Top-3</th><th className="r">{t('Trùng Top-3 gốc')}</th></tr></thead>
            <tbody>{stability.runs.map((r) => (
              <tr key={r.code} className={r.top1 !== stability.runs[0].top1 ? 'hl' : ''}><td>{r.name}</td><td>{r.top1 ?? '—'}</td><td>{r.top3.join(', ')}</td><td className="r">{r.top3Overlap}/3</td></tr>
            ))}</tbody></table>
          <p className="small muted" style={{ marginTop: 6 }}>{tr(`Cùng bộ trọng số ${out.options.wset ?? 'A'}, ${result.normalize ? 'có' : 'không'} chuẩn hóa (sheet Sensitivity v6). Dòng tô vàng = Top-1 đổi.`, `Same weight set ${out.options.wset ?? 'A'}, ${result.normalize ? 'with' : 'without'} normalization (Sensitivity sheet v6). Highlighted row = Top-1 changes.`)}</p>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{tr('Quét α (β, γ giữ tỉ lệ persona', 'α sweep (β, γ keep the ratio of persona')} {PERSONA_NAME[result.persona]})</h2>
          <table className="tbl"><thead><tr><th className="r">α</th><th>Top-1</th><th className="r">{t('Điểm')}</th></tr></thead>
            <tbody>{sweep.map((s) => <tr key={s.alpha} className={s.top1 !== result.top[0]?.profile ? 'hl' : ''}><td className="r">{fmt(s.alpha, 1)}</td><td>{s.top1}</td><td className="r">{fmt(s.value)}</td></tr>)}</tbody></table>
          <p className="small muted" style={{ marginTop: 6 }}>{t('Nguồn: Student_Report AC:AH (v6). Dòng tô vàng = khác Top-1 hiện tại.')}</p>
        </section>
      </div>
    </>
  );
}

// ---------------- L6 tri thức nguồn ----------------
export function L6({ out, kb }) {
  const [d, err] = useLayer('l6');
  const [qry, setQry] = useState('');
  if (!d) return <Loading err={err} />;
  const { sig } = out;
  const wanted = [['PY', sig.G1, tr('G1 – số chủ đạo', 'G1 – ruling number')], ['PY', sig.G5, tr('G5 – tên đầy đủ', 'G5 – complete name')], ['VE', sig.G2, 'G2 – Vedic psychic'], ['KB', sig.G4, tr('G4 – khóa thứ', 'G4 – weekday key')], ['KB', sig.G6, tr('G6 – khóa tên Hebraic', 'G6 – Hebraic name key')]];
  const cite = (type, key) => d.citations.filter((c) => c.target_type === type && String(c.target_key) === String(key));
  const ruleCodes = ['PY00', ...kb.groups.map((g) => g.rule_code)];
  const gl = d.glossary.filter((g) => !qry || `${g.term} ${g.full_name} ${g.plain_vi}`.toLowerCase().includes(qry.toLowerCase()));
  return (
    <>
      <section className="panel" style={{ marginBottom: 12 }}>
        <h2 style={{ marginBottom: 6 }}>{t('Ý nghĩa các con số của học sinh (trích nguyên văn nguồn)')}</h2>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>{t('Tín hiệu')}</th><th>{t('Trường phái · số')}</th><th>{t('Ý nghĩa')}</th><th>{t('Nghề phù hợp (theo sách)')}</th><th>{t('Nguồn')}</th></tr></thead>
          <tbody>{wanted.map(([sc, num, label]) => {
            const m = d.meanings.find((x) => x.school_code === sc && x.number === num);
            return (
              <tr key={label}><td>{label}</td><td>{sc} · {num}</td><td>{m?.meaning ?? <span className="muted">{t('chưa có trong bảng ý nghĩa')}</span>}</td><td>{m?.vocations ?? '—'}</td>
                <td className="src">{m?.source_note}<br />{m?.src_ref}{m && cite('number_meaning', m.id).length ? ` · ${cite('number_meaning', m.id).length} ${tr('trích dẫn', 'citations')}` : ''}</td></tr>
            );
          })}</tbody>
        </table></div>
        <p className="small muted" style={{ marginTop: 6 }}>{t('Nguồn tiếng Anh giữ nguyên văn để không làm sai lệch. Thần số học không có giá trị dự báo khoa học (E10).')}</p>
      </section>
      <div className="grid2">
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{t('Quy tắc tính đã dùng')}</h2>
          <table className="tbl"><thead><tr><th>{t('Mã')}</th><th>{t('Quy tắc')}</th><th>{t('Trích dẫn')}</th></tr></thead>
            <tbody>{d.rules.filter((r) => ruleCodes.includes(r.code)).map((r) => (
              <tr key={r.code}><td>{r.code}</td><td>{r.indicator}<br /><span className="small muted">{r.pseudocode}</span><br /><Src>{r.src_ref}</Src></td>
                <td className="small">{cite('calc_rule', r.code).map((c) => <div key={c.source_code}>{c.author ?? c.source_code} – <i>{c.title}</i></div>)}</td></tr>
            ))}</tbody></table>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{t('Trọng số persona & bằng chứng')}</h2>
          <table className="tbl"><thead><tr><th>{t('Bộ')}</th><th>Persona</th><th className="r">α</th><th className="r">β</th><th className="r">γ</th><th>{t('Căn cứ')}</th></tr></thead>
            <tbody>{kb.weightMeta.map((w) => (
              <tr key={w.set_code + w.persona} className={w.set_code === kb.paramSet.code ? '' : 'dim'}><td>{w.set_code}</td><td>{w.persona}</td>
                <td className="r">{fmt(w.alpha)}</td><td className="r">{fmt(w.beta)}</td><td className="r">{fmt(w.gamma)}</td><td className="small">{w.criteria_rank ? `${w.criteria_rank} · ` : ''}{w.evidence}</td></tr>
            ))}</tbody></table>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{t('Công thức (F-*)')}</h2>
          <table className="tbl"><thead><tr><th>{t('Mã')}</th><th>{t('Tầng')}</th><th>{t('Công thức')}</th></tr></thead>
            <tbody>{d.formulas.map((f) => <tr key={f.code}><td>{f.code}</td><td>{f.layer}</td><td>{f.name_vi}: <span className="small">{f.expr}</span><br /><Src>{f.src_ref}</Src></td></tr>)}</tbody></table>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>{tr('Thuật ngữ', 'Glossary')} ({d.glossary.length})</h2>
            <input type="search" placeholder={t('Tìm thuật ngữ…')} value={qry} onChange={(e) => setQry(e.target.value)} aria-label={t('Tìm thuật ngữ')} /></div>
          <div className="tbl-wrap" style={{ maxHeight: 360 }}><table className="tbl"><tbody>
            {gl.map((g) => <tr key={g.group_code + g.term}><td><b>{g.term}</b><br /><span className="small muted">{g.group_code}</span></td><td>{g.full_name}<br /><span className="small">{g.plain_vi}</span></td></tr>)}
          </tbody></table></div>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{tr('Nguồn tài liệu & bằng chứng', 'Sources & evidence')} ({d.sources.length})</h2>
          <div className="tbl-wrap" style={{ maxHeight: 360 }}><table className="tbl"><tbody>
            {d.sources.map((s) => <tr key={s.code}><td>{s.code}</td><td>{s.author ? `${s.author} – ` : ''}<i>{s.title}</i>{s.used_for || s.locator ? <><br /><span className="small muted">{[s.used_for, s.locator].filter(Boolean).join(" · ")}</span></> : null}</td></tr>)}
          </tbody></table></div>
        </section>
      </div>
    </>
  );
}

// ---------------- L7 dữ liệu & lineage ----------------
const DocItem = ({ c }) => (typeof c === 'object' && c !== null
  ? <dl style={{ margin: 0, display: 'grid', gap: 2 }}>{Object.entries(c).map(([k, v]) => <div key={k}><dt className="small muted" style={{ display: 'inline' }}>{k}: </dt><dd style={{ display: 'inline', margin: 0 }} className="small">{String(v ?? '')}</dd></div>)}</dl>
  : <span className="small">{String(c)}</span>);

export function L7({ out, kb, meta }) {
  const [d, err] = useLayer('l7');
  const bench = out.target?.benchmark;
  const adm = out.kpis.find((k) => k.code === 'K_ADMIT')?.detail;
  const groups = useMemo(() => {
    const g = {};
    for (const x of d?.docs ?? []) (g[x.doc_type] ??= []).push(x);
    return g;
  }, [d]);
  if (!d) return <Loading err={err} />;
  const DOC_NAME = { model_card: 'Model Card', data_gap: 'Khoảng trống dữ liệu (Data_Gap)', data_dictionary: 'Từ điển dữ liệu', major_data_dictionary: 'Từ điển dữ liệu ngành', sensitivity_summary: 'Tóm tắt Sensitivity', change_log: 'Nhật ký thay đổi', member_contribution: 'Đóng góp thành viên' };
  return (
    <>
      <div className="grid2" style={{ marginBottom: 12 }}>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{t('Lần tính này')}</h2>
          <table className="tbl"><tbody>
            <tr><td>{t('Mã lần tính')}</td><td className="num">{meta.runId ?? tr('không lưu (khách / chỉ xem)', 'not saved (guest / read-only)')}</td></tr>
            <tr><td>Engine</td><td>{out.engine} ({tr('khớp engine.py + Excel v6 – test hồi quy', 'matches engine.py + Excel v6 – regression tests')})</td></tr>
            <tr><td>{t('Bộ tham số')}</td><td>{kb.paramSet.code} v{kb.paramSet.version} · {kb.paramSet.method}</td></tr>
            <tr><td>{t('Phiên bản tri thức')}</td><td>{kb.kbRelease?.label} · <span className="num small">{kb.kbRelease?.content_hash?.slice(0, 16)}…</span></td></tr>
            <tr><td>{t('Tùy chọn')}</td><td className="small">{JSON.stringify(out.options)}</td></tr>
            <tr><td>{t('Dữ liệu đầu vào')}</td><td>{meta.simulated ? tr('Học sinh mô phỏng (không phải người thật)', 'Simulated student (not a real person)') : tr('Do người dùng tự nhập – không lưu', 'Entered by the user – not saved')}</td></tr>
          </tbody></table>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{t('Điểm chuẩn pilot (F-ADM)')}</h2>
          {bench ? (
            <table className="tbl"><tbody>
              <tr><td>{t('Ngành HaUI')}</td><td>{bench.haui_name} ({bench.haui_code}) · {tr('tổ hợp', 'subject combos')} {bench.combos_2026}</td></tr>
              <tr><td>{t('ĐC 2024 / 2025 / 2026')}</td><td className="num">{fmt(bench.cutoff_2024, 2)} / {fmt(bench.cutoff_2025, 2)} / {fmt(bench.cutoff_2026, 2)}</td></tr>
              <tr><td>{t('Δ = max |chênh năm|')}</td><td className="num">{fmt(bench.delta_used, 2)}</td></tr>
              {adm && <tr><td>{tr('Biên', 'Margin')} = {adm.combo} {fmt(adm.score, 2)} − {fmt(adm.cutoff, 2)}</td><td className="num"><b>{fmt(adm.margin, 2)} → {t(adm.level)}</b></td></tr>}
              <tr><td>{t('Nguồn')}</td><td className="src">{bench.src_2024} · {bench.src_2025} · {bench.src_2026} · {bench.src_ref}</td></tr>
            </tbody></table>
          ) : <p className="small muted">{t('Ngành mục tiêu không nằm trong 18 ngành pilot HaUI → không đánh giá khả năng đỗ (V_ADMIT).')}</p>}
        </section>
      </div>
      <section className="panel" style={{ marginBottom: 12 }}>
        <h2 style={{ marginBottom: 6 }}>{t('Dòng dõi dữ liệu (lineage)')}</h2>
        <table className="tbl"><thead><tr><th>{t('Bảng')}</th><th className="r">{t('Số dòng')}</th><th>{t('Ví dụ nguồn (tệp › sheet › dòng)')}</th></tr></thead>
          <tbody>{d.lineage.map((x) => <tr key={x.tbl}><td>{x.tbl}</td><td className="r">{x.n}</td><td className="src">{x.example_src}</td></tr>)}</tbody></table>
        <p className="small muted" style={{ marginTop: 6 }}>{t('Excel DSS_ASS2_ThanSoHoc_v6.xlsx → ETL (prepare.py + etl.js, kiểm chứng số dòng) → TiDB `dss_than_so_hoc` → API → engine dùng chung.')}</p>
      </section>
      {Object.entries(groups).map(([type, items]) => (
        <details key={type} className="panel" style={{ marginBottom: 8 }}>
          <summary><b>{t(DOC_NAME[type] ?? type)}</b> <span className="small muted">({items.length} {tr('mục', 'items')})</span></summary>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>{items.map((x) => <div key={x.seq} style={{ borderBottom: '1px solid var(--line-2)', paddingBottom: 4 }}><DocItem c={x.content} /><Src>{x.src_ref}</Src></div>)}</div>
        </details>
      ))}
    </>
  );
}
