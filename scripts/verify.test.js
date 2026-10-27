// Kiểm chứng engine web với kết quả trong DSS_ASS2_ThanSoHoc_v6.xlsx.
// Chạy: npm run verify
import { describe, it, expect } from 'vitest';
import { computeProfile } from '../src/lib/numerology.js';
import { scoreAll, targetAnalysis, defaultOptions, SKILLS, PARAMS } from '../src/lib/engine.js';
import STUDENTS from './fixtures/students.json';
import SIGNALS from './fixtures/signals.json';
import WHATIF from './fixtures/whatif.json';
import SENS from './fixtures/sensitivity.json';
import REPORT from './fixtures/student_report_HS007.json';

const LABEL = {
  'Ưu tiên (Priority)': 'priority', 'Cân nhắc (Consider)': 'consider',
  'Thử thách (Challenge)': 'challenge', 'Không đề xuất (Not recommended)': 'none',
};
const PERSONA = { 'Học sinh (Student)': 'student', 'Phụ huynh (Parent)': 'parent', 'Tư vấn viên (Counselor)': 'counselor' };
const n = (s) => Number(String(s).replace(',', '.'));
// Excel/Python làm tròn hiển thị; so sánh số thực trong sai số của chữ số cuối
const near = (got, want, d) => Math.abs(got - want) <= 0.5 * 10 ** -d + 1e-9;
const byId = Object.fromEntries(STUDENTS.map((s) => [s.id, s]));

function studentFrom(s, computed = true) {
  const signals = computed ? computeProfile(s.name, s.dob).signals : SIGNALS[s.id];
  return { signals, skills: s.skills, top: s.top, env: s.env };
}

describe('Hồ sơ thần số học (Students_300, 300 HS)', () => {
  it('khớp mọi chỉ số tính trong Excel', () => {
    const errors = [];
    for (const s of STUDENTS) {
      const r = computeProfile(s.name, s.dob);
      const c = s.check;
      const pairs = [
        ['normalized_name', r.normalizedName, c.normalized_name],
        ['py_ruling_raw', r.pythagoras.rulingRaw, +c.py_ruling_raw],
        ['py_ruling_number', r.pythagoras.ruling, +c.py_ruling_number],
        ['py_vowel_total', r.pythagoras.vowelTotal, +c.py_vowel_total],
        ['py_soul_urge_number', r.pythagoras.soulUrge, +c.py_soul_urge_number],
        ['py_consonant_total', r.pythagoras.consonantTotal, +c.py_consonant_total],
        ['py_outer_expression_number', r.pythagoras.outer, +c.py_outer_expression_number],
        ['py_name_total', r.pythagoras.nameTotal, +c.py_name_total],
        ['py_complete_name_number', r.pythagoras.completeName, +c.py_complete_name_number],
        ['py_missing_numbers', r.pythagoras.missing.join(','), c.py_missing_numbers],
        ['py_arrows', r.pythagoras.arrows.join(' | ') || 'No full/empty arrow', c.py_arrows],
        ['vedic_psychic_number', r.vedic.psychic, +c.vedic_psychic_number],
        ['vedic_destiny_number', r.vedic.destiny, +c.vedic_destiny_number],
        ['vedic_name_number', r.vedic.name, +c.vedic_name_number],
        ['kab_birth_key', r.kabala.birthKey, +c.kab_birth_key],
        ['kab_weekday', r.kabala.weekday, c.kab_weekday],
        ['kab_day_key', r.kabala.dayKey, +c.kab_day_key],
        ['kab_name_hebraic_total', r.kabala.hebrewTotal, +c.kab_name_hebraic_total],
        ['kab_name_key', r.kabala.nameKey, +c.kab_name_key],
      ];
      for (const [k, got, want] of pairs) if (got !== want) errors.push(`${s.id} ${k}: ${got} ≠ ${want}`);
      const sig = SIGNALS[s.id];
      for (const k of ['G1', 'G5', 'G6', 'G4', 'G2', 'soul', 'soulY']) {
        if (r.signals[k] !== sig[k]) errors.push(`${s.id} signal ${k}: ${r.signals[k]} ≠ ${sig[k]}`);
      }
    }
    expect(errors.slice(0, 20)).toEqual([]);
  });
});

