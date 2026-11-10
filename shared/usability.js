// Pha 4 – đánh giá khả dụng (Ch7 Step 7): 3 nhiệm vụ trả lời câu hỏi quyết định + SUS 10 câu (Brooke, 1996).
// Dùng chung server (kiểm tra, tính điểm) và client (form test).
// Đáp án của các nhiệm vụ đã đối chiếu với engine (bộ A, min–max) – tests/api.test.js kiểm hồi quy.

/** SUS – bản tiếng Việt của nhóm (giữ thứ tự & chiều câu gốc: câu lẻ tích cực, câu chẵn tiêu cực). */
export const SUS_ITEMS = [
  'Tôi nghĩ tôi sẽ muốn dùng trang web này thường xuyên.',
  'Tôi thấy trang web này phức tạp một cách không cần thiết.',
  'Tôi thấy trang web này dễ sử dụng.',
  'Tôi nghĩ tôi cần người hỗ trợ kỹ thuật mới dùng được trang web này.',
  'Tôi thấy các chức năng của trang web được kết hợp tốt với nhau.',
  'Tôi thấy trang web này có quá nhiều chỗ không nhất quán.',
  'Tôi nghĩ hầu hết mọi người sẽ học cách dùng trang web này rất nhanh.',
  'Tôi thấy trang web này rất rườm rà, khó dùng.',
  'Tôi cảm thấy rất tự tin khi dùng trang web này.',
  'Tôi cần học nhiều thứ trước khi có thể dùng được trang web này.',
];

/** Điểm SUS 0–100: câu lẻ (r − 1), câu chẵn (5 − r), tổng × 2,5 (giống view v_sus_score). */
export function susScore(answers) {
  if (!Array.isArray(answers) || answers.length !== 10 || answers.some((r) => !Number.isInteger(r) || r < 1 || r > 5)) return null;
  return 2.5 * answers.reduce((s, r, i) => s + (i % 2 === 0 ? r - 1 : 5 - r), 0);
}

/** Thang tính từ của Bangor, Kortum & Miller (2009) – chỉ để diễn giải, ngưỡng là điểm trung bình mỗi bậc. */
export function susGrade(score) {
  if (score == null) return null;
  if (score >= 85.5) return 'Xuất sắc';
  if (score >= 71.4) return 'Tốt';
  if (score >= 50.9) return 'Chấp nhận được';
  if (score >= 35.7) return 'Kém';
  return 'Rất kém';
}

/**
 * 3 nhiệm vụ / vai trò, mỗi nhiệm vụ trả lời một câu hỏi quyết định (Q1, Q2, STEP5 …) và gắn với kịch bản test (test_case).
 * `account` = tài khoản mô phỏng người tham gia dùng; `answer` = đáp án đúng để người điều phối chấm.
 */
