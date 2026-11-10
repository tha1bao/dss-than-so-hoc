// Cách hỏi dễ hiểu cho học sinh THPT ở form tự nhập. Chỉ đổi CÁCH HỎI – giá trị gửi vào engine giữ nguyên
// (mã môi trường COLLAB/CREATE/LEAD/STRUCT, điểm kỹ năng 1–5 theo số nét tính cách 1…33).
import { tr } from '../i18n.js';

/** Môi trường làm việc → hỏi bằng tình huống quen thuộc ở trường. */
export const ENV_SCENARIOS = {
  COLLAB: {
    icon: '🤝',
    vi: ['Làm nhóm, giúp đỡ bạn bè', 'Bạn vui nhất khi được làm việc cùng mọi người, giảng bài cho bạn, chăm lo cho tập thể.'],
    en: ['Teamwork, helping friends', 'You are happiest working with others, explaining lessons to friends, caring for the group.'],
  },
  CREATE: {
    icon: '🎨',
    vi: ['Sáng tạo, thể hiện ý tưởng', 'Bạn thích làm poster, viết bài, quay video, thiết kế – tạo ra thứ mang dấu ấn riêng.'],
    en: ['Creating and expressing ideas', 'You enjoy making posters, writing, filming, designing – things with your own touch.'],
  },
  LEAD: {
    icon: '🚀',
    vi: ['Dẫn dắt, tự quyết', 'Bạn thích làm lớp trưởng, tổ chức sự kiện, tự lên kế hoạch và chịu trách nhiệm kết quả.'],
    en: ['Leading, deciding for yourself', 'You like being class monitor, organising events, planning and owning the result.'],
  },
  STRUCT: {
    icon: '🔬',
    vi: ['Đào sâu, làm cho chuẩn', 'Bạn thích ngồi giải một bài khó đến cùng, làm việc có quy trình rõ ràng, chính xác.'],
    en: ['Going deep, getting it right', 'You like working through a hard problem to the end, with clear and precise steps.'],
  },
};
export const envScenario = (code) => {
  const x = ENV_SCENARIOS[code];
  if (!x) return null;
  const [title, desc] = tr(x.vi, x.en);
  return { icon: x.icon, title, desc };
};

/** 12 kỹ năng → tên ngắn + một ví dụ hành vi để học sinh dễ tự chấm. Khóa = số nét tính cách. */
export const SKILL_PLAIN = {
  1: [['Chủ động, dám quyết định', 'Ví dụ: bạn hay tự đứng ra nhận việc, tự quyết khi nhóm còn phân vân.'], ['Taking initiative, making decisions', 'E.g. you step up and decide when the group is unsure.']],
  2: [['Lắng nghe, hòa giải', 'Ví dụ: bạn bè hay tìm bạn để tâm sự hoặc nhờ giảng hòa khi cãi nhau.'], ['Listening, making peace', 'E.g. friends come to you to talk or to settle arguments.']],
  3: [['Giao tiếp, thuyết trình', 'Ví dụ: nhóm hay cử bạn lên trình bày, bạn viết hoặc kể chuyện cuốn hút.'], ['Communicating, presenting', 'E.g. your group sends you to present; you write or tell stories well.']],
  4: [['Lập kế hoạch, kiên trì', 'Ví dụ: bạn có thời gian biểu, làm bài đều đặn, theo một việc đến cùng.'], ['Planning, persistence', 'E.g. you keep a schedule, study steadily and finish what you start.']],
  5: [['Thích nghi, ứng biến', 'Ví dụ: kế hoạch thay đổi phút chót bạn vẫn xoay xở được, thích thử cái mới.'], ['Adapting, improvising', 'E.g. you cope when plans change last-minute and enjoy trying new things.']],
  6: [['Quan tâm, chăm sóc người khác', 'Ví dụ: bạn hay kèm bạn học yếu, chăm em nhỏ, để ý khi ai đó buồn.'], ['Caring for others', 'E.g. you tutor classmates, look after younger kids, notice when someone is sad.']],
  7: [['Phân tích, tự nghiên cứu', 'Ví dụ: bạn thích tìm hiểu "vì sao", tự đọc thêm, tự học trên mạng.'], ['Analysing, self-study', 'E.g. you like asking "why", reading more and learning online by yourself.']],
  8: [['Quản lý tiền & nguồn lực', 'Ví dụ: bạn giữ quỹ lớp, biết mặc cả, tính toán chi tiêu hợp lý.'], ['Managing money and resources', 'E.g. you keep the class fund, negotiate and budget sensibly.']],
  9: [['Thấu cảm, vì cộng đồng', 'Ví dụ: bạn hay tham gia tình nguyện, quan tâm tới vấn đề xã hội.'], ['Empathy, serving the community', 'E.g. you volunteer and care about social issues.']],
  11: [['Truyền cảm hứng, nảy ý tưởng', 'Ví dụ: bạn hay nghĩ ra ý tưởng mới và làm mọi người hào hứng theo.'], ['Inspiring, generating ideas', 'E.g. you come up with new ideas and get others excited about them.']],
  22: [['Làm dự án lớn từ đầu đến cuối', 'Ví dụ: bạn từng biến một ý tưởng thành dự án/câu lạc bộ có nhiều người tham gia.'], ['Running big projects end to end', 'E.g. you turned an idea into a project or club with many members.']],
  33: [['Dạy và nâng đỡ người khác', 'Ví dụ: bạn kiên nhẫn hướng dẫn người khác và thấy vui khi họ tiến bộ.'], ['Teaching and uplifting others', 'E.g. you patiently guide others and are glad when they improve.']],
};
export const skillPlain = (a) => {
  const x = SKILL_PLAIN[a];
  if (!x) return null;
  const [name, example] = tr(x[0], x[1]);
  return { name, example };
};

/** Thang tự chấm bằng lời. */
export const RATING_WORDS = () => [
  tr('Chưa làm được', 'Not yet'), tr('Cần người giúp', 'With help'), tr('Làm được', 'Can do'), tr('Khá tốt', 'Quite good'), tr('Rất giỏi', 'Very strong'),
];
