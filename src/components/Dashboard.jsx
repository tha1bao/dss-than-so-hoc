// L0 – một câu trả lời trước, chi tiết sau: thẻ Top-1 (+ Vì sao? + bước cải thiện) · (a) 4 KPI + cảnh báo
// · (c) lựa chọn khác · (b) 3 insight · (d) What-if. Mọi câu chữ lấy từ mẫu câu tri thức hoặc số engine đã tính.
import { LABELS, skillCode, targetAnalysis } from '../../shared/engine/index.js';
import { explainProfile } from '../../shared/engine/view.js';
import { fmt, signed, profileMajors } from '../format.js';
import { Status, LabelChip, Warnings, ContribBar, ContribLegend, useTip } from './common.jsx';
import WhatIf from './WhatIf.jsx';
import { t, tr, num } from '../i18n.js';

const link = (fn) => (e) => { e.preventDefault(); fn(); };

// ---------------- (a) KPI – 4 ô, chi tiết trong tooltip ----------------
const KPI_META = {
  K_EC: ['Tín hiệu khớp (EC)', 'l2', (k) => (k.value == null ? '–' : `${k.value}/5`), () => t('xanh ≥ 2 · vàng 1 · đỏ 0')],
  K_WEAK: ['Kỹ năng yếu (≤ 2)', 'whatif', (k) => k.value ?? '–', (k) => (k.skills?.length ? k.skills.join(', ') : t('không có'))],
  K_STAB: ['Độ ổn định Top-1', 'l5', (k) => (k.value == null ? '–' : `${k.value}/5`), () => t('qua 5 cấu hình Sensitivity')],
  K_ADMIT: ['Khả năng đỗ', 'l7', (k) => (k.value ? t(k.value) : '–'),
    (k) => (k.detail ? `${k.detail.combo} ${fmt(k.detail.score, 2)} vs ${tr('ĐC', 'cut-off')} ${fmt(k.detail.cutoff, 2)}` : k.value ? t('chỉ 18 ngành HaUI') : t('chưa chọn ngành mục tiêu'))],
};

export function KpiStrip({ kpis, onGo }) {
  const sr = kpis.find((k) => k.code === 'K_SR');
  return (
    <div className="kpis">
      {kpis.filter((k) => KPI_META[k.code]).map((k) => {
        const [name, layer, val, sub] = KPI_META[k.code];
        const extra = k.code === 'K_WEAK' && sr ? ` · SR ${fmt(sr.value)} (${tr('ngưỡng', 'threshold')} ${fmt(0.625)})` : '';
        return (
          <button key={k.code} type="button" className={`kpi ${k.level}`} onClick={() => onGo(layer, k.profile)} title={`${sub(k)}${extra}`}>
            <span className="k-name">{t(name)}</span>
            <span className={`k-val num ${/[^\d/–\s]/.test(String(val(k))) ? 'txt' : ''}`}>{val(k)}</span>
            <Status level={k.level} />
          </button>
        );
      })}
    </div>
  );
}

// ---------------- thẻ câu trả lời (Top-1) ----------------
/** Câu "làm gì để lên Ưu tiên" – từ Bước 5 (targetAnalysis) áp cho Top-1. */
function nextStep(row, result, kb) {
  if (!row || row.label === LABELS.PRIORITY) return null;
  const ta = targetAnalysis(result, row.profile, { ...kb.params, p: result.p });
  if (!ta) return null;
  if (ta.status === 'EC_LOW') return tr(`EC = ${row.EC} < 2 nên hồ sơ này tối đa là Cân nhắc, dù tăng kỹ năng.`, `EC = ${row.EC} < 2, so this profile stays at Consider at most, even with higher skills.`);
  const parts = [];
  if (row.weakList.length) parts.push(tr(`nâng ${row.weakList.map((w) => `${w.skill} từ ${w.level} lên 3`).join(', ')}`, `raise ${row.weakList.map((w) => `${w.skill} from ${w.level} to 3`).join(', ')}`));
  if (ta.gap > 1e-9) parts.push(tr(`thêm ${ta.stepsMain} bậc ở ${skillCode(row.A[0])} (SR còn thiếu ${fmt(ta.gap, 1)} điểm)`, `add ${ta.stepsMain} level(s) to ${skillCode(row.A[0])} (SR is ${fmt(ta.gap, 1)} points short)`));
  return parts.length ? `${tr('Để lên Ưu tiên', 'To reach Priority')}: ${parts.join(tr(' và ', ' and '))}.` : null;
}

