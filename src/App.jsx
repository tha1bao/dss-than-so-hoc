// Khung ứng dụng: định tuyến theo hash, phiên đăng nhập, giao diện sáng/tối, chân trang bắt buộc (dữ liệu mô phỏng + E10).
import React, { Component, useEffect, useState } from 'react';
import { ENGINE_VERSION } from '../shared/engine/index.js';
import { getSession, setSession } from './api.js';
import { ROLE_NAME } from './format.js';
import { TipProvider } from './components/common.jsx';
import StudentView from './pages/StudentView.jsx';
import { Login, StudentList, GuestForm, Admin } from './pages/Pages.jsx';
import { TestRunner, TestReport } from './pages/Usability.jsx';
import { t, tr, getLang, setLang } from './i18n.js';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('DSS ErrorBoundary caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <section className="panel" style={{ maxWidth: 640, margin: '40px auto', padding: 24, textAlign: 'center' }}>
          <h2 style={{ color: 'var(--err, #d32f2f)', marginBottom: 8 }}>⚠️ {t('Đã xảy ra sự cố hiển thị')}</h2>
          <p className="small muted" style={{ marginBottom: 16 }}>{this.state.error?.message || t('Không thể tải phần nội dung này.')}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = '#/'; }}>
              {t('Về trang chính')}
            </button>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              {t('Tải lại trang')}
            </button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

const GUEST_KEY = 'dss.guest';
function getStoredGuest() {
  try {
    const raw = sessionStorage.getItem(GUEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function setStoredGuest(g) {
  try {
    if (g) sessionStorage.setItem(GUEST_KEY, JSON.stringify(g));
    else sessionStorage.removeItem(GUEST_KEY);
  } catch { /* bỏ qua */ }
}

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
  const [guest, setGuestState] = useState(getStoredGuest);
  const setGuest = (g) => { setStoredGuest(g); setGuestState(g); };
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
    else page = <GuestForm initial={guest} onSubmit={(g) => { setGuest(g); go(`/guest/${p1 || 'l0'}${route.query.get('p') ? `?p=${route.query.get('p')}` : ''}`); }} />;
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
          <h1 className="brand"><a href="#/">{t('DSS chọn ngành')}</a></h1>
          <span className="sim-badge">{t('Dữ liệu mô phỏng')}</span>
          <nav className="topnav">
            {user && user.role !== 'student' && <a className="btn" href="#/students">{t('Danh sách')}</a>}
            {user && ['admin', 'counselor'].includes(user.role) && <a className="btn" href="#/test/report">{t('Test khả dụng')}</a>}
            {user && user.role === 'admin' && <a className="btn" href="#/admin">{t('Quản trị')}</a>}
          </nav>
          <button type="button" className="btn icon" onClick={toggleLang} lang={lang === 'en' ? 'vi' : 'en'} aria-label="Ngôn ngữ / Language">{lang === 'en' ? 'VI' : 'EN'}</button>
          <button type="button" className="btn icon" onClick={cycleTheme} aria-label={t({ auto: 'Giao diện: theo máy', light: 'Giao diện: sáng', dark: 'Giao diện: tối' }[theme])} title={t({ auto: 'Giao diện: theo máy', light: 'Giao diện: sáng', dark: 'Giao diện: tối' }[theme])}>{{ auto: '◐', light: '☀', dark: '☾' }[theme]}</button>
          {user ? (
            <span className="who"><span className="role-chip">{ROLE_NAME[user.role]}</span>{user.displayName}<button type="button" className="btn" onClick={logout}>{t('Đăng xuất')}</button></span>
          ) : p0 === 'guest' ? <a className="btn" href="#/login">{t('Đăng nhập')}</a> : null}
        </header>
        <main key={lang}>
          <ErrorBoundary key={`${lang}-${route.parts.join('/')}-${route.query.get('p') ?? ''}`}>
            {page}
          </ErrorBoundary>
        </main>
        <footer className="foot">
          <p><b>{t('Dữ liệu mô phỏng')}</b> · {t('Thần số học không có giá trị dự báo khoa học – kết quả chỉ để trao đổi cùng gia đình và tư vấn viên.')}
            <span className="muted"> · Engine {ENGINE_VERSION} · DSS301 {tr('Nhóm', 'Group')} 2{lang === 'en' ? ` · ${t('Tri thức nguồn giữ ngôn ngữ gốc.')}` : ''}</span></p>
        </footer>
      </div>
    </TipProvider>
  );
}
