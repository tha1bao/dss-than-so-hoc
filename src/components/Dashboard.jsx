// L0 – câu trả lời cho người ra quyết định: ngành phù hợp nhất (+ % + 1 dòng nhận xét = khu vực insight)
// · ngành phù hợp khác (xếp hạng Top-4) · 3 chỉ số + cảnh báo · Thử thay đổi (What-if).
import { useState, useMemo } from 'react';
import { skillName, fmt, envName } from '../format.js';
import { Status, LabelChip, Warnings } from './common.jsx';
import WhatIf from './WhatIf.jsx';
import { t, tr } from '../i18n.js';
import { pct, repMajor, insightLine, nextStepPlain, stabWord, avgSkill, SKILL_NEED } from '../plain.js';
import { admissionChance } from '../../shared/engine/kpi.js';

const link = (fn) => (e) => { e.preventDefault(); fn(); };
const PCT_NOTE = () => tr('so với các ngành khác của bạn', 'compared with your other majors');
const PCT_TIP = () => tr('Mức phù hợp tương đối: chỉ so sánh các ngành của chính bạn, không phải xác suất thành công.', 'Relative fit: only compares your own majors – not a probability of success.');

function WhyBtn({ onClick }) {
  return <button type="button" className="why-btn" onClick={onClick}>{t('Vì sao?')}</button>;
}

