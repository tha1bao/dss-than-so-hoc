// Khu vực (a) – 6 KPI có ngưỡng xanh/vàng/đỏ (mục 1.5, nhóm duyệt D10). Ngưỡng lấy từ bảng `threshold`.
// Quy ước khoảng số: min ≤ x < max (NULL = không chặn). KPI dạng chữ: so với match_text (phân tách '; ').
export const DEFAULT_THRESHOLDS = [
  ['K_LABEL', 'green', null, null, 'Ưu tiên'], ['K_LABEL', 'yellow', null, null, 'Cân nhắc'], ['K_LABEL', 'red', null, null, 'Thử thách; Không đề xuất'],
  ['K_EC', 'green', 2, null], ['K_EC', 'yellow', 1, 2], ['K_EC', 'red', null, 1],
  ['K_SR', 'green', 0.625, null], ['K_SR', 'yellow', 0.5, 0.625], ['K_SR', 'red', null, 0.5],
  ['K_WEAK', 'green', null, 1], ['K_WEAK', 'yellow', 1, 2], ['K_WEAK', 'red', 2, null],
  ['K_STAB', 'green', 5, null], ['K_STAB', 'yellow', 3, 5], ['K_STAB', 'red', null, 3],
  ['K_ADMIT', 'green', null, null, 'An toàn'], ['K_ADMIT', 'yellow', null, null, 'Vừa sức'], ['K_ADMIT', 'red', null, null, 'Với cao; Khó'],
  ['K_ADMIT', 'grey', null, null, 'Chưa có dữ liệu'],
].map(([kpi_code, level, min_value, max_value, match_text = null]) => ({ kpi_code, level, min_value, max_value, match_text }));

export function levelOf(kpiCode, value, thresholds = DEFAULT_THRESHOLDS) {
  if (value === null || value === undefined) return 'grey';
  for (const t of thresholds.filter((x) => x.kpi_code === kpiCode)) {
    if (t.match_text != null) { if (String(t.match_text).split(/;\s*/).includes(String(value))) return t.level; continue; }
    const lo = t.min_value == null ? -Infinity : Number(t.min_value);
    const hi = t.max_value == null ? Infinity : Number(t.max_value);
    if (value >= lo && value < hi) return t.level;
  }
  return 'grey';
}

/** Khả năng đỗ (F-ADM, Phụ lục B3.3): Biên = điểm thi tốt nhất trong các tổ hợp ngành nhận − ĐC 2026; so với Δ. */
export function admissionChance(bench, exam) {
  if (!bench || !exam) return null;
  const combos = ['A00', 'A01', 'D01', 'B00'].filter((c) => bench[`has_${c}`] && exam[c] != null);
  if (!combos.length || bench.cutoff_2026 == null) return null;
  const best = combos.reduce((b, c) => (Number(exam[c]) > Number(exam[b]) ? c : b));
  const margin = Number(exam[best]) - Number(bench.cutoff_2026);
  const delta = Number(bench.delta_used);
  const level = margin >= delta ? 'An toàn' : margin >= 0 ? 'Vừa sức' : margin >= -delta ? 'Với cao' : 'Khó';
  return { combo: best, score: Number(exam[best]), cutoff: Number(bench.cutoff_2026), margin, delta, level };
}

/**
 * @param result kết quả score()
 * @param ctx { stability?: 0–5, target?: {analysis, benchmark}, exam?, thresholds? }
 */
export function computeKpis(result, ctx = {}) {
  const th = ctx.thresholds ?? DEFAULT_THRESHOLDS;
  const top1 = result.top[0] ?? null;
  const focus = ctx.target?.analysis?.row ?? top1; // "ngành đang xem": mục tiêu nếu có, không thì Top-1
  const adm = ctx.target?.benchmark ? admissionChance(ctx.target.benchmark, ctx.exam) : null;
  const k = (code, value, extra = {}) => ({ code, value, level: levelOf(code, value, th), ...extra });
  return [
    k('K_LABEL', top1?.label ?? null, { profile: top1?.profile }),
    k('K_EC', top1?.EC ?? null, { profile: top1?.profile }),
    k('K_SR', focus?.SR ?? null, { profile: focus?.profile }),
    k('K_WEAK', focus?.weak ?? null, { profile: focus?.profile, skills: focus?.weakList?.map((w) => w.skill) }),
    k('K_STAB', ctx.stability ?? null),
    k('K_ADMIT', adm ? adm.level : (ctx.target?.major ? 'Chưa có dữ liệu' : null), { detail: adm }),
  ];
}
