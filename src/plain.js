// Diễn giải bằng ngôn ngữ thường cho học sinh/phụ huynh. Không thêm quy tắc mới: mọi câu chỉ đọc lại số engine đã tính
// (C, EC, SR, ENV, weakList, targetAnalysis). Ký hiệu/công thức chỉ xuất hiện ở tầng Công thức (L4).
import { LABELS, targetAnalysis } from '../shared/engine/index.js';
import { fmt, skillName, envName } from './format.js';
import { tr } from './i18n.js';

/** % phù hợp = C × 100 (C đã chuẩn hóa min–max trong chính học sinh → chỉ so sánh tương đối). */
export const pct = (x) => (x == null || Number.isNaN(x) ? '–' : `${Math.round(x * 100)}%`);

/**
 * Ngành đại diện của một nhóm ngành (quy ước hiển thị, không phải quy tắc thần số học):
 * ngành đầu tiên có môi trường trùng môi trường đang chọn; không có thì ngành đầu tiên của nhóm.
 */
export function repMajor(kb, pid, env) {
  const ms = kb.majors.filter((m) => m.profile_id === pid);
  const m = ms.find((x) => x.env_code === env) ?? ms[0];
  return { name: m?.name_vi ?? pid, more: Math.max(0, ms.length - 1), all: ms };
}
export const majorName = (kb, pid, env) => repMajor(kb, pid, env).name;

/** Mức kỹ năng trung bình (thang 1–5) tương đương SR: SR = Σp(r−1)/(4Σp) ⇔ r̄ = 1 + 4·SR. */
export const avgSkill = (sr) => 1 + 4 * sr;
export const SKILL_NEED = (kb) => 1 + 4 * kb.params.SR_min; // 0,625 ⇔ 3,5/5

/** Tên kỹ năng (bỏ mã SKxx). */
export const skillsText = (kb, list) => list.map((w) => skillName(kb, w.archetype)).join(', ');

/** Câu "muốn lên Ưu tiên" – đọc lại Bước 5 (targetAnalysis) cho một nhóm ngành. */
export function nextStepPlain(row, result, kb) {
  if (!row || row.label === LABELS.PRIORITY) return null;
  const ta = targetAnalysis(result, row.profile, { ...kb.params, p: result.p });
  if (!ta) return null;
  if (ta.status === 'EC0') return tr('Không con số nào của bạn trùng với nhóm ngành này, nên tăng kỹ năng cũng không thay đổi được.', 'None of your numbers match this group, so raising skills cannot change it.');
  if (ta.status === 'EC_LOW') return tr('Chỉ 1 con số trùng nên nhóm ngành này tối đa là "Cân nhắc", dù tăng kỹ năng.', 'Only 1 number matches, so this group stays at "Consider" at most, even with higher skills.');
  const parts = [];
  if (row.weakList.length) parts.push(tr(`nâng ${row.weakList.map((w) => `${skillName(kb, w.archetype)} lên 3/5`).join(', ')}`, `raise ${row.weakList.map((w) => `${skillName(kb, w.archetype)} to 3/5`).join(', ')}`));
  if (ta.gap > 1e-9) parts.push(tr(`tăng ${skillName(kb, row.A[0])} thêm ${ta.stepsMain} bậc`, `raise ${skillName(kb, row.A[0])} by ${ta.stepsMain} level(s)`));
  return parts.length ? parts.join(tr(' và ', ' and ')) : null;
}

/** Một dòng nhận xét (khu vực Insight) cho thẻ ngành phù hợp nhất. */
export function insightLine(row, result, kb) {
  if (!row) return '';
  const bits = [row.ENV ? tr('Hợp môi trường bạn chọn', 'Fits the environment you chose') : tr('Môi trường khác với lựa chọn của bạn', 'Environment differs from your choice')];
  if (row.weakList.length) bits.push(tr(`nên cải thiện kỹ năng ${skillsText(kb, row.weakList)}`, `work on ${skillsText(kb, row.weakList)}`));
  else if (row.SR < kb.params.SR_min - 1e-9) bits.push(tr(`nên cải thiện kỹ năng ${skillName(kb, row.A[0])}`, `work on ${skillName(kb, row.A[0])}`));
  else bits.push(tr('kỹ năng liên quan đã đủ mức', 'related skills are strong enough'));
  if (row.EC === 1) bits.push(tr('chỉ 1 con số trùng, nên tham khảo thêm', 'only 1 number matches – get a second opinion'));
  return bits.join(' · ');
}

