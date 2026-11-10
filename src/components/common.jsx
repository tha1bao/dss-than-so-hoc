// Phần tử dùng chung: tooltip, biểu tượng trạng thái (luôn kèm chữ – không dùng màu đơn lẻ), chip nhãn, thanh đóng góp C.
import { createContext, useContext, useState, useCallback } from 'react';
import { LABELS } from '../../shared/engine/index.js';
import { fmt, LABEL_CLASS } from '../format.js';
import { t, tr, num, localizeKb } from '../i18n.js';

// ---------- tooltip ----------
const TipCtx = createContext(() => {});
export function TipProvider({ children }) {
  const [tip, setTip] = useState(null);
  return (
    <TipCtx.Provider value={setTip}>
      {children}
      {tip && <div className="tip" role="tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 300), top: tip.y + 16 }}>{tip.content}</div>}
    </TipCtx.Provider>
  );
}
/** Gắn vào phần tử: {...tip(nội dung)} → hiện khi rê chuột / focus bàn phím. */
export function useTip() {
  const set = useContext(TipCtx);
  return useCallback((content) => ({
    onMouseMove: (e) => set({ x: e.clientX, y: e.clientY, content }),
    onMouseLeave: () => set(null),
    onFocus: (e) => { const r = e.currentTarget.getBoundingClientRect(); set({ x: r.left, y: r.bottom, content }); },
    onBlur: () => set(null),
  }), [set]);
}

// ---------- trạng thái ----------
const STATUS_TEXT = { green: 'Tốt', yellow: 'Lưu ý', red: 'Cảnh báo', grey: 'Không áp dụng' };
export function StatusIcon({ level, size = 12 }) {
  const s = { width: size, height: size, viewBox: '0 0 12 12', 'aria-hidden': true };
  if (level === 'green') return <svg {...s}><circle cx="6" cy="6" r="5.5" fill="var(--good)" /><path d="M3.4 6.2l1.8 1.8 3.5-3.6" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>;
  if (level === 'yellow') return <svg {...s}><path d="M6 .8l5.4 10H.6z" fill="var(--warn)" /><path d="M6 4.3v3" stroke="#3b2a00" strokeWidth="1.5" strokeLinecap="round" /><circle cx="6" cy="9" r=".8" fill="#3b2a00" /></svg>;
  if (level === 'red') return <svg {...s}><path d="M3.6.6h4.8l3 3v4.8l-3 3H3.6l-3-3V3.6z" fill="var(--bad)" /><path d="M4.2 4.2l3.6 3.6M7.8 4.2L4.2 7.8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg>;
  return <svg {...s}><circle cx="6" cy="6" r="5" fill="none" stroke="var(--ink-3)" strokeWidth="1.4" /><path d="M3.6 6h4.8" stroke="var(--ink-3)" strokeWidth="1.4" /></svg>;
}
export const Status = ({ level, text }) => (
  <span className={`status ${level}`}><StatusIcon level={level} />{text ?? t(STATUS_TEXT[level])}</span>
);

export const LabelChip = ({ label }) => <span className={`label ${LABEL_CLASS[label] ?? 'none'}`}>{t(label)}</span>;

export function Warnings({ warnings, showGrey = false }) {
  const main = warnings.filter((w) => w.level !== 'grey');
  const grey = warnings.filter((w) => w.level === 'grey');
  if (!main.length && !showGrey) return null;
  return (
    <div className="warns" role="status">
      {main.map((w) => (
        <div key={w.code} className={`warn ${w.level}`}><StatusIcon level={w.level} size={14} /><span><b>{t(w.level === 'red' ? 'Ngoài phạm vi' : 'Lưu ý')}:</b> {num(w.message)} <span className="src">[{w.code}]</span></span></div>
      ))}
      {showGrey && grey.map((w) => <div key={w.code} className="warn grey"><span>ⓘ {num(w.message)} <span className="src">[{w.code}]</span></span></div>)}
    </div>
  );
}

// ---------- thanh đóng góp C = α·NF* + β·SR* + γ·ENV* ----------
export const SEGMENTS = [
  ['NF', 'nf', 'α·NF*', 'tương hợp thần số học'], ['SR', 'sr', 'β·SR*', 'sẵn sàng kỹ năng'], ['ENV', 'env', 'γ·ENV*', 'môi trường'],
];
export function ContribLegend() {
  return (
    <div className="legend" aria-label={t('Chú giải')}>
      {SEGMENTS.map(([k, cls, sym, name]) => <span key={k}><i style={{ background: `var(--c-${cls})` }} />{sym} – {t(name)}</span>)}
    </div>
  );
}
/** Thanh ngang trên trục 0–1 (C tối đa = α+β+γ = 1). Không hiển thị %. */
export function ContribBar({ row, weights, normalize }) {
  const tip = useTip();
  if (!row.contrib) return <div className="bar-wrap"><span className="small muted">{t('EC = 0 – không xếp hạng')}</span></div>;
  const raw = { NF: normalize ? row.NF_n : row.NF, SR: normalize ? row.SR_n : row.SR, ENV: normalize ? row.ENV_n : row.ENV };
  const w = { NF: weights[0], SR: weights[1], ENV: weights[2] };
  return (
    <div className="bar-wrap" aria-label={`C = ${fmt(row.C)}: ${SEGMENTS.map(([k, , s]) => `${s} ${fmt(row.contrib[k])}`).join(', ')}`}>
      <div className="bar-track">
        {SEGMENTS.map(([k, cls, sym, name]) => row.contrib[k] > 1e-9 && (
          <div key={k} className={`bar-seg ${cls}`} style={{ flex: `0 0 calc(${row.contrib[k] * 100}% - 2px)` }} tabIndex={0}
            {...tip(<><b>{sym} = {fmt(row.contrib[k])}</b><br />{t(name)}: {fmt(w[k])} × {fmt(raw[k])}{normalize ? tr(' (đã chuẩn hóa min–max)', ' (min–max normalized)') : ''}</>)} />
        ))}
      </div>
    </div>
  );
}
/** Trục 0–1 đặt trong cùng lưới cột với thanh để vạch khớp vị trí. */
export const Axis01 = () => (
  <div className="rank-row axis-row" aria-hidden="true">
    <span />
    <div className="axis">{[0, 0.25, 0.5, 0.75, 1].map((t) => <span key={t} style={{ left: `${t * 100}%` }}>{fmt(t, t % 0.5 ? 2 : t % 1 ? 1 : 0)}</span>)}</div>
    <span className="c-col" />
  </div>
);

/** Phân bố nhãn của 35 nhóm ngành (thanh ngang, màu trạng thái luôn kèm chữ). */
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
          <div key={l} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 26px', gap: 6, alignItems: 'center', fontSize: '0.84rem' }}>
            <span>{t(l)}</span>
            <div style={{ height: 12 }} tabIndex={0} {...tip(`${t(l)}: ${n}/35`)}>
              {n > 0 && <div style={{ width: `${(n / max) * 100}%`, height: '100%', background: cls[l], borderRadius: '0 4px 4px 0' }} />}
            </div>
            <span className="num" style={{ textAlign: 'right' }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- thanh 3 phần cho học sinh (không ký hiệu) ----------
/**
 * Thanh chia 3 màu: Môi trường · Kỹ năng · Con số. Mỗi phần có "khung tối đa" (nền nhạt) và "phần đạt được" (màu đậm),
 * để học sinh thấy ngay phần nào đã đủ, phần nào còn thiếu – thay cho công thức C = α·NF* + β·SR* + γ·ENV*.
 */
export function FitStack({ row, weights }) {
  if (!row?.contrib) return null;
  const [a, b, g] = weights ?? [0.111, 0.278, 0.611];
  const parts = [
    ['ENV', 'env', tr('Môi trường', 'Environment'), g],
    ['SR', 'sr', tr('Kỹ năng', 'Skills'), b],
    ['NF', 'nf', tr('Con số', 'Numbers'), a],
  ];
  return (
    <div className="fitstack" role="img" aria-label={parts.map(([k, , n, mx]) => `${n} ${Math.round(row.contrib[k] * 100)}/${Math.round(mx * 100)}`).join(', ')}>
      <div className="fitstack-track">
        {parts.map(([k, cls, , mx]) => (
          <div key={k} className={`fitstack-slot ${cls}`} style={{ flex: `${mx} 0 0` }}>
            <div className="fitstack-fill" style={{ width: `${mx > 0 ? Math.min(1, row.contrib[k] / mx) * 100 : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="fitstack-legend">
        {parts.map(([k, cls, n, mx]) => (
          <span key={k}><i className={cls} />{n}: <b className="num">{Math.round(row.contrib[k] * 100)}</b>/{Math.round(mx * 100)}</span>
        ))}
      </div>
    </div>
  );
}

// ---------- từ điển nhỏ: chạm / rê chuột để xem nghĩa ----------
export const GLOSSARY = {
  'Thần số học': ['Cách đọc tính cách qua các con số tính từ họ tên và ngày sinh. Chỉ để tham khảo, không có giá trị dự báo khoa học.', 'Reading personality from numbers derived from your name and birth date. For reflection only – no scientific predictive value.'],
  Pythagoras: ['Trường phái thần số học phổ biến nhất (phương Tây): đổi chữ cái thành số 1–9 và cộng các chữ số.', 'The most common (Western) school: letters become 1–9 and digits are added up.'],
  Kabala: ['Trường phái thần số học gốc Do Thái: tính theo âm của chữ cái và theo thứ trong tuần bạn sinh ra.', 'A Hebrew-rooted school: uses letter sounds and the weekday you were born.'],
  'Vệ Đà': ['Trường phái thần số học Ấn Độ: dùng ngày sinh trong tháng.', 'The Indian (Vedic) school: uses your day of birth.'],
  'Số chủ đạo': ['Con số quan trọng nhất, tính bằng cách cộng tất cả chữ số của ngày, tháng, năm sinh.', 'The most important number: add all digits of your full birth date.'],
  'Nét tính cách': ['Mỗi nhóm ngành gắn với 3 nét tính cách (đánh số 1–9, 11, 22, 33). Con số của bạn trùng nét nào thì cộng điểm nét đó.', 'Each major group is tied to 3 personality traits (1–9, 11, 22, 33). A number of yours that matches a trait adds points.'],
  'Nhóm ngành': ['Hệ thống gom 300 ngành thành 35 nhóm có cùng nét tính cách và môi trường làm việc.', 'The 300 majors are grouped into 35 groups sharing traits and work environment.'],
};
export function Term({ k, children }) {
  const tip = useTip();
  const def = GLOSSARY[k];
  if (!def) return <>{children ?? k}</>;
  const text = tr(def[0], def[1]);
  return <abbr className="term" tabIndex={0} title={text} {...tip(text)}>{children ?? k}</abbr>;
}
