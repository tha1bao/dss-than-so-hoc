// Pha 4 – tính điểm SUS, xếp loại, kiểm tra dữ liệu buổi test (không cần DB).
import { describe, it, expect } from 'vitest';
import { susScore, susGrade, validateSession, TASKS, SUS_ITEMS } from '../shared/usability.js';

describe('SUS', () => {
  it('công thức Brooke: tốt nhất 100, tệ nhất 0, trung lập 50', () => {
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
    expect(susScore(Array(10).fill(3))).toBe(50);
    expect(susScore([4, 2, 4, 2, 4, 2, 4, 2, 4, 2])).toBe(75);
  });
  it('thiếu câu / ngoài thang → null', () => {
    expect(susScore([5, 1, 5])).toBeNull();
    expect(susScore([6, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBeNull();
  });
  it('xếp loại Bangor 2009', () => {
    expect(susGrade(90)).toBe('Xuất sắc'); expect(susGrade(75)).toBe('Tốt'); expect(susGrade(68)).toBe('Chấp nhận được'); expect(susGrade(40)).toBe('Kém');
  });
  it('10 câu, mỗi vai trò 3 nhiệm vụ gắn kịch bản test', () => {
    expect(SUS_ITEMS).toHaveLength(10);
    for (const r of ['student', 'parent', 'counselor', 'teacher']) expect(TASKS[r].list.map((t) => t.no)).toEqual([1, 2, 3]);
  });
});

describe('validateSession', () => {
  const ok = { participantCode: 'U01', role: 'student', uiVersion: 'v1', consent: true,
    tasks: [1, 2, 3].map((n) => ({ taskNo: n, timeSec: 60, errors: 0, success: true })), sus: Array(10).fill(3) };
  it('hợp lệ', () => expect(validateSession(ok)).toEqual([]));
  it('chặn tên thật, thiếu đồng ý, thiếu nhiệm vụ', () => {
    expect(validateSession({ ...ok, participantCode: 'Nguyễn An' }).join()).toMatch(/không ghi tên thật/);
    expect(validateSession({ ...ok, consent: false }).join()).toMatch(/đồng ý/);
    expect(validateSession({ ...ok, tasks: ok.tasks.slice(0, 2) }).join()).toMatch(/3 nhiệm vụ/);
  });
});
