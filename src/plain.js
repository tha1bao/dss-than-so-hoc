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
  const birthArrows = extras?.arrows ?? [];

  // 2. Đặc điểm & Yêu cầu nhóm ngành
  const majorTraits = (row.A || []).map((a, i) => ({
    pos: i + 1,
    archetype: a,
    traitTitle: archTrait(kb, a),
    skill: skillName(kb, a),
    rating: row.KN?.[i] ?? 3,
    matchedGroups: r.groups ? r.groups.filter((g) => sig?.arch?.[g] === a).map((g) => groupName(kb, g)) : [],
  }));

  // 3. Phân bổ điểm số (% đóng góp) & Công thức lồng ghép trực quan
  const [a, b, g] = r.weights ?? [0.111, 0.278, 0.611];
  const personaName = PERSONA_NAME[r.persona] ?? r.persona;
  const weightPctNF = Math.round(a * 1000) / 10;
  const weightPctSR = Math.round(b * 1000) / 10;
  const weightPctENV = Math.round(g * 1000) / 10;

  const rawNF = row.NF;
  const normNF = row.NF_n ?? row.NF;
  const normPctNF = Math.round(normNF * 100);

  const rawSR = row.SR;
  const normSR = row.SR_n ?? row.SR;
  const normPctSR = Math.round(normSR * 100);

  const rawENV = row.ENV;
  const normENV = row.ENV_n ?? row.ENV;
  const normPctENV = Math.round(normENV * 100);

  const cNF = row.contrib?.NF ?? 0;
  const cSR = row.contrib?.SR ?? 0;
  const cENV = row.contrib?.ENV ?? 0;
  const pctNF = Math.round(cNF * 100);
  const pctSR = Math.round(cSR * 100);
  const pctENV = Math.round(cENV * 100);
  const totalPct = Math.round(row.C * 100);

  // Chuỗi công thức trực quan từng trụ cột
  const formulaNF = tr(
    `Thần số học = ${normPctNF}% (mức trùng khớp) × ${fmt(weightPctNF, 1)}% (trọng số góc nhìn ${personaName}) = ${pctNF}%`,
    `Numerology = ${normPctNF}% (match score) × ${fmt(weightPctNF, 1)}% (${personaName} weight) = ${pctNF}%`
  );
  const formulaSR = tr(
    `Kỹ năng = ${normPctSR}% (mức sẵn sàng kỹ năng) × ${fmt(weightPctSR, 1)}% (trọng số góc nhìn ${personaName}) = ${pctSR}%`,
    `Skills = ${normPctSR}% (skill readiness) × ${fmt(weightPctSR, 1)}% (${personaName} weight) = ${pctSR}%`
  );
  const formulaENV = tr(
    `Môi trường = ${normPctENV}% (độ hợp môi trường) × ${fmt(weightPctENV, 1)}% (trọng số góc nhìn ${personaName}) = ${pctENV}%`,
    `Environment = ${normPctENV}% (environment fit) × ${fmt(weightPctENV, 1)}% (${personaName} weight) = ${pctENV}%`
  );
  const formulaTotal = tr(
    `Mức phù hợp tổng hợp = ${pctNF}% (Thần số học) + ${pctSR}% (Kỹ năng) + ${pctENV}% (Môi trường) = ${totalPct}%`,
    `Overall Fit = ${pctNF}% (Numerology) + ${pctSR}% (Skills) + ${pctENV}% (Environment) = ${totalPct}%`
  );

  const formulaDetailNF = row.EC >= 1
    ? (normPctNF === 0
        ? tr(
            `Bạn có ${row.EC} con số trùng (điểm gốc NF = ${fmt(rawNF)}), nhưng mức trùng này ở cận dưới trong các ngành bạn có số trùng (min NF = ${fmt(r.minmax?.NF?.[0] ?? rawNF)}), nên sau khi chuẩn hóa so sánh đạt 0%. Do đó: 0% × ${fmt(weightPctNF, 1)}% = 0%.`,
            `You matched ${row.EC} number (raw NF = ${fmt(rawNF)}), but this is at the baseline among your matching majors (min NF = ${fmt(r.minmax?.NF?.[0] ?? rawNF)}), scaling to 0%. Multiplied by weight ${fmt(weightPctNF, 1)}%, contribution is 0%.`
          )
        : tr(
            `Điểm Thần số học gốc là NF = ${fmt(rawNF)}. Sau khi chuẩn hóa so sánh giữa các ngành đạt ${normPctNF}%. Khi nhân với trọng số ${fmt(weightPctNF, 1)}% của góc nhìn ${personaName}, Thần số học đóng góp ${pctNF}% vào tổng điểm.`,
            `Raw Numerology score is NF = ${fmt(rawNF)}, normalized to ${normPctNF}%. Multiplied by weight ${fmt(weightPctNF, 1)}%, contribution is ${pctNF}%.`
          ))
    : tr('Không có con số nào trùng khớp nên yếu tố này đóng góp 0%.', 'No matching numbers, contribution is 0%.');

  const formulaDetailSR = tr(
    `Điểm kỹ năng tự đánh giá trung bình của bạn là ${fmt(avgSkill(rawSR), 1)}/5 sao (điểm gốc SR = ${fmt(rawSR)}). Sau khi chuẩn hóa so sánh đạt ${normPctSR}%. Khi nhân với trọng số ${fmt(weightPctSR, 1)}% của góc nhìn ${personaName}, kỹ năng đóng góp ${pctSR}% vào tổng điểm.`,
    `Your average self-rated skill is ${fmt(avgSkill(rawSR), 1)}/5 (raw SR = ${fmt(rawSR)}), scaled to ${normPctSR}%. Multiplied by weight ${fmt(weightPctSR, 1)}%, contribution is ${pctSR}%.`
  );

  const formulaDetailENV = Boolean(row.ENV)
    ? tr(
        `Môi trường bạn chọn ("${envName(kb, r.env)}") trùng hoàn toàn với môi trường của ngành (đạt 100%). Theo chuẩn ROC của góc nhìn ${personaName}, Môi trường là tiêu chí được ưu tiên hàng đầu với trọng số ${fmt(weightPctENV, 1)}%, do đó đóng góp ${pctENV}% vào tổng điểm.`,
        `Your preferred environment matches the major group (100%). Under ${personaName} ROC weights, Environment carries ${fmt(weightPctENV, 1)}% weight, contributing ${pctENV}%.`
      )
    : tr(
        `Môi trường bạn chọn khác với môi trường của ngành (đạt 0%), do đó dù trọng số là ${fmt(weightPctENV, 1)}% thì đóng góp vẫn là 0%.`,
        `Your chosen environment differs from the major group (0%), so multiplied by weight ${fmt(weightPctENV, 1)}%, contribution is 0%.`
      );

  // 4. Giải mã nhãn
  let labelReason = '';
  if (row.label === LABELS.PRIORITY) {
    labelReason = tr(
      `Đạt chuẩn "Ưu tiên" vì bạn có ${row.EC} con số Thần số học hội tụ (yêu cầu ≥ 2) và kỹ năng tự đánh giá đạt trung bình ${fmt(avgSkill(row.SR), 1)}/5 sao (yêu cầu ≥ 3,5/5), không có kỹ năng yếu.`,
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
        `Điểm số đạt ${totalPct}% nhờ bạn tự chấm kỹ năng tốt và đúng môi trường mong muốn. Tuy nhiên, về thiên hướng tự nhiên từ Thần số học, bạn mới có ${row.EC} con số trùng khớp (chuẩn "Ưu tiên" cần ≥ 2 con số trùng), nên hệ thống xếp ở mức "Cân nhắc" để bạn đối chiếu kỹ hơn với đam mê thực tế.`,
        `Score reaches ${totalPct}% thanks to high skill self-ratings and matching environment. However, only ${row.EC} number matches the traits (needs ≥ 2 for "Priority"), so it is placed in "Consider".`
      );
    } else {
      labelReason = tr(
        `Bạn có ${row.EC} con số Thần số học hội tụ rất tốt, nhưng điểm kỹ năng tự đánh giá hiện tại đạt ${fmt(avgSkill(row.SR), 1)}/5 sao (hơi dưới ngưỡng chuẩn ${fmt(SKILL_NEED(kb), 1)}/5 sao). Khi rèn luyện thêm kỹ năng, ngành này sẽ lên thẳng mức "Ưu tiên".`,
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
    birthMatrixPresent,
    birthArrows,
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
    weightPctNF,
    weightPctSR,
    weightPctENV,
    normPctNF,
    normPctSR,
    normPctENV,
    rawNF,
    rawSR,
    rawENV,
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
    rank: row.rank,
    totalRanked: r.ranked?.length ?? 0,
    label: row.label,
    labelReason,
    step: nextStepPlain(row, r, kb),
    insight: insightLine(row, r, kb),
  };
}