function AnswerCard({ out, kb, onGo }) {
  const { result } = out;
  const top = result.top[0];
  if (!top) return <section className="panel answer"><p className="empty">{t('Không có hồ sơ nào có EC ≥ 1 – không xếp hạng được.')}</p></section>;
  const why = explainProfile(out, kb, top.profile).filter((s) => s.code === 'WHY_NF' || s.code.startsWith('LABEL_'));
  const step = nextStep(top, result, kb);
  const tie = result.tiesWithTop1.length > 0;
  return (
    <section className="panel answer" aria-labelledby="z-top">
      <span className="eyebrow">{t('Gợi ý phù hợp nhất')}</span>
      <div className="answer-head">
        <h2 id="z-top">{top.profile}</h2>
        <LabelChip label={top.label} />
        <span className="answer-majors">{profileMajors(kb, top.profile, 3).join(' · ')}</span>
      </div>
      <p className="answer-why">{why.map((s) => num(s.text)).join(' ')}</p>
      <div className="answer-bar">
        <ContribBar row={top} weights={result.weights} normalize={result.normalize} />
        <button type="button" className="c-val num" onClick={() => onGo('l1', top.profile)} title={t('Vì sao? (L1)')}>
          {fmt(top.C)}<br /><span className="small">{t('Vì sao?')}</span>
        </button>
      </div>
      <ContribLegend />
      <p className="small muted">{t('C = mức tương hợp tương đối, chỉ so sánh trong cùng một học sinh.')}{tie ? ` ${tr('Hòa điểm với', 'Tied with')} ${result.tiesWithTop1.join(', ')} – ${tr('xếp theo luật phá hòa.', 'ordered by the tie-break rule.')}` : ''}</p>
      {step && <p className="answer-step"><b>→</b> {step} <a href="#" onClick={link(() => onGo('whatif'))}>{t('Thử ngay')}</a></p>}
      {result.bestPriority && (
        <p className="best-note"><b>{t('Ưu tiên tốt nhất:')}</b> {num(out.bestPriorityText?.text)} <a href="#" onClick={link(() => onGo('l1', result.bestPriority.profile))}>{t('Vì sao?')}</a></p>
      )}
    </section>
  );
}

// ---------------- (c) lựa chọn khác + ngành mục tiêu ----------------
function AltRow({ row, kb, result, onGo, note }) {
  return (
    <li className="alt-row">
      <span className="rank-no num">{row.rank ?? '–'}</span>
      <span className="alt-main"><b>{row.profile}</b> <span className="muted small">{profileMajors(kb, row.profile, 2).join(' · ')}</span>{note && <span className="small"> {note}</span>}</span>
      <LabelChip label={row.label} />
      <ContribBar row={row} weights={result.weights} normalize={result.normalize} />
      <button type="button" className="c-val num" onClick={() => onGo('l1', row.profile)} title={t('Vì sao? (L1)')}>
        {row.EC >= 1 ? fmt(row.C) : '—'}<br /><span className="small">{t('Vì sao?')}</span>
      </button>
    </li>
  );
}

