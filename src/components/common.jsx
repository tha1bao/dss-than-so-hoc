// Phần tử dùng chung: tooltip, biểu tượng trạng thái (luôn kèm chữ – không dùng màu đơn lẻ), chip nhãn, thanh đóng góp C.
import { createContext, useContext, useState, useCallback } from 'react';
import { fmt, LABEL_CLASS } from '../format.js';

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
  <span className={`status ${level}`}><StatusIcon level={level} />{text ?? STATUS_TEXT[level]}</span>
);

export const LabelChip = ({ label }) => <span className={`label ${LABEL_CLASS[label] ?? 'none'}`}>{label}</span>;

export function Warnings({ warnings, showGrey = false }) {
  const main = warnings.filter((w) => w.level !== 'grey');
  const grey = warnings.filter((w) => w.level === 'grey');
  if (!main.length && !showGrey) return null;
  return (
    <div className="warns" role="status">
      {main.map((w) => (
        <div key={w.code} className={`warn ${w.level}`}><StatusIcon level={w.level} size={14} /><span><b>{w.level === 'red' ? 'Ngoài phạm vi' : 'Lưu ý'}:</b> {w.message} <span className="src">[{w.code}]</span></span></div>
      ))}
      {showGrey && grey.map((w) => <div key={w.code} className="warn grey"><span>ⓘ {w.message} <span className="src">[{w.code}]</span></span></div>)}
    </div>
  );
}

// ---------- thanh đóng góp C = α·NF* + β·SR* + γ·ENV* ----------
export const SEGMENTS = [
  ['NF', 'nf', 'α·NF*', 'tương hợp thần số học'], ['SR', 'sr', 'β·SR*', 'sẵn sàng kỹ năng'], ['ENV', 'env', 'γ·ENV*', 'môi trường'],
];
export function ContribLegend() {
  return (
    <div className="legend" aria-label="Chú giải">
      {SEGMENTS.map(([k, cls, sym, name]) => <span key={k}><i style={{ background: `var(--c-${cls})` }} />{sym} – {name}</span>)}
    </div>
  );
}
/** Thanh ngang trên trục 0–1 (C tối đa = α+β+γ = 1). Không hiển thị %. */
export function ContribBar({ row, weights, normalize }) {
  const tip = useTip();
  if (!row.contrib) return <div className="bar-wrap"><span className="small muted">EC = 0 – không xếp hạng</span></div>;
  const raw = { NF: normalize ? row.NF_n : row.NF, SR: normalize ? row.SR_n : row.SR, ENV: normalize ? row.ENV_n : row.ENV };
  const w = { NF: weights[0], SR: weights[1], ENV: weights[2] };
  return (
    <div className="bar-wrap" aria-label={`C = ${fmt(row.C)}: ${SEGMENTS.map(([k, , s]) => `${s} ${fmt(row.contrib[k])}`).join(', ')}`}>
      <div className="bar-track">
        {SEGMENTS.map(([k, cls, sym, name]) => row.contrib[k] > 1e-9 && (
          <div key={k} className={`bar-seg ${cls}`} style={{ flex: `0 0 calc(${row.contrib[k] * 100}% - 2px)` }} tabIndex={0}
            {...tip(<><b>{sym} = {fmt(row.contrib[k])}</b><br />{name}: {fmt(w[k])} × {fmt(raw[k])}{normalize ? ' (đã chuẩn hóa min–max)' : ''}</>)} />
        ))}
      </div>
    </div>
  );
}
/** Trục 0–1 đặt trong cùng lưới cột với thanh để vạch khớp vị trí. */
export const Axis01 = () => (
  <div className="rank-row axis-row" aria-hidden="true">
    <span />
    <div className="axis">{[0, 0.25, 0.5, 0.75, 1].map((t) => <span key={t} style={{ left: `${t * 100}%` }}>{String(t).replace('.', ',')}</span>)}</div>
    <span className="c-col" />
  </div>
);
