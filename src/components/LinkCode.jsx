// Nút "Mã cho bố mẹ" của học sinh: hiện tên đăng nhập + mã liên kết 8 ký tự để phụ huynh tự đăng ký và liên kết.
import { useState } from 'react';
import { api, getSession } from '../api.js';
import { tr } from '../i18n.js';

export function LinkCodeButton() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(false);
  const load = (e) => {
    if (!e.currentTarget.open || data) return;
    api('/auth/link-code').then(setData).catch((x) => setErr(x.message));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(data.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* trình duyệt chặn */ }
  };
  return (
    <details className="linkcode" onToggle={load}>
      <summary className="btn">👪 {tr('Mã cho bố mẹ', 'Code for parents')}</summary>
      <div className="linkcode-pop panel">
        <p className="small">{tr('Bố mẹ vào "Đăng ký" → chọn "Phụ huynh" → nhập tên đăng nhập và mã dưới đây để xem kết quả của bạn.', 'Your parent opens "Sign up" → "Parent" → enters your username and the code below to see your results.')}</p>
        {err && <p className="err small">{err}</p>}
        {!data && !err && <p className="small muted">{tr('Đang tải…', 'Loading…')}</p>}
        {data && (
          <>
            <dl className="linkcode-dl">
              <dt>{tr('Tên đăng nhập', 'Username')}</dt><dd className="mono">{getSession()?.user?.username}</dd>
              <dt>{tr('Mã liên kết', 'Link code')}</dt><dd className="mono big">{data.code.slice(0, 4)}-{data.code.slice(4)}</dd>
            </dl>
            <button type="button" className="btn" onClick={copy}>{copied ? tr('Đã chép ✓', 'Copied ✓') : tr('Chép mã', 'Copy code')}</button>
            <p className="small muted" style={{ marginTop: 6 }}>
              {data.parents.length
                ? `${tr('Đã liên kết', 'Linked')}: ${data.parents.map((p) => `${p.name} (${p.relation ?? ''})`).join(', ')}`
                : tr('Chưa có phụ huynh nào liên kết.', 'No parent linked yet.')}
            </p>
            <p className="small muted">{tr('Chỉ đưa mã cho bố mẹ hoặc người giám hộ của bạn.', 'Only share this code with your parent or guardian.')}</p>
          </>
        )}
      </div>
    </details>
  );
}
