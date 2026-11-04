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

const ARCH_TRAIT_VI = {
  1: 'Tiên phong, độc lập, quyết đoán',
  2: 'Hòa nhã, tinh tế, hợp tác',
  3: 'Sáng tạo, hoạt ngôn, lạc quan',
  4: 'Thực tế, kỷ luật, quy củ',
  5: 'Tự do, linh hoạt, thích khám phá',
  6: 'Trách nhiệm, quan tâm, hòa ái',
  7: 'Nghiên cứu, chiều sâu, tri thức',
  8: 'Quản trị, thành tựu, hiệu quả',
  9: 'Nhân đạo, lý tưởng, cống hiến',
  11: 'Trực giác nhạy bén, truyền cảm hứng, lý tưởng',
  22: 'Kiến tạo quy mô lớn, chiến lược, thực thi',
  33: 'Phụng sự, giáo dục, chữa lành, nâng đỡ',
};
export const archTrait = (kb, a) => {
  if (getLang() === 'vi' && ARCH_TRAIT_VI[a]) return ARCH_TRAIT_VI[a];
  return kb?.archetypes?.find((x) => x.number === Number(a))?.trait ?? '';
};

const CLEAN_GROUP_VI = {
  G1: 'Số chủ đạo',
  G2: 'Số ngày sinh',
  G4: 'Số thứ trong tuần',
  G5: 'Số tên đầy đủ',
  G6: 'Số tên Kabala',
  SU: 'Số linh hồn',
};

export const groupName = (kb, g) => {
  if (getLang() === 'vi') {
    if (CLEAN_GROUP_VI[g]) return CLEAN_GROUP_VI[g];
    const name = kb?.groups?.find((x) => x.code === g)?.name_vi ?? g;
    return typeof name === 'string' ? name.replace(/\s*\([A-Za-z\s]+\)$/, '') : name;
  }
  return kb?.groups?.find((x) => x.code === g)?.name_vi ?? g;
};

export const envName = (kb, e) => kb?.envs?.[e] ?? e;
export const profileMajors = (kb, pid, n = 3) => kb?.majors?.filter((m) => m.profile_id === pid).slice(0, n).map((m) => m.name_vi) ?? [];
export const profileTitle = (kb, row) => `${row.profile} · ${row.A.map((a) => archName(kb, a)).join(' · ')}`;
