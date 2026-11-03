// Công thức hiển thị kiểu LaTeX (giống ảnh công thức trong Phụ lục ASS2) bằng KaTeX.
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { fmt } from '../format.js';

export function Tex({ children, display = true, className = '' }) {
  const html = useMemo(() => {
    try { return katex.renderToString(children, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'html' }); }
    catch { return null; }
  }, [children, display]);
  if (!html) return <code>{children}</code>;
  return <span className={`tex ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Số trong công thức: dấu phẩy thập phân kiểu vi-VN cần bọc {,} để KaTeX không chèn khoảng trắng. */
export const tn = (x, d = 3) => fmt(x, d).replace(/,/g, '{,}');
/** Chữ thường trong công thức (escape ký tự đặc biệt của TeX). */
export const tt = (s) => `\\text{${String(s).replace(/[\\{}$&#%_^~]/g, (c) => `\\${c}`)}}`;
