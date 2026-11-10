// Diễn giải bằng ngôn ngữ thường cho học sinh/phụ huynh. Không thêm quy tắc mới: mọi câu chỉ đọc lại số engine đã tính
// (C, EC, SR, ENV, weakList, targetAnalysis). Ký hiệu/công thức chỉ xuất hiện ở tầng Công thức (L4).
import { LABELS, targetAnalysis } from '../shared/engine/index.js';
import { fmt, skillName, envName } from './format.js';
import { tr, t } from './i18n.js';
import { computeExtras } from '../shared/engine/numerology.js';
import { archTrait, groupName, PERSONA_NAME } from './format.js';
import { getMeaningVi } from './data/number_meanings_vi.js';

/** % phù hợp = C × 100 (C đã chuẩn hóa min–max trong chính học sinh → chỉ so sánh tương đối). */
export const pct = (x) => (x == null || Number.isNaN(x) ? '–' : `${Math.round(x * 100)}%`);

/**
 * Ngành đại diện của một nhóm ngành (quy ước hiển thị, không phải quy tắc thần số học):
 * ngành đầu tiên có môi trường trùng môi trường đang chọn; không có thì ngành đầu tiên của nhóm.
 */
export function repMajor(kb, pid, env) {
  const ms = kb?.majors ? kb.majors.filter((m) => m.profile_id === pid) : [];
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

export const ARROW_EXPLAIN_VI = {
  '1-2-3': {
    titleStrong: 'Trục 1-2-3: Thế mạnh Lập kế hoạch & Tổ chức',
    descStrong: 'Tư duy sắp xếp công việc khoa học, ngăn nắp và có phương pháp.',
    titleWeak: 'Gợi ý: tập lập kế hoạch',
    descWeak: 'Thử lập thời gian biểu học tập mỗi tuần – một thói quen nhỏ nhưng rất có ích khi lên đại học.',
  },
  '4-5-6': {
    titleStrong: 'Trục 4-5-6: Thế mạnh Ý chí & Nghị lực',
    descStrong: 'Nghị lực bền bỉ, kiên định vượt khó và có tinh thần tự giác cao.',
    titleWeak: 'Gợi ý: rèn sự kiên nhẫn',
    descWeak: 'Khi gặp bài khó, thử chia nhỏ thành từng bước và kiên trì thêm một chút trước khi bỏ qua.',
  },
  '7-8-9': {
    titleStrong: 'Trục 7-8-9: Thế mạnh Năng động & Nhiệt huyết',
    descStrong: 'Giàu năng lượng, chủ động nắm bắt cơ hội và hành động quyết liệt.',
    titleWeak: 'Gợi ý: chủ động trải nghiệm',
    descWeak: 'Tham gia câu lạc bộ hoặc hoạt động ngoại khóa sẽ giúp bạn hiểu mình thích gì hơn.',
  },
  '1-4-7': {
    titleStrong: 'Trục 1-4-7: Thế mạnh Thực tế & Khéo léo',
    descStrong: 'Tư duy thực tế, tháo vát và có năng lực triển khai ý tưởng ra hành động.',
    titleWeak: 'Gợi ý: học qua thực hành',
    descWeak: 'Thử làm dự án nhỏ, thí nghiệm hoặc việc tay chân để biến ý tưởng thành sản phẩm thật.',
  },
  '2-5-8': {
    titleStrong: 'Trục 2-5-8: Thế mạnh Cân bằng Cảm xúc',
    descStrong: 'Giàu lòng trắc ẩn, trực giác tinh tế và khả năng thấu hiểu người khác.',
    titleWeak: 'Gợi ý: chia sẻ cảm xúc',
    descWeak: 'Dành thời gian thư giãn và trò chuyện với người bạn tin tưởng khi thấy áp lực.',
  },
  '3-6-9': {
    titleStrong: 'Trục 3-6-9: Thế mạnh Trí tuệ & Tư duy Sáng tạo',
    descStrong: 'Khả năng tư duy logic nhạy bén, tiếp thu nhanh và trí nhớ tốt.',
    titleWeak: 'Gợi ý: thử sơ đồ tư duy',
    descWeak: 'Sơ đồ tư duy (mindmap) có thể giúp bạn ghi nhớ và ôn bài nhanh hơn.',
  },
  '1-5-9': {
    titleStrong: 'Trục 1-5-9: Thế mạnh Quyết tâm & Kiên định',
    descStrong: 'Tính kiên trì, quyết đoán và theo đuổi mục tiêu đến cùng.',
    titleWeak: 'Gợi ý: luyện ra quyết định',
    descWeak: 'Đặt hạn chót cho những việc nhỏ để quen với việc chọn và làm ngay.',
  },
  '3-5-7': {
    titleStrong: 'Trục 3-5-7: Thế mạnh Nhận thức & Trực giác Sâu sắc',
    descStrong: 'Tâm hồn sâu sắc, trực giác tinh anh và ham tìm hiểu bản chất cuộc sống.',
    titleWeak: 'Gợi ý: lắng nghe nhiều góc nhìn',
    descWeak: 'Thử nghe thêm ý kiến của bạn bè, thầy cô trước khi chốt một quyết định quan trọng.',
  },
};

/**
 * Tạo cấu trúc dữ liệu luận giải định hướng chuyên sâu (Story Narrative) cho Tab L1 và Drawer:
 * 1. Hồ sơ cá nhân học sinh (Thần số học: Số chủ đạo, ngày sinh, tên, ma trận ngày sinh, trục tâm lý).
 * 2. Yêu cầu & môi trường của nhóm ngành (3 nét tính cách, môi trường, 3 kỹ năng cốt lõi).
 * 3. Đối chiếu & phân bổ điểm số (% đóng góp từng trụ cột: Thần số học, Kỹ năng, Môi trường).
 * 4. Tổng kết mức độ phù hợp, giải mã nhãn mác (Ưu tiên / Cân nhắc / Thử thách) và bước rèn luyện tiếp theo.
 */
export function buildNarrativeWhy(row, out, kb) {
  if (!row || !out) return null;
  const { sig, result: r } = out;
  const extras = sig && !sig.redacted ? computeExtras(sig, kb) : null;
  const m = repMajor(kb, row.profile, r.env);
  const nOn = r.groups ? r.groups.length : 5;
  const hits = r.groups ? r.groups.filter((g) => row.khop?.[g] > 0) : [];

  // 1. Hồ sơ Thần số học học sinh
  const sigList = sig ? [
    {
      code: 'G1',
      name: groupName(kb, 'G1'),
      val: sig.G1,
      meaning: getMeaningVi('PY', sig.G1)?.meaning ?? archTrait(kb, sig.G1),
      matched: Boolean(row.khop?.G1 > 0),
    },
    {
      code: 'G2',
      name: groupName(kb, 'G2'),
      val: sig.G2,
      meaning: getMeaningVi('VE', sig.G2)?.meaning ?? archTrait(kb, sig.G2),
      matched: Boolean(row.khop?.G2 > 0),
    },
    {
      code: 'G4',
      name: groupName(kb, 'G4'),
      val: sig.G4,
      meaning: getMeaningVi('KB', sig.G4)?.meaning ?? archTrait(kb, sig.G4),
      matched: Boolean(row.khop?.G4 > 0),
    },
    {
      code: 'G5',
      name: groupName(kb, 'G5'),
      val: sig.G5,
      meaning: getMeaningVi('PY', sig.G5)?.meaning ?? archTrait(kb, sig.G5),
      matched: Boolean(row.khop?.G5 > 0),
    },
    {
      code: 'G6',
      name: groupName(kb, 'G6'),
      val: sig.G6,
      meaning: getMeaningVi('KB', sig.G6)?.meaning ?? archTrait(kb, sig.G6),
      matched: Boolean(row.khop?.G6 > 0),
    },
  ] : [];

  const birthDigits = sig?.digits?.filter((d) => d > 0) ?? [];
  const birthMatrixPresent = extras?.birthChart
    ? Object.keys(extras.birthChart).map(Number).filter((k) => extras.birthChart[k] > 0)
    : [];

  const arrowAnalysis = [];
  for (const rawArr of (extras?.arrows ?? [])) {
    const [code, ...nameParts] = rawArr.split(': ');
    const name = nameParts.join(': ').trim();
    const info = ARROW_EXPLAIN_VI[code];
    if (info) {
      const isWeak = [
        'Arrow of Frustration', 'Arrow of Scepticism', 'Arrow of Disorganisation',
        'Arrow of Passivity', 'Arrow of Disorder', 'Arrow of Hypersensitivity',
        'Arrow of Poor Memory', 'Arrow of Procrastination'
      ].includes(name);
      arrowAnalysis.push({
        code,
        isStrong: !isWeak,
        title: isWeak ? info.titleWeak : info.titleStrong,
        desc: isWeak ? info.descWeak : info.descStrong,
      });
    }
  }
  arrowAnalysis.sort((x, y) => Number(y.isStrong) - Number(x.isStrong)); // thế mạnh trước, gợi ý sau

  // 2. Đặc điểm & Yêu cầu nhóm ngành
  const majorTraits = (row.A || []).map((a, i) => ({
    pos: i + 1,
    archetype: a,
    traitTitle: archTrait(kb, a),
    skill: skillName(kb, a),
    rating: row.KN?.[i] ?? 3,
    matchedGroups: r.groups ? r.groups.filter((g) => sig?.arch?.[g] === a).map((g) => groupName(kb, g)) : [],
  }));

  // 3. Phân bổ điểm số (% đóng góp) theo cơ cấu điểm tối đa (Weight Budget)
  const [a, b, g] = r.weights ?? [0.111, 0.278, 0.611];
  const personaName = PERSONA_NAME[r.persona] ?? r.persona;
  const maxPtsENV = Math.round(g * 100);
  const maxPtsSR = Math.round(b * 100);
  const maxPtsNF = Math.max(0, 100 - maxPtsENV - maxPtsSR);

  const cNF = row.contrib?.NF ?? 0;
  const cSR = row.contrib?.SR ?? 0;
  const cENV = row.contrib?.ENV ?? 0;
  const pctNF = Math.round(cNF * 100);
  const pctSR = Math.round(cSR * 100);
  const pctENV = Math.round(cENV * 100);
  const totalPct = Math.round(row.C * 100);

  // Chuỗi công thức trực quan, dễ hiểu, KHÔNG NHÂN % × %
  const formulaNF = tr(
    `Thần số học = Đạt ${pctNF}% (trên tối đa ${maxPtsNF}% của góc nhìn ${personaName})`,
    `Numerology = Earns ${pctNF}% (out of max ${maxPtsNF}% for ${personaName} view)`
  );
  const formulaSR = tr(
    `Kỹ năng = Đạt ${pctSR}% (trên tối đa ${maxPtsSR}% của góc nhìn ${personaName})`,
    `Skills = Earns ${pctSR}% (out of max ${maxPtsSR}% for ${personaName} view)`
  );
  const formulaENV = tr(
    `Môi trường = Đạt ${pctENV}% (trên tối đa ${maxPtsENV}% của góc nhìn ${personaName})`,
    `Environment = Earns ${pctENV}% (out of max ${maxPtsENV}% for ${personaName} view)`
  );
  const formulaTotal = tr(
    `Tổng điểm phù hợp = ${pctENV}% (Môi trường) + ${pctSR}% (Kỹ năng) + ${pctNF}% (Thần số học) = ${totalPct}%`,
    `Overall Fit = ${pctENV}% (Environment) + ${pctSR}% (Skills) + ${pctNF}% (Numerology) = ${totalPct}%`
  );

  // Câu giải thích viết THEO TỪNG TRƯỜNG HỢP (số con số trùng, vị trí trùng, đạt tối đa hay chưa) – không dùng câu ghép cố định.
  const posOf = (g) => (row.A || []).indexOf(sig?.arch?.[g]);
  const POS_VI = ['nét chính', 'nét phụ', 'nét bổ trợ'], POS_EN = ['main trait', 'second trait', 'supporting trait'];
  const hitText = hits.map((g) => `${groupName(kb, g)} ${sig[g]} → ${tr(POS_VI[posOf(g)] ?? 'nét ngành', POS_EN[posOf(g)] ?? 'trait')}`).join('; ');
  const relSentence = (n, got, max, what, whatEn) => {
    if (n == null) return '';
    if (n >= 1 - 1e-9) return tr(`So với các nhóm ngành khác của bạn, đây là mức ${what} cao nhất, nên phần này được trọn ${got}/${max}%.`, `Compared with your other major groups this is your highest ${whatEn}, so this part earns the full ${got}/${max}%.`);
    if (n <= 1e-9) return tr(`So với các nhóm ngành khác của bạn, đây là mức ${what} thấp nhất, nên phần này được 0/${max}%.`, `Compared with your other major groups this is your lowest ${whatEn}, so this part earns 0/${max}%.`);
    return tr(`Mức ${what} này bằng khoảng ${Math.round(n * 100)}% so với nhóm ngành tốt nhất của bạn ở mục này, nên được ${got}/${max}%.`, `This ${whatEn} is about ${Math.round(n * 100)}% of your best group on this factor, so it earns ${got}/${max}%.`);
  };
  const formulaDetailNF = row.EC >= 1
    ? `${tr(`Bạn có ${row.EC}/${nOn} con số trùng với nét tính cách của ngành (${hitText}).`, `${row.EC} of your ${nOn} numbers match this group's traits (${hitText}).`)} ${relSentence(row.NF_n, pctNF, maxPtsNF, 'trùng con số', 'number match')}`
    : tr(
        `Không có con số nào trong ${nOn} con số của bạn trùng với 3 nét tính cách ngành này, nên phần này được 0/${maxPtsNF}%.`,
        `None of your numbers match the 3 traits of this major group, so this part earns 0/${maxPtsNF}%.`
      );

  const avgS = fmt(avgSkill(row.SR), 1), needS = fmt(SKILL_NEED(kb), 1);
  const srLevel = row.SR >= (kb.params?.SR_min ?? 0.625) - 1e-9
    ? tr(`đạt mức chuẩn ${needS}/5`, `meets the ${needS}/5 bar`)
    : tr(`chưa đạt mức chuẩn ${needS}/5`, `is below the ${needS}/5 bar`);
  const formulaDetailSR = row.EC >= 1
    ? `${tr(`Điểm kỹ năng của ngành này là ${avgS}/5 và ${srLevel}.`, `Your skill score for this group is ${avgS}/5 and ${srLevel}.`)} ${relSentence(row.SR_n, pctSR, maxPtsSR, 'kỹ năng', 'skill level')}`
    : tr(`Điểm kỹ năng của ngành này là ${avgS}/5 (${srLevel}). Nhóm ngành không có con số trùng nên không được xếp hạng.`, `Your skill score for this group is ${avgS}/5 (${srLevel}). The group has no matching number, so it is not ranked.`);
  const skillAvgNote = tr(
    'Đây là trung bình có trọng số: kỹ năng gắn với nét chính của ngành được tính nặng nhất (×1,0), rồi đến nét phụ (×0,8) và nét bổ trợ (×0,6). Vì vậy kết quả có thể khác với khi bạn tự cộng rồi chia 3.',
    'This is a weighted average: the skill tied to the main trait counts most (×1.0), then the second (×0.8) and supporting trait (×0.6), so it can differ from a plain average of three.'
  );

  const formulaDetailENV = Boolean(row.ENV)
    ? tr(
        `Môi trường bạn mong muốn ("${envName(kb, r.env)}") trùng khớp 100% với môi trường của ngành. Theo góc nhìn ${personaName}, Môi trường là tiêu chí được ưu tiên cao nhất (chiếm tới ${maxPtsENV}% tổng điểm), nên bạn nhận trọn vẹn ${pctENV}% điểm này.`,
        `Your preferred environment ("${envName(kb, r.env)}") matches 100%. Under ${personaName} view, Environment is top priority (up to ${maxPtsENV}%), earning the full ${pctENV}%.`
      )
    : tr(
        `Môi trường bạn mong muốn ("${envName(kb, r.env)}") khác với môi trường của ngành ("${envName(kb, row.env)}"), do đó bạn nhận 0% (trên tối đa ${maxPtsENV}% điểm của góc nhìn ${personaName}).`,
        `Your preferred environment differs from the major group, earning 0% (out of max ${maxPtsENV}%).`
      );

  // 4. Giải mã nhãn
  let labelReason = '';
  if (row.label === LABELS.PRIORITY) {
    labelReason = tr(
      `Đạt chuẩn "Ưu tiên" vì bạn có ${row.EC} con số trùng với ngành (yêu cầu ≥ 2) và điểm kỹ năng của ngành (trung bình có trọng số) đạt ${fmt(avgSkill(row.SR), 1)}/5 (yêu cầu ≥ ${fmt(SKILL_NEED(kb), 1)}/5), không có kỹ năng nào từ 2/5 trở xuống.`,
      `Meets "Priority" because you have ${row.EC} matching numbers (needs ≥ 2) and skill average ${fmt(avgSkill(row.SR), 1)}/5 (needs ≥ 3.5/5) with no weak skills.`
    );
  } else if (row.label === LABELS.CHALLENGE) {
    labelReason = tr(
      `Được xếp ở mức "Thử thách" vì bạn có kỹ năng liên quan tự chấm còn thấp (≤ 2/5 sao: ${skillsText(kb, row.weakList ?? [])}). Nếu đam mê ngành này, bạn cần kế hoạch bồi dưỡng kỹ năng cụ thể.`,
      `Ranked as "Challenge" because you self-rated a core skill low (≤ 2/5: ${skillsText(kb, row.weakList ?? [])}). Consider upskilling if pursuing this path.`
    );
  } else if (row.label === LABELS.NONE) {
    labelReason = tr(
      'Hệ thống không đề xuất nhóm ngành này vì bạn không có con số Thần số học nào trùng khớp với nét tính cách cốt lõi của ngành.',
      'Not recommended because none of your Numerology numbers match the core traits of this major group.'
    );
  } else {
    // CONSIDER
    if (row.EC < (kb.params?.EC_min ?? 2)) {
      labelReason = tr(
        `Ngành này đạt điểm cao (${totalPct}%) nhờ bạn tự chấm kỹ năng rất tốt (${pctSR}%) và đúng môi trường làm việc mong muốn (${pctENV}%). Tuy nhiên, về thiên hướng tự nhiên từ Thần số học, bạn mới có ${row.EC} con số trùng khớp (đóng góp ${pctNF}%, trong khi chuẩn "Ưu tiên" cần ≥ 2 con số trùng). Vì vậy, hệ thống xếp ở mức "Cân nhắc" để bạn đối chiếu kỹ hơn với đam mê thực tế.`,
        `Score reaches ${totalPct}% thanks to high skills (${pctSR}%) and matching environment (${pctENV}%). However, only ${row.EC} number matches the traits (${pctNF}%, needs ≥ 2 for "Priority"), so it is placed in "Consider".`
      );
    } else {
      labelReason = tr(
        `Bạn có ${row.EC} con số trùng với ngành, nhưng điểm kỹ năng tự đánh giá hiện tại đạt ${fmt(avgSkill(row.SR), 1)}/5 sao (hơi dưới ngưỡng chuẩn ${fmt(SKILL_NEED(kb), 1)}/5 sao). Khi rèn luyện thêm kỹ năng, ngành này sẽ lên thẳng mức "Ưu tiên".`,
        `You have ${row.EC} matching numbers, but current skills average ${fmt(avgSkill(row.SR), 1)}/5 (below ${fmt(SKILL_NEED(kb), 1)}/5). Improving skills will raise this to "Priority".`
      );
    }
  }

  return {
    studentName: sig?.name?.fullName || (sig?.name?.words ? sig.name.words.join(' ') : tr('Bạn', 'You')),
    dobText: sig?.input ? `${String(sig.input.day).padStart(2, '0')}/${String(sig.input.month).padStart(2, '0')}/${sig.input.year}` : '',
    sigList,
    soulUrge: sig?.vowelValue,
    birthDigits,
    birthDigitsSummary: birthDigits.join(', '),
    birthMatrixPresent,
    arrowAnalysis,
    majorName: m.name,
    allMajors: m.all,
    moreCount: m.more,
    majorProfile: row.profile,
    majorTraits,
    majorEnv: envName(kb, row.env),
    chosenEnv: envName(kb, r.env),
    isEnvMatch: Boolean(row.ENV),
    EC: row.EC,
    nOn,
    hits,
    avgSkillVal: avgSkill(row.SR),
    skillNeedVal: SKILL_NEED(kb),
    personaName,
    maxPtsNF,
    maxPtsSR,
    maxPtsENV,
    pctNF,
    pctSR,
    pctENV,
    totalPct,
    formulaNF,
    formulaSR,
    formulaENV,
    formulaTotal,
    formulaDetailNF,
    formulaDetailSR,
    formulaDetailENV,
    skillAvgNote,
    rawFit: row.EC >= 1 ? Math.round((row.C_raw ?? 0) * 100) : null,
    rank: row.rank,
    totalRanked: r.ranked?.length ?? 0,
    label: row.label,
    labelReason,
    step: nextStepPlain(row, r, kb),
    insight: insightLine(row, r, kb),
  };
}

/** Thứ tự nhãn để hiển thị (không đổi thứ hạng của mô hình). */
export const LABEL_ORDER = { [LABELS.PRIORITY]: 0, [LABELS.CONSIDER]: 1, [LABELS.CHALLENGE]: 2, [LABELS.NONE]: 3 };

/**
 * Hạng (theo % phù hợp) và nhãn (theo ngưỡng) là hai phép đo khác nhau. Khi có ngành nhãn tốt hơn nằm dưới ngành nhãn kém hơn,
 * trả về câu giải thích để học sinh không hiểu nhầm. Không thay đổi thứ hạng của mô hình (phải khớp bảng tính Excel).
 */
export function labelRankNote(ranked) {
  const inv = ranked.some((r, i) => ranked.slice(0, i).some((u) => LABEL_ORDER[u.label] > LABEL_ORDER[r.label]));
  if (!inv) return null;
  return tr(
    'Vì sao có ngành "Ưu tiên" lại đứng dưới ngành "Cân nhắc"? Hạng và % được tính bằng cách cộng 3 phần (môi trường, kỹ năng, con số), trong đó môi trường chiếm nhiều điểm nhất. Còn nhãn chỉ xét 2 điều kiện: có ít nhất 2 con số trùng và điểm kỹ năng từ 3,5/5. Vì vậy một ngành khác môi trường bạn chọn có thể % thấp nhưng vẫn đạt "Ưu tiên". Hãy xem cả hai.',
    'Why can a "Priority" group sit below a "Consider" one? Rank and % add up 3 parts (environment, skills, numbers), with environment weighing the most. The label only checks 2 conditions: at least 2 matching numbers and a skill score of 3.5/5 or more. So a group outside your chosen environment can have a low % yet still be "Priority". Look at both.'
  );
}

/** Danh sách ngành trong một nhóm (để học sinh thấy "+N ngành" gồm những gì). */
export const groupMajorNames = (kb, pid) => (kb?.majors ?? []).filter((m) => m.profile_id === pid).map((m) => m.name_vi);
