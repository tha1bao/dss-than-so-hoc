// Song ngữ VI/EN (Pha 4 – localization, Ch6). Khóa = chính chuỗi tiếng Việt → không có chuỗi nào "mất" khi thiếu bản dịch.
// Tri thức nguồn (ý nghĩa con số, tên ngành, trích dẫn) giữ nguyên ngôn ngữ gốc; mẫu câu "Vì sao?" và cảnh báo lấy
// template_en / message_en từ DB (db/etl/i18n_en.json).
import EN from './i18n.en.json';

const read = () => { try { return localStorage.getItem('dss.lang') === 'en' ? 'en' : 'vi'; } catch { return 'vi'; } };
let lang = read();

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'vi';
  try { localStorage.setItem('dss.lang', lang); } catch { /* bỏ qua */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
if (typeof document !== 'undefined') document.documentElement.lang = lang;

/** Dịch một chuỗi; vars thay {tên}. Không có bản dịch → giữ tiếng Việt. */
export function t(vi, vars) {
  let s = (lang === 'en' && EN[vi]) || vi;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}
/** Chọn nhanh theo ngôn ngữ cho câu có ghép biểu thức. */
export const tr = (vi, en) => (lang === 'en' ? en : vi);

/** Câu engine sinh ra (dùng fmt dấu phẩy) → dấu chấm thập phân khi xem tiếng Anh. */
export const num = (s) => (lang === 'en' && typeof s === 'string' ? s.replace(/(\d),(\d)/g, '$1.$2') : s);

/**
 * Bản tri thức theo ngôn ngữ để engine sinh câu giải thích/cảnh báo đúng ngôn ngữ.
 * Không đổi bất kỳ số liệu nào – chỉ đổi chuỗi hiển thị (mẫu câu, thông điệp, tên môi trường/nhóm/kỹ năng).
 */
const cache = new WeakMap();
export function localizeKb(kb) {
  if (!kb || lang !== 'en') return kb;
  if (cache.has(kb)) return cache.get(kb);
  const skillEn = Object.fromEntries((kb.archetypes ?? []).map((a) => [a.number, a.skill_cluster]));
  const out = {
    ...kb,
    templates: { ...kb.templates, ...(kb.templatesEn ?? {}) },
    rules: Object.fromEntries(Object.entries(kb.rules ?? {}).map(([c, r]) => [c, { ...r, message_vi: r.message_en || r.message_vi }])),
    envs: { ...kb.envs, ...(kb.envsEn ?? {}) },
    groups: kb.groups.map((g) => ({ ...g, name_vi: EN[g.name_vi] ?? g.name_vi })),
    skills: kb.skills.map((s) => ({ ...s, name_vi: skillEn[s.archetype_no] ?? s.name_vi })),
  };
  cache.set(kb, out);
  return out;
}
