// Đối chiếu trực tiếp engine JS (shared/engine) với giá trị trong DSS_ASS2_ThanSoHoc_v6.xlsx
// (bộ trọng số v6, KHÔNG chuẩn hóa – đúng cấu hình ASS2). Fixture Excel: scripts/fixtures (từ repo cũ).
import { describe, it, expect } from 'vitest';
import { computeSignals, computeExtras, scoreWithOptions, targetAnalysis, SKILL_ARCHS } from '../shared/engine/index.js';
import FX from './fixtures/engine_py.json';
import STUDENTS from '../scripts/fixtures/students.json';
import SIGNALS from '../scripts/fixtures/signals.json';
import WHATIF from '../scripts/fixtures/whatif.json';
import SENS from '../scripts/fixtures/sensitivity.json';
import REPORT from '../scripts/fixtures/student_report_HS007.json';
import MAJORS from '../src/data/majors.json';

const KB = FX.kb;
const PERSONA = { 'Học sinh (Student)': 'HS', 'Phụ huynh (Parent)': 'PH', 'Tư vấn viên (Counselor)': 'TVV' };
const LABEL = (s) => s.replace(/\s*\(.*\)$/, '');
const n = (s) => Number(String(s).replace(',', '.'));
const near = (got, want, d) => Math.abs(got - want) <= 0.5 * 10 ** -d + 1e-9;
const byId = Object.fromEntries(STUDENTS.map((s) => [s.id, s]));
const V6 = { wset: 'v6', normalize: false };
const inputOf = (s) => {
  const sig = computeSignals(s.name, s.dob, KB);
  return { sig, input: { arch: sig.arch, skills: Object.fromEntries(SKILL_ARCHS.map((a) => [a, s.skills[`SK${String(a).padStart(2, '0')}`]])), env: s.env, tops: s.top } };
};

describe('Students_300 – 19 chỉ số + tín hiệu khớp Excel v6', () => {
  it('300/300', () => {
    const err = [];
    for (const s of STUDENTS) {
      const { sig } = inputOf(s);
      const x = computeExtras(sig, KB);
      const c = s.check;
      const pairs = [
        ['normalized_name', sig.name.normalized, c.normalized_name], ['py_ruling_raw', sig.rulingRaw, +c.py_ruling_raw],
        ['py_ruling_number', sig.G1, +c.py_ruling_number], ['py_vowel_total', sig.vowelTotal, +c.py_vowel_total],
        ['py_soul_urge_number', sig.soulUrge, +c.py_soul_urge_number], ['py_consonant_total', x.consonantTotal, +c.py_consonant_total],
        ['py_outer_expression_number', x.outer, +c.py_outer_expression_number], ['py_name_total', sig.nameTotal, +c.py_name_total],
        ['py_complete_name_number', sig.G5, +c.py_complete_name_number], ['py_missing_numbers', x.missing.join(','), c.py_missing_numbers],
        ['py_arrows', x.arrows.join(' | ') || 'No full/empty arrow', c.py_arrows], ['vedic_psychic_number', sig.G2, +c.vedic_psychic_number],
        ['vedic_destiny_number', x.vedic.destiny, +c.vedic_destiny_number], ['vedic_name_number', x.vedic.name, +c.vedic_name_number],
        ['kab_birth_key', x.kabala.birthKey, +c.kab_birth_key], ['kab_weekday', x.kabala.weekday, c.kab_weekday],
        ['kab_day_key', sig.G4, +c.kab_day_key], ['kab_name_hebraic_total', sig.hebAdj, +c.kab_name_hebraic_total],
        ['kab_name_key', sig.G6, +c.kab_name_key],
      ];
      const e = SIGNALS[s.id];
      pairs.push(['G1', sig.arch.G1, e.G1], ['G5', sig.arch.G5, e.G5], ['G6', sig.arch.G6, e.G6], ['G4', sig.arch.G4, e.G4],
        ['G2', sig.arch.G2, e.G2], ['soul', sig.arch.SU, e.soul], ['soulY', sig.arch.SU_Y, e.soulY]);
      for (const [k, got, want] of pairs) if (got !== want) err.push(`${s.id} ${k}: ${got} ≠ ${want}`);
    }
    expect(err.slice(0, 20)).toEqual([]);
  });
});

