// Tầng giải thích L1–L7 – viết cho học sinh THPT: lời thường trước, ký hiệu chỉ ở "Công thức" (L4).
// Bảng kỹ thuật (min/max, F-*, lineage…) vẫn giữ trong mục "Dành cho giáo viên" để truy vết tới nguồn.
import { useEffect, useMemo, useState } from 'react';
import { GROUPS, targetAnalysis, alphaSweep, computeExtras, LABELS } from '../../shared/engine/index.js';
import { explainProfile } from '../../shared/engine/view.js';
import { getLayer } from '../api.js';
import { fmt, envName, groupName, skillName, PERSONA_NAME, archTrait } from '../format.js';
import { LabelChip, Warnings, LabelDistribution } from './common.jsx';
import { Tex, tn, tt } from './Tex.jsx';
import { t, tr, num, getLang } from '../i18n.js';
import { getMeaningVi } from '../data/number_meanings_vi.js';
import { pct, repMajor, avgSkill, SKILL_NEED, labelPlain, nextStepPlain, STAB_NAME, stabWord, py00Chain, rootChain, chainText } from '../plain.js';

const WEEKDAY_VI = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const WEEKDAY_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekday = (i) => tr(WEEKDAY_VI[i], WEEKDAY_EN[i]);
const SIG_ORDER = ['G1', 'G2', 'G4', 'G5', 'G6'];
const SIG_NAME = {
  G1: ['Số chủ đạo', 'Ruling number', 'từ ngày sinh · Pythagoras', 'from birth date · Pythagoras'],
  G2: ['Số ngày sinh', 'Birth-day number', 'Vệ Đà', 'Vedic'],
  G4: ['Số thứ trong tuần', 'Weekday number', 'Kabala', 'Kabbalah'],
  G5: ['Số tên đầy đủ', 'Full-name number', 'từ họ tên · Pythagoras', 'from name · Pythagoras'],
  G6: ['Số tên Kabala', 'Kabbalah name number', 'từ họ tên · Kabala', 'from name · Kabbalah'],
};
const sigName = (g) => tr(SIG_NAME[g][0], SIG_NAME[g][1]);
const COMP = [['NF', 'nf', 'Con số của bạn', 'Your numbers'], ['SR', 'sr', 'Kỹ năng', 'Skills'], ['ENV', 'env', 'Môi trường', 'Environment']];

const ARROW_VI = {
  'Arrow of the Planner': 'Thế mạnh: Lập kế hoạch & Tổ chức',
  'Arrow of Will': 'Thế mạnh: Ý chí & Nghị lực',
  'Arrow of Frustration': 'Vùng rèn luyện: Tính kiên nhẫn & Vượt khó',
  'Arrow of Activity': 'Thế mạnh: Năng động & Nhiệt huyết',
  'Arrow of Passivity': 'Vùng rèn luyện: Tinh thần chủ động & Dấn thân',
  'Arrow of Practicality': 'Thế mạnh: Thực tế & Khéo léo',
  'Arrow of Disorder': 'Vùng rèn luyện: Kỷ luật & Ngăn nắp',
  'Arrow of Emotional Balance': 'Thế mạnh: Cân bằng cảm xúc',
  'Arrow of Hypersensitivity': 'Vùng rèn luyện: Cân bằng cảm xúc & Giảm âu lo',
  'Arrow of Intellect': 'Thế mạnh: Tư duy logic & Sáng dạ',
  'Arrow of Poor Memory': 'Vùng rèn luyện: Phương pháp ghi nhớ & Tập trung',
  'Arrow of Determination': 'Thế mạnh: Quyết tâm & Kiên định',
  'Arrow of Procrastination': 'Vùng rèn luyện: Quyết đoán & Tránh chần chừ',
  'Arrow of Spirituality': 'Thế mạnh: Trực giác & Nhạy cảm tinh thần',
  'Arrow of Scepticism': 'Vùng rèn luyện: Sự cởi mở & Lòng tin vào bản thân',
};

function formatArrow(arrStr) {
  const [code, ...rest] = arrStr.split(': ');
  const name = rest.join(': ');
  const vi = ARROW_VI[name];
  if (!vi) return arrStr;
  return tr(`${code}: ${vi} (${name})`, `${code}: ${name}`);
}

function useLayer(name) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { let on = true; getLayer(name).then((x) => on && setD(x)).catch((e) => on && setErr(e.message)); return () => { on = false; }; }, [name]);
  return [d, err];
}
const Loading = ({ err }) => <p className="empty">{err ? `${tr('Không tải được', 'Could not load')}: ${err}` : t('Đang tải…')}</p>;
const Src = ({ children }) => (children ? <span className="src">{tr('nguồn', 'source')}: {children}</span> : null);
const Teacher = ({ title, children }) => (
  <details className="panel teacher"><summary>{tr('Dành cho giáo viên', 'For teachers')}{title ? `: ${title}` : ''}</summary><div className="teacher-body">{children}</div></details>
);
const rowOf = (out, sel) => out.result.rows.find((x) => x.profile === sel) ?? out.result.top[0] ?? out.result.rows[0];
const layerHref = (l, p) => `#${location.hash.slice(1).replace(/\/l\d.*$/, `/${l}`)}?p=${p}`;

export function ProfilePicker({ out, kb, sel, setSel }) {
  const r = out.result;
  return (
    <label className="picker">
      <span className="small muted">{tr('Đang xem', 'Viewing')}</span>
      <select value={sel} onChange={(e) => setSel(e.target.value)}>
        {r.rows.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.idx - b.idx).map((x) => (
          <option key={x.profile} value={x.profile}>{x.rank ? `${x.rank}. ` : '— '}{repMajor(kb, x.profile, r.env).name} · {t(x.label)}{x.EC >= 1 ? ` · ${pct(x.C)}` : ''}</option>
        ))}
      </select>
    </label>
  );
}

function Head({ out, kb, row, setSel, children }) {
  const m = repMajor(kb, row.profile, out.result.env);
  return (
    <div className="lhead">
      <div>
        <h2>{m.name} <LabelChip label={row.label} /></h2>
        <span className="small muted">{m.more > 0 ? tr(`và ${m.more} ngành cùng nhóm`, `and ${m.more} more in this group`) : ''}{children}</span>
      </div>
      <ProfilePicker out={out} kb={kb} sel={row.profile} setSel={setSel} />
    </div>
  );
}

