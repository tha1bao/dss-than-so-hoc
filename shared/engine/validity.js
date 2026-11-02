// Step 5 (ASS3): cảnh báo "ngoài điều kiện hợp lệ của mô hình". Luật & lời nhắn lấy từ bảng validity_rule;
// DEFAULT_RULES chỉ dùng khi chạy không có DB (test, client offline) – nội dung trùng bản ETL.
export const DEFAULT_RULES = {
  V_DOB: { level: 'yellow', message_vi: 'Năm sinh ngoài dải dữ liệu 2009–2011', params: { year_min: 2009, year_max: 2011 } },
  V_CHAR: { level: 'yellow', message_vi: 'Tên có ký tự ngoài A–Z – đã bỏ khi tính' },
  V_NAME_LEN: { level: 'yellow', message_vi: 'Tên không phải 3 âm tiết (dữ liệu chuẩn: 3)', params: { syllables: 3 } },
  V_TZ: { level: 'yellow', message_vi: 'Có chữ ghép TZ – áp KB04 (khác Excel v6)' },
  V_MAJOR: { level: 'red', message_vi: 'Ngành mục tiêu không có trong 300 ngành – không chấm được' },
  V_EC0: { level: 'red', message_vi: 'Ngành mục tiêu EC = 0 – hồ sơ bị loại khỏi xếp hạng' },
  V_CONFLICT: { level: 'yellow', message_vi: 'Xung đột: kỹ năng sẵn sàng cao nhưng không có tín hiệu thần số học – trình bày cả hai phía' },
  V_ONE_PROFILE: { level: 'yellow', message_vi: 'Chỉ 1 hồ sơ đủ điều kiện – chuẩn hóa min–max mất ý nghĩa' },
  V_EC1: { level: 'yellow', message_vi: 'Chỉ 1 nhóm tín hiệu ủng hộ – bằng chứng yếu' },
  V_TIE: { level: 'grey', message_vi: 'Có hồ sơ hòa điểm – thứ tự do luật phá hòa (hồ sơ đứng trước)' },
  V_ADMIT: { level: 'grey', message_vi: 'Chưa có dữ liệu điểm chuẩn cho ngành này' },
  V_SELF: { level: 'grey', message_vi: 'Kỹ năng là tự đánh giá (Data_Gap #6)' },
  V_SIM: { level: 'grey', message_vi: 'Dữ liệu mô phỏng – thần số học không có giá trị dự báo khoa học (E10)' },
};

/**
 * @param ctx { sig (computeSignals), result (score), target?: { text, major|null, analysis|null, inPilot:bool }, params, simulated:bool }
 * @param rules  bản đồ code → { level, message_vi, params } (từ DB); thiếu thì dùng DEFAULT_RULES
 * @returns [{ code, level, message }] theo thứ tự đầu vào → mục tiêu → kết quả → thông tin chung
 */
export function evaluateValidity(ctx, rules = DEFAULT_RULES) {
  const R = (code) => rules[code] ?? DEFAULT_RULES[code];
  const out = [];
  const add = (code, extra = '') => { const r = R(code); if (r) out.push({ code, level: r.level, message: r.message_vi + extra }); };
  const { sig, result, target, params } = ctx;

  const dobR = R('V_DOB').params ?? DEFAULT_RULES.V_DOB.params;
  if (sig.input.year < dobR.year_min || sig.input.year > dobR.year_max) add('V_DOB');
  if (sig.name.removed.length) add('V_CHAR', ` (${[...new Set(sig.name.removed)].join(' ')})`);
  const syl = (R('V_NAME_LEN').params ?? DEFAULT_RULES.V_NAME_LEN.params).syllables;
  if (sig.name.rawWordCount !== syl) add('V_NAME_LEN', ` – tên có ${sig.name.rawWordCount} âm tiết`);
  if (sig.digraph.TZ) add('V_TZ');

  if (target?.text && !target.major) add('V_MAJOR');
  if (target?.analysis) {
    const row = target.analysis.row;
    if (row.EC === 0) add('V_EC0');
    if (row.EC === 0 && row.SR >= params.SR_min) add('V_CONFLICT', ` (SR ${row.SR.toFixed(2).replace('.', ',')})`);
    if (!target.inPilot) add('V_ADMIT');
  }
  if (result.nEligible <= 1) add('V_ONE_PROFILE');
  if (result.top[0]?.EC === 1) add('V_EC1');
  if (result.tiesWithTop1.length) add('V_TIE', ` (${result.tiesWithTop1.join(', ')})`);
  add('V_SELF');
  if (ctx.simulated !== false) add('V_SIM');
  return out;
}

/** Mức tổng hợp để tô màu banner: red > yellow > grey. */
export const worstLevel = (ws) => (ws.some((w) => w.level === 'red') ? 'red' : ws.some((w) => w.level === 'yellow') ? 'yellow' : 'grey');