/** Ngăn kéo giải thích nhanh (Drawer) – không bị văng trang khi bấm "Vì sao?" */
function WhyDrawer({ out, kb, profile, base0, onClose, onSwitchProfile }) {
  const { result, target } = out;
  const row = result.rows.find((r) => r.profile === profile) ?? result.top[0];
  if (!row) return null;
  const m = repMajor(kb, row.profile, result.env);
  const nOn = result.groups.length;
  const step = nextStepPlain(row, result, kb);
  const targetMajor = target?.major;
  const targetProfile = targetMajor ? (targetMajor.profile_id ?? targetMajor.profile) : null;

  return (
    <div className="drawer-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Giải thích vì sao">
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">{tr('Giải thích nhanh', 'Quick explanation')}</span>
            <h3>{m.name} <LabelChip label={row.label} /></h3>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {targetMajor && targetProfile !== row.profile && (
          <div className="drawer-target-banner">
            <span className="small">{tr('Ngành bạn đang nhắm:', 'Your target major:')} <b>{targetMajor.name_vi}</b></span>
            <button type="button" className="btn small" onClick={() => onSwitchProfile(targetProfile)}>
              🎯 {tr('Xem giải thích ngành này', 'View this major')}
            </button>
          </div>
        )}

        <div className="drawer-body">
          <div className="drawer-pct-box">
            <span className="big-pct num">{row.EC >= 1 ? pct(row.C) : '—'}</span>
            <span className="small muted">{row.rank ? `${tr('Xếp hạng', 'Rank')} #${row.rank}` : tr('Không xếp hạng', 'Unranked')}</span>
          </div>

          <div className="drawer-section">
            <h4>{tr('3 Yếu tố đóng góp vào điểm số:', '3 Factors contributing to score:')}</h4>
            <div className="factor-row">
              <span className="factor-label">{tr('Con số thần số học', 'Numerology numbers')}:</span>
              <span className="factor-desc">
                <b>{row.EC}/{nOn}</b> {row.EC >= 1 ? tr('con số trùng khớp tính cách ngành', 'matching traits') : tr('không có con số trùng', 'no match')}
              </span>
            </div>
            <div className="factor-row">
              <span className="factor-label">{tr('Kỹ năng tự đánh giá', 'Self-rated skills')}:</span>
              <span className="factor-desc">
                <b>{fmt(avgSkill(row.SR), 1)}/5</b> ({tr('mức chuẩn cần', 'required bar')}: {fmt(SKILL_NEED(kb), 1)}/5)
              </span>
            </div>
            <div className="factor-row">
              <span className="factor-label">{tr('Môi trường làm việc', 'Working environment')}:</span>
              <span className="factor-desc">
                {row.ENV ? <span className="ok">{tr('✓ Đúng môi trường bạn mong muốn', '✓ Fits your chosen environment')} ({envName(kb, result.env)})</span>
                  : <span className="muted">{tr('Khác môi trường bạn chọn', 'Differs from your choice')} ({envName(kb, row.env)})</span>}
              </span>
            </div>
          </div>

          {row.weakList.length > 0 && (
            <div className="drawer-section alert-weak">
              <b>{tr('Kỹ năng cần bổ trợ thêm:', 'Skills needing improvement:')}</b>
              <p className="small">{row.weakList.map((w) => `${skillName(kb, w.archetype)} (${w.level}/5)`).join(', ')}</p>
            </div>
          )}

          {step && (
            <div className="drawer-section">
              <b>{tr('Để nâng lên mức "Ưu tiên":', 'To reach "Priority":')}</b>
              <p className="small">→ {step}</p>
            </div>
          )}

          <div className="drawer-foot">
            <a
              href={`#${base0}/l1?p=${row.profile}`}
              className="btn small primary"
              style={{ textAlign: 'center', textDecoration: 'none' }}
              onClick={onClose}
            >
              {tr('Mở toàn màn hình xem chi tiết (Tab L1–L7) ↗', 'Open full detailed view (Tab L1–L7) ↗')}
            </a>
            <button type="button" className="btn small ghost" onClick={onClose}>
              {tr('✕ Đóng để tiếp tục thử What-if', '✕ Close to continue What-if')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopCard({ out, base, kb, base0, onOpenWhy }) {
  const { result } = out;
  const top = result.top[0];
  if (!top) return <section className="panel answer"><p className="empty">{tr('Chưa tìm được ngành phù hợp: không con số nào của bạn trùng với nhóm ngành nào.', 'No match yet: none of your numbers match any major group.')}</p></section>;
  const m = repMajor(kb, top.profile, result.env);
  const tie = result.tiesWithTop1.length > 0;
  const best = result.bestPriority;

  const baseTop = base?.result.top[0];
  const cDiff = baseTop ? Math.round((top.C - baseTop.C) * 100) : 0;

  return (
    <section className={`panel answer ${cDiff > 0 ? 'pulse-up' : cDiff < 0 ? 'pulse-down' : ''}`} aria-labelledby="z-top">
      <div className="answer-main">
        <span className="eyebrow">{tr('Ngành phù hợp nhất', 'Best-fit major')}</span>
        <h2 id="z-top">{m.name}</h2>
        <div className="answer-meta">
          <LabelChip label={top.label} />
          {m.more > 0 && <span className="muted small">+{m.more} {tr('ngành cùng nhóm', 'more in this group')}</span>}
          {cDiff !== 0 && (
            <span className={`delta-badge ${cDiff > 0 ? 'up' : 'down'}`}>
              {cDiff > 0 ? `▲ +${cDiff}%` : `▼ ${cDiff}%`}
            </span>
          )}
        </div>
        <p className="answer-why">{insightLine(top, result, kb)}</p>
        {tie && <p className="small muted">{tr(`Ngang điểm với ${result.tiesWithTop1.map((p) => repMajor(kb, p, result.env).name).join(', ')}.`, `Tied with ${result.tiesWithTop1.map((p) => repMajor(kb, p, result.env).name).join(', ')}.`)}</p>}
        {best && <p className="best-note">{tr('Lựa chọn "Ưu tiên" tốt nhất', 'Best "Priority" option')}: <b>{repMajor(kb, best.profile, result.env).name}</b> ({pct(best.C)}) <button type="button" className="btn ghost small" onClick={() => onOpenWhy(best.profile)}>{t('Vì sao?')}</button></p>}
      </div>
      <div className="answer-pct" title={PCT_TIP()}>
        <span className="big-pct num">{pct(top.C)}</span>
        <span className="pct-note">{PCT_NOTE()}</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <WhyBtn onClick={() => onOpenWhy(top.profile)} />
          <a href={`#${base0}/l1?p=${top.profile}`} className="small muted" style={{ fontSize: '0.74rem' }}>{tr('Xem chi tiết L1–L7 ↗', 'Full details ↗')}</a>
        </div>
      </div>
    </section>
  );
}

function MajorRow({ row, baseRow, kb, env, onOpenWhy, note }) {
  const m = repMajor(kb, row.profile, env);
  const cDiff = baseRow ? Math.round(((row.C ?? 0) - (baseRow.C ?? 0)) * 100) : 0;
  return (
    <li className={`mrow ${cDiff > 0 ? 'pulse-up' : cDiff < 0 ? 'pulse-down' : ''}`}>
      <span className="mrow-name">
        {m.name}
        {m.more > 0 && <span className="muted small"> +{m.more}</span>}
        {note && <span className="small muted"> · {note}</span>}
      </span>
      <span className="mrow-bar" title={PCT_TIP()}><span style={{ width: `${Math.max(0, Math.min(1, row.C ?? 0)) * 100}%` }} /></span>
      <b className="num mrow-pct">
        {row.EC >= 1 ? pct(row.C) : '—'}
        {cDiff !== 0 && <span className={`delta-badge-inline ${cDiff > 0 ? 'up' : 'down'}`}>{cDiff > 0 ? `+${cDiff}%` : `${cDiff}%`}</span>}
      </b>
      <LabelChip label={row.label} />
      <WhyBtn onClick={() => onOpenWhy(row.profile)} />
    </li>
  );
}

export function OtherMajors({ out, base, kb, base0, onOpenWhy, onGo, onSetTarget }) {
  const { result, target } = out;
  const env = result.env;
  const ranked = result.rows.filter((r) => r.rank).sort((a, b) => a.rank - b.rank);
  const rest = ranked.slice(1, 4);
  const tg = target?.analysis?.row;
  const step = tg && nextStepPlain(tg, result, kb);
  const top1MajorName = repMajor(kb, result.top[0]?.profile, env).name;

  return (
    <>
      <div className="panel-head">
        <h2>{tr('Ngành phù hợp khác', 'Other good fits')}</h2>
        <a href={`#${base0}/l5`} className="small">{tr('Xem bảng xếp hạng đầy đủ (L5) →', 'See full ranking (L5) →')}</a>
      </div>
      {rest.length ? (
        <ol className="mlist">
          {rest.map((r) => {
            const baseRow = base?.result?.rows?.find((br) => br.profile === r.profile);
            return <MajorRow key={r.profile} row={r} baseRow={baseRow} kb={kb} env={env} onOpenWhy={onOpenWhy} />;
          })}
        </ol>
      ) : (
        <p className="small muted">{tr('Không có ngành nào khác được xếp hạng.', 'No other majors are ranked.')}</p>
      )}

      {/* Khối ngành mục tiêu (Chuyên ngành mong muốn) */}
      <div className="target-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <h3>{tr('Ngành bạn đang nhắm', 'Your target major')}: {target?.major?.name_vi ?? target?.text ?? tr('Chưa đặt mục tiêu', 'None set')}</h3>
          {!target?.text && (
            <button type="button" className="btn small primary" onClick={() => onSetTarget(top1MajorName)}>
              {tr(`🎯 Đặt Top 1 "${top1MajorName}" làm chuyên ngành mong muốn`, `🎯 Set Top 1 "${top1MajorName}" as target`)}
            </button>
          )}
        </div>

        {target && !target.major && (
          <p className="small err">{tr('Ngành này không có trong danh sách 300 ngành nên không chấm được.', 'This major is not in the 300-major list, so it cannot be scored.')}</p>
        )}

        {tg && (
          <div style={{ marginTop: 6 }}>
            <ol className="mlist">
              <MajorRow row={tg} baseRow={base?.target?.analysis?.row} kb={kb} env={env} onOpenWhy={onOpenWhy} note={tg.rank ? `${tr('hạng', 'rank')} ${tg.rank}` : tr('không xếp hạng', 'not ranked')} />
            </ol>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href={`#${base0}/l1?p=${target.major.profile_id ?? target.major.profile}`}
                className="btn small primary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                🎯 {tr(`Xem chi tiết chuyên ngành mong muốn (${target.major.name_vi}) →`, `View details for target major (${target.major.name_vi}) →`)}
              </a>
              <button type="button" className="btn small" onClick={() => onOpenWhy(tg.profile)}>
                {tr('Giải thích nhanh vì sao', 'Quick explanation why')}
              </button>
            </div>
          </div>
        )}

        {target?.major && target?.benchmark && (
          <div className="adm-box-inline">
            <span className="small">
              {tr('Khảo sát điểm chuẩn 2026 (HaUI):', '2026 Admission benchmark (HaUI):')}{' '}
              <b>{t(target.benchmark.level)}</b> (Tổ hợp {target.benchmark.combo}: {target.benchmark.score}đ vs {target.benchmark.cutoff}đ, {target.benchmark.margin >= 0 ? `dư +${target.benchmark.margin.toFixed(2)}` : `thiếu ${target.benchmark.margin.toFixed(2)}`}đ)
            </span>
          </div>
        )}

        {target?.major && !target?.benchmark && (
          <p className="small muted" style={{ marginTop: 2 }}>
            ℹ️ {tr('Ngành này chưa nằm trong 18 ngành thí điểm điểm chuẩn 2026 (HaUI). Điểm thi tốt nghiệp của bạn đã sẵn sàng đối chiếu khi cập nhật thêm trường.', 'This major is not among the 18 pilot benchmark majors. Your exam scores are ready for future updates.')}
          </p>
        )}

        {step && <p className="small" style={{ marginTop: 4 }}>→ {tr('Muốn đạt "Ưu tiên"', 'To reach "Priority"')}: {step}.</p>}
      </div>
    </>
  );
}

function Indicators({ out, kb, onGo, onSetTarget }) {
  const K = Object.fromEntries(out.kpis.map((k) => [k.code, k]));
  const stab = K.K_STAB, weak = K.K_WEAK, adm = K.K_ADMIT;
  const weakRow = out.result.rows.find((r) => r.profile === weak?.profile);

  // Tìm benchmark cho ngành Top 1 nếu chưa chọn mục tiêu
  const top1Profile = out.result.top[0]?.profile;
  const top1Rep = top1Profile ? repMajor(kb, top1Profile, out.result.env) : null;
  const top1Major = top1Rep ? kb.majors.find((m) => m.name_vi === top1Rep.name) : null;
  const top1Bench = top1Major && kb.admission ? kb.admission.find((a) => a.major_id === top1Major.id) : null;
  const top1Adm = useMemo(() => (top1Bench && out.exam ? admissionChance(top1Bench, out.exam) : null), [top1Bench, out.exam]);

  let admDisplay;
  if (adm?.value) {
    admDisplay = {
      level: adm.level,
      val: t(adm.value),
      sub: out.target?.major?.name_vi,
      tip: tr(`Tính cho ngành mục tiêu: ${out.target?.major?.name_vi}`, `Calculated for target: ${out.target?.major?.name_vi}`),
    };
  } else if (top1Adm) {
    admDisplay = {
      level: top1Adm.level === 'An toàn' ? 'green' : top1Adm.level === 'Vừa sức' ? 'yellow' : 'red',
      val: t(top1Adm.level),
      sub: `Top 1: ${top1Rep.name}`,
      tip: tr(`Tự động đối chiếu theo Top 1: ${top1Rep.name} (Điểm chuẩn HaUI: ${top1Adm.cutoff})`, `Auto-checked against Top 1: ${top1Rep.name}`),
    };
  } else {
    admDisplay = {
      level: 'grey',
      val: tr('Thí điểm 18 ngành', '18-major pilot'),
      sub: top1Rep ? top1Rep.name : tr('Chưa chọn ngành', 'No target'),
      tip: tr('Ngành này chưa có trong 18 ngành khảo sát điểm chuẩn ĐH Công nghiệp HN (HaUI)', 'Not among 18 pilot majors from HaUI'),
    };
  }

  const items = [
    { code: 'K_STAB', name: tr('Độ ổn định kết quả', 'Result stability'), layer: 'l5', level: stab?.level,
      val: stab?.value == null ? '–' : stabWord(stab.value), tip: tr(`${stab?.value ?? '–'}/5 cách tính cho cùng ngành phù hợp nhất`, `${stab?.value ?? '–'}/5 methods give the same best fit`) },
    { code: 'K_WEAK', name: tr('Kỹ năng cần cải thiện', 'Skills to improve'), layer: 'whatif', level: weak?.level,
      val: weakRow?.weakList.length ? weakRow.weakList.map((w) => skillName(kb, w.archetype)).join(', ') : tr('Không có', 'None'),
      tip: tr('Kỹ năng liên quan tới ngành phù hợp nhất mà bạn tự chấm từ 2/5 trở xuống', 'Related skills you rated 2/5 or lower') },
    { code: 'K_ADMIT', name: tr('Khả năng đỗ (Tuyển sinh)', 'Admission chance'), layer: 'l7', level: admDisplay.level,
      val: admDisplay.val, sub: admDisplay.sub, tip: admDisplay.tip },
  ];

  return (
    <div className="kpis">
      {items.map((k) => (
        <button key={k.code} type="button" className={`kpi ${k.level ?? 'grey'}`} onClick={() => onGo(k.layer, weak?.profile)} title={k.tip}>
          <span className="k-name">{k.name}</span>
          <span className="k-val">{k.val}</span>
          {k.sub && <span className="k-sub" title={k.sub}>{k.sub}</span>}
          <Status level={k.level ?? 'grey'} />
        </button>
      ))}
    </div>
  );
}

export default function Dashboard({ out, base, kb, onGo, whatif, base0 = '' }) {
  const [drawerProfile, setDrawerProfile] = useState(null);
  const r = out.result;
  const env = r.env;
  const moved = base && base.result.top[0]?.profile !== r.top[0]?.profile;

  const openWhy = (profile) => setDrawerProfile(profile);

  return (
    <div className="l0">
      <div className="l0-main">
        {moved && (
          <p className="whatif-on" role="status">
            {tr('Đang thử thay đổi', 'Trying changes')}: {tr('ngành phù hợp nhất đổi từ', 'best fit changes from')}{' '}
            <b>{base.result.top[0] ? repMajor(kb, base.result.top[0].profile, base.result.env).name : '–'}</b> → <b>{r.top[0] ? repMajor(kb, r.top[0].profile, env).name : '–'}</b>.
          </p>
        )}
        <TopCard out={out} base={base} kb={kb} base0={base0} onOpenWhy={openWhy} />
        <section className="panel" aria-label={tr('Ngành phù hợp khác', 'Other good fits')}>
          <OtherMajors out={out} base={base} kb={kb} base0={base0} onOpenWhy={openWhy} onGo={onGo} onSetTarget={whatif.setTarget} />
        </section>
        <section className="zone-kpi" aria-label={t('Chỉ số chính & cảnh báo')}>
          <Indicators out={out} kb={kb} onGo={onGo} onSetTarget={whatif.setTarget} />
          <Warnings warnings={out.warnings} />
        </section>
      </div>
      <section className="panel zone-whatif" aria-labelledby="z-d" id="whatif">
        <WhatIf {...whatif} kb={kb} out={out} base={base} />
      </section>

      {/* Drawer giải thích tại chỗ */}
      {drawerProfile && (
        <WhyDrawer
          out={out}
          kb={kb}
          profile={drawerProfile}
          base0={base0}
          onClose={() => setDrawerProfile(null)}
          onSwitchProfile={(p) => setDrawerProfile(p)}
        />
      )}
    </div>
  );
}
