// Đăng ký tài khoản: chọn vai trò → điền thông tin theo vai trò.
// HS: tài khoản + bảng hỏi 4 bước (dùng lại GuestForm) · PH: liên kết con bằng mã · TVV: chờ Quản trị hệ thống duyệt.
import { cloneElement, useId, useState } from 'react';
import { api, setSession } from '../api.js';
import { GuestForm } from './Pages.jsx';
import { tr } from '../i18n.js';
import { checkUsername, checkPassword, validateRegistration, RELATIONS, GENDERS } from '../../shared/register.js';

const ROLES = () => [
  { key: 'student', icon: '🎒', title: tr('Học sinh', 'Student'), desc: tr('Trả lời bảng hỏi, lưu kết quả gợi ý ngành và chia sẻ với bố mẹ, thầy cô.', 'Answer the questionnaire, save your suggestions and share them with parents and teachers.'), note: tr('Dùng được ngay', 'Ready right away') },
  { key: 'parent', icon: '👪', title: tr('Phụ huynh', 'Parent'), desc: tr('Xem kết quả của con. Cần mã liên kết 8 ký tự lấy từ tài khoản của con.', "See your child's results. Needs the 8-character link code from your child's account."), note: tr('Con cần đăng ký trước', 'Your child signs up first') },
  { key: 'counselor', icon: '🧑‍🏫', title: tr('Tư vấn viên', 'Counselor'), desc: tr('Xem và trao đổi kết quả với học sinh được phân công.', 'View and discuss results of students assigned to you.'), note: tr('Cần quản trị viên duyệt', 'Needs admin approval') },
];

/** Thông báo lỗi do quy tắc chung trả về (tiếng Việt) – ở chế độ EN vẫn hiện nguyên văn, đủ để hiểu. */
function Field({ label, error, hint, children }) {
  const id = useId();
  const msgId = `${id}-msg`;
  const control = cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? msgId : undefined });
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control}
      {error ? <small id={msgId} className="err">{error}</small> : hint ? <small id={msgId} className="muted">{hint}</small> : null}
    </div>
  );
}

