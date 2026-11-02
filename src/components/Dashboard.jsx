// L0 – tổng quan một màn hình: (a) KPI + cảnh báo · (c) xếp hạng + khuyến nghị · (b) insight · (d) What-if.
import { LABELS, skillCode } from '../../shared/engine/index.js';
import { fmt, signed, profileMajors, archName, envName, groupName, PERSONA_NAME } from '../format.js';
import { Status, LabelChip, Warnings, ContribBar, ContribLegend, Axis01, useTip } from './common.jsx';
import WhatIf from './WhatIf.jsx';

// ---------------- (a) KPI ----------------
const KPI_META = {
  K_LABEL: ['Nhãn Top-1', 'l1', (k) => k.value ?? '–', (k) => k.profile ? `hồ sơ ${k.profile}` : 'không có hồ sơ EC ≥ 1'],
  K_EC: ['Số nhóm tín hiệu khớp (EC) Top-1', 'l2', (k) => (k.value == null ? '–' : `${k.value}/5`), () => 'xanh ≥ 2 · vàng 1 · đỏ 0'],
  K_SR: ['Sẵn sàng kỹ năng (SR)', 'l4', (k) => fmt(k.value), (k) => `${k.profile ?? ''} · ngưỡng 0,625`],
  K_WEAK: ['Kỹ năng yếu (≤ 2)', 'whatif', (k) => k.value ?? '–', (k) => (k.skills?.length ? k.skills.join(', ') : 'không có')],
  K_STAB: ['Độ ổn định Top-1', 'l5', (k) => (k.value == null ? '–' : `${k.value}/5`), () => 'qua 5 cấu hình Sensitivity'],
  K_ADMIT: ['Khả năng đỗ (pilot HaUI)', 'l7', (k) => k.value ?? '–',
    (k) => (k.detail ? `${k.detail.combo} ${fmt(k.detail.score, 2)} vs ĐC ${fmt(k.detail.cutoff, 2)}` : k.value ? 'chỉ 18 ngành HaUI' : 'chưa chọn ngành mục tiêu')],
};

export function KpiStrip({ kpis, onGo }) {
  return (
    <div className="kpis">
      {kpis.map((k) => {
        const [name, layer, val, sub] = KPI_META[k.code];
        return (
          <button key={k.code} type="button" className={`kpi ${k.level}`} onClick={() => onGo(layer, k.profile)}
            title={`Bấm để xem chi tiết (${layer === 'whatif' ? 'What-if' : layer.toUpperCase()})`}>
            <span className="k-name">{name}</span>
            <span className="k-val num">{val(k)}</span>
            <span className="k-sub">{sub(k)}</span>
            <Status level={k.level} />
          </button>
        );
      })}
    </div>
  );
}

// ---------------- (c) xếp hạng + khuyến nghị ----------------
function RankRow({ row, kb, result, onWhy, note }) {
  return (
    <li className="rank-row">
      <span className="rank-no num" aria-label={`Hạng ${row.rank ?? '–'}`}>{row.rank ?? '–'}</span>
      <div className="rank-main">
        <div className="rank-title">
          <b>{row.profile}</b>
          <span className="muted small">archetype {row.A.map((a) => archName(kb, a)).join(' · ')}</span>
          <LabelChip label={row.label} />
          {note && <span className="small muted">{note}</span>}
        </div>
        <div className="rank-majors">{profileMajors(kb, row.profile, 4).join(' · ')}</div>
        <ContribBar row={row} weights={result.weights} normalize={result.normalize} />
      </div>
      <button type="button" className="c-val num" onClick={() => onWhy(row.profile)} title="Vì sao? (L1)">
        {row.EC >= 1 ? fmt(row.C) : '—'}<br /><span className="small" style={{ fontWeight: 600 }}>Vì sao?</span>
      </button>
    </li>
  );
}

