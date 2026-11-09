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
import { pct, repMajor, avgSkill, SKILL_NEED, labelPlain, nextStepPlain, STAB_NAME, stabWord, py00Chain, rootChain, chainText, buildNarrativeWhy } from '../plain.js';

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
  const sig = out.sig;
  const row = rowOf(out, sel);
  const [viewMode, setViewMode] = useState('story'); // 'story' | 'table'

  if (!row) return <p className="empty">{t('Không có hồ sơ.')}</p>;

  const nOn = r.groups.length;
  const step = nextStepPlain(row, r, kb);
  const ties = row.EC >= 1 ? r.ranked.filter((x) => x !== row && Math.abs(x.C - row.C) <= 1e-9) : [];
  const narrative = useMemo(() => buildNarrativeWhy(row, out, kb), [row, out, kb]);

  const say = {
    NF: row.EC >= 1 ? tr(`${row.EC} trong ${nOn} con số của bạn trùng với nét tính cách của nhóm ngành này.`, `${row.EC} of your ${nOn} numbers match this group's personality traits.`)
      : tr('Không con số nào của bạn trùng với nhóm ngành này.', 'None of your numbers match this group.'),
    SR: tr(`Kỹ năng liên quan (${row.A.map((a) => skillName(kb, a)).join('; ')}) của bạn đạt trung bình ${fmt(avgSkill(row.SR), 1)}/5; mức cần là ${fmt(SKILL_NEED(kb), 1)}/5.`,
      `Your related skills (${row.A.map((a) => skillName(kb, a)).join('; ')}) average ${fmt(avgSkill(row.SR), 1)}/5; the bar is ${fmt(SKILL_NEED(kb), 1)}/5.`),
    ENV: row.ENV ? tr(`Môi trường "${envName(kb, r.env)}" đúng với lựa chọn của bạn.`, `"${envName(kb, r.env)}" matches the environment you chose.`)
      : tr(`Môi trường "${envName(kb, row.env)}" khác với môi trường bạn chọn ("${envName(kb, r.env)}").`, `"${envName(kb, row.env)}" differs from your choice ("${envName(kb, r.env)}").`),
  };

  return (
    <section className="panel l1-panel">
      <Head out={out} kb={kb} row={row} setSel={setSel} />

      {/* Hero Banner: Tổng kết mức phù hợp */}
      <div className="l1-hero-banner">
        <div className="l1-hero-left">
          <div className="l1-hero-title-row">
            <h2 className="l1-hero-major">{narrative?.majorName ?? row.profile}</h2>
            <LabelChip label={row.label} />
            {narrative?.moreCount > 0 && (
              <span className="small muted">+{narrative.moreCount} {tr('ngành cùng nhóm', 'majors in group')}</span>
            )}
          </div>
          <p className="l1-hero-verdict">{narrative?.labelReason}</p>
        </div>
        <div className="l1-hero-score-box">
          <div className="l1-hero-score">
            <span className="score-num">{row.EC >= 1 ? pct(row.C) : '—'}</span>
            <span className="score-label">{tr('Mức phù hợp', 'Overall Fit')}</span>
          </div>
          <span className="score-rank">
            {row.rank ? `${tr('Hạng', 'Rank')} #${row.rank}/${r.ranked.length}` : tr('Không xếp hạng', 'Unranked')}
          </span>
        </div>
      </div>

      {/* View Switcher: Luận giải định hướng vs Bảng đối chiếu */}
      <div className="l1-mode-switch">
        <button
          type="button"
          className={`mode-btn ${viewMode === 'story' ? 'active' : ''}`}
          onClick={() => setViewMode('story')}
        >
          📖 {tr('Bài luận giải định hướng chi tiết', 'Detailed Guidance Narrative')}
        </button>
        <button
          type="button"
          className={`mode-btn ${viewMode === 'table' ? 'active' : ''}`}
          onClick={() => setViewMode('table')}
        >
          📊 {tr('Bảng đối chiếu 3 trụ cột (Thanh đo)', 'Pillars Comparison Chart')}
        </button>
      </div>

      {viewMode === 'story' && narrative && (
        <div className="narrative-flow">
          {/* Bước 1: Hồ sơ Thần số học của học sinh */}
          <div className="narrative-card">
            <div className="narrative-card-head">
              <span className="step-tag">1</span>
              <div>
                <h3>{tr('Hồ sơ Thần số học của bạn', 'Your Numerology Profile')}</h3>
                <span className="small muted">
                  {tr(
                    `Dựa trên họ tên "${narrative.studentName}" và ngày sinh ${narrative.dobText}:`,
                    `Based on name "${narrative.studentName}" and birth date ${narrative.dobText}:`
                  )}
                </span>
              </div>
            </div>

            <div className="narrative-card-body">
              <div className="profile-sig-grid">
                {narrative.sigList.map((sigItem) => (
                  <div key={sigItem.code} className={`profile-sig-item ${sigItem.matched ? 'matched' : ''}`}>
                    <div className="sig-item-top">
                      <span className="sig-item-badge">{sigItem.val}</span>
                      <span className="sig-item-name">{sigItem.name}</span>
                      {sigItem.matched && <span className="sig-match-pill">{tr('✓ Trùng nét ngành này', '✓ Matches major trait')}</span>}
                    </div>
                    <p className="sig-item-meaning">{sigItem.meaning}</p>
                  </div>
                ))}
              </div>

              {narrative.birthMatrixPresent.length > 0 && (
                <div className="narrative-sub-box">
                  <b>{tr('Ma trận ngày sinh & Trục tâm lý:', 'Birth Chart & Psychological Axes:')}</b>
                  <p className="small" style={{ margin: '4px 0 0' }}>
                    {tr(
                      `Ngày sinh của bạn gồm các chữ số: [${narrative.birthMatrixPresent.join(', ')}]. `,
                      `Your birth date contains numbers: [${narrative.birthMatrixPresent.join(', ')}]. `
                    )}
                    {narrative.birthArrows.length > 0 ? (
                      <span>
                        {tr('Hình thành các mũi tên tâm lý học đường: ', 'Forms key psychological arrows: ')}
                        <b>{narrative.birthArrows.map((a) => {
                          const [code] = a.split(':');
                          return ARROW_VI[code] || a;
                        }).join(' · ')}.</b>
                      </span>
                    ) : (
                      <span>{tr('Các con số phân bổ hài hòa trên các trục Trí não, Tâm hồn và Thể chất.', 'Numbers are balanced across Mind, Soul, and Physical planes.')}</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bước 2: Đặc điểm & Yêu cầu của nhóm ngành */}
          <div className="narrative-card">
            <div className="narrative-card-head">
              <span className="step-tag">2</span>
              <div>
                <h3>{tr(`Đặc điểm & Yêu cầu của ngành ${narrative.majorName}`, `Requirements for ${narrative.majorName}`)}</h3>
                <span className="small muted">
                  {tr(
                    `Các yếu tố cốt lõi giúp sinh viên học tốt và phát triển trong nhóm ngành này:`,
                    `Core elements required to thrive in this major group:`
                  )}
                </span>
              </div>
            </div>

            <div className="narrative-card-body">
              <div className="major-traits-list">
                {narrative.majorTraits.map((t) => (
                  <div key={t.pos} className="major-trait-row">
                    <span className="trait-pos-badge">{tr('Vị trí', 'Pos')} {t.pos}</span>
                    <div className="trait-detail">
                      <b>{t.traitTitle} <span className="small muted">({tr('Nét tính cách', 'Archetype')} {t.archetype})</span></b>
                      <span className="small muted" style={{ display: 'block', marginTop: 2 }}>
                        {tr('Kỹ năng tương ứng:', 'Linked skill:')} <b>{t.skill}</b>
                      </span>
                    </div>
                    {t.matchedGroups.length > 0 ? (
                      <span className="trait-match-badge ok">
                        {tr(`Trùng ${t.matchedGroups.join(', ')} của bạn`, `Matches your ${t.matchedGroups.join(', ')}`)}
                      </span>
                    ) : (
                      <span className="trait-match-badge muted">{tr('Bạn chưa có con số trùng nét này', 'No matching number')}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="narrative-sub-box env-box">
                <b>{tr('Môi trường làm việc đặc trưng:', 'Typical work environment:')}</b>
                <span> {narrative.majorEnv}</span>
              </div>
            </div>
          </div>

          {/* Bước 3: Đối chiếu & Phân bổ điểm số (% đóng góp) */}
          <div className="narrative-card">
            <div className="narrative-card-head">
              <span className="step-tag">3</span>
              <div>
                <h3>{tr('Đối chiếu chi tiết & Phân bổ điểm số (% đóng góp)', 'Match Breakdown & Score Contributions')}</h3>
                <span className="small muted">
                  {tr(
                    'Vì sao ra điểm số này? Từng trụ cột đóng góp bao nhiêu % vào kết quả:',
                    'Why this score? How much each pillar contributes to overall fit:'
                  )}
                </span>
              </div>
            </div>

            <div className="narrative-card-body">
              <div className="pillars-breakdown">
                {/* Trụ cột 1: Thần số học */}
                <div className="pillar-item">
                  <div className="pillar-header">
                    <div className="pillar-title">
                      <span className="pillar-badge nf">1</span>
                      <b>{tr('Thần số học (Thiên hướng tự nhiên)', 'Numerology (Natural Tendencies)')}</b>
                    </div>
                    <span className="pillar-contrib-val">+{narrative.pctNF}%</span>
                  </div>
                  <p className="pillar-text">
                    {narrative.EC >= 1 ? (
                      <>
                        {tr('Trong 5 con số của bạn, bạn có ', 'Out of your 5 numbers, you have ')}
                        <b>{narrative.EC}/5 {tr('con số phù hợp', 'matching numbers')}</b>
                        {tr(
                          ` với tính cách ngành (${narrative.hits.map((g) => `${groupName(kb, g)}: ${sig[g]}`).join(', ')}). `,
                          ` (${narrative.hits.map((g) => `${groupName(kb, g)}: ${sig[g]}`).join(', ')}). `
                        )}
                        {narrative.pctNF === 0 ? (
                          <span className="muted">
                            {tr(
                              '(Đóng góp 0% do mức trùng này ở cận dưới trong các ngành bạn có số trùng sau khi chuẩn hóa so sánh).',
                              '(Contributes 0% as this match is at the baseline among your matching groups).'
                            )}
                          </span>
                        ) : (
                          tr(`Yếu tố Thần số học đóng góp ${narrative.pctNF}% vào điểm số tổng hợp.`, `Numerology contributes ${narrative.pctNF}% to overall score.`)
                        )}
                      </>
                    ) : (
                      tr(
                        'Bạn chưa có con số nào trùng khớp với nét tính cách ngành này (đóng góp 0%).',
                        'None of your numbers match the traits of this major group (contributes 0%).'
                      )
                    )}
                  </p>
                </div>

                {/* Trụ cột 2: Kỹ năng tự đánh giá */}
                <div className="pillar-item">
                  <div className="pillar-header">
                    <div className="pillar-title">
                      <span className="pillar-badge sr">2</span>
                      <b>{tr('Kỹ năng tự đánh giá', 'Self-Rated Skills')}</b>
                    </div>
                    <span className="pillar-contrib-val">+{narrative.pctSR}%</span>
                  </div>
                  <p className="pillar-text">
                    {tr('Dựa trên 3 kỹ năng bạn tự chấm: ', 'Based on your 3 self-rated skills: ')}
                    <b>{narrative.majorTraits.map((t) => `${t.skill} (${t.rating}/5)`).join(' · ')}</b>.
                    {tr(' Điểm trung bình đạt ', ' Average score is ')}
                    <b>{fmt(narrative.avgSkillVal, 1)}/5 sao</b>
                    {tr(
                      ` (mức chuẩn khuyến nghị là ≥ ${fmt(narrative.skillNeedVal, 1)}/5 sao). `,
                      ` (recommended bar is ≥ ${fmt(narrative.skillNeedVal, 1)}/5). `
                    )}
                    {tr('Yếu tố kỹ năng đóng góp ', 'Skills contribute ')}
                    <b>{narrative.pctSR}%</b>
                    {tr(' vào điểm số tổng hợp.', ' to overall fit score.')}
                  </p>
                </div>

                {/* Trụ cột 3: Môi trường làm việc */}
                <div className="pillar-item">
                  <div className="pillar-header">
                    <div className="pillar-title">
                      <span className="pillar-badge env">3</span>
                      <b>{tr('Môi trường làm việc', 'Work Environment')}</b>
                    </div>
                    <span className="pillar-contrib-val">+{narrative.pctENV}%</span>
                  </div>
                  <p className="pillar-text">
                    {narrative.isEnvMatch ? (
                      <>
                        {tr('Môi trường bạn mong muốn là ', 'Your preferred environment is ')}
                        <b>"{narrative.chosenEnv}"</b>,
                        <span className="ok"> {tr('✓ hoàn toàn trùng khớp với môi trường của ngành', '✓ perfectly matches this major group')}</span>.
                        {tr(' Đóng góp ', ' Contributes ')}
                        <b>{narrative.pctENV}%</b>
                        {tr(' vào điểm số tổng hợp.', ' to overall fit score.')}
                      </>
                    ) : (
                      <>
                        {tr('Môi trường bạn mong muốn là ', 'Your preferred environment is ')}
                        <b>"{narrative.chosenEnv}"</b>,
                        <span className="muted"> {tr(`khác với môi trường của ngành ("${narrative.majorEnv}")`, `differs from major's ("${narrative.majorEnv}")`)}</span>.
                        {tr(' Đóng góp ', ' Contributes ')}
                        <b>{narrative.pctENV}%</b>
                        {tr(' vào điểm số tổng hợp.', ' to overall fit score.')}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bước 4: Tổng kết & Lời khuyên định hướng */}
          <div className="narrative-card highlight-card">
            <div className="narrative-card-head">
              <span className="step-tag done">4</span>
              <div>
                <h3>{tr('Tổng kết mức độ phù hợp & Lời khuyên định hướng', 'Summary & Guidance Advice')}</h3>
                <span className="small muted">{tr('Đúc kết từ góc nhìn khoa học ra quyết định & tư vấn học đường', 'Decision Science & Student Guidance synthesis')}</span>
              </div>
            </div>

            <div className="narrative-card-body">
              <div className="verdict-equation-box">
                <span className="eq-term">{tr('Thần số học', 'Numerology')}: <b>{narrative.pctNF}%</b></span>
                <span className="eq-op">+</span>
                <span className="eq-term">{tr('Kỹ năng', 'Skills')}: <b>{narrative.pctSR}%</b></span>
                <span className="eq-op">+</span>
                <span className="eq-term">{tr('Môi trường', 'Environment')}: <b>{narrative.pctENV}%</b></span>
                <span className="eq-op">=</span>
                <span className="eq-total"><b>{row.EC >= 1 ? pct(row.C) : '—'}</b> {tr('Phù hợp', 'Overall Fit')}</span>
              </div>

              <div className="verdict-explanation">
                <p><b>{tr('Về nhãn khuyến nghị:', 'About recommendation label:')}</b> {narrative.labelReason}</p>
                {step && (
                  <p style={{ marginTop: 8 }}>
                    <b>{tr('Gợi ý rèn luyện để nâng lên "Ưu tiên":', 'Next step to reach "Priority":')}</b> {step}.
                  </p>
                )}
                {ties.length > 0 && (
                  <p className="small muted" style={{ marginTop: 6 }}>
                    {tr(`Hòa điểm với ${ties.length} nhóm ngành khác:`, `Tied with ${ties.length} other group(s):`)} {ties.map((x) => repMajor(kb, x.profile, r.env).name).join(', ')}.
                  </p>
                )}
              </div>

              <div className="student-advice-callout">
                <span className="advice-icon">💡</span>
                <p className="small">
                  <b>{tr('Lời khuyên định hướng:', 'Guidance note:')}</b>{' '}
                  {tr(
                    'Thần số học đóng vai trò như một lăng kính tham khảo về thiên hướng tính cách tự nhiên, không quyết định tuyệt đối năng lực hay tương lai của bạn. Hãy kết hợp điểm số này với sở thích cá nhân, điều kiện học tập thực tế và trao đổi cùng thầy cô tư vấn để đưa ra lựa chọn sáng suốt nhất!',
                    'Numerology provides a reflective lens on natural tendencies, not a rigid prophecy. Combine this insight with your real passions, academic readiness, and counseling advice.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chế độ bảng thanh đo đối chiếu (View Table) */}
      {viewMode === 'table' && (
        <div className="parts-container">
          <div className="parts">
            {COMP.map(([k, cls, name]) => {
              const w = row.contrib?.[k] ?? 0;
              return (
                <div key={k} className="part">
                  <span className="part-name">{t(name)}</span>
                  <div className="part-bar">
                    <span className={`bar-seg ${cls}`} style={{ width: `${Math.max(0, Math.min(1, w)) * 100}%` }} />
                  </div>
                  <span className="num muted small">{fmt(w, 2)}</span>
                  <span className="part-say">{say[k]}</span>
                </div>
              );
            })}
          </div>
          <div className="l1-label" style={{ marginTop: 14 }}>
            <p><b>{t('Đánh giá')}:</b> {labelPlain(row, kb)}</p>
            {step && <p><b>{tr('Bước tiếp theo để lên "Ưu tiên"', 'Next step to reach "Priority"')}:</b> {step}.</p>}
            {ties.length > 0 && (
              <p className="small muted">
                {tr(`Hòa điểm với ${ties.length} nhóm ngành khác:`, `Tied with ${ties.length} other group(s):`)} {ties.map((x) => repMajor(kb, x.profile, r.env).name).join(', ')}. {tr('Nhóm có mã đứng trước được xếp trên.', 'The group with the earlier code is ranked higher.')}
              </p>
            )}
          </div>
        </div>
      )}
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
            <div className="birth-chart-card">
              <div className="birth-chart-head">
                <div>
                  <span className="eyebrow">{tr('Thần số học Pythagoras', 'Pythagorean Numerology')}</span>
                  <h4 style={{ margin: '2px 0 0', fontSize: '0.96rem' }}>{tr('Ma trận ngày sinh (Biểu đồ 3×3)', 'Birth Chart Matrix (3×3 Grid)')}</h4>
                </div>
                {sig.input && (
                  <span className="birth-date-badge">
                    📅 {String(sig.input.day).padStart(2, '0')}/{String(sig.input.month).padStart(2, '0')}/{sig.input.year}
                  </span>
                )}
              </div>

              <div className="chart-matrix-wrapper">
                <div className="chart-planes">
                  <span className="plane-label">{tr('Trí não', 'Mind')}</span>
                  <span className="plane-label">{tr('Tâm hồn', 'Soul')}</span>
                  <span className="plane-label">{tr('Thể chất', 'Physical')}</span>
                </div>
                <div className="chart-grid-3x3" role="grid" aria-label={tr('Ma trận ngày sinh 3×3', 'Birth chart 3x3')}>
                  {[3, 6, 9, 2, 5, 8, 1, 4, 7].map((k) => {
                    const count = extras.birthChart[k] || 0;
                    return (
                      <div
                        key={k}
                        className={`chart-cell ${count > 0 ? 'cell-filled' : 'cell-empty'}`}
                        title={count > 0 ? tr(`Số ${k}: xuất hiện ${count} lần trong ngày sinh`, `Number ${k}: appears ${count} time(s)`) : tr(`Vị trí số ${k} (trống trong ngày sinh)`, `Slot for number ${k} (empty)`)}
                      >
                        {count > 0 ? (
                          <b className="cell-digits">{String(k).repeat(count)}</b>
                        ) : (
                          <span className="cell-ghost">({k})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="chart-legend-row">
                <span className="small muted">
                  <b>{tr('Cấu trúc 3 trục ngang:', '3 Horizontal Planes:')}</b> {tr('Hàng trên', 'Top')} 3-6-9 ({tr('Trí não', 'Mind')}) · {tr('Hàng giữa', 'Middle')} 2-5-8 ({tr('Tâm hồn', 'Soul')}) · {tr('Hàng dưới', 'Bottom')} 1-4-7 ({tr('Thể chất', 'Physical')}).
                </span>
              </div>

              <div className="birth-chart-note">
                <p className="small muted">
                  <b>{tr('💡 Ghi chú về ma trận ngày sinh:', '💡 About the Birth Chart Matrix:')}</b>{' '}
                  {tr(
                    'Ma trận được lập bằng cách điền các chữ số xuất hiện trong ngày tháng năm sinh vào 9 vị trí cố định theo 3 tầng biểu đạt. Các hàng, cột hoặc đường chéo có đủ số (hoặc vắng mặt toàn bộ) sẽ hình thành nên các "Mũi tên tâm lý" (thế mạnh hoặc vùng rèn luyện) được phân tích chi tiết ở bảng bên cạnh.',
                    'The matrix is populated by placing the digits from your birth date into 9 fixed positions across 3 planes. Complete lines or empty gaps form the "Psychological Arrows" (strengths or growth areas) analyzed in the adjacent table.'
                  )}
                </p>
              </div>
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
function Step({ no, title, say, symbols, general, real, note, src }) {
  return (
    <div className="step">
      <div className="step-head">
        <h3>{tr('Bước', 'Step')} {no} · {title}</h3>
        {src && <Src>{src}</Src>}
      </div>
      {say && <p className="step-say">{say}</p>}
      {symbols && symbols.length > 0 && (
        <div className="step-symbols">
          <span className="step-symbols-label">{tr('Ký hiệu trong bước này:', 'Symbols in this step:')}</span>
          <ul className="step-symbols-list">
            {symbols.map(([sym, exp, val]) => (
              <li key={sym}>
                <code>{sym}</code>: {exp}{val !== undefined && <> → <b>{val}</b></>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {general && (
        <div className="step-formula-box">
          <span className="formula-tag">{tr('Công thức tổng quát', 'General formula')}</span>
          <Tex>{general}</Tex>
        </div>
      )}
      {real && (
        <div className="step-formula-box real-box">
          <span className="formula-tag real-tag">{tr('Thay số thực tế của bạn', 'With your actual numbers')}</span>
          <Tex className="real">{real}</Tex>
        </div>
      )}
      {note && <p className="small real-note">{note}</p>}
    </div>
  );
}

function SymbolLegend({ r, row, kb }) {
  const [open, setOpen] = useState(true);
  const [a, b, c] = r.weights;
  return (
    <div className="symbol-decoder-panel">
      <button
        type="button"
        className="symbol-decoder-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>
          <b>{tr('📖 Bảng giải mã các ký hiệu trong công thức', '📖 Formula Symbols & Notation Guide')}</b>
          <span className="small muted" style={{ marginLeft: 8 }}>
            {tr('(Nhấn để đóng/mở giải thích ký hiệu)', '(Click to toggle symbol explanations)')}
          </span>
        </span>
        <span className="toggle-icon">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="symbol-decoder-content">
          <p className="small muted" style={{ margin: '0 0 10px' }}>
            {tr(
              'Để tính % phù hợp, hệ thống kết hợp 3 trụ cột: Thần số học (NF) + Kỹ năng (SR) + Môi trường (ENV). Dưới đây là ý nghĩa và vai trò của từng ký hiệu:',
              'To compute the fit %, the system combines 3 pillars: Numerology (NF) + Skills (SR) + Environment (ENV). Below is what each symbol means and its role:'
            )}
          </p>

          <div className="symbol-grid">
            <div className="symbol-item">
              <div className="symbol-badge">C</div>
              <div className="symbol-desc">
                <b>{tr('Điểm % phù hợp tổng hợp (Composite Score)', 'Composite Fit Score')}</b>
                <p className="small muted">
                  {tr('Điểm số sau cùng quyết định mức độ phù hợp và thứ hạng của ngành (sau khi nhân trọng số và chuẩn hóa).', 'The final score determining fit % and rank (after weighting and scaling).')}
                </p>
                <span className="symbol-val">{tr('Của bạn', 'Your value')}: <b>{row.EC >= 1 ? `${Math.round(row.C * 100)}%` : tr('Chưa xếp hạng', 'Unranked')}</b></span>
              </div>
            </div>

            <div className="symbol-item">
              <div className="symbol-badge">NF / NF*</div>
              <div className="symbol-desc">
                <b>{tr('Độ trùng khớp Thần số học (Numerology Fit)', 'Numerology Fit Score')}</b>
                <p className="small muted">
                  {tr('Đo lường mức độ tương hợp giữa 5 con số của bạn với 3 nét tính cách của ngành.', 'Measures compatibility between your 5 numbers and the major group\'s 3 traits.')}
                </p>
                <span className="symbol-val">{tr('Của bạn', 'Your value')}: <b>NF = {fmt(row.NF)}{row.NF_n !== undefined && ` → NF* = ${fmt(row.NF_n)}`}</b></span>
              </div>
            </div>

            <div className="symbol-item">
              <div className="symbol-badge">SR / SR*</div>
              <div className="symbol-desc">
                <b>{tr('Độ sẵn sàng kỹ năng (Skill Readiness)', 'Skill Readiness Score')}</b>
                <p className="small muted">
                  {tr('Điểm tự đánh giá 3 kỹ năng cốt lõi của ngành, quy đổi từ thang 1–5 về thang chuẩn 0–1.', 'Self-rating of the 3 linked skills, scaled from 1–5 to standard 0–1.')}
                </p>
                <span className="symbol-val">{tr('Của bạn', 'Your value')}: <b>SR = {fmt(row.SR)}{row.SR_n !== undefined && ` → SR* = ${fmt(row.SR_n)}`}</b></span>
              </div>
            </div>

            <div className="symbol-item">
              <div className="symbol-badge">ENV / ENV*</div>
              <div className="symbol-desc">
                <b>{tr('Môi trường làm việc (Environment)', 'Working Environment')}</b>
                <p className="small muted">
                  {tr('Bằng 1 nếu môi trường bạn mong muốn trùng với môi trường của ngành; bằng 0 nếu khác.', '1 if your preferred environment matches the group\'s; 0 otherwise.')}
                </p>
                <span className="symbol-val">{tr('Của bạn', 'Your value')}: <b>ENV = {row.ENV}</b></span>
              </div>
            </div>

            <div className="symbol-item">
              <div className="symbol-badge">EC</div>
              <div className="symbol-desc">
                <b>{tr('Số lượng con số hội tụ (Eligible Count)', 'Eligible Number Matches')}</b>
                <p className="small muted">
                  {tr('Đếm xem bạn có bao nhiêu con số trùng với ngành. Cần EC ≥ 1 để được xếp hạng, EC ≥ 2 để đạt "Ưu tiên".', 'Counts how many numbers match the traits. Needs EC ≥ 1 to be ranked, EC ≥ 2 for "Priority".')}
                </p>
                <span className="symbol-val">{tr('Của bạn', 'Your value')}: <b>{row.EC}/5 {tr('con số trùng', 'matching numbers')}</b></span>
              </div>
            </div>

            <div className="symbol-item">
              <div className="symbol-badge">α, β, γ</div>
              <div className="symbol-desc">
                <b>{tr('Trọng số góc nhìn (Alpha, Beta, Gamma)', 'Persona ROC Weights')}</b>
                <p className="small muted">
                  {tr(`Tỷ lệ coi trọng giữa Thần số học (α), Kỹ năng (β), Môi trường (γ) theo góc nhìn ${PERSONA_NAME[r.persona]}.`, `Weighting between Numerology (α), Skills (β), Environment (γ) for ${PERSONA_NAME[r.persona]}.`)}
                </p>
                <span className="symbol-val">α = <b>{fmt(a)}</b> · β = <b>{fmt(b)}</b> · γ = <b>{fmt(c)}</b></span>
              </div>
            </div>

            <div className="symbol-item">
              <div className="symbol-badge">w_g</div>
              <div className="symbol-desc">
                <b>{tr('Trọng số từng con số (Group Weights)', 'Number Weights')}</b>
                <p className="small muted">
                  {tr('Độ quan trọng: G1 Số chủ đạo (35%), G5 Tên đầy đủ (25%), G6 Kabala (15%), G4 Thứ sinh (15%), G2 Ngày sinh (10%).', 'Weights: G1 Ruling (35%), G5 Full Name (25%), G6 Kabbalah (15%), G4 Weekday (15%), G2 Day (10%).')}
                </p>
              </div>
            </div>

            <div className="symbol-item">
              <div className="symbol-badge">p_k & r_k</div>
              <div className="symbol-desc">
                <b>{tr('Thứ tự nét tính cách (p) & Điểm tự chấm (r)', 'Trait Order (p) & Self-Rating (r)')}</b>
                <p className="small muted">
                  {tr('p = [1,0; 0,8; 0,6] theo 3 vị trí nét tính cách. r = điểm tự chấm (1–5) của 3 kỹ năng tương ứng.', 'p = [1.0, 0.8, 0.6] by trait position. r = self-ratings (1–5) for the 3 skills.')}
                </p>
                <span className="symbol-val">r = [<b>{row.KN.join(', ')}</b>] / 5</span>
              </div>
            </div>
          </div>
        </div>
      )}
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
      <SymbolLegend r={r} row={row} kb={kb} />
      <div className="steps">
        <Step
          no={++no}
          title={tr('Con số nào trùng? (Độ khớp từng con số)', 'Which numbers match?')}
          src={src('F-KHOP')}
          say={tr(
            'Mỗi nhóm ngành có 3 nét tính cách xếp theo thứ tự ưu tiên 1, 2, 3. Con số của bạn nếu trùng nét ở vị trí nào sẽ nhận điểm thưởng vị trí tương ứng: vị trí 1 nhận 1,0 điểm; vị trí 2 nhận 0,8 điểm; vị trí 3 nhận 0,6 điểm.',
            'Each major group has 3 ordered traits. A number matching trait 1, 2, 3 earns position points 1.0, 0.8, 0.6 respectively.'
          )}
          symbols={[
            ['g', tr('Mã con số thần số học (G1..G6: Số chủ đạo, ngày sinh, thứ sinh, họ tên)', 'Signal number code')],
            ['k', tr('Vị trí nét tính cách của ngành (k = 1, 2 hoặc 3)', 'Trait position index (k = 1, 2, 3)')],
            ['p_k', tr('Điểm thưởng theo vị trí: p1 = 1,0 (nét chính), p2 = 0,8 (nét phụ), p3 = 0,6 (nét bổ trợ)', 'Trait position points: p1 = 1.0, p2 = 0.8, p3 = 0.6')],
            ['\\text{khớp}_g', tr('Điểm trùng của con số g: nhận pk nếu trùng nét thứ k, bằng 0 nếu không trùng', 'Match points for number g (= pk if matches, 0 otherwise)')],
            ['EC', tr('Eligible Count – Tổng số lượng con số của bạn có trùng khớp (cần EC ≥ 1 để xếp hạng, EC ≥ 2 để đạt Ưu tiên)', 'Eligible Count – total matching numbers (needs EC ≥ 1 to rank, EC ≥ 2 for Priority)'), `${row.EC}/5 con số`],
          ]}
          general={`\\text{khớp}_g=\\begin{cases}p_k & ${tt(tr('con số g trùng nét thứ k', 'number g matches trait k'))}\\\\ 0 & ${tt(tr('ngược lại (không trùng)', 'otherwise (no match)'))}\\end{cases}\\qquad EC=\\#\\{g:\\ \\text{khớp}_g>0\\}`}
          real={hits.length ? `${hits.map((g) => `\\text{khớp}_{\\text{${g}}}=${tn(row.khop[g], 1)}`).join(',\\ ')}\\ \\Rightarrow\\ EC=${row.EC}` : 'EC=0\\ (không\\ có\\ con\\ số\\ nào\\ trùng)'}
          note={row.EC >= 1 ? tr(`Bạn có ${row.EC} con số trùng khớp tính cách ngành (${hits.map((g) => `${g} ${groupName(kb, g)}`).join(', ')}).`, `You have ${row.EC} numbers matching the traits (${hits.map((g) => `${g} ${groupName(kb, g)}`).join(', ')}).`) : tr('Chưa có con số nào trùng khớp nét tính cách ngành này.', 'No numbers match this group\'s traits.')}
        />
        <Step
          no={++no}
          title={tr('Độ trùng con số Thần số học (NF - Numerology Fit)', 'Numerology Fit score (NF)')}
          src={src('F-NF')}
          say={tr(
            'Tính tổng điểm trùng có nhân trọng số theo mức độ quan trọng của từng con số (w_g), sau đó chia cho điểm tối đa có thể đạt được (2,4 × tổng w) để chuẩn hóa điểm NF về thang đo từ 0 đến 1.',
            'Sum weighted match points by number importance (w_g), divided by the maximum possible (2.4 × sum of w) to scale NF to 0–1.'
          )}
          symbols={[
            ['NF', tr('Numerology Fit – Điểm tương thích con số thần số học (thang 0–1, càng cao càng hợp)', 'Numerology Fit score on 0–1 scale'), fmt(row.NF)],
            ['w_g', tr('Trọng số con số: G1 Số chủ đạo (0,35), G5 Tên đầy đủ (0,25), G6 Kabala (0,15), G4 Thứ sinh (0,15), G2 Ngày sinh (0,10)', 'Number weights: G1 (0.35), G5 (0.25), G6 (0.15), G4 (0.15), G2 (0.10)')],
            ['\\sum_g w_g', tr('Tổng trọng số các con số đang bật tính toán', 'Sum of active number weights'), tn(sw, 2)],
            ['\\sum_k p_k', tr('Tổng điểm vị trí tối đa (1,0 + 0,8 + 0,6 = 2,4)', 'Sum of maximum position points'), tn(sp, 1)],
          ]}
          general={'NF=\\dfrac{\\sum_g w_g\\cdot\\text{khớp}_g}{\\left(\\sum_g w_g\\right)\\cdot\\sum_k p_k}'}
          real={`NF=\\dfrac{${hits.length ? hits.map((g) => `${tn(w[g], 2)}\\cdot ${tn(row.khop[g], 1)}`).join('+') : '0'}}{${tn(sw, 2)}\\cdot ${tn(sp, 1)}}=${tn(row.NF)}`}
          note={tr(`Điểm Thần số học gốc: NF = ${fmt(row.NF)} (trên thang 0–1).`, `Raw Numerology score: NF = ${fmt(row.NF)} (on 0–1 scale).`)}
        />
        <Step
          no={++no}
          title={tr('Mức sẵn sàng kỹ năng (SR - Skill Readiness)', 'Skill readiness level (SR)')}
          src={src('F-SR')}
          say={tr(
            'Lấy điểm tự đánh giá (thang 1–5) của 3 kỹ năng gắn liền với ngành. Công thức lấy (r_k - 1)/4 để quy đổi khoảng cách [1; 5] về thang đo chuẩn [0; 1] (1 điểm → 0; 3 điểm → 0,5; 5 điểm → 1,0), sau đó tính trung bình có trọng số p_k.',
            'Take your 1–5 self-ratings of the 3 linked skills. (rk - 1)/4 scales [1; 5] to standard [0; 1] (1 → 0; 3 → 0.5; 5 → 1.0), then weighted by pk.'
          )}
          symbols={[
            ['SR', tr('Skill Readiness – Mức độ sẵn sàng kỹ năng (thang 0–1)', 'Skill Readiness score on 0–1 scale'), fmt(row.SR)],
            ['r_k', tr('Điểm tự đánh giá kỹ năng ở vị trí k (thang điểm từ 1 đến 5)', 'Self-rating score for skill k (1 to 5)'), `[${row.KN.join(', ')}]`],
            ['p_k', tr('Trọng số vị trí của kỹ năng (1,0; 0,8; 0,6)', 'Skill position weight (1.0, 0.8, 0.6)')],
            ['\\dfrac{r_k - 1}{4}', tr('Phép co dãn thang đo: trừ 1 chia 4 để đưa điểm 1..5 về khoảng 0..1', 'Scale adjustment: converts 1..5 range into 0..1')],
          ]}
          general={'SR=\\dfrac{\\sum_{k=1}^{3}p_k\\,(r_k-1)}{4\\sum_k p_k}'}
          real={`SR=\\dfrac{${row.KN.map((rk, i) => `${tn(p[i], 1)}\\cdot(${rk}-1)`).join('+')}}{4\\cdot ${tn(sp, 1)}}=${tn(row.SR)}`}
          note={tr(`Điểm kỹ năng tự đánh giá: SR = ${fmt(row.SR)} (tương đương trung bình ${fmt(avgSkill(row.SR), 1)}/5 sao; mức chuẩn cần là ≥ ${fmt(SKILL_NEED(kb), 1)}/5).`, `Skill score: SR = ${fmt(row.SR)} (avg ${fmt(avgSkill(row.SR), 1)}/5 stars; standard bar is ≥ ${fmt(SKILL_NEED(kb), 1)}/5).`)}
        />
        <Step
          no={++no}
          title={tr('Độ phù hợp môi trường làm việc (ENV - Environment)', 'Working environment match (ENV)')}
          src={src('F-ENV')}
          say={tr(
            'Bằng 1 nếu môi trường bạn mong muốn trùng khớp với môi trường làm việc đặc trưng của nhóm ngành; bằng 0 nếu khác môi trường.',
            '1 if your chosen environment matches the major group\'s environment; 0 otherwise.'
          )}
          symbols={[
            ['ENV', tr('Điểm môi trường làm việc (chỉ nhận giá trị 1 hoặc 0)', 'Environment match score (1 or 0)'), row.ENV],
            ['môi trường bạn chọn', tr('Môi trường do bạn lựa chọn khi làm bài khảo sát', 'Your chosen work environment'), envName(kb, r.env)],
            ['môi trường nhóm ngành', tr('Môi trường làm việc đặc trưng của nhóm ngành', 'Major group typical work environment'), envName(kb, row.env)],
          ]}
          general={`ENV=[\\,${tt(tr('môi trường bạn chọn', 'your environment'))}=${tt(tr('môi trường nhóm ngành', 'group environment'))}\\,]`}
          real={`ENV=[\\,${tt(envName(kb, r.env))}=${tt(envName(kb, row.env))}\\,]=${row.ENV}`}
          note={row.ENV === 1 ? tr('✓ Hoàn toàn trùng khớp môi trường bạn mong muốn.', '✓ Perfectly fits your preferred environment.') : tr('Khác môi trường bạn mong muốn (ENV = 0).', 'Differs from your preferred environment (ENV = 0).')}
        />
        {norm && row.EC >= 1 && (
          <Step
            no={++no}
            title={tr('Chuẩn hóa Min-Max về cùng thang đo (X*)', 'Put on the same scale (Min-Max normalization)')}
            src={src('F-MM')}
            say={tr(
              `So sánh điểm của ngành này với ${r.nEligible} nhóm ngành có con số trùng của chính bạn: ngành thấp nhất nhận 0, ngành cao nhất nhận 1. Phép chuẩn hóa này giúp cả 3 trụ cột (Thần số học, Kỹ năng, Môi trường) có cùng thang đo 0..1 công bằng trước khi cộng có trọng số.`,
              `Comparing against your ${r.nEligible} matching groups: lowest = 0, highest = 1. This ensures all 3 pillars (Numerology, Skills, Environment) share a fair 0..1 scale before weighted addition.`
            )}
            symbols={[
              ['X*', tr('Điểm sau chuẩn hóa Min-Max (NF*, SR*, ENV*) nằm trong đoạn [0; 1]', 'Normalized score in [0; 1] range')],
              ['X', tr('Điểm gốc ban đầu trước chuẩn hóa (NF, SR, ENV)', 'Original raw score (NF, SR, ENV)')],
              ['\\min X, \\max X', tr('Điểm thấp nhất và cao nhất của chỉ số đó trong các ngành bạn có số trùng', 'Min and max values among your matching major groups')],
            ]}
            general={'X^{*}=\\dfrac{X-\\min X}{\\max X-\\min X}'}
            real={['NF', 'SR', 'ENV'].map(mm).join('\\qquad ')}
            note={tr(`Sau chuẩn hóa: NF* = ${fmt(row.NF_n)}, SR* = ${fmt(row.SR_n)}, ENV* = ${row.ENV_n}.`, `After scaling: NF* = ${fmt(row.NF_n)}, SR* = ${fmt(row.SR_n)}, ENV* = ${row.ENV_n}.`)}
          />
        )}
        <Step
          no={++no}
          title={tr('Điểm % phù hợp tổng hợp (C - Composite Score)', 'Composite fit percentage (C)')}
          src={src('F-C')}
          say={tr(
            `Nhân từng trụ cột với trọng số ROC của góc nhìn ${PERSONA_NAME[r.persona]} rồi cộng lại. Điểm C quyết định tỷ lệ % phù hợp và thứ hạng xếp hạng của ngành.`,
            `Multiply each scaled pillar by the ROC weights for ${PERSONA_NAME[r.persona]}, then sum. Score C determines the fit % and ranking.`
          )}
          symbols={[
            ['C', tr('Composite Score – Điểm phù hợp tổng hợp (thể hiện % phù hợp trên giao diện)', 'Composite fit score determining percentage on UI'), `${Math.round(row.C * 100)}% (${fmt(row.C)})`],
            ['\\alpha', tr(`Trọng số Thần số học (góc nhìn ${PERSONA_NAME[r.persona]})`, 'Weight for Numerology'), fmt(a)],
            ['\\beta', tr(`Trọng số Kỹ năng (góc nhìn ${PERSONA_NAME[r.persona]})`, 'Weight for Skills'), fmt(b)],
            ['\\gamma', tr(`Trọng số Môi trường (góc nhìn ${PERSONA_NAME[r.persona]})`, 'Weight for Environment'), fmt(c)],
            ['NF*, SR*, ENV*', tr('Các yếu tố đã đưa về cùng thang đo 0..1', 'Normalized factors on 0..1 scale')],
          ]}
          general={`C=\\alpha\\,${X('NF')}+\\beta\\,${X('SR')}+\\gamma\\,${X('ENV')}`}
          real={row.EC >= 1 ? `C=${tn(a)}\\cdot ${tn(xv('NF'))}+${tn(b)}\\cdot ${tn(xv('SR'))}+${tn(c)}\\cdot ${tn(xv('ENV'))}=${tn(row.C)}\\;\\Rightarrow\\;${Math.round(row.C * 100)}\\%` : `EC=0\\ \\Rightarrow\\ ${tt(tr('không xếp hạng', 'not ranked'))}`}
          note={row.EC >= 1 ? tr(`Kết quả: Nhóm ngành này đạt mức phù hợp ${Math.round(row.C * 100)}% (xếp hạng #${row.rank ?? '—'}).`, `Result: This major group achieves a fit of ${Math.round(row.C * 100)}% (Rank #${row.rank ?? '—'}).`) : tr('Không xếp hạng do không có con số thần số học nào trùng.', 'Unranked because no numerology numbers match.')}
        />
        <Step
          no={++no}
          title={tr('Quy tắc gán nhãn khuyến nghị (Ưu tiên / Cân nhắc / Thử thách)', 'Recommendation label rule')}
          src={src('F-LABEL')}
          say={tr(
            'Hệ thống căn cứ vào 3 tiêu chuẩn: độ hội tụ con số (EC ≥ 2), mức độ thành thạo kỹ năng (SR ≥ 0,625) và kiểm tra không có kỹ năng yếu (≤ 2).',
            'The system evaluates 3 criteria: number convergence (EC ≥ 2), skill readiness bar (SR ≥ 0.625), and absence of weak skills (≤ 2).'
          )}
          symbols={[
            ['EC', tr('Số con số trùng: EC = 0 → Không đề xuất; EC ≥ 2 là điều kiện cần để lên Ưu tiên', 'Matching numbers count'), `${row.EC}`],
            ['SR_{min}', tr(`Ngưỡng kỹ năng chuẩn: SR phải ≥ ${fmt(srMin)} (tương đương tự chấm trung bình ≥ 3,5/5)`, 'Skill threshold'), fmt(srMin)],
            ['\\text{kỹ năng } \\le 2', tr('Cảnh báo kỹ năng yếu: nếu có kỹ năng ≤ 2 sẽ bị gán nhãn "Thử thách" để nhắc nhở', 'Weak skill warning'), `${row.weak} kỹ năng`],
          ]}
          general={`${tt(tr('Nhãn', 'Label'))}=\\begin{cases}${tt(t('Không đề xuất'))} & EC=0\\\\ ${tt(t('Thử thách'))} & ${tt(tr('có kỹ năng', 'a skill'))}\\le 2\\\\ ${tt(t('Ưu tiên'))} & EC\\ge 2,\\ SR\\ge ${tn(srMin)}\\\\ ${tt(t('Cân nhắc'))} & ${tt(tr('còn lại', 'otherwise'))}\\end{cases}`}
          note={`${tr('Đối chiếu kết quả của bạn', 'Matching your results')}: EC = ${row.EC} (${row.EC >= 2 ? tr('đạt chuẩn hội tụ', 'converged') : tr('chưa đủ ≥ 2 con số', 'under 2 matches')}), ${row.weak ? tr(`có ${row.weak} kỹ năng ≤ 2 (cần bổ trợ)`, `has ${row.weak} skill(s) ≤ 2`) : tr('không có kỹ năng yếu', 'no weak skills')}, SR = ${fmt(row.SR)} (${row.SR >= srMin ? tr('đạt ngưỡng chuẩn', 'meets bar') : tr('dưới ngưỡng chuẩn', 'below bar')}) → ${t(row.label)}.`}
        />
        {ta && row.label !== LABELS.PRIORITY && ta.status === 'POSSIBLE' && (
          <Step
            no={++no}
            title={tr('Lộ trình rèn luyện để nâng lên nhãn "Ưu tiên"', 'Improvement path to reach "Priority"')}
            src={src('F-STEP5a')}
            say={tr(
              'Xác định số bậc kỹ năng cụ thể bạn cần cải thiện trong học tập và rèn luyện để đưa nhóm ngành này từ "Cân nhắc" lên mức "Ưu tiên".',
              'Identifies the exact skill level increments needed to elevate this major group from "Consider" to "Priority".'
            )}
            symbols={[
              ['bậc cần tăng', tr('Số bậc cần nâng ở các kỹ năng đang yếu (≤ 2) lên mức tối thiểu 3', 'Levels to raise weak skills to 3'), ta.stepsWeak],
              ['điểm thiếu', tr('Khoảng cách điểm SR còn thiếu so với mức chuẩn 0,625', 'Missing SR gap to standard bar'), fmt(ta.gap, 2)],
              ['kỹ năng chính', tr('Kỹ năng cốt lõi ở vị trí số 1 của ngành (mang lại hiệu quả tăng điểm cao nhất)', 'Primary skill in position 1'), skillName(kb, row.A[0])],
            ]}
            general={`${tt(tr('bậc cần tăng', 'levels needed'))}=\\sum_{r_k\\le 2}(3-r_k)\\qquad ${tt(tr('điểm thiếu', 'missing points'))}=\\max\\!\\left(0;\\ ${tn(srMin)}\\cdot 4\\sum_k p_k-\\sum_k p_k(r_k-1)\\right)`}
            real={`${tt(tr('bậc cần tăng', 'levels needed'))}=${ta.stepsWeak}\\qquad ${tt(tr('điểm thiếu', 'missing points'))}=${tn(ta.gap, 2)}\\ \\Rightarrow\\ ${ta.stepsMain}\\ ${tt(tr('bậc ở', 'level(s) on'))}\\ ${tt(skillName(kb, row.A[0]))}`}
            note={tr(`Chỉ cần rèn luyện thêm ${ta.stepsMain} bậc ở kỹ năng "${skillName(kb, row.A[0])}", nhóm ngành này sẽ lập tức đạt chuẩn nhãn "Ưu tiên".`, `Just increasing ${ta.stepsMain} level(s) on "${skillName(kb, row.A[0])}" will elevate this major group to "Priority".`)}
          />
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