function AccountFields({ v, set, errs }) {
  return (
    <>
      <Field label={tr('Tên đăng nhập', 'Username')} error={errs.username} hint={tr('3–30 ký tự: chữ thường không dấu, số, dấu . _ -', '3–30 chars: lowercase letters, digits, . _ -')}>
        <input type="text" value={v.username} onChange={(e) => set({ username: e.target.value })} autoComplete="username" autoCapitalize="none" spellCheck={false} />
      </Field>
      <div className="reg-2col">
        <Field label={tr('Mật khẩu', 'Password')} error={errs.password} hint={tr('Ít nhất 8 ký tự, có cả chữ và số', 'At least 8 characters with letters and digits')}>
          <input type="password" value={v.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" />
        </Field>
        <Field label={tr('Nhập lại mật khẩu', 'Confirm password')} error={errs.confirm}>
          <input type="password" value={v.confirm} onChange={(e) => set({ confirm: e.target.value })} autoComplete="new-password" />
        </Field>
      </div>
    </>
  );
}

const CONSENT = {
  student: () => tr('Tôi đồng ý để hệ thống lưu họ tên, ngày sinh và câu trả lời của tôi để tính gợi ý ngành; bố mẹ (khi liên kết) và tư vấn viên được phân công có thể xem kết quả. Nếu chưa đủ 18 tuổi, tôi đã hỏi ý kiến bố mẹ hoặc người giám hộ.',
    'I agree that the system stores my name, birth date and answers to compute major suggestions; linked parents and assigned counselors may see the results. If I am under 18, I have asked my parent or guardian.'),
  parent: () => tr('Tôi là bố/mẹ/người giám hộ hợp pháp của học sinh này và đồng ý để hệ thống lưu thông tin của tôi.', 'I am the legal parent/guardian of this student and agree that the system stores my information.'),
  counselor: () => tr('Tôi cam kết chỉ dùng thông tin học sinh cho mục đích tư vấn và giữ bí mật thông tin cá nhân.', 'I will use student information only for counseling and keep personal data confidential.'),
};

export default function Register({ onLogin }) {
  const [role, setRole] = useState(null);
  const [phase, setPhase] = useState('form'); // HS: 'form' (tài khoản) → 'profile' (bảng hỏi)
  const [v, setV] = useState({ username: '', password: '', confirm: '', fullName: '', gender: '', grade: '', relation: '', childUsername: '', linkCode: '', organization: '', roleTitle: '', years: '', consent: false });
  const [draft, setDraft] = useState(null);
  const [errs, setErrs] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (patch) => setV((x) => ({ ...x, ...patch }));

  const localErrors = () => {
    const e = {};
    const u = checkUsername(v.username); if (u) e.username = u;
    const p = checkPassword(v.password, v.username); if (p) e.password = p;
    if (v.password !== v.confirm) e.confirm = tr('Hai mật khẩu chưa khớp', 'Passwords do not match');
    if (!v.consent) e.consent = tr('Cần đánh dấu đồng ý để tiếp tục', 'Please tick to agree');
    if (role !== 'student') {
      const { errors } = validateRegistration({ ...v, role });
      for (const k of ['fullName', 'relation', 'childUsername', 'linkCode', 'organization', 'years']) if (errors[k]) e[k] = errors[k];
    }
    return e;
  };

  const send = async (body) => {
    setBusy(true); setMsg(null);
    try {
      const r = await api('/auth/register', { method: 'POST', body });
      if (r.pending) { setDone(r.message); return; }
      setSession(r); onLogin(r);
    } catch (x) {
      const f = x.fields ?? {};
      setErrs(f); setMsg(x.message);
      if (role === 'student' && (f.username || f.password || f.consent || f.grade || f.gender)) setPhase('form');
    } finally { setBusy(false); }
  };

  const next = (e) => {
    e.preventDefault();
    const le = localErrors(); setErrs(le); setMsg(null);
    if (Object.keys(le).length) return;
    if (role === 'student') { setPhase('profile'); return; }
    send({ ...v, role, years: v.years === '' ? null : Number(v.years) });
  };

  if (done) {
    return (
      <section className="panel reg">
        <h2>✅ {tr('Đã gửi đăng ký', 'Registration sent')}</h2>
        <p>{tr('Tài khoản tư vấn viên cần quản trị viên hệ thống kiểm tra và duyệt. Sau khi được duyệt, bạn đăng nhập bằng tên và mật khẩu vừa tạo.', 'Counselor accounts are reviewed by a system administrator. Once approved, sign in with the username and password you just created.')}</p>
        <p><a className="btn primary" href="#/login">{tr('Đến trang đăng nhập', 'Go to sign in')}</a></p>
      </section>
    );
  }

  if (!role) {
    return (
      <section className="reg">
        <div className="panel">
          <h2>{tr('Tạo tài khoản', 'Create an account')}</h2>
          <p className="small muted">{tr('Bạn là ai? Mỗi vai trò thấy những thông tin khác nhau.', 'Who are you? Each role sees different information.')}</p>
          <div className="role-cards" role="group" aria-label={tr('Chọn vai trò', 'Choose a role')}>
            {ROLES().map((r) => (
              <button key={r.key} type="button" className="role-card" onClick={() => { setRole(r.key); setErrs({}); setMsg(null); }}>
                <span className="role-ic" aria-hidden="true">{r.icon}</span>
                <b>{r.title}</b>
                <span className="small">{r.desc}</span>
                <span className="small muted">{r.note}</span>
              </button>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>{tr('Tài khoản quản trị do nhóm phát triển cấp, không tự đăng ký được.', 'Admin accounts are issued by the project team and cannot be self-registered.')}</p>
          <p className="small" style={{ marginTop: 6 }}>{tr('Đã có tài khoản?', 'Already have an account?')} <a href="#/login">{tr('Đăng nhập', 'Sign in')}</a> · <a href="#/guest">{tr('Hoặc dùng thử không cần tài khoản', 'Or try without an account')}</a></p>
        </div>
      </section>
    );
  }

  const roleInfo = ROLES().find((r) => r.key === role);

  if (role === 'student' && phase === 'profile') {
    return (
      <GuestForm
        initial={draft ?? (v.fullName ? { fullName: v.fullName, dob: '', skills: {}, env: '', target: '', exam: {} } : undefined)}
        onDraft={setDraft}
        title={tr('Hồ sơ của bạn', 'Your profile')}
        intro={tr(`Tài khoản: ${v.username} · Câu trả lời sẽ được lưu để bạn xem lại và chia sẻ với bố mẹ, thầy cô.`, `Account: ${v.username} · Your answers are saved so you can revisit and share them.`)}
        submitLabel={tr('Tạo tài khoản & xem kết quả', 'Create account & see results')}
        onBack={() => setPhase('form')}
        error={msg}
        busy={busy}
        onSubmit={(g) => send({ role, username: v.username, password: v.password, consent: v.consent, gender: v.gender || null, grade: v.grade || null,
          fullName: g.fullName, dob: g.dob, env: g.env, skills: g.skills, target: g.target, exam: g.exam })}
      />
    );
  }

  return (
    <section className="reg">
      <form className="panel" onSubmit={next} noValidate>
        <div className="reg-head">
          <button type="button" className="btn ghost" onClick={() => { setRole(null); setPhase('form'); setErrs({}); setMsg(null); }}>← {tr('Đổi vai trò', 'Change role')}</button>
          <span className="role-chip">{roleInfo.icon} {roleInfo.title}</span>
        </div>
        <h2>{tr('Đăng ký', 'Sign up')}: {roleInfo.title}</h2>
        {role === 'student' && <p className="small muted">{tr('Bước 1/2: tạo tài khoản. Bước 2: trả lời bảng hỏi (khoảng 3 phút).', 'Step 1/2: create your account. Step 2: answer the questionnaire (about 3 minutes).')}</p>}
        {role === 'parent' && (
          <p className="note-box small">{tr('Cách lấy mã liên kết: con bạn đăng nhập → bấm nút "Mã cho bố mẹ" ở góc trên → đọc cho bạn tên đăng nhập và mã 8 ký tự.', 'How to get the link code: your child signs in → taps "Code for parents" at the top → tells you their username and the 8-character code.')}</p>
        )}
        {role === 'counselor' && (
          <p className="note-box small">{tr('Vì tư vấn viên được xem hồ sơ học sinh, tài khoản sẽ được quản trị viên hệ thống kiểm tra và duyệt trước khi dùng. Sau khi duyệt, quản trị viên sẽ phân công học sinh cho bạn.', 'Because counselors can view student profiles, your account is reviewed by a system administrator before use, who then assigns students to you.')}</p>
        )}

        <div className="reg-body">
          {role !== 'student' && (
            <Field label={tr('Họ và tên (có dấu)', 'Full name')} error={errs.fullName}>
              <input type="text" value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} autoComplete="name" />
            </Field>
          )}

          {role === 'student' && (
            <div className="reg-2col">
              <Field label={tr('Lớp (không bắt buộc)', 'Grade (optional)')} error={errs.grade}>
                <select value={v.grade} onChange={(e) => set({ grade: e.target.value })}>
                  <option value="">—</option>{[10, 11, 12].map((g) => <option key={g} value={g}>{tr(`Lớp ${g}`, `Grade ${g}`)}</option>)}
                </select>
              </Field>
              <Field label={tr('Giới tính (không bắt buộc)', 'Gender (optional)')} error={errs.gender}>
                <select value={v.gender} onChange={(e) => set({ gender: e.target.value })}>
                  <option value="">—</option>{GENDERS.map((g) => <option key={g} value={g}>{tr(g, { Nam: 'Male', Nữ: 'Female', Khác: 'Other' }[g])}</option>)}
                </select>
              </Field>
            </div>
          )}

          {role === 'parent' && (
            <>
              <Field label={tr('Bạn là', 'You are the')} error={errs.relation}>
                <select value={v.relation} onChange={(e) => set({ relation: e.target.value })}>
                  <option value="">{tr('Chọn…', 'Choose…')}</option>{RELATIONS.map((r) => <option key={r} value={r}>{tr(r, { Bố: 'Father', Mẹ: 'Mother', 'Người giám hộ': 'Guardian' }[r])}</option>)}
                </select>
              </Field>
              <div className="reg-2col">
                <Field label={tr('Tên đăng nhập của con', "Child's username")} error={errs.childUsername}>
                  <input type="text" value={v.childUsername} onChange={(e) => set({ childUsername: e.target.value })} autoCapitalize="none" spellCheck={false} />
                </Field>
                <Field label={tr('Mã liên kết (8 ký tự)', 'Link code (8 characters)')} error={errs.linkCode}>
                  <input type="text" value={v.linkCode} onChange={(e) => set({ linkCode: e.target.value.toUpperCase() })} maxLength={10} autoCapitalize="characters" spellCheck={false} className="mono" />
                </Field>
              </div>
            </>
          )}

          {role === 'counselor' && (
            <>
              <Field label={tr('Trường / đơn vị công tác', 'School / organisation')} error={errs.organization}>
                <input type="text" value={v.organization} onChange={(e) => set({ organization: e.target.value })} autoComplete="organization" />
              </Field>
              <div className="reg-2col">
                <Field label={tr('Chức vụ (không bắt buộc)', 'Job title (optional)')}>
                  <input type="text" value={v.roleTitle} onChange={(e) => set({ roleTitle: e.target.value })} placeholder={tr('VD: Giáo viên chủ nhiệm', 'e.g. Homeroom teacher')} />
                </Field>
                <Field label={tr('Số năm kinh nghiệm (không bắt buộc)', 'Years of experience (optional)')} error={errs.years}>
                  <input type="number" min="0" max="60" value={v.years} onChange={(e) => set({ years: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          <AccountFields v={v} set={set} errs={errs} />

          <label className={`consent ${errs.consent ? 'missing' : ''}`}>
            <input type="checkbox" checked={v.consent} onChange={(e) => set({ consent: e.target.checked })} />
            <span className="small">{CONSENT[role]()}</span>
          </label>
          {errs.consent && <small className="err">{errs.consent}</small>}
        </div>

        {msg && !Object.keys(errs).length && <p className="err" role="alert">{msg}</p>}
        <div className="wizard-nav">
          <a className="btn ghost" href="#/login">{tr('Đã có tài khoản? Đăng nhập', 'Have an account? Sign in')}</a>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? tr('Đang gửi…', 'Sending…') : role === 'student' ? `${tr('Tiếp tục', 'Next')} →` : role === 'counselor' ? tr('Gửi đăng ký', 'Submit') : tr('Tạo tài khoản', 'Create account')}
          </button>
        </div>
      </form>
    </section>
  );
}