export function Alternatives({ out, kb, onGo }) {
  const { result, target } = out;
  const tg = target?.analysis?.row;
  const rest = result.top.slice(1);
  const tgNote = t('← ngành mục tiêu');
  return (
    <>
      <div className="panel-head"><h2>{t('Lựa chọn khác')}</h2>
        <a href="#" className="small" onClick={link(() => onGo('l5'))}>{t('Xem đủ 35 hồ sơ (L5) →')}</a></div>
      {rest.length ? (
        <ol className="alt-list">{rest.map((r) => <AltRow key={r.profile} row={r} kb={kb} result={result} onGo={onGo} note={tg && r.profile === tg.profile ? tgNote : null} />)}</ol>
      ) : <p className="small muted">{t('Chỉ có 1 hồ sơ được xếp hạng.')}</p>}
      {target && (
        <div className="target-box">
          <h3>{t('Ngành mục tiêu')}: {target.major?.name_vi ?? target.text}</h3>
          {!target.major && <p className="small err">{t('Không có trong 300 ngành – không chấm được (V_MAJOR).')}</p>}
          {tg && result.top[0]?.profile !== tg.profile && !rest.some((r) => r.profile === tg.profile) && (
            <ol className="alt-list"><AltRow row={tg} kb={kb} result={result} onGo={onGo} note={tgNote} /></ol>
          )}
          {target.explanation?.map((e) => <p key={e.code} className="small">{num(e.text)}</p>)}
        </div>
      )}
    </>
  );
}

// ---------------- (b) insight – mỗi câu suy ra trực tiếp từ số đã tính; L0 chỉ hiện 3 câu giá trị nhất ----------------
export function buildInsights(out, kb, person) {
  const { result, stability } = out;
  const top = result.top;
  const ins = [];
  if (top.length >= 2) {
    const d = top[0].C - top[1].C;
    if (d > 1e-9) ins.push({ key: 'gap', layer: 'l5', text: tr(`${top[0].profile} dẫn trước ${top[1].profile} ${fmt(d)} điểm C${d < 0.05 ? ' – cách biệt nhỏ, nên xem cả hai' : ''}.`, `${top[0].profile} leads ${top[1].profile} by ${fmt(d)} C points${d < 0.05 ? ' – a small gap, consider both' : ''}.`) });
  }
  if (top[0]?.contrib) {
    const parts = [[tr('thần số học (α·NF*)', 'numerology (α·NF*)'), top[0].contrib.NF], [tr('kỹ năng (β·SR*)', 'skills (β·SR*)'), top[0].contrib.SR], [tr('môi trường (γ·ENV*)', 'environment (γ·ENV*)'), top[0].contrib.ENV]];
    const [name, v] = parts.reduce((a, b) => (b[1] > a[1] ? b : a));
    ins.push({ key: 'contrib', layer: 'l1', profile: top[0].profile, text: tr(`Kết quả Top-1 đến chủ yếu từ ${name} = ${fmt(v)} / ${fmt(top[0].C)}.`, `Top-1 comes mainly from ${name} = ${fmt(v)} / ${fmt(top[0].C)}.`) });
  }
  if (stability) {
    const changed = stability.runs.filter((r) => r.top1 !== stability.runs[0].top1).map((r) => `${r.name} → ${r.top1 ?? '–'}`);
    ins.push({ key: 'stab', layer: 'l5', text: changed.length ? tr(`Top-1 giữ ở ${stability.count}/5 cấu hình; đổi khi: ${changed.join('; ')}.`, `Top-1 holds in ${stability.count}/5 configurations; changes under: ${changed.join('; ')}.`) : tr('Top-1 giữ nguyên ở cả 5 cấu hình – kết quả ổn định.', 'Top-1 is the same in all 5 configurations – a stable result.') });
  }
  const weak = Object.entries(person.skillsNow).filter(([, r]) => r <= kb.params.Weak_max).map(([a, r]) => `${skillCode(a)} = ${r}`);
  if (weak.length) {
    const n = result.rows.filter((r) => r.label === LABELS.CHALLENGE).length;
    ins.push({ key: 'weak', layer: 'whatif', text: tr(`Kỹ năng ≤ 2 (${weak.join(', ')}) làm ${n}/35 hồ sơ thành "Thử thách".`, `Skills ≤ 2 (${weak.join(', ')}) make ${n}/35 profiles "Challenge".`) });
  }
  const pri = result.rows.filter((r) => r.label === LABELS.PRIORITY).length;
  ins.push({ key: 'labels', layer: 'l5', text: tr(`${pri}/35 hồ sơ đạt Ưu tiên, ${result.ranked.length}/35 có EC ≥ 1.`, `${pri}/35 profiles reach Priority, ${result.ranked.length}/35 have EC ≥ 1.`) });
  return ins;
}

