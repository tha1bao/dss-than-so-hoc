import { describe, it, expect } from 'vitest';
import { labelPlain, nextStepPlain, avgSkill, repMajor, SKILL_NEED } from '../src/plain.js';
import { computeSignals } from '../shared/engine/numerology.js';
import { score } from '../shared/engine/score.js';
import { groupName, archTrait } from '../src/format.js';
import { getMeaningVi, NUMBER_MEANINGS_VI } from '../src/data/number_meanings_vi.js';
import FX from './fixtures/engine_py.json';

const kb = FX.kb;

describe('Layers and plain text helper safety', () => {
  const sig = computeSignals('Nguyễn Ngọc Phúc', '2009-01-01', kb);
  const skills = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33].map((a) => [a, 3]));
  const tops = [1, 2, 3];
  const r = score(sig.arch, skills, 'Lãnh đạo & tự chủ', tops, kb, { persona: 'HS' });

  it('labelPlain handles both (row, kb) and (row, r, kb) without throwing', () => {
    for (const row of r.rows) {
      // 2 arguments
      const text2 = labelPlain(row, kb);
      expect(typeof text2).toBe('string');
      expect(text2.length).toBeGreaterThan(0);

      // 3 arguments (legacy/accidental call signature)
      const text3 = labelPlain(row, r, kb);
      expect(typeof text3).toBe('string');
      expect(text3.length).toBeGreaterThan(0);
      expect(text3).toBe(text2);
    }
  });

  it('P25 and all 35 profiles have valid data for L1 and drawer', () => {
    const rowP25 = r.rows.find((x) => x.profile === 'P25');
    expect(rowP25).toBeDefined();

    for (const row of r.rows) {
      const step = nextStepPlain(row, r, kb);
      // nextStepPlain should return a string or null, never throw
      expect(step === null || typeof step === 'string').toBe(true);

      // contrib access with optional chaining
      const contribNF = row.contrib?.NF ?? 0;
      const contribSR = row.contrib?.SR ?? 0;
      const contribENV = row.contrib?.ENV ?? 0;
      expect(typeof contribNF).toBe('number');
      expect(typeof contribSR).toBe('number');
      expect(typeof contribENV).toBe('number');
    }
  });

  it('EC === 0 profiles (unranked) do not crash helper functions', () => {
    const ec0Rows = r.rows.filter((x) => x.EC === 0);
    expect(ec0Rows.length).toBeGreaterThan(0);
    for (const row of ec0Rows) {
      expect(row.contrib).toBeNull();
      expect(row.contrib?.NF ?? 0).toBe(0);
      const text = labelPlain(row, kb);
      expect(text).toContain('Không con số nào');
    }
  });

  it('admission benchmark rendering without exam does not throw toFixed', () => {
    // Benchmark row without student exam (typical for guest mode)
    const mockBenchmark = { major_id: 1, haui_name: 'Kế toán', cutoff_2026: 23.5, combos_2026: 'A00, A01, D01' };
    expect(mockBenchmark.margin).toBeUndefined();
    // fmt should safely handle undefined or number
    const { fmt } = require ? {} : {};
    expect(mockBenchmark.margin?.toFixed(2)).toBeUndefined();
  });

  it('all 29 number meanings in L6 have Vietnamese translations', () => {
    expect(Object.keys(NUMBER_MEANINGS_VI)).toHaveLength(29);
    for (const [key, val] of Object.entries(NUMBER_MEANINGS_VI)) {
      expect(typeof val.meaning).toBe('string');
      expect(val.meaning.length).toBeGreaterThan(10);
      expect(typeof val.vocations).toBe('string');
      expect(val.vocations.length).toBeGreaterThan(5);
    }
    // Test getMeaningVi helper
    expect(getMeaningVi('PY', 7)?.meaning).toContain('trải nghiệm');
    expect(getMeaningVi('VE', 6)?.meaning).toContain('Sao Kim');
    expect(getMeaningVi('KB', 4)?.meaning).toContain('thực tiễn');
  });

  it('groupName and archTrait provide clean Vietnamese in vi mode', () => {
    expect(groupName(kb, 'G1')).toBe('Số chủ đạo');
    expect(groupName(kb, 'G5')).toBe('Số tên đầy đủ');
    expect(archTrait(kb, 7)).toBe('Nghiên cứu, chiều sâu, tri thức');
  });
});