// ---------------- L1 Vì sao? ----------------
export function L1({ out, kb, sel, setSel }) {
  const r = out.result;
  const row = rowOf(out, sel);
  if (!row) return <p className="empty">{t('Không có hồ sơ.')}</p>;
  const nOn = r.groups.length;
  const step = nextStepPlain(row, r, kb);
  const ties = row.EC >= 1 ? r.ranked.filter((x) => x !== row && Math.abs(x.C - row.C) <= 1e-9) : [];
  const say = {
    NF: row.EC >= 1 ? tr(`${row.EC} trong ${nOn} con số của bạn trùng với nét tính cách của nhóm ngành này.`, `${row.EC} of your ${nOn} numbers match this group's personality traits.`)
      : tr('Không con số nào của bạn trùng với nhóm ngành này.', 'None of your numbers match this group.'),
    SR: tr(`Kỹ năng liên quan (${row.A.map((a) => skillName(kb, a)).join('; ')}) của bạn đạt trung bình ${fmt(avgSkill(row.SR), 1)}/5; mức cần là ${fmt(SKILL_NEED(kb), 1)}/5.`,
      `Your related skills (${row.A.map((a) => skillName(kb, a)).join('; ')}) average ${fmt(avgSkill(row.SR), 1)}/5; the bar is ${fmt(SKILL_NEED(kb), 1)}/5.`),
    ENV: row.ENV ? tr(`Môi trường "${envName(kb, r.env)}" đúng với lựa chọn của bạn.`, `"${envName(kb, r.env)}" matches the environment you chose.`)
      : tr(`Môi trường "${envName(kb, row.env)}" khác với môi trường bạn chọn ("${envName(kb, r.env)}").`, `"${envName(kb, row.env)}" differs from your choice ("${envName(kb, r.env)}").`),
  };

  return (
    <section className="panel">
      <Head out={out} kb={kb} row={row} setSel={setSel} />
      <div className="l1-pct">{tr('Mức phù hợp', 'Overall fit')}: <b>{row.EC >= 1 ? pct(row.C) : '—'}</b> {row.rank ? `(${tr('hạng', 'rank')} ${row.rank}/${r.ranked.length})` : `(${tr('không xếp hạng', 'not ranked')})`}</div>
      <div className="parts">
        {COMP.map(([k, cls, name]) => {
          const w = row.contrib?.[k] ?? 0;
          return (
            <div key={k} className="part">
              <span className="part-name">{t(name)}</span>
              <div className="part-bar"><span className={`bar-seg ${cls}`} style={{ width: `${Math.max(0, Math.min(1, w)) * 100}%` }} /></div>
              <span className="num muted small">{fmt(w, 2)}</span>
              <span className="part-say">{say[k]}</span>
            </div>
          );
        })}
      </div>
      <div className="l1-label">
        <p><b>{t('Đánh giá')}:</b> {labelPlain(row, kb)}</p>
        {step && <p><b>{tr('Bước tiếp theo để lên "Ưu tiên"', 'Next step to reach "Priority"')}:</b> {step}.</p>}
        {ties.length > 0 && <p className="small muted">{tr(`Hòa điểm với ${ties.length} nhóm ngành khác:`, `Tied with ${ties.length} other group(s):`)} {ties.map((x) => repMajor(kb, x.profile, r.env).name).join(', ')}. {tr('Nhóm có mã đứng trước được xếp trên.', 'The group with the earlier code is ranked higher.')}</p>}
      </div>
    </section>
  );
}

// ---------------- L2 Con số của bạn ----------------
function derivePlain(g, sig) {
  if (sig.redacted) return tr('Ngày sinh/họ tên được che với vai trò Quản trị.', 'Birth date/name hidden for the Admin role.');
  const name = sig.name.words.join(' ');
  switch (g) {
    case 'G1': return `${tr('Cộng các chữ số ngày sinh', 'Add the digits of the birth date')}: ${sig.digits.join(' + ')} = ${chainText(sig.rulingRaw, py00Chain(sig.rulingRaw))}`;
    case 'G2': return `${tr('Ngày', 'Day')} ${chainText(sig.input.day, rootChain(sig.input.day))}`;
    case 'G4': return tr(`Sinh vào ${weekday(sig.input.isoWeekday)} → số ${sig.G4} (theo bảng thứ của Kabala)`, `Born on a ${weekday(sig.input.isoWeekday)} → number ${sig.G4} (Kabbalah weekday table)`);
    case 'G5': return `${tr('Đổi mỗi chữ cái thành số (A = 1 … I = 9, J = 1 …) rồi cộng', 'Turn each letter into a number (A = 1 … I = 9, J = 1 …) and add')}: ${name} = ${chainText(sig.nameTotal, py00Chain(sig.nameTotal))}`;
    case 'G6': {
      const adj = sig.hebAdj !== sig.hebTotal;
      return `${tr('Quy đổi họ tên theo âm tiết Kabala: tương ứng năng lượng số', 'Name evaluated by Kabbalah syllables: energy number')} ${chainText(sig.hebAdj, rootChain(sig.hebAdj))}${adj ? tr(' (đã chuẩn hóa các chữ ghép TH, PH, TZ)', ' (normalized digraphs TH, PH, TZ)') : ''}`;
    }
    default: return '';
  }
}
export function L2({ out, kb, sel, setSel }) {
  const { sig } = out;
  const row = rowOf(out, sel);
  const extras = useMemo(() => (sig.redacted ? null : computeExtras(sig, kb)), [sig, kb]);
  return (
    <>
      <section className="panel">
        <Head out={out} kb={kb} row={row} setSel={setSel}> · {tr('ô viền xanh = con số trùng nhóm ngành đang xem', 'blue border = number matches the group you are viewing')}</Head>
        <div className="sig-cards">
          {SIG_ORDER.map((g) => {
            const hit = row && row.khop[g] > 0;
            const v = sig[g];
            return (
              <div key={g} className={`sig ${hit ? 'on' : ''}`}>
                <span className="small muted">{sigName(g)} · {tr(SIG_NAME[g][2], SIG_NAME[g][3])}</span>
                <span className="big num">{v}</span>
                <span className="small">{derivePlain(g, sig)}</span>
                {sig.arch[g] !== v && <span className="small muted">{tr(`Số ${v} được tính như số ${sig.arch[g]}.`, `${v} counts as ${sig.arch[g]}.`)}</span>}
                <span className={`small ${hit ? 'ok' : 'muted'}`}>{hit ? tr('✓ trùng nhóm ngành đang xem', '✓ matches the group you are viewing') : tr('không trùng', 'no match')}</span>
              </div>
            );
          })}
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>{tr('Số 11 và 22 được giữ nguyên, không rút gọn. Họ tên được bỏ dấu và viết hoa trước khi tính (Đ → D).', '11 and 22 are kept as they are. The name is written in capitals without accents before counting (Đ → D).')}</p>
        <Warnings warnings={out.warnings.filter((w) => ['V_DOB', 'V_CHAR', 'V_NAME_LEN', 'V_TZ'].includes(w.code))} />
      </section>
      {!sig.redacted && (
        <details className="panel teacher">
          <summary>{tr('Bảng chữ cái của tên', 'Letters of the name')}</summary>
          <div className="teacher-body">
            <p className="small muted">{tr('Số trên: Pythagoras · số dưới: Hebrew. Nền đậm = nguyên âm, viền xanh = chữ ghép.', 'Top: Pythagorean · bottom: Hebrew. Shaded = vowel, blue border = digraph.')}</p>
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
          </div>
        </details>
      )}
      {extras && (
        <details className="panel teacher" open>
          <summary>{tr('Chỉ số tham khảo & Phân tích tâm lý học đường (không dùng để chấm)', 'Reference indicators & Growth areas (not used in scoring)')}</summary>
          <div className="teacher-body grid2">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: 3 }} aria-label={t('Biểu đồ ngày sinh 3×3')}>
              {[3, 6, 9, 2, 5, 8, 1, 4, 7].map((k) => <div key={k} className="letter" style={{ height: 40 }}><b>{extras.birthChart[k] ? String(k).repeat(extras.birthChart[k]) : '·'}</b></div>)}
            </div>
            <table className="tbl"><tbody>
              <tr><td>{tr('Số linh hồn', 'Soul Urge')}</td><td className="r">{sig.soulUrge}</td></tr>
              <tr><td>{t('Số thiếu (PY03)')}</td><td>{extras.missing.join(', ') || tr('không', 'none')}</td></tr>
              <tr>
                <td>{t('Mũi tên tâm lý (PY04)')}</td>
                <td>
                  {extras.arrows.length > 0 ? (
                    <ul className="arrow-list">
                      {extras.arrows.map((a) => {
                        const isGrowth = a.includes('Frustration') || a.includes('Passivity') || a.includes('Disorder') || a.includes('Hypersensitivity') || a.includes('Poor Memory') || a.includes('Procrastination') || a.includes('Scepticism');
                        return (
                          <li key={a} className={isGrowth ? 'arrow-growth' : 'arrow-strength'}>
                            <span>{isGrowth ? '🌱 ' : '★ '}</span>{formatArrow(a)}
                          </li>
                        );
                      })}
                    </ul>
                  ) : tr('không có trục đầy/trống', 'none')}
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {tr('💡 Các "vùng rèn luyện" là tiềm năng có thể bồi dưỡng thêm trong môi trường đại học, không phải khuyết điểm cố định.', '💡 Growth areas are potentials that can be nurtured in university, not fixed flaws.')}
                  </p>
                </td>
              </tr>
              <tr><td>{tr('Số thể hiện bên ngoài (PY06)', 'Outer expression (PY06)')}</td><td className="r">{extras.outer}</td></tr>
              <tr><td>{tr('Vệ Đà: tâm hồn / định mệnh / danh tính', 'Vedic: psychic / destiny / name')}</td><td className="r">{extras.vedic.psychicType} · {extras.vedic.destiny} · {extras.vedic.name}</td></tr>
              <tr><td>{t('Kabala: khóa ngày sinh · hành tinh')}</td><td className="r">{extras.kabala.birthKey} · {extras.kabala.birthPlanet}</td></tr>
            </tbody></table>
          </div>
        </details>
      )}
    </>
  );
}

