// Định dạng & tên hiển thị dùng chung giao diện. Số kiểu vi-VN (dấu phẩy thập phân).
import { LABELS, skillCode } from '../shared/engine/index.js';
import { t, getLang } from './i18n.js';

/** Bảng tên dịch khi đọc (Object.entries / [key] đều trả bản theo ngôn ngữ hiện tại). */
const i18nMap = (o) => new Proxy(o, { get: (obj, k) => (typeof obj[k] === 'string' ? t(obj[k]) : obj[k]) });

export const fmt = (x, d = 3) => (x === null || x === undefined || Number.isNaN(x) ? '–' : getLang() === 'en' ? Number(x).toFixed(d) : Number(x).toFixed(d).replace('.', ','));
export const signed = (x, d = 3) => (x > 0 ? '+' : x < 0 ? '−' : '±') + fmt(Math.abs(x), d);

export const LABEL_CLASS = { [LABELS.PRIORITY]: 'priority', [LABELS.CONSIDER]: 'consider', [LABELS.CHALLENGE]: 'challenge', [LABELS.NONE]: 'none' };
export const ROLE_NAME = i18nMap({ student: 'Học sinh', parent: 'Phụ huynh', counselor: 'Tư vấn viên', admin: 'Quản trị' });
export const PERSONA_NAME = i18nMap({ HS: 'Học sinh', PH: 'Phụ huynh', TVV: 'Tư vấn viên' });
export const SET_NAME = i18nMap({ A: 'A · ROC (mặc định)', v6: 'v6 · ASS2', B: 'B · so sánh' });
export const GROUP_SCHOOL = { G1: 'Pythagoras', G5: 'Pythagoras', G6: 'Kabala', G4: 'Kabala', G2: 'Vệ Đà' };

export const skillName = (kb, a) => kb?.skills?.find((s) => s.archetype_no === Number(a))?.name_vi ?? skillCode(a);
export const archName = (_kb, a) => String(a);
export const groupName = (kb, g) => kb?.groups?.find((x) => x.code === g)?.name_vi ?? g;
export const envName = (kb, e) => kb?.envs?.[e] ?? e;
export const profileMajors = (kb, pid, n = 3) => kb?.majors?.filter((m) => m.profile_id === pid).slice(0, n).map((m) => m.name_vi) ?? [];
export const profileTitle = (kb, row) => `${row.profile} · ${row.A.map((a) => archName(kb, a)).join(' · ')}`;
