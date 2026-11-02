// Pha 4 – song ngữ: đổi ngôn ngữ chỉ đổi chuỗi hiển thị, KHÔNG đổi con số (engine dùng chung).
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import { t, setLang, localizeKb, num } from '../src/i18n.js';
import EN from '../src/i18n.en.json';

const I18N = JSON.parse(fs.readFileSync(new URL('../db/etl/i18n_en.json', import.meta.url), 'utf8'));
const kb = {
  templates: { WHY_NF: '{ec}/5 nhóm tín hiệu khớp archetype của hồ sơ ({groups}). NF = {nf}.' },
  templatesEn: { WHY_NF: I18N.templates.WHY_NF },
  rules: { V_EC1: { level: 'yellow', message_vi: 'Chỉ 1 nhóm tín hiệu ủng hộ – bằng chứng yếu', message_en: I18N.rules.V_EC1 } },
  envs: { LEAD: 'Lãnh đạo & tự chủ' }, envsEn: { LEAD: 'Leadership & autonomy' },
  groups: [{ code: 'G1', name_vi: 'Số chủ đạo (Ruling)' }],
  skills: [{ code: 'SK01', archetype_no: 1, name_vi: 'Chủ động' }],
  archetypes: [{ number: 1, skill_cluster: 'Initiate, autonomy' }],
  params: { w: { G1: 0.35 } },
};

afterEach(() => setLang('vi'));

describe('song ngữ VI/EN', () => {
  it('mặc định tiếng Việt: t() trả nguyên chuỗi, localizeKb không đổi kb', () => {
    setLang('vi');
    expect(t('Ưu tiên')).toBe('Ưu tiên');
    expect(localizeKb(kb)).toBe(kb);
    expect(num('0,875')).toBe('0,875');
  });
  it('tiếng Anh: nhãn, mẫu câu, cảnh báo, tên môi trường/nhóm/kỹ năng được dịch; tham số số học giữ nguyên', () => {
    setLang('en');
    expect([t('Ưu tiên'), t('Cân nhắc'), t('Thử thách'), t('Không đề xuất')]).toEqual(['Priority', 'Consider', 'Challenge', 'Not recommended']);
    const k = localizeKb(kb);
    expect(k.templates.WHY_NF).toMatch(/signal groups/);
    expect(k.rules.V_EC1.message_vi).toBe(I18N.rules.V_EC1);
    expect(k.envs.LEAD).toBe('Leadership & autonomy');
    expect(k.groups[0].name_vi).toBe('Ruling number');
    expect(k.skills[0].name_vi).toBe('Initiate, autonomy');
    expect(k.params).toBe(kb.params);
    expect(num('C = 0,875; SK01 = 2, SK05 = 3')).toBe('C = 0.875; SK01 = 2, SK05 = 3');
  });
  it('chuỗi chưa có bản dịch → giữ tiếng Việt (không mất chữ)', () => {
    setLang('en');
    expect(t('chuỗi chưa dịch xyz')).toBe('chuỗi chưa dịch xyz');
  });
  it('bản dịch mẫu câu giữ đúng các biến {…} của bản tiếng Việt', () => {
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    const etl = fs.readFileSync(new URL('../db/etl/etl.js', import.meta.url), 'utf8');
    for (const [code, en] of Object.entries(I18N.templates)) {
      const vi = etl.match(new RegExp(`T\\('${code}', 'L\\d', '([^']*)'\\)`))?.[1];
      expect(vi, code).toBeTruthy();
      expect(vars(en), code).toBe(vars(vi));
    }
    expect(Object.keys(I18N.rules)).toHaveLength(13);
  });
  it('từ điển giao diện không có bản dịch rỗng', () => {
    for (const [vi, en] of Object.entries(EN)) expect(en.trim(), vi).not.toBe('');
  });
});