export const TASKS = {
  student: { account: 'sim-hs001', list: [
    { no: 1, tc: 'TC01', q: 'Q1', text: 'Bạn là học sinh SIM-HS001. Hãy cho biết nhóm ngành được gợi ý đứng đầu và mức khuyến nghị của nó.', answer: 'Xử lý ngôn ngữ tự nhiên – 92%, nhãn Cân nhắc (ngang điểm với Quản trị khách sạn 92%; hòa thì nhóm đứng trước xếp trên) [nhóm P06]' },
    { no: 2, tc: 'TC02', q: 'Q1', text: 'Vì sao nhóm ngành đó đứng đầu? Phần nào đóng góp nhiều nhất vào điểm của nó?', answer: 'Phần "Môi trường" đóng góp lớn nhất; bấm "Vì sao?" dưới % (tab "Vì sao hợp?")' },
    { no: 3, tc: 'TC05', q: 'Q2', text: 'Bạn muốn học ngành mục tiêu "Công nghệ sinh học". Hệ thống nói gì về ngành này, và nếu tăng kỹ năng yếu nhất thêm 1 bậc thì có thay đổi không?', answer: 'Công nghệ sinh học: Không đề xuất (không con số nào trùng, cảnh báo đỏ); tăng kỹ năng "Phân tích sâu, quan sát, nghiên cứu, tự học" vẫn không đổi [ngành 204, nhóm P17, EC = 0]' },
  ] },
  parent: { account: 'sim-ph001', list: [
    { no: 1, tc: 'TC06', q: 'Q1', text: 'Bạn là phụ huynh của SIM-HS002. Nhóm ngành đứng đầu cho con bạn là gì và có nên chọn ngay không?', answer: 'Kinh tế nông nghiệp – nhãn Thử thách (kỹ năng "Phân tích sâu, quan sát, nghiên cứu, tự học" mới 2/5), ngang điểm với Truyền thông đa phương tiện (Cân nhắc) → chưa nên chọn ngay [nhóm P03, P10]' },
    { no: 2, tc: 'TC07', q: null, text: 'Thử mở hồ sơ của một học sinh khác (ví dụ SIM-HS003). Điều gì xảy ra?', answer: 'Bị chặn – chỉ xem được con mình' },
    { no: 3, tc: 'TC05', q: 'Q2', text: 'Con bạn cần tăng kỹ năng nào để nhóm ngành đứng đầu thành "Ưu tiên"? Thử bằng What-if.', answer: 'Tăng "Phân tích sâu, quan sát, nghiên cứu, tự học" từ 2 lên 3 (What-if +1) → Kinh tế nông nghiệp thành Ưu tiên [P03, SR 0,625 → 0,708]' },
  ] },
  counselor: { account: 'sim-tvv01', list: [
    { no: 1, tc: 'TC08', q: 'Q1', text: 'Trong danh sách học sinh bạn phụ trách, có bao nhiêu em có Top-1 là "Thử thách"? Kể tên một em.', answer: 'Lọc nhãn Thử thách → 1 em: SIM-HS051 (trong 8 em phụ trách)' },
    { no: 2, tc: 'TC09', q: 'Q1', text: 'Với SIM-HS001, Top-1 có giống nhau theo góc nhìn Học sinh, Phụ huynh và Tư vấn viên không?', answer: 'Có – cả 3 góc nhìn đều ra Xử lý ngôn ngữ tự nhiên (tab "Tất cả nhóm ngành" › "Kết quả có chắc không?"); độ ổn định 5/5 = rất chắc chắn' },
    { no: 3, tc: 'TC10', q: null, text: 'Ý nghĩa của số chủ đạo của SIM-HS001 lấy từ sách nào, trang nào?', answer: 'Số chủ đạo 2 → tab "Ý nghĩa & sách nguồn": Phillips ch.7 (PDF p.68–69) + Lê Đỗ Quỳnh Hương, Con số chủ đạo 2 (PDF p.25–27)' },
  ] },
};
TASKS.teacher = TASKS.student; // giảng viên / người đánh giá đóng vai học sinh
TASKS.admin = TASKS.student;

/** Kiểm tra dữ liệu buổi test trước khi lưu (TiDB không cưỡng chế CHECK). Trả về danh sách lỗi. */
export function validateSession(s) {
  const err = [];
  if (!s || typeof s !== 'object') return ['Thiếu dữ liệu'];
  if (!/^U\d{2,3}$/.test(s.participantCode ?? '')) err.push('Mã người tham gia dạng U01 – không ghi tên thật');
  if (!['student', 'parent', 'counselor', 'admin', 'teacher'].includes(s.role)) err.push('Vai trò không hợp lệ');
  if (s.consent !== true) err.push('Cần sự đồng ý của người tham gia');
  if (!/^[\w.-]{1,20}$/.test(s.uiVersion ?? '')) err.push('Phiên bản giao diện không hợp lệ');
  if (!Array.isArray(s.tasks) || s.tasks.length !== 3) err.push('Cần đủ 3 nhiệm vụ');
  else for (const t of s.tasks) {
    if (![1, 2, 3].includes(t.taskNo)) err.push('Số nhiệm vụ 1–3');
    if (!Number.isInteger(t.timeSec) || t.timeSec < 0 || t.timeSec > 3600) err.push(`Nhiệm vụ ${t.taskNo}: thời gian 0–3600 giây`);
    if (!Number.isInteger(t.errors) || t.errors < 0 || t.errors > 50) err.push(`Nhiệm vụ ${t.taskNo}: số lỗi 0–50`);
    if (typeof t.success !== 'boolean') err.push(`Nhiệm vụ ${t.taskNo}: chưa chấm thành công/không`);
  }
  if (susScore(s.sus) == null) err.push('SUS cần đủ 10 câu, mỗi câu 1–5');
  return err;
}