describe('Student_Report – HS007, persona Học sinh, v6', () => {
  it('35 hồ sơ khớp NF, EC, SR, C, nhãn, hạng, SAT, STR', () => {
    const r = scoreWithOptions(inputOf(byId.HS007).input, KB, { ...V6, persona: 'HS' });
    const err = [];
    REPORT.forEach((w, i) => {
      const x = r.rows[i];
      const ok = x.profile === w.id && near(x.NF, w.NF, 3) && x.EC === w.EC && near(x.SR, w.SR, 3) && near(x.C, w.C, 3)
        && x.label === LABEL(w.label) && (x.rank ?? null) === w.rank && x.SAT === w.SAT && x.STR === w.STR && x.weak === w.weak;
      if (!ok) err.push(w.id);
    });
    expect(err).toEqual([]);
  });
});

describe('WhatIf_Scenarios – 12 kịch bản (v6)', () => {
  for (const sc of WHATIF) {
    it(`${sc.ID}: ${sc['Kịch bản / thay đổi']}`, () => {
      const delta = Object.fromEntries(SKILL_ARCHS.map((a) => [a, +sc[`Δ SK${String(a).padStart(2, '0')}`]]));
      const r = scoreWithOptions(inputOf(byId[sc['Học sinh']]).input, KB, { ...V6, persona: PERSONA[sc.Persona],
        flags: { G1: +sc.f_G1, G5: +sc.f_G5, G6: +sc.f_G6, G4: +sc.f_G4, G2: +sc.f_G2 }, positional: sc.pm === '1',
        envOverride: sc['Env thay thế'] || '', yVowel: sc.Y === '1', delta });
      const major = MAJORS.find((m) => m.id === Number(sc['Ngành mục tiêu (ID)']));
      const t = targetAnalysis(r, major.profile, KB.params).row;
      expect({
        top: r.top.map((x) => x.profile), top1Label: r.top[0].label, top1C: near(r.top[0].C, n(sc['Top-1 C']), 3),
        tC: near(t.C, n(sc['C mục tiêu']), 3), tEC: t.EC, tSR: near(t.SR, n(sc['SR mục tiêu']), 3), tLabel: t.label,
        tRank: t.rank === null ? '– (EC=0)' : String(t.rank), tSAT: t.SAT,
      }).toEqual({
        top: [sc['Top-1 hồ sơ'], sc['Top-2 hồ sơ'], sc['Top-3 hồ sơ']], top1Label: LABEL(sc['Top-1 nhãn']), top1C: true,
        tC: true, tEC: +sc['EC mục tiêu'], tSR: true, tLabel: LABEL(sc['Nhãn mục tiêu']), tRank: sc['Hạng mục tiêu (/35)'], tSAT: +sc['SAT mục tiêu'],
      });
    });
  }
});

describe('Sensitivity – 300 HS × 5 cấu hình (v6)', () => {
  it('Top-1, số Top-3 trùng, EC và C của Top-1 khớp Excel', () => {
    const cfgs = [['Gốc: Học sinh', { persona: 'HS' }], ['Persona Phụ huynh', { persona: 'PH' }], ['Persona Tư vấn viên', { persona: 'TVV' }],
      ['Chỉ Pythagoras (G1, G5)', { persona: 'HS', flags: { G1: 1, G5: 1, G6: 0, G4: 0, G2: 0 } }], ['Trọng số vị trí bằng nhau', { persona: 'HS', positional: false }]];
    const err = [];
    for (const row of SENS) {
      const inp = inputOf(byId[row.student_id]).input;
      const base = scoreWithOptions(inp, KB, { ...V6, persona: 'HS' }).top.map((r) => r.profile);
      for (const [name, o] of cfgs) {
        const r = scoreWithOptions(inp, KB, { ...V6, ...o });
        const t1 = r.top[0];
        const ov = r.top.filter((x) => base.includes(x.profile)).length;
        if (t1.profile !== row[`Top-1 ${name}`] || ov !== +row[`Top-3 trùng: ${name}`] || t1.EC !== +row[`EC Top-1 ${name}`] || !near(t1.C, n(row[`C Top-1 ${name}`]), 4))
          err.push(`${row.student_id} ${name}`);
      }
    }
    expect(err.slice(0, 20)).toEqual([]);
  });
});