describe('Student_Report – HS007, persona Học sinh', () => {
  it('35 hồ sơ khớp NF, EC, SR, C, nhãn, hạng, SAT, STR', () => {
    const res = scoreAll(studentFrom(byId.HS007), defaultOptions());
    const errors = [];
    REPORT.forEach((want, i) => {
      const r = res.rows[i];
      const chk = [
        ['NF', near(r.nf, want.NF, 3), true], ['EC', r.ec, want.EC], ['SR', near(r.sr, want.SR, 3), true],
        ['C', near(r.c, want.C, 3), true], ['label', r.label, LABEL[want.label]], ['rank', r.rank ?? null, want.rank],
        ['SAT', r.sat, want.SAT], ['STR', r.str, want.STR], ['weak', r.weakSkills.length, want.weak],
      ];
      for (const [k, got, w] of chk) if (got !== w) errors.push(`${want.id} ${k}: ${got} ≠ ${w}`);
    });
    expect(errors).toEqual([]);
  });
});

describe('WhatIf_Scenarios – 12 kịch bản', () => {
  for (const sc of WHATIF) {
    it(`${sc.ID}: ${sc['Kịch bản / thay đổi']}`, () => {
      const o = defaultOptions();
      o.persona = PERSONA[sc.Persona];
      o.weights = [...PARAMS.personas[o.persona]];
      o.flags = { G1: +sc.f_G1, G5: +sc.f_G5, G6: +sc.f_G6, G4: +sc.f_G4, G2: +sc.f_G2 };
      o.positional = sc.pm === '1';
      o.envOverride = sc['Env thay thế'] || '';
      o.yVowel = sc.Y === '1';
      for (const s of SKILLS) o.delta[s] = +sc[`Δ ${s}`];
      const res = scoreAll(studentFrom(byId[sc['Học sinh']]), o);
      const t = targetAnalysis(res, sc['Ngành mục tiêu (ID)']);
      const got = {
        top1: res.top[0].profile.id, top2: res.top[1].profile.id, top3: res.top[2].profile.id,
        top1Label: res.top[0].label, top1C: near(res.top[0].c, n(sc['Top-1 C']), 3),
        tC: near(t.row.c, n(sc['C mục tiêu']), 3), tEC: t.row.ec, tSR: near(t.row.sr, n(sc['SR mục tiêu']), 3), tLabel: t.row.label,
        tRank: t.row.rank === null ? '– (EC=0)' : String(t.row.rank), tSAT: t.row.sat,
      };
      const want = {
        top1: sc['Top-1 hồ sơ'], top2: sc['Top-2 hồ sơ'], top3: sc['Top-3 hồ sơ'],
        top1Label: LABEL[sc['Top-1 nhãn']], top1C: true,
        tC: true, tEC: +sc['EC mục tiêu'], tSR: true,
        tLabel: LABEL[sc['Nhãn mục tiêu']], tRank: sc['Hạng mục tiêu (/35)'], tSAT: +sc['SAT mục tiêu'],
      };
      expect(got).toEqual(want);
    });
  }
});

describe('Sensitivity – 300 HS × 5 cấu hình', () => {
  it('Top-1, số Top-3 trùng, EC và C của Top-1 đều khớp', () => {
    const configs = [
      ['Gốc: Học sinh', (o) => o],
      ['Persona Phụ huynh', (o) => ({ ...o, persona: 'parent', weights: [...PARAMS.personas.parent] })],
      ['Persona Tư vấn viên', (o) => ({ ...o, persona: 'counselor', weights: [...PARAMS.personas.counselor] })],
      ['Chỉ Pythagoras (G1, G5)', (o) => ({ ...o, flags: { G1: 1, G5: 1, G6: 0, G4: 0, G2: 0 } })],
      ['Trọng số vị trí bằng nhau', (o) => ({ ...o, positional: false })],
    ];
    const errors = [];
    for (const row of SENS) {
      const st = studentFrom(byId[row.student_id]);
      const base = scoreAll(st, defaultOptions());
      const baseTop3 = base.top.map((r) => r.profile.id);
      for (const [name, mk] of configs) {
        const res = scoreAll(st, mk(defaultOptions()));
        const top1 = res.top[0];
        const overlap = res.top.filter((r) => baseTop3.includes(r.profile.id)).length;
        const chk = [
          ['Top-1', top1.profile.id, row[`Top-1 ${name}`]],
          ['Top-3 trùng', overlap, +row[`Top-3 trùng: ${name}`]],
          ['EC', top1.ec, +row[`EC Top-1 ${name}`]],
          ['C', near(top1.c, n(row[`C Top-1 ${name}`]), 4), true],
        ];
        for (const [k, got, w] of chk) if (got !== w) errors.push(`${row.student_id} ${name} ${k}: ${got} ≠ ${w}`);
      }
    }
    expect(errors.slice(0, 20)).toEqual([]);
  });
});
