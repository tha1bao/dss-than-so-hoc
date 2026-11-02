// Khung ứng dụng: định tuyến theo hash, phiên đăng nhập, giao diện sáng/tối, chân trang bắt buộc (dữ liệu mô phỏng + E10).
import { useEffect, useState } from 'react';
import { ENGINE_VERSION } from '../shared/engine/index.js';
import { getSession, setSession } from './api.js';
import { ROLE_NAME } from './format.js';
import { TipProvider } from './components/common.jsx';
import StudentView from './pages/StudentView.jsx';
import { Login, StudentList, GuestForm, Admin } from './pages/Pages.jsx';
import { TestRunner, TestReport } from './pages/Usability.jsx';
import { t, tr, getLang, setLang } from './i18n.js';

function parseHash() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = h.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}
const go = (path) => { window.location.hash = path; };

function useTheme() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('dss.theme') || 'auto'; } catch { return 'auto'; } });
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'auto') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', theme);
    try { localStorage.setItem('dss.theme', theme); } catch { /* bỏ qua */ }
  }, [theme]);
  return [theme, () => setTheme((t) => ({ auto: 'light', light: 'dark', dark: 'auto' }[t]))];
}

function homeFor(user) {
  if (!user) return '/login';
  if (user.role === 'student') return `/s/${user.personCode}/l0`;
  return '/students';
}

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [session, setSess] = useState(getSession);
  const [guest, setGuest] = useState(null);
  const [theme, cycleTheme] = useTheme();
  const [lang, setLangState] = useState(getLang);
  const toggleLang = () => { const l = lang === 'en' ? 'vi' : 'en'; setLang(l); setLangState(l); };
  const user = session?.user ?? null;

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    const onLogout = () => setSess(null);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('dss:logout', onLogout);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('dss:logout', onLogout); };
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [route.parts.join('/')]);

  const logout = () => { setSession(null); setSess(null); setGuest(null); go('/login'); };
  const [p0, p1, p2] = route.parts;
  let page;
  if (p0 === 'guest') {
    if (p1 && guest) page = <StudentView source={{ kind: 'guest', person: guest }} user={null} layer={p1} sel={route.query.get('p')} go={go} />;
    else page = <GuestForm initial={guest} onSubmit={(g) => { setGuest(g); go('/guest/l0'); }} />;
  } else if (!user) {
    page = <Login onLogin={(s) => { setSess(s); go(homeFor(s.user)); }} />;
  } else if (p0 === 's' && p1) {
    page = <StudentView key={p1} source={{ kind: 'student', id: p1 }} user={user} layer={p2 ?? 'l0'} sel={route.query.get('p')} go={go} />;
  } else if (p0 === 'students' && user.role !== 'student') {
    page = <StudentList user={user} go={go} />;
  } else if (p0 === 'test' && ['admin', 'counselor'].includes(user.role)) {
    page = p1 === 'report' ? <TestReport user={user} /> : <TestRunner />;
  } else if (p0 === 'admin' && user.role === 'admin') {
    page = <Admin user={user} />;
  } else {
    setTimeout(() => go(homeFor(user)), 0);
    page = null;
  }

  return (
    <TipProvider>
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <h1><a href="#/" style={{ textDecoration: 'none' }}>{t('DSS gợi ý nhóm ngành theo thần số học')}</a></h1>
            <small>{t('DSS301 · Nhóm 2 · ASS3 – Pythagoras · Kabala · Vệ Đà + kỹ năng tự đánh giá + môi trường mong muốn')}</small>
          </div>
          <span className="sim-badge">{t('Dữ liệu mô phỏng')}</span>
          {user && user.role === 'admin' && <a className="btn" href="#/admin">{t('Quản trị')}</a>}
          {user && user.role !== 'student' && <a className="btn" href="#/students">{t('Danh sách')}</a>}
          {user && ['admin', 'counselor'].includes(user.role) && <a className="btn" href="#/test/report">{t('Test khả dụng')}</a>}
          <button type="button" className="btn" onClick={toggleLang} lang={lang === 'en' ? 'vi' : 'en'} aria-label="Ngôn ngữ / Language">{lang === 'en' ? 'Tiếng Việt' : 'English'}</button>
          <button type="button" className="btn" onClick={cycleTheme} title={t('Đổi giao diện')}>{t({ auto: 'Giao diện: theo máy', light: 'Giao diện: sáng', dark: 'Giao diện: tối' }[theme])}</button>
          {user ? (
            <span className="who"><span className="role-chip">{ROLE_NAME[user.role]}</span>{user.displayName}<button type="button" className="btn" onClick={logout}>{t('Đăng xuất')}</button></span>
          ) : p0 === 'guest' ? <a className="btn" href="#/login">{t('Đăng nhập')}</a> : null}
        </header>
        <main key={lang}>{page}</main>
        <footer className="foot">
          <p><b>{t('Dữ liệu mô phỏng')}</b> {t('– học sinh, phụ huynh, tư vấn viên trên trang này là người giả lập, không phải người thật.')}</p>
          <p>{t('Thần số học không có giá trị dự báo khoa học (E10). Kết quả chỉ là gợi ý để trao đổi cùng gia đình và tư vấn viên – không thay thế tư vấn hướng nghiệp, năng lực học tập và điểm thi.')}</p>
          <p className="muted">Engine {ENGINE_VERSION} · {tr('khớp engine.py và DSS_ASS2_ThanSoHoc_v6.xlsx (test hồi quy) · mặc định bộ trọng số A (ROC) + chuẩn hóa min–max.', 'matches engine.py and DSS_ASS2_ThanSoHoc_v6.xlsx (regression tests) · default weight set A (ROC) + min–max normalization.')}</p>
          {lang === 'en' && <p className="muted">{t('Nội dung tri thức (ý nghĩa con số, tên ngành, trích dẫn) giữ nguyên ngôn ngữ nguồn; câu giải thích và cảnh báo đã có bản tiếng Anh.')}</p>}
        </footer>
      </div>
    </TipProvider>
  );
}