export function Ranking({ out, kb, onGo }) {
  const { result, target } = out;
  const why = (p) => onGo('l1', p);
  const t = target?.analysis?.row;
  const tInTop = t && result.top.some((r) => r.profile === t.profile);
  return (
    <>
      <div className="panel-head">
        <h2>Xếp hạng nhóm ngành & khuyến nghị</h2>
        <span className="small muted">mức tương hợp tương đối C (0–1, chỉ so sánh trong cùng một học sinh)</span>
      </div>
      <ContribLegend />
      {result.top.length ? (
        <>
          <ol className="rank-list" style={{ marginTop: 8 }}>
            {result.top.map((r) => <RankRow key={r.profile} row={r} kb={kb} result={result} onWhy={why}
              note={t && r.profile === t.profile ? '← ngành mục tiêu' : null} />)}
          </ol>
          <Axis01 />
        </>
      ) : <p className="empty">Không có hồ sơ nào có EC ≥ 1 – không xếp hạng được.</p>}
      {result.tiesWithTop1.length > 0 && (
        <p className="small muted" style={{ marginTop: 6 }}>Hòa điểm với Top-1: {result.tiesWithTop1.join(', ')} – thứ tự theo luật phá hòa (hồ sơ đứng trước xếp trên).</p>
      )}
      {result.bestPriority && (
        <div className="best-note">
          <b>Ưu tiên tốt nhất:</b> {out.bestPriorityText?.text}
          <ol className="rank-list" style={{ marginTop: 6 }}><RankRow row={result.bestPriority} kb={kb} result={result} onWhy={why} /></ol>
        </div>
      )}
      {target && (
        <div style={{ marginTop: 10, borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
          <h3>Ngành mục tiêu: {target.major?.name_vi ?? target.text}</h3>
          {!target.major && <p className="small err">Không có trong 300 ngành – không chấm được (V_MAJOR).</p>}
          {t && !tInTop && <ol className="rank-list" style={{ marginTop: 6 }}><RankRow row={t} kb={kb} result={result} onWhy={why} note="← ngành mục tiêu" /></ol>}
          {out.target.explanation?.map((e) => <p key={e.code} className="small" style={{ marginTop: 4 }}>{e.text}</p>)}
        </div>
      )}
      <p className="small" style={{ marginTop: 8 }}><a href="#" onClick={(e) => { e.preventDefault(); onGo('l5'); }}>Xem đủ 35 hồ sơ (L5) →</a></p>
    </>
  );
}

// ---------------- (b) insight – mỗi câu suy ra trực tiếp từ số đã tính ----------------
export function buildInsights(out, kb, person) {
  const { result, stability, sig } = out;
  const top = result.top;
  const ins = [];
  if (top.length >= 2) {
    const d = top[0].C - top[1].C;
    ins.push({ layer: 'l5', text: d <= 1e-9 ? `${top[0].profile} và ${top[1].profile} hòa điểm (C = ${fmt(top[0].C)}).`
      : `${top[0].profile} dẫn trước ${top[1].profile} ${fmt(d)} điểm C${d < 0.05 ? ' – cách biệt nhỏ, nên xem cả hai' : ''}.` });
  }
  if (top[0]?.contrib) {
    const parts = [['α·NF* (thần số học)', top[0].contrib.NF], ['β·SR* (kỹ năng)', top[0].contrib.SR], ['γ·ENV* (môi trường)', top[0].contrib.ENV]];
    const [name, v] = parts.reduce((a, b) => (b[1] > a[1] ? b : a));
    ins.push({ layer: 'l1', profile: top[0].profile, text: `C của Top-1 đến chủ yếu từ ${name} = ${fmt(v)} / ${fmt(top[0].C)}.` });
  }
  // tín hiệu lặp lại giữa các nhóm
  const by = {};
  for (const g of result.groups) (by[sig.arch[g]] ??= []).push(g);
  const rep = Object.entries(by).filter(([, gs]) => gs.length >= 2).sort((a, b) => b[1].length - a[1].length);
  ins.push({ layer: 'l2', text: rep.length
    ? `Số ${rep[0][0]} xuất hiện ở ${rep[0][1].length} nhóm tín hiệu (${rep[0][1].map((g) => groupName(kb, g)).join(', ')}).`
    : `${result.groups.length} nhóm tín hiệu cho ${Object.keys(by).length} số khác nhau – tín hiệu phân tán, EC thường thấp.` });
  const weak = Object.entries(person.skillsNow).filter(([, r]) => r <= kb.params.Weak_max).map(([a, r]) => `${skillCode(a)} = ${r}`);
  if (weak.length) {
    const n = result.rows.filter((r) => r.label === LABELS.CHALLENGE).length;
    ins.push({ layer: 'whatif', text: `Kỹ năng tự đánh giá ≤ 2: ${weak.join(', ')} → ${n}/35 hồ sơ thành "Thử thách".` });
  }
  if (stability) {
    const changed = stability.runs.filter((r) => r.top1 !== stability.runs[0].top1).map((r) => `${r.name} → ${r.top1 ?? '–'}`);
    ins.push({ layer: 'l5', text: changed.length ? `Top-1 giữ ở ${stability.count}/5 cấu hình; đổi khi: ${changed.join('; ')}.` : 'Top-1 giữ nguyên ở cả 5 cấu hình Sensitivity – kết quả ổn định.' });
  }
  if (top[0]) ins.push({ layer: 'l3', profile: top[0].profile, text: `Top-1 trùng ${top[0].STR}/3 điểm mạnh tự khai (STR) và ${top[0].SAT}/3 tín hiệu nội tâm SU·G2·G6 (SAT) – chỉ để tham khảo, không vào C.` });
  const tr = out.target?.analysis?.row;
  if (tr) ins.push({ layer: 'l1', profile: tr.profile, text: tr.rank ? `Ngành mục tiêu thuộc ${tr.profile}: hạng ${tr.rank}/${result.ranked.length}, nhãn ${tr.label}.` : `Ngành mục tiêu thuộc ${tr.profile}: EC = 0 nên không được xếp hạng.` });
  return ins;
}

function LabelDistribution({ rows }) {
  const tip = useTip();
  const order = [LABELS.PRIORITY, LABELS.CONSIDER, LABELS.CHALLENGE, LABELS.NONE];
  const cls = { [LABELS.PRIORITY]: 'var(--good)', [LABELS.CONSIDER]: 'var(--warn)', [LABELS.CHALLENGE]: 'var(--bad)', [LABELS.NONE]: 'var(--ink-3)' };
  const max = Math.max(1, ...order.map((l) => rows.filter((r) => r.label === l).length));
  return (
    <div style={{ display: 'grid', gap: 4, marginTop: 10 }} aria-label="Phân bố nhãn của 35 hồ sơ">
      <h3 className="small" style={{ fontWeight: 700 }}>Phân bố nhãn – 35 hồ sơ</h3>
      {order.map((l) => {
        const n = rows.filter((r) => r.label === l).length;
        return (
          <div key={l} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 26px', gap: 6, alignItems: 'center', fontSize: '0.8rem' }}>
            <span>{l}</span>
            <div style={{ height: 12 }} tabIndex={0} {...tip(`${l}: ${n}/35 hồ sơ – ${rows.filter((r) => r.label === l).map((r) => r.profile).join(', ') || 'không có'}`)}>
              {n > 0 && <div style={{ width: `${(n / max) * 100}%`, height: '100%', background: cls[l], borderRadius: '0 4px 4px 0' }} />}
            </div>
            <span className="num" style={{ textAlign: 'right' }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Insights({ out, kb, person, onGo }) {
  const items = buildInsights(out, kb, person);
  return (
    <>
      <div className="panel-head"><h2>Insight</h2><span className="zone-tag">khu vực b</span></div>
      <ul className="insights">
        {items.map((x, i) => (
          <li key={i}>{x.text} <a href="#" className="small" onClick={(e) => { e.preventDefault(); onGo(x.layer, x.profile); }}>
            {x.layer === 'whatif' ? 'thử What-if' : `xem ${x.layer.toUpperCase()}`}</a></li>
        ))}
      </ul>
      <LabelDistribution rows={out.result.rows} />
    </>
  );
}

// ---------------- L0 ----------------
export default function Dashboard({ out, base, kb, person, onGo, whatif }) {
  const r = out.result;
  return (
    <div className="l0">
      <section className="panel zone-kpi" aria-labelledby="z-a">
        <div className="panel-head">
          <h2 id="z-a">Chỉ số chính & cảnh báo</h2>
          <span className="small muted">
            Persona {PERSONA_NAME[r.persona]} · bộ trọng số {out.options.weights ? 'tự chỉnh' : out.options.wset} · α/β/γ = {r.weights.map((x) => fmt(x)).join(' / ')}
            {r.normalize ? ' · chuẩn hóa min–max' : ' · không chuẩn hóa'} · môi trường mong muốn: {envName(kb, r.env)}
          </span>
        </div>
        <KpiStrip kpis={out.kpis} onGo={onGo} />
        <Warnings warnings={out.warnings} />
        {base && base.result.top[0]?.profile !== r.top[0]?.profile && (
          <p className="small" style={{ marginTop: 6 }}><b>What-if đang bật:</b> Top-1 đổi {base.result.top[0]?.profile ?? '–'} → {r.top[0]?.profile ?? '–'} (C {signed((r.top[0]?.C ?? 0) - (base.result.top[0]?.C ?? 0))}).</p>
        )}
      </section>
      <section className="panel zone-rank" aria-label="Xếp hạng"><Ranking out={out} kb={kb} onGo={onGo} /></section>
      <section className="panel zone-insight" aria-label="Insight"><Insights out={out} kb={kb} person={person} onGo={onGo} /></section>
      <section className="panel zone-whatif" aria-labelledby="z-d" id="whatif"><WhatIf {...whatif} kb={kb} out={out} base={base} /></section>
    </div>
  );
}