// ---------------- L3 Kết nối (sơ đồ có đường nối) ----------------
const trunc = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
export function L3({ out, kb, person, sel, setSel }) {
  const { sig, result } = out;
  const row = rowOf(out, sel);
  const env = result.env;
  const [hoverArch, setHoverArch] = useState(null);

  const sigArch = new Set(result.groups.map((g) => sig.arch[g]));
  const archs = [...new Set([...sigArch, ...(row?.A ?? [])])].sort((a, b) => a - b);
  const ranked = result.rows.filter((r) => r.rank).sort((a, b) => a.rank - b.rank);
  const profs = ranked.slice(0, 5);
  if (row && !profs.includes(row)) profs.push(row);
  const majors = row ? repMajor(kb, row.profile, env).all : [];
  const mShow = majors.slice(0, 5);

  const W = 1080, colX = [0, 200, 560, 850], colW = [160, 320, 250, 220], H0 = 34, GAP = 12;
  const place = (n, h) => Array.from({ length: n }, (_, i) => 40 + i * (h + GAP));
  const sigY = place(SIG_ORDER.length, H0), archY = place(archs.length, H0), profY = place(profs.length, 44), majY = place(mShow.length + (majors.length > 5 ? 1 : 0), H0);
  const height = Math.max(...[sigY, archY, profY, majY].map((ys) => (ys.length ? ys[ys.length - 1] : 0))) + 60;
  const pathOf = (x1, y1, x2, y2) => { const m = (x1 + x2) / 2; return `M${x1} ${y1} C ${m} ${y1}, ${m} ${y2}, ${x2} ${y2}`; };
  const archIdx = (a) => archs.indexOf(a);

  const edges = [];
  SIG_ORDER.forEach((g, i) => {
    const j = archIdx(sig.arch[g]); if (j < 0) return;
    const isConn = hoverArch === null || hoverArch === sig.arch[g];
    edges.push({ k: `s${g}`, d: pathOf(colX[0] + colW[0], sigY[i] + H0 / 2, colX[1], archY[j] + H0 / 2), on: row?.khop[g] > 0, highlight: hoverArch === sig.arch[g], faint: !isConn });
  });
  profs.forEach((p, pi) => p.A.forEach((a) => {
    const j = archIdx(a); if (j < 0) return;
    const isSel = p === row;
    if (!isSel && !sigArch.has(a)) return;
    const isConn = hoverArch === null || hoverArch === a;
    edges.push({ k: `a${p.profile}${a}`, d: pathOf(colX[1] + colW[1], archY[j] + H0 / 2, colX[2], profY[pi] + 22), on: isSel && sigArch.has(a), highlight: hoverArch === a, faint: !isSel || !isConn });
  }));
  const selIdx = profs.indexOf(row);
  if (selIdx >= 0) majY.forEach((y, i) => edges.push({ k: `m${i}`, d: pathOf(colX[2] + colW[2], profY[selIdx] + 22, colX[3], y + H0 / 2), on: true, highlight: false }));

  return (
    <>
      <section className="panel">
        <Head out={out} kb={kb} row={row} setSel={setSel} />
        <div className="flow-wrap">
          <svg viewBox={`0 0 ${W} ${height}`} className="flow-svg" role="img" aria-label={tr('Sơ đồ: con số → nét tính cách → nhóm ngành → ngành', 'Diagram: numbers → traits → major groups → majors')}>
            {[tr('Con số của bạn', 'Your numbers'), tr('Nét tính cách · kỹ năng của bạn', 'Trait · your skill'), tr('Nhóm ngành (bấm để đổi)', 'Major group (click to switch)'), tr('Ngành cụ thể', 'Majors')].map((h, i) => <text key={h} x={colX[i]} y={20} className="flow-h">{h}</text>)}
            {edges.map((e) => <path key={e.k} d={e.d} className={`edge ${e.highlight ? 'edge-highlight' : e.on ? 'on' : e.faint ? 'faint' : 'off'}`} />)}
            {SIG_ORDER.map((g, i) => (
              <g key={g} className={`fnode ${row?.khop[g] > 0 ? 'on' : ''}`} transform={`translate(${colX[0]},${sigY[i]})`}>
                <rect width={colW[0]} height={H0} rx="6" /><text x="10" y="22">{trunc(sigName(g), 17)}: <tspan className="b">{sig[g]}</tspan></text>
              </g>
            ))}
            {archs.map((a, i) => (
              <g
                key={a}
                className={`fnode ${row?.A.includes(a) && sigArch.has(a) ? 'on' : !sigArch.has(a) ? 'dim' : ''} ${hoverArch === a ? 'hovered' : ''}`}
                transform={`translate(${colX[1]},${archY[i]})`}
                onMouseEnter={() => setHoverArch(a)}
                onMouseLeave={() => setHoverArch(null)}
              >
                <title>{`${skillName(kb, a)} – ${archTrait(kb, a)}`}</title>
                <rect width={colW[1]} height={H0} rx="6" />
                <text x="10" y="22"><tspan className="b">{a}</tspan> · {trunc(skillName(kb, a), 34)} ({person.skillsNow[a]}/5)</text>
              </g>
            ))}
            {profs.map((p, i) => (
              <g key={p.profile} className={`fnode click ${p === row ? 'sel' : ''}`} transform={`translate(${colX[2]},${profY[i]})`} onClick={() => setSel(p.profile)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') setSel(p.profile); }}>
                <title>{repMajor(kb, p.profile, env).name}</title>
                <rect width={colW[2]} height={44} rx="6" />
                <text x="10" y="18" className="b">{trunc(repMajor(kb, p.profile, env).name, 26)}</text>
                <text x="10" y="36" className="sub">{p.rank ? `${tr('hạng', 'rank')} ${p.rank} · ${pct(p.C)}` : tr('không xếp hạng', 'not ranked')} · {t(p.label)}</text>
              </g>
            ))}
            {mShow.map((m, i) => (
              <g key={m.id} className="fnode" transform={`translate(${colX[3]},${majY[i]})`}><title>{m.name_vi}</title>
                <rect width={colW[3]} height={H0} rx="6" /><text x="10" y="22">{trunc(m.name_vi, 26)}</text></g>
            ))}
            {majors.length > 5 && <g className="fnode dim" transform={`translate(${colX[3]},${majY[mShow.length]})`}><rect width={colW[3]} height={H0} rx="6" /><text x="10" y="22">+{majors.length - 5} {tr('ngành khác', 'more majors')}</text></g>}
          </svg>
        </div>
        <p className="small muted">{tr('Đường đậm = con số của bạn trùng nét tính cách của nhóm ngành đang xem · rê chuột vào nét tính cách để làm nổi bật đường nối.', 'Bold line = your number matches the selected group · hover over a trait to highlight connected paths.')}</p>
        {row && <p className="small">{tr(`Nhóm ngành này gắn với 3 nét tính cách số ${row.A.join(', ')}. Bạn có con số trùng ở ${row.A.filter((a) => sigArch.has(a)).length} nét.`, `This group is linked to traits ${row.A.join(', ')}. Your numbers match ${row.A.filter((a) => sigArch.has(a)).length} of them.`)}</p>}
      </section>
      {row && (
        <Teacher title={tr('bảng khớp chi tiết', 'detailed match table')}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>{t('Vị trí')}</th><th>{tr('Nét tính cách', 'Archetype')}</th><th className="r">p</th><th>{t('Nhóm tín hiệu trùng')}</th><th>{t('Kỹ năng')}</th><th className="r">{t('Mức')}</th></tr></thead>
            <tbody>{row.A.map((a, i) => (
              <tr key={i} className={row.KN[i] <= kb.params.Weak_max ? 'hl' : ''}>
                <td>{i + 1}</td><td>{a}</td><td className="r">{fmt(result.p[i], 1)}</td>
                <td>{result.groups.filter((g) => sig.arch[g] === a).map((g) => `${g} ${groupName(kb, g)}`).join(', ') || '—'}</td>
                <td>{skillName(kb, a)}</td><td className="r">{row.KN[i]}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <p className="small muted">{row.profile} · {tr('môi trường nhóm', 'group environment')}: {envName(kb, row.env)} → ENV = {row.ENV} (F-KHOP, F-EC, F-ENV)</p>
        </Teacher>
      )}
    </>
  );
}

// ---------------- L4 Công thức (kiểu LaTeX + số thật) ----------------
function Step({ no, title, say, general, real, note, src }) {
  return (
    <div className="step">
      <h3>{tr('Bước', 'Step')} {no} · {title}</h3>
      {say && <p className="small muted">{say}</p>}
      {general && <Tex>{general}</Tex>}
      {real && <Tex className="real">{real}</Tex>}
      {note && <p className="small real-note">{note}</p>}
      <Src>{src}</Src>
    </div>
  );
}
export function L4({ out, kb, sel, setSel }) {
  const [l6] = useLayer('l6');
  const { result: r } = out;
  const row = rowOf(out, sel);
  if (!row) return <p className="empty">{t('Không có hồ sơ.')}</p>;
  const F = Object.fromEntries((l6?.formulas ?? []).map((f) => [f.code, f]));
  const src = (c) => (F[c] ? `${c} · ${F[c].src_ref ?? ''}` : c);
  const { w } = kb.params; const p = r.p; const sp = r.sumP;
  const sw = r.groups.reduce((s, g) => s + w[g], 0);
  const hits = GROUPS.filter((g) => row.khop[g] > 0);
  const [a, b, c] = r.weights;
  const norm = r.normalize;
  const X = (k) => (norm ? `${k}^{*}` : k);
  const xv = (k) => (norm ? row[`${k}_n`] : row[k]);
  const mm = (k) => { const [lo, hi] = r.minmax[k]; const d = k === 'ENV' ? 0 : 3; return Math.abs(hi - lo) <= 1e-9 ? `${k}^{*}=0\\ (${tt('max = min')})` : `${k}^{*}=\\dfrac{${tn(row[k], d)}-${tn(lo, d)}}{${tn(hi, d)}-${tn(lo, d)}}=${tn(row[`${k}_n`], k === 'ENV' ? 0 : 3)}`; };
  const ta = targetAnalysis(r, row.profile, { ...kb.params, p });
  const srMin = kb.params.SR_min;
  let no = 0;
  return (
    <section className="panel">
      <Head out={out} kb={kb} row={row} setSel={setSel} />
      <div className="steps">
        <Step no={++no} title={tr('Con số nào trùng?', 'Which numbers match?')} src={src('F-KHOP')}
          say={tr('Mỗi nhóm ngành có 3 nét tính cách xếp theo thứ tự. Con số của bạn trùng nét ở vị trí 1, 2, 3 được 1; 0,8; 0,6 điểm.', 'Each group has 3 ordered traits. A number matching trait 1, 2, 3 earns 1, 0.8, 0.6.')}
          general={`\\text{khớp}_g=\\begin{cases}p_k & ${tt(tr('con số g trùng nét thứ k', 'number g matches trait k'))}\\\\ 0 & ${tt(tr('ngược lại', 'otherwise'))}\\end{cases}\\qquad EC=\\#\\{g:\\ \\text{khớp}_g>0\\}`}
          real={hits.length ? `${hits.map((g) => `\\text{khớp}_{\\text{${g}}}=${tn(row.khop[g], 1)}`).join(',\\ ')}\\ \\Rightarrow\\ EC=${row.EC}` : 'EC=0'} />
        <Step no={++no} title={tr('Độ trùng con số', 'Number match score')} src={src('F-NF')}
          say={tr('Cộng điểm trùng theo trọng số của từng con số, rồi chia cho điểm tối đa có thể.', 'Add the match points weighted by each number, divided by the maximum possible.')}
          general={'NF=\\dfrac{\\sum_g w_g\\cdot\\text{khớp}_g}{\\left(\\sum_g w_g\\right)\\cdot\\sum_k p_k}'}
          real={`NF=\\dfrac{${hits.length ? hits.map((g) => `${tn(w[g], 2)}\\cdot ${tn(row.khop[g], 1)}`).join('+') : '0'}}{${tn(sw, 2)}\\cdot ${tn(sp, 1)}}=${tn(row.NF)}`} />
        <Step no={++no} title={tr('Mức kỹ năng', 'Skill level')} src={src('F-SR')}
          say={tr('Lấy điểm tự đánh giá (1–5) của 3 kỹ năng gắn với nhóm ngành, đổi về thang 0–1.', 'Take your 1–5 self-ratings of the 3 linked skills and scale them to 0–1.')}
          general={'SR=\\dfrac{\\sum_{k=1}^{3}p_k\\,(r_k-1)}{4\\sum_k p_k}'}
          real={`SR=\\dfrac{${row.KN.map((rk, i) => `${tn(p[i], 1)}\\cdot(${rk}-1)`).join('+')}}{4\\cdot ${tn(sp, 1)}}=${tn(row.SR)}`} />
        <Step no={++no} title={tr('Môi trường', 'Environment')} src={src('F-ENV')}
          say={tr('Bằng 1 nếu môi trường bạn muốn trùng môi trường của nhóm ngành, ngược lại bằng 0.', '1 if the environment you want matches the group, otherwise 0.')}
          general={`ENV=[\\,${tt(tr('môi trường bạn chọn', 'your environment'))}=${tt(tr('môi trường nhóm ngành', 'group environment'))}\\,]`}
          real={`ENV=[\\,${tt(envName(kb, r.env))}=${tt(envName(kb, row.env))}\\,]=${row.ENV}`} />
        {norm && row.EC >= 1 && (
          <Step no={++no} title={tr('Đưa về cùng thang', 'Put on the same scale')} src={src('F-MM')}
            say={tr(`So với ${r.nEligible} nhóm ngành có con số trùng của chính bạn: thấp nhất = 0, cao nhất = 1.`, `Compared with your own ${r.nEligible} groups that have a match: lowest = 0, highest = 1.`)}
            general={'X^{*}=\\dfrac{X-\\min X}{\\max X-\\min X}'}
            real={['NF', 'SR', 'ENV'].map(mm).join('\\qquad ')} />
        )}
        <Step no={++no} title={tr('% phù hợp', 'Fit %')} src={src('F-C')}
          say={tr(`Cộng 3 phần theo trọng số ROC của góc nhìn ${PERSONA_NAME[r.persona]}.`, `Add the 3 parts with the ROC weights of the ${PERSONA_NAME[r.persona]} view.`)}
          general={`C=\\alpha\\,${X('NF')}+\\beta\\,${X('SR')}+\\gamma\\,${X('ENV')}`}
          real={row.EC >= 1 ? `C=${tn(a)}\\cdot ${tn(xv('NF'))}+${tn(b)}\\cdot ${tn(xv('SR'))}+${tn(c)}\\cdot ${tn(xv('ENV'))}=${tn(row.C)}\\;\\Rightarrow\\;${Math.round(row.C * 100)}\\%` : `EC=0\\ \\Rightarrow\\ ${tt(tr('không xếp hạng', 'not ranked'))}`} />
        <Step no={++no} title={tr('Nhãn khuyến nghị', 'Recommendation label')} src={src('F-LABEL')}
          general={`${tt(tr('Nhãn', 'Label'))}=\\begin{cases}${tt(t('Không đề xuất'))} & EC=0\\\\ ${tt(t('Thử thách'))} & ${tt(tr('có kỹ năng', 'a skill'))}\\le 2\\\\ ${tt(t('Ưu tiên'))} & EC\\ge 2,\\ SR\\ge ${tn(srMin)}\\\\ ${tt(t('Cân nhắc'))} & ${tt(tr('còn lại', 'otherwise'))}\\end{cases}`}
          note={`${tr('Bạn', 'You')}: EC = ${row.EC}, ${row.weak ? tr(`có ${row.weak} kỹ năng ≤ 2`, `${row.weak} skill(s) ≤ 2`) : tr('không có kỹ năng ≤ 2', 'no skill ≤ 2')}, SR = ${fmt(row.SR)} → ${t(row.label)}`} />
        {ta && row.label !== LABELS.PRIORITY && ta.status === 'POSSIBLE' && (
          <Step no={++no} title={tr('Cần tăng bao nhiêu để lên Ưu tiên?', 'How much to reach Priority?')} src={src('F-STEP5a')}
            general={`${tt(tr('bậc cần tăng', 'levels needed'))}=\\sum_{r_k\\le 2}(3-r_k)\\qquad ${tt(tr('điểm thiếu', 'missing points'))}=\\max\\!\\left(0;\\ ${tn(srMin)}\\cdot 4\\sum_k p_k-\\sum_k p_k(r_k-1)\\right)`}
            real={`${tt(tr('bậc cần tăng', 'levels needed'))}=${ta.stepsWeak}\\qquad ${tt(tr('điểm thiếu', 'missing points'))}=${tn(ta.gap, 2)}\\ \\Rightarrow\\ ${ta.stepsMain}\\ ${tt(tr('bậc ở', 'level(s) on'))}\\ ${tt(skillName(kb, row.A[0]))}`} />
        )}
      </div>
      <p className="small muted">{tr('Ký hiệu: w = trọng số của từng con số · p = 1 / 0,8 / 0,6 theo vị trí · r = điểm kỹ năng tự chấm · α, β, γ = trọng số ROC.', 'Symbols: w = weight of each number · p = 1 / 0.8 / 0.6 by position · r = self-rated skill · α, β, γ = ROC weights.')}</p>
      {out.sig.redacted && <p className="small muted">{t('Dãy chữ số ngày sinh được che với vai trò Quản trị.')}</p>}
    </section>
  );
}

// ---------------- L5 Bảng xếp hạng ----------------
export function L5({ out, kb, sel, setSel, compare }) {
  const { result, stability } = out;
  const [showAll, setShowAll] = useState(false);
  const [searchQry, setSearchQry] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [filterEnv, setFilterEnv] = useState('');

  const env = result.env;
  const ranked = result.rows.filter((r) => r.rank).sort((a, b) => a.rank - b.rank);
  const rows = showAll ? [...ranked, ...result.rows.filter((r) => !r.rank)] : ranked;

  const labelCounts = useMemo(() => {
    const c = { [LABELS.PRIORITY]: 0, [LABELS.CONSIDER]: 0, [LABELS.CHALLENGE]: 0, [LABELS.NONE]: 0 };
    rows.forEach((r) => { if (c[r.label] !== undefined) c[r.label]++; });
    return c;
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterLabel && r.label !== filterLabel) return false;
      if (filterEnv && r.env !== filterEnv) return false;
      if (searchQry) {
        const m = repMajor(kb, r.profile, env);
        const q = searchQry.trim().toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchAll = m.all.some((major) => major.name_vi.toLowerCase().includes(q));
        if (!matchName && !matchAll) return false;
      }
      return true;
    });
  }, [rows, filterLabel, filterEnv, searchQry, kb, env]);

  const sweep = useMemo(() => alphaSweep(result), [result]);
  const n = result.normalize;
  const top1 = stability.runs[0].top1;

  return (
    <>
      <p className="howto"><b>{tr('Cách đọc bảng', 'How to read this')}:</b> {tr(`hệ thống chấm cả 35 nhóm ngành. % phù hợp càng cao càng hợp với bạn (chỉ so sánh giữa các ngành của chính bạn). "Con số trùng" là số con số của bạn khớp nét tính cách của nhóm ngành; "Kỹ năng" là điểm trung bình bạn tự chấm cho các kỹ năng liên quan (cần từ ${fmt(SKILL_NEED(kb), 1)}/5). Nhóm không có con số trùng thì không được xếp hạng.`, `all 35 major groups are scored. Higher fit % = better for you (only compared within your own results). "Matching numbers" counts your numbers that match the group's traits; "Skills" is your average self-rating of the related skills (bar: ${fmt(SKILL_NEED(kb), 1)}/5). Groups with no match are not ranked.`)}</p>
      <section className="panel">
        <div className="panel-head">
          <h2>{tr('Bảng xếp hạng 35 nhóm ngành', '35 Major-group ranking')}</h2>
          {result.rows.length > ranked.length && (
            <button type="button" className="btn ghost small" onClick={() => setShowAll((x) => !x)}>
              {showAll ? tr('chỉ nhóm được xếp hạng', 'ranked groups only') : tr(`hiện cả ${result.rows.length - ranked.length} nhóm không xếp hạng`, `show the ${result.rows.length - ranked.length} unranked groups`)}
            </button>
          )}
        </div>

        {/* Thanh công cụ tìm kiếm và lọc */}
        <div className="l5-filter-bar">
          <input
            type="search"
            className="l5-search"
            placeholder={tr('🔍 Tìm nhanh tên ngành trong 35 nhóm…', '🔍 Search major name…')}
            value={searchQry}
            onChange={(e) => setSearchQry(e.target.value)}
          />

          <div className="l5-pills">
            <button
              type="button"
              className={`pill-btn ${filterLabel === '' ? 'active' : ''}`}
              onClick={() => setFilterLabel('')}
            >
              {tr('Tất cả', 'All')} ({rows.length})
            </button>
            <button
              type="button"
              className={`pill-btn priority ${filterLabel === LABELS.PRIORITY ? 'active' : ''}`}
              onClick={() => setFilterLabel(filterLabel === LABELS.PRIORITY ? '' : LABELS.PRIORITY)}
            >
              ★ {t(LABELS.PRIORITY)} ({labelCounts[LABELS.PRIORITY] ?? 0})
            </button>
            <button
              type="button"
              className={`pill-btn consider ${filterLabel === LABELS.CONSIDER ? 'active' : ''}`}
              onClick={() => setFilterLabel(filterLabel === LABELS.CONSIDER ? '' : LABELS.CONSIDER)}
            >
              ◯ {t(LABELS.CONSIDER)} ({labelCounts[LABELS.CONSIDER] ?? 0})
            </button>
            <button
              type="button"
              className={`pill-btn challenge ${filterLabel === LABELS.CHALLENGE ? 'active' : ''}`}
              onClick={() => setFilterLabel(filterLabel === LABELS.CHALLENGE ? '' : LABELS.CHALLENGE)}
            >
              ⚠ {t(LABELS.CHALLENGE)} ({labelCounts[LABELS.CHALLENGE] ?? 0})
            </button>
            {labelCounts[LABELS.NONE] > 0 && (
              <button
                type="button"
                className={`pill-btn none ${filterLabel === LABELS.NONE ? 'active' : ''}`}
                onClick={() => setFilterLabel(filterLabel === LABELS.NONE ? '' : LABELS.NONE)}
              >
                ✕ {t(LABELS.NONE)} ({labelCounts[LABELS.NONE] ?? 0})
              </button>
            )}
          </div>

          <select
            className="l5-env-select"
            value={filterEnv}
            onChange={(e) => setFilterEnv(e.target.value)}
            aria-label="Lọc theo môi trường làm việc"
          >
            <option value="">{tr('Mọi môi trường làm việc', 'All environments')}</option>
            {Object.keys(kb.envs).map((e) => (
              <option key={e} value={e}>{envName(kb, e)}</option>
            ))}
          </select>
        </div>

        <div className="small muted" style={{ margin: '4px 0 8px' }}>
          {tr(`Hiển thị ${filteredRows.length} trên tổng số ${rows.length} nhóm ngành:`, `Showing ${filteredRows.length} of ${rows.length} major groups:`)}
        </div>

        <div className="tbl-wrap"><table className="tbl rank-tbl">
          <thead><tr><th className="r">{t('Hạng')}</th><th>{tr('Ngành đại diện & Nhóm ngành', 'Representative major')}</th><th>{tr('% phù hợp', 'Fit %')}</th><th>{t('Nhãn')}</th><th className="r">{tr('Con số trùng', 'Matching numbers')}</th><th className="r">{t('Kỹ năng')}</th><th /></tr></thead>
          <tbody>{filteredRows.length > 0 ? filteredRows.map((r) => {
            const m = repMajor(kb, r.profile, env);
            return (
              <tr key={r.profile} className={r.profile === sel ? 'hl' : r.EC === 0 ? 'dim' : ''} onClick={() => setSel(r.profile)} style={{ cursor: 'pointer' }}>
                <td className="r">{r.rank ?? '—'}</td>
                <td>
                  <b>{m.name}</b>
                  {m.more > 0 && <span className="muted small"> +{m.more} {tr('ngành khác', 'others')}</span>}
                  <div className="small muted">{envName(kb, r.env)}</div>
                </td>
                <td><span className="pct-cell"><span className="mrow-bar"><span style={{ width: `${(r.EC >= 1 ? r.C : 0) * 100}%` }} /></span><b className="num">{r.EC >= 1 ? pct(r.C) : '—'}</b></span></td>
                <td><LabelChip label={r.label} /></td>
                <td className="r">{r.EC}/{result.groups.length}</td>
                <td className="r">{fmt(avgSkill(r.SR), 1)}/5</td>
                <td><a href={layerHref('l1', r.profile)} onClick={(e) => e.stopPropagation()}>{t('Vì sao?')}</a></td>
              </tr>
            );
          }) : (
            <tr><td colSpan={7} className="empty">{tr('Không tìm thấy ngành nào phù hợp với bộ lọc.', 'No majors match the filter.')}</td></tr>
          )}</tbody>
        </table></div>
      </section>
      <div className="grid2" style={{ marginTop: 12 }}>
        <section className="panel">
          <h2 style={{ marginBottom: 4 }}>{tr('Kết quả có chắc không?', 'How consistent is the result?')}</h2>
          <p className="small muted" style={{ marginBottom: 6 }}>{tr('Hệ thống tính lại theo 5 cách khác nhau và xem ngành phù hợp nhất có đổi không:', 'The system recalculates in 5 different ways and checks whether the best fit changes:')}</p>
          <ul className="stab-list">{stability.runs.map((x) => (
            <li key={x.code} className={x.top1 === top1 ? 'ok' : 'err'}><span aria-hidden="true">{x.top1 === top1 ? '✓' : '✗'}</span> {tr(...(STAB_NAME[x.code] ?? [x.name, x.name]))}: <b>{x.top1 ? repMajor(kb, x.top1, env).name : '—'}</b></li>
          ))}</ul>
          <p className="small" style={{ marginTop: 6 }}><b>{stability.count}/5</b> {tr('cách cho cùng kết quả', 'methods agree')} → {stabWord(stability.count)}.</p>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{tr('Phân bố nhãn của 35 nhóm ngành', 'Labels across the 35 groups')}</h2>
          <LabelDistribution rows={result.rows} />
        </section>
      </div>
      <Teacher title={tr('bảng tính đầy đủ, so sánh persona, quét α', 'full table, persona comparison, α sweep')}>
        <p className="small muted" style={{ marginBottom: 6 }}>α/β/γ = {result.weights.map((x) => fmt(x)).join(' / ')} · p = {result.p.map((x) => fmt(x, 1)).join(' / ')} · {tr('nhóm bật', 'groups on')}: {result.groups.join(', ')} ·
          min–max (EC ≥ 1): NF [{result.minmax.NF.map((x) => fmt(x)).join('; ')}], SR [{result.minmax.SR.map((x) => fmt(x)).join('; ')}], ENV [{result.minmax.ENV.join('; ')}]</p>
        <div className="tbl-wrap" style={{ maxHeight: 460 }}>
          <table className="tbl">
            <thead><tr>
              <th className="r">{t('Hạng')}</th><th>{t('Hồ sơ')}</th><th>A1·A2·A3</th>{GROUPS.map((g) => <th key={g} className="r">{g}</th>)}
              <th className="r">NF</th><th className="r">EC</th><th>KN</th><th className="r">SR</th><th className="r">ENV</th>
              {n && <><th className="r">NF*</th><th className="r">SR*</th><th className="r">ENV*</th></>}
              <th className="r">C</th><th>{t('Nhãn')}</th><th className="r">SAT</th><th className="r">STR</th>
            </tr></thead>
            <tbody>{result.rows.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.idx - b.idx).map((r) => (
              <tr key={r.profile} className={r.profile === sel ? 'hl' : r.EC === 0 ? 'dim' : ''}>
                <td className="r">{r.rank ?? '—'}</td><td>{r.profile}</td><td>{r.A.join('·')}</td>
                {GROUPS.map((g) => <td key={g} className="r">{r.khop[g] ? fmt(r.khop[g], 1) : '·'}</td>)}
                <td className="r">{fmt(r.NF)}</td><td className="r">{r.EC}</td><td>{r.KN.join('·')}</td><td className="r">{fmt(r.SR)}</td><td className="r">{r.ENV}</td>
                {n && <><td className="r">{fmt(r.NF_n)}</td><td className="r">{fmt(r.SR_n)}</td><td className="r">{fmt(r.ENV_n)}</td></>}
                <td className="r"><b>{fmt(r.C)}</b></td><td>{t(r.label)}</td><td className="r">{r.SAT}</td><td className="r">{r.STR}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {compare && (
          <>
            <h3 style={{ margin: '10px 0 4px' }}>{tr('So sánh 3 persona (bộ A)', 'Compare 3 personas (set A)')}</h3>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Persona</th><th className="r">α / β / γ</th><th>Top-1</th><th>Top-2</th><th>Top-3</th><th>{t('Ưu tiên tốt nhất')}</th></tr></thead>
              <tbody>{compare.map(({ persona, out: o }) => (
                <tr key={persona} className={o.result.top[0]?.profile !== compare[0].out.result.top[0]?.profile ? 'hl' : ''}>
                  <td>{PERSONA_NAME[persona]}</td><td className="r">{o.result.weights.map((x) => fmt(x)).join(' / ')}</td>
                  {[0, 1, 2].map((i) => { const x = o.result.top[i]; return <td key={i}>{x ? `${x.profile} · ${fmt(x.C)} · ${t(x.label)}` : '—'}</td>; })}
                  <td>{o.result.bestPriority ? `${o.result.bestPriority.profile} (${tr('hạng', 'rank')} ${o.result.bestPriority.rank})` : '—'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </>
        )}
        <h3 style={{ margin: '10px 0 4px' }}>{tr('Quét α (β, γ giữ tỉ lệ persona', 'α sweep (β, γ keep the ratio of persona')} {PERSONA_NAME[result.persona]})</h3>
        <table className="tbl"><thead><tr><th className="r">α</th><th>Top-1</th><th className="r">C</th></tr></thead>
          <tbody>{sweep.map((s) => <tr key={s.alpha} className={s.top1 !== result.top[0]?.profile ? 'hl' : ''}><td className="r">{fmt(s.alpha, 1)}</td><td>{s.top1}</td><td className="r">{fmt(s.value)}</td></tr>)}</tbody></table>
        <p className="small muted">{t('Nguồn: Student_Report AC:AH (v6). Dòng tô vàng = khác Top-1 hiện tại.')}</p>
      </Teacher>
    </>
  );
}

// ---------------- L6 Nguồn tri thức ----------------
export function L6({ out, kb }) {
  const [d, err] = useLayer('l6');
  const [qry, setQry] = useState('');
  if (!d) return <Loading err={err} />;
  const { sig } = out;
  const wanted = [['PY', sig.G1, 'G1'], ['PY', sig.G5, 'G5'], ['VE', sig.G2, 'G2'], ['KB', sig.G4, 'G4'], ['KB', sig.G6, 'G6']];
  const cite = (type, key) => d.citations.filter((c) => c.target_type === type && String(c.target_key) === String(key));
  const ruleCodes = ['PY00', ...kb.groups.map((g) => g.rule_code)];
  const gl = d.glossary.filter((g) => !qry || `${g.term} ${g.full_name} ${g.plain_vi}`.toLowerCase().includes(qry.toLowerCase()));
  return (
    <>
      <section className="panel">
        <h2 style={{ marginBottom: 8 }}>{tr('Ý nghĩa các con số của bạn', 'What your numbers mean')}</h2>
        <div className="mean-cards">
          {wanted.map(([sc, n, g]) => {
            const m = d.meanings.find((x) => x.school_code === sc && x.number === n);
            const cs = m ? cite('number_meaning', m.id) : [];
            const vi = getMeaningVi(sc, n);
            const isVi = getLang() === 'vi';
            const meaningText = (isVi && vi?.meaning) || m?.meaning;
            const vocationsText = (isVi && vi?.vocations) || m?.vocations;
            return (
              <div key={g} className="mean">
                <span className="small muted">{sigName(g)} <b className="num">{n}</b></span>
                {meaningText ? <>
                  <p>“{meaningText}”</p>
                  {vocationsText && <p className="small"><b>{tr('Nghề theo sách', 'Careers in the book')}:</b> {vocationsText}</p>}
                  <span className="src">{tr('Nguồn', 'Source')}: {m?.source_note ?? ''}{cs.length ? ` · ${cs.map((c) => c.author ?? c.source_code).join('; ')}` : ''}</span>
                </> : <p className="small muted">{t('chưa có trong bảng ý nghĩa')}</p>}
              </div>
            );
          })}
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>{tr('Trích dẫn và lược dịch từ sách nguồn để tiện đối chiếu. Thần số học không có giá trị dự báo khoa học.', 'Quoted word for word from the books to avoid distortion. Numerology has no scientific predictive value.')}</p>
      </section>
      <Teacher title={tr('quy tắc, trọng số, công thức, thuật ngữ, tài liệu', 'rules, weights, formulas, glossary, sources')}>
        <div className="grid2">
          <div>
            <h3>{t('Quy tắc tính đã dùng')}</h3>
            <table className="tbl"><thead><tr><th>{t('Mã')}</th><th>{t('Quy tắc')}</th><th>{t('Trích dẫn')}</th></tr></thead>
            <tbody>{d.rules.filter((r) => ruleCodes.includes(r.code)).map((r) => (
              <tr key={r.code}><td>{r.code}</td><td>{r.indicator}<br /><span className="small muted">{r.pseudocode}</span><br /><Src>{r.src_ref}</Src></td>
                <td className="small">{cite('calc_rule', r.code).map((c) => <div key={c.source_code}>{c.author ?? c.source_code} – <i>{c.title}</i></div>)}</td></tr>
            ))}</tbody></table>
          </div>
          <div>
            <h3>{t('Trọng số persona & bằng chứng')}</h3>
            <table className="tbl"><thead><tr><th>{t('Bộ')}</th><th>Persona</th><th className="r">α</th><th className="r">β</th><th className="r">γ</th><th>{t('Căn cứ')}</th></tr></thead>
            <tbody>{kb.weightMeta.map((w) => (
              <tr key={w.set_code + w.persona} className={w.set_code === kb.paramSet.code ? '' : 'dim'}><td>{w.set_code}</td><td>{w.persona}</td>
                <td className="r">{fmt(w.alpha)}</td><td className="r">{fmt(w.beta)}</td><td className="r">{fmt(w.gamma)}</td><td className="small">{w.criteria_rank ? `${w.criteria_rank} · ` : ''}{w.evidence}</td></tr>
            ))}</tbody></table>
          </div>
          <div>
            <h3>{t('Công thức (F-*)')}</h3>
            <table className="tbl"><thead><tr><th>{t('Mã')}</th><th>{t('Tầng')}</th><th>{t('Công thức')}</th></tr></thead>
            <tbody>{d.formulas.map((f) => <tr key={f.code}><td>{f.code}</td><td>{f.layer}</td><td>{f.name_vi}: <span className="small">{f.expr}</span><br /><Src>{f.src_ref}</Src></td></tr>)}</tbody></table>
          </div>
          <div>
            <div className="panel-head"><h3>{tr('Thuật ngữ', 'Glossary')} ({d.glossary.length})</h3>
              <input type="search" placeholder={t('Tìm thuật ngữ…')} value={qry} onChange={(e) => setQry(e.target.value)} aria-label={t('Tìm thuật ngữ')} /></div>
            <div className="tbl-wrap" style={{ maxHeight: 320 }}><table className="tbl"><tbody>
              {gl.map((g) => <tr key={g.group_code + g.term}><td><b>{g.term}</b><br /><span className="small muted">{g.group_code}</span></td><td>{g.full_name}<br /><span className="small">{g.plain_vi}</span></td></tr>)}
            </tbody></table></div>
          </div>
          <div>
            <h3>{tr('Nguồn tài liệu & bằng chứng', 'Sources & evidence')} ({d.sources.length})</h3>
            <div className="tbl-wrap" style={{ maxHeight: 320 }}><table className="tbl"><tbody>
              {d.sources.map((s) => <tr key={s.code}><td>{s.code}</td><td>{s.author ? `${s.author} – ` : ''}<i>{s.title}</i>{s.used_for || s.locator ? <><br /><span className="small muted">{[s.used_for, s.locator].filter(Boolean).join(' · ')}</span></> : null}</td></tr>)}
            </tbody></table></div>
          </div>
        </div>
      </Teacher>
    </>
  );
}

// ---------------- L7 Dữ liệu ----------------
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
  const DOC_NAME = {
    model_card: tr('Thẻ mô hình (Model Card)', 'Model Card'),
    data_gap: tr('Khoảng trống dữ liệu (Data Gap)', 'Data Gap'),
    data_dictionary: tr('Từ điển dữ liệu', 'Data dictionary'),
    major_data_dictionary: tr('Từ điển dữ liệu ngành', 'Major data dictionary'),
    sensitivity_summary: tr('Tóm tắt phân tích độ nhạy (Sensitivity)', 'Sensitivity summary'),
    change_log: tr('Nhật ký thay đổi', 'Change log'),
    member_contribution: tr('Đóng góp thành viên', 'Member contribution'),
  };
  return (
    <>
      <div className="grid2">
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{tr('Khả năng đỗ', 'Admission chance')} <span className="small muted">({tr('thử nghiệm với 18 ngành ĐH Công nghiệp Hà Nội', 'pilot with 18 HaUI majors')})</span></h2>
          {bench ? (
            <div className="plain-list">
              <p>{tr('Ngành', 'Major')}: <b>{bench.haui_name}</b></p>
              {adm ? <>
                <p>{tr('Điểm của bạn', 'Your score')} ({adm.combo}): <b className="num">{fmt(adm.score, 2)}</b></p>
                <p>{tr('Điểm chuẩn gần nhất', 'Latest cut-off')}: <b className="num">{fmt(adm.cutoff, 2)}</b> <span className="muted small">({tr('dao động tối đa', 'varied by up to')} ±{fmt(bench.delta_used, 2)} {tr('qua các năm', 'across years')})</span></p>
                <p className={adm.margin >= 0 ? 'ok' : 'err'}>{adm.margin >= 0 ? tr(`Cao hơn điểm chuẩn ${fmt(adm.margin, 2)} điểm`, `${fmt(adm.margin, 2)} above the cut-off`) : tr(`Thấp hơn điểm chuẩn ${fmt(-adm.margin, 2)} điểm`, `${fmt(-adm.margin, 2)} below the cut-off`)} → <b>{t(adm.level)}</b></p>
              </> : <p className="muted">{tr('Chưa có điểm thi thử của bạn để so sánh.', 'No practice-exam score to compare yet.')}</p>}
              <span className="src">{tr('Nguồn', 'Source')}: {bench.src_2026 ?? bench.src_ref}</span>
            </div>
          ) : <p className="small muted">{tr('Ngành bạn nhắm chưa nằm trong 18 ngành thử nghiệm (hoặc bạn chưa chọn ngành), nên chưa đánh giá được khả năng đỗ.', 'Your target major is not among the 18 pilot majors (or no target is chosen), so admission chance is not assessed.')}</p>}
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>{tr('Dữ liệu dùng để tính', 'Data used')}</h2>
          <div className="plain-list">
            <p>{meta?.simulated ? tr('Học sinh mô phỏng – không phải người thật.', 'Simulated student – not a real person.') : tr('Thông tin bạn tự nhập – không được lưu lại.', 'Information you entered – not saved.')}</p>
            <p>{tr('Tri thức lấy từ bảng tính DSS v6 của nhóm; kết quả web đã kiểm tra khớp 100% với bảng tính.', "Knowledge comes from the group's DSS v6 workbook; web results were checked to match it 100%.")}</p>
            <p>{tr('Trọng số: ROC (mặc định), đưa về cùng thang trước khi cộng.', 'Weights: ROC (default), scaled before adding.')}</p>
          </div>
        </section>
      </div>
      <Teacher title={tr('lần tính, điểm chuẩn, dòng dõi dữ liệu, tài liệu', 'run, cut-offs, lineage, documents')}>
        <div className="grid2">
          <table className="tbl"><tbody>
            <tr><td>{t('Mã lần tính')}</td><td className="num">{meta?.runId ?? tr('không lưu (khách / chỉ xem)', 'not saved (guest / read-only)')}</td></tr>
            <tr><td>Engine</td><td>{out.engine}</td></tr>
            <tr><td>{t('Bộ tham số')}</td><td>{kb.paramSet.code} v{kb.paramSet.version} · {kb.paramSet.method}</td></tr>
            <tr><td>{t('Phiên bản tri thức')}</td><td>{kb.kbRelease?.label} · <span className="num small">{kb.kbRelease?.content_hash?.slice(0, 16)}…</span></td></tr>
            <tr><td>{t('Tùy chọn')}</td><td className="small">{JSON.stringify(out.options)}</td></tr>
          </tbody></table>
          {bench && (
            <table className="tbl"><tbody>
              <tr><td>{t('Ngành HaUI')}</td><td>{bench.haui_name} ({bench.haui_code}) · {tr('tổ hợp', 'subject combos')} {bench.combos_2026}</td></tr>
              <tr><td>{t('ĐC 2024 / 2025 / 2026')}</td><td className="num">{fmt(bench.cutoff_2024, 2)} / {fmt(bench.cutoff_2025, 2)} / {fmt(bench.cutoff_2026, 2)}</td></tr>
              <tr><td>{t('Δ = max |chênh năm|')}</td><td className="num">{fmt(bench.delta_used, 2)}</td></tr>
              <tr><td>{t('Nguồn')}</td><td className="src">{bench.src_2024} · {bench.src_2025} · {bench.src_2026} · {bench.src_ref}</td></tr>
            </tbody></table>
          )}
        </div>
        <h3 style={{ margin: '10px 0 4px' }}>{t('Dòng dõi dữ liệu (lineage)')}</h3>
        <table className="tbl"><thead><tr><th>{t('Bảng')}</th><th className="r">{t('Số dòng')}</th><th>{t('Ví dụ nguồn (tệp › sheet › dòng)')}</th></tr></thead>
          <tbody>{d.lineage.map((x) => <tr key={x.tbl}><td>{x.tbl}</td><td className="r">{x.n}</td><td className="src">{x.example_src}</td></tr>)}</tbody></table>
        <p className="small muted">{t('Excel DSS_ASS2_ThanSoHoc_v6.xlsx → ETL (prepare.py + etl.js, kiểm chứng số dòng) → TiDB `dss_than_so_hoc` → API → engine dùng chung.')}</p>
        {Object.entries(groups).map(([type, items]) => (
          <details key={type} style={{ marginTop: 6 }}>
            <summary><b>{t(DOC_NAME[type] ?? type)}</b> <span className="small muted">({items.length} {tr('mục', 'items')})</span></summary>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>{items.map((x) => <div key={x.seq} style={{ borderBottom: '1px solid var(--line-2)', paddingBottom: 4 }}><DocItem c={x.content} /><Src>{x.src_ref}</Src></div>)}</div>
          </details>
        ))}
      </Teacher>
    </>
  );
}
