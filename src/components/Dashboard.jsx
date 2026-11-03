// L0 – câu trả lời cho người ra quyết định: ngành phù hợp nhất (+ % + 1 dòng nhận xét = khu vực insight)
// · ngành phù hợp khác (xếp hạng Top-4) · 3 chỉ số + cảnh báo · Thử thay đổi (What-if). Công thức/ký hiệu nằm ở L1–L7 ("Vì sao?").
import { skillName } from '../format.js';
import { Status, LabelChip, Warnings } from './common.jsx';
import WhatIf from './WhatIf.jsx';
import { t, tr } from '../i18n.js';
import { pct, repMajor, insightLine, nextStepPlain, stabWord } from '../plain.js';

const link = (fn) => (e) => { e.preventDefault(); fn(); };
const PCT_NOTE = () => tr('so với các ngành khác của bạn', 'compared with your other majors');
const PCT_TIP = () => tr('Mức phù hợp tương đối: chỉ so sánh các ngành của chính bạn, không phải xác suất thành công.', 'Relative fit: only compares your own majors – not a probability of success.');

function WhyBtn({ onClick }) {
  return <button type="button" className="why-btn" onClick={onClick}>{t('Vì sao?')}</button>;
}

function TopCard({ out, kb, onGo }) {
  const { result } = out;
  const top = result.top[0];
  if (!top) return <section className="panel answer"><p className="empty">{tr('Chưa tìm được ngành phù hợp: không con số nào của bạn trùng với nhóm ngành nào.', 'No match yet: none of your numbers match any major group.')}</p></section>;
  const m = repMajor(kb, top.profile, result.env);
  const tie = result.tiesWithTop1.length > 0;
  const best = result.bestPriority;
  return (
    <section className="panel answer" aria-labelledby="z-top">
      <div className="answer-main">
        <span className="eyebrow">{tr('Ngành phù hợp nhất', 'Best-fit major')}</span>
        <h2 id="z-top">{m.name}</h2>
        <div className="answer-meta">
          <LabelChip label={top.label} />
          {m.more > 0 && <span className="muted small">+{m.more} {tr('ngành cùng nhóm', 'more in this group')}</span>}
        </div>
        <p className="answer-why">{insightLine(top, result, kb)}</p>
        {tie && <p className="small muted">{tr(`Ngang điểm với ${result.tiesWithTop1.map((p) => repMajor(kb, p, result.env).name).join(', ')}.`, `Tied with ${result.tiesWithTop1.map((p) => repMajor(kb, p, result.env).name).join(', ')}.`)}</p>}
        {best && <p className="best-note">{tr('Lựa chọn "Ưu tiên" tốt nhất', 'Best "Priority" option')}: <b>{repMajor(kb, best.profile, result.env).name}</b> ({pct(best.C)}) <a href="#" onClick={link(() => onGo('l1', best.profile))}>{t('Vì sao?')}</a></p>}
      </div>
      <div className="answer-pct" title={PCT_TIP()}>
        <span className="big-pct num">{pct(top.C)}</span>
        <span className="pct-note">{PCT_NOTE()}</span>
        <WhyBtn onClick={() => onGo('l1', top.profile)} />
      </div>
    </section>
  );
}

function MajorRow({ row, kb, env, onGo, note }) {
  const m = repMajor(kb, row.profile, env);
  return (
    <li className="mrow">
      <span className="mrow-name">{m.name}{m.more > 0 && <span className="muted small"> +{m.more}</span>}{note && <span className="small muted"> · {note}</span>}</span>
      <span className="mrow-bar" title={PCT_TIP()}><span style={{ width: `${Math.max(0, Math.min(1, row.C ?? 0)) * 100}%` }} /></span>
      <b className="num mrow-pct">{row.EC >= 1 ? pct(row.C) : '—'}</b>
      <LabelChip label={row.label} />
      <WhyBtn onClick={() => onGo('l1', row.profile)} />
    </li>
  );
}