export function Insights({ out, kb, person, onGo, max = 3 }) {
  const items = buildInsights(out, kb, person).slice(0, max);
  return (
    <>
      <div className="panel-head"><h2>{t('Nhận định')}</h2></div>
      <ul className="insights">
        {items.map((x) => (
          <li key={x.key}>{x.text} <a href="#" className="small" onClick={link(() => onGo(x.layer, x.profile))}>{x.layer === 'whatif' ? t('thử What-if') : '→'}</a></li>
        ))}
      </ul>
    </>
  );
}

/** Phân bố nhãn 35 hồ sơ (thanh ngang) – hiển thị ở L5. */
export function LabelDistribution({ rows }) {
  const tip = useTip();
  const order = [LABELS.PRIORITY, LABELS.CONSIDER, LABELS.CHALLENGE, LABELS.NONE];
  const cls = { [LABELS.PRIORITY]: 'var(--good)', [LABELS.CONSIDER]: 'var(--warn)', [LABELS.CHALLENGE]: 'var(--bad)', [LABELS.NONE]: 'var(--ink-3)' };
  const max = Math.max(1, ...order.map((l) => rows.filter((r) => r.label === l).length));
  return (
    <div style={{ display: 'grid', gap: 4 }} aria-label={t('Phân bố nhãn của 35 hồ sơ')}>
      {order.map((l) => {
        const n = rows.filter((r) => r.label === l).length;
        return (
          <div key={l} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 26px', gap: 6, alignItems: 'center', fontSize: '0.8rem' }}>
            <span>{t(l)}</span>
            <div style={{ height: 12 }} tabIndex={0} {...tip(`${t(l)}: ${n}/35 ${tr('hồ sơ', 'profiles')} – ${rows.filter((r) => r.label === l).map((r) => r.profile).join(', ') || t('không có')}`)}>
              {n > 0 && <div style={{ width: `${(n / max) * 100}%`, height: '100%', background: cls[l], borderRadius: '0 4px 4px 0' }} />}
            </div>
            <span className="num" style={{ textAlign: 'right' }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- L0 ----------------
export default function Dashboard({ out, base, kb, person, onGo, whatif }) {
  const r = out.result;
  const moved = base && base.result.top[0]?.profile !== r.top[0]?.profile;
  return (
    <div className="l0">
      <div className="l0-main">
        {moved && (
          <p className="whatif-on" role="status"><b>{t('What-if đang bật:')}</b> Top-1 {tr('đổi', 'changes')} {base.result.top[0]?.profile ?? '–'} → {r.top[0]?.profile ?? '–'} (C {signed((r.top[0]?.C ?? 0) - (base.result.top[0]?.C ?? 0))}).</p>
        )}
        <AnswerCard out={out} kb={kb} onGo={onGo} />
        <section className="zone-kpi" aria-label={t('Chỉ số chính & cảnh báo')}>
          <KpiStrip kpis={out.kpis} onGo={onGo} />
          <Warnings warnings={out.warnings} />
        </section>
        <section className="panel" aria-label={t('Lựa chọn khác')}><Alternatives out={out} kb={kb} onGo={onGo} /></section>
        <section className="panel" aria-label={t('Nhận định')}><Insights out={out} kb={kb} person={person} onGo={onGo} /></section>
      </div>
      <section className="panel zone-whatif" aria-labelledby="z-d" id="whatif"><WhatIf {...whatif} kb={kb} out={out} base={base} /></section>
    </div>
  );
}