/** Câu giải thích nhãn bằng lời. */
export function labelPlain(row, rOrKb, kbMaybe) {
  const kb = kbMaybe ?? rOrKb;
  if (!row || !kb?.params) return '';
  const need = fmt(SKILL_NEED(kb), 1);
  if (row.label === LABELS.NONE) return tr('Không con số nào của bạn trùng với nhóm ngành này, nên hệ thống không đề xuất.', 'None of your numbers match this group, so it is not recommended.');
  if (row.label === LABELS.CHALLENGE) return tr(`Có kỹ năng liên quan bạn tự chấm từ 2/5 trở xuống (${skillsText(kb, row.weakList ?? [])}).`, `You rated a related skill 2/5 or lower (${skillsText(kb, row.weakList ?? [])}).`);
  if (row.label === LABELS.PRIORITY) return tr(`Có từ 2 con số trùng và kỹ năng trung bình từ ${need}/5.`, `At least 2 numbers match and average skill is ${need}/5 or more.`);
  const miss = [row.EC < kb.params.EC_min ? tr(`mới có ${row.EC} con số trùng`, `only ${row.EC} number matches`) : null,
    row.SR < kb.params.SR_min - 1e-9 ? tr(`kỹ năng mới đạt ${fmt(avgSkill(row.SR), 1)}/5`, `skills average ${fmt(avgSkill(row.SR), 1)}/5`) : null].filter(Boolean).join(tr(', ', ', '));
  return tr(`Để được "Ưu tiên" cần ít nhất 2 con số trùng và kỹ năng trung bình từ ${need}/5; bạn ${miss}.`, `"Priority" needs at least 2 matching numbers and average skill ${need}/5; you have ${miss}.`);
}

/** Tên dễ hiểu của 5 cấu hình kiểm tra độ chắc chắn. */
export const STAB_NAME = {
  BASE_HS: ['Góc nhìn học sinh', 'Student view'], PH: ['Góc nhìn phụ huynh', 'Parent view'], TVV: ['Góc nhìn tư vấn viên', 'Counselor view'],
  PY_ONLY: ['Chỉ dùng con số Pythagoras', 'Pythagorean numbers only'], EQUAL_P: ['Mọi vị trí tính như nhau', 'All positions weighted equally'],
};
export const stabWord = (n) => (n >= 5 ? tr('rất chắc chắn', 'very consistent') : n >= 3 ? tr('khá chắc chắn', 'fairly consistent') : tr('chưa chắc chắn', 'not consistent'));

/** Chuỗi rút gọn kiểu Pythagoras (PY00): cộng chữ số đến khi ≤ 11 hoặc = 22. */
export function py00Chain(n) {
  const steps = [];
  let x = n;
  while (x > 11 && x !== 22) { const d = String(x).split('').map(Number); const s = d.reduce((a, b) => a + b, 0); steps.push(`${d.join(' + ')} = ${s}`); x = s; }
  return { steps, value: x };
}
/** Rút gọn về 1 chữ số (1–9). */
export function rootChain(n) {
  const steps = [];
  let x = n;
  while (x > 9) { const d = String(x).split('').map(Number); const s = d.reduce((a, b) => a + b, 0); steps.push(`${d.join(' + ')} = ${s}`); x = s; }
  return { steps, value: x };
}
/** "13 → 1 + 3 = 4" */
export const chainText = (start, c) => [String(start), ...c.steps].join(' → ');

export const envText = (kb, e) => envName(kb, e);