export function OtherMajors({ out, kb, onGo }) {
  const { result, target } = out;
  const env = result.env;
  const ranked = result.rows.filter((r) => r.rank).sort((a, b) => a.rank - b.rank);
  const rest = ranked.slice(1, 4);
  const tg = target?.analysis?.row;
  const step = tg && nextStepPlain(tg, result, kb);
  return (
    <>
      <div className="panel-head"><h2>{tr('Ngành phù hợp khác', 'Other good fits')}</h2>
        <a href="#" className="small" onClick={link(() => onGo('l5'))}>{tr('Xem bảng xếp hạng →', 'See full ranking →')}</a></div>
      {rest.length ? <ol className="mlist">{rest.map((r) => <MajorRow key={r.profile} row={r} kb={kb} env={env} onGo={onGo} />)}</ol>
        : <p className="small muted">{tr('Không có ngành nào khác được xếp hạng.', 'No other majors are ranked.')}</p>}
      {target && (
        <div className="target-box">
          <h3>{tr('Ngành bạn đang nhắm', 'Your target major')}: {target.major?.name_vi ?? target.text}</h3>
          {!target.major && <p className="small err">{tr('Ngành này không có trong danh sách 300 ngành nên không chấm được.', 'This major is not in the 300-major list, so it cannot be scored.')}</p>}
          {tg && <ol className="mlist"><MajorRow row={tg} kb={kb} env={env} onGo={onGo} note={tg.rank ? `${tr('hạng', 'rank')} ${tg.rank}` : tr('không xếp hạng', 'not ranked')} /></ol>}
          {step && <p className="small">→ {tr('Muốn đạt "Ưu tiên"', 'To reach "Priority"')}: {step}.</p>}
        </div>
      )}
    </>
  );
}

function Indicators({ out, kb, onGo }) {
  const K = Object.fromEntries(out.kpis.map((k) => [k.code, k]));
  const stab = K.K_STAB, weak = K.K_WEAK, adm = K.K_ADMIT;
  const weakRow = out.result.rows.find((r) => r.profile === weak?.profile);
  const items = [
    { code: 'K_STAB', name: tr('Độ ổn định kết quả', 'Result stability'), layer: 'l5', level: stab?.level,
      val: stab?.value == null ? '–' : stabWord(stab.value), tip: tr(`${stab?.value ?? '–'}/5 cách tính cho cùng ngành phù hợp nhất`, `${stab?.value ?? '–'}/5 methods give the same best fit`) },
    { code: 'K_WEAK', name: tr('Kỹ năng cần cải thiện', 'Skills to improve'), layer: 'whatif', level: weak?.level,
      val: weakRow?.weakList.length ? weakRow.weakList.map((w) => skillName(kb, w.archetype)).join(', ') : tr('Không có', 'None'),
      tip: tr('Kỹ năng liên quan tới ngành phù hợp nhất mà bạn tự chấm từ 2/5 trở xuống', 'Related skills you rated 2/5 or lower') },
    { code: 'K_ADMIT', name: tr('Khả năng đỗ', 'Admission chance'), layer: 'l7', level: adm?.level,
      val: adm?.value ? t(adm.value) : tr('Chưa chọn ngành', 'No target yet'), tip: tr('Chỉ có dữ liệu cho 18 ngành của ĐH Công nghiệp Hà Nội', 'Only available for 18 HaUI majors') },
  ];
  return (
    <div className="kpis">
      {items.map((k) => (
        <button key={k.code} type="button" className={`kpi ${k.level ?? 'grey'}`} onClick={() => onGo(k.layer, weak?.profile)} title={k.tip}>
          <span className="k-name">{k.name}</span>
          <span className="k-val">{k.val}</span>
          <Status level={k.level ?? 'grey'} />
        </button>
      ))}
    </div>
  );
}

export default function Dashboard({ out, base, kb, onGo, whatif }) {
  const r = out.result;
  const env = r.env;
  const moved = base && base.result.top[0]?.profile !== r.top[0]?.profile;
  return (
    <div className="l0">
      <div className="l0-main">
        {moved && (
          <p className="whatif-on" role="status">{tr('Đang thử thay đổi', 'Trying changes')}: {tr('ngành phù hợp nhất đổi từ', 'best fit changes from')} <b>{base.result.top[0] ? repMajor(kb, base.result.top[0].profile, base.result.env).name : '–'}</b> → <b>{r.top[0] ? repMajor(kb, r.top[0].profile, env).name : '–'}</b>.</p>
        )}
        <TopCard out={out} kb={kb} onGo={onGo} />
        <section className="panel" aria-label={tr('Ngành phù hợp khác', 'Other good fits')}><OtherMajors out={out} kb={kb} onGo={onGo} /></section>
        <section className="zone-kpi" aria-label={t('Chỉ số chính & cảnh báo')}>
          <Indicators out={out} kb={kb} onGo={onGo} />
          <Warnings warnings={out.warnings} />
        </section>
      </div>
      <section className="panel zone-whatif" aria-labelledby="z-d" id="whatif"><WhatIf {...whatif} kb={kb} out={out} base={base} /></section>
    </div>
  );
}
