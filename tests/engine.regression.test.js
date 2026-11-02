// Hồi quy: engine JS (shared/engine) phải khớp 100% ENGINE CHUẨN engine.py.
// Fixture sinh bởi db/etl/prepare.py (chạy lại khi engine.py hoặc tri thức đổi).
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { computeSignals, score, scoreWithOptions, evaluateValidity, targetAnalysis, GROUPS } from '../shared/engine/index.js';
import FX from './fixtures/engine_py.json';

const KB = FX.kb;
const EPS = 1e-12;
const close = (a, b) => (a === null || b === null ? a === b : Math.abs(a - b) <= EPS);
const sigCache = Object.fromEntries(FX.students.map((s) => [s.id, computeSignals(s.name, s.dob, KB)]));

describe(`Tín hiệu thần số học – ${FX.students.length} HS (300 ASS2 + 75 mô phỏng)`, () => {
  it('G1, G2, G4, G5, G6, Soul Urge và các bước trung gian khớp engine.py', () => {
    const err = [];
    for (const s of FX.students) {
      const g = sigCache[s.id], e = s.sig;
      const pairs = [['G1', g.G1, e.G1], ['G2', g.G2, e.G2], ['G4', g.G4, e.G4], ['G5', g.G5, e.G5], ['G6', g.G6, e.G6],
        ['SU', g.soulUrge, e.soul_urge], ['ruling_raw', g.rulingRaw, e.ruling_raw], ['name_total', g.nameTotal, e.name_total],
        ['vowel_total', g.vowelTotal, e.vowel_total], ['heb_total', g.hebTotal, e.heb_total], ['heb_adj', g.hebAdj, e.heb_adj],
        ['TH', g.digraph.TH, e.TH], ['PH', g.digraph.PH, e.PH], ['TZ', g.digraph.TZ, e.TZ], ['normalized', g.name.normalized, e.normalized]];
      for (const k of ['G1', 'G5', 'G6', 'G4', 'G2', 'SU']) pairs.push([`arch.${k}`, g.arch[k], e.arch[k]]);
      for (const [k, a, b] of pairs) if (a !== b) err.push(`${s.id} ${k}: ${a} ≠ ${b}`);
    }
    expect(err.slice(0, 20)).toEqual([]);
  });
});

const input = (s) => [sigCache[s.id].arch, s.skills, s.env, s.tops];

describe(`Top-3 – ${FX.students.length} HS × ${FX.configs.length} cấu hình (v6/A/B × HS/PH/TVV)`, () => {
  it('hồ sơ, C, nhãn, EC của Top-3 khớp engine.py', () => {
    const err = [];
    for (const s of FX.students) {
      FX.configs.forEach(([wset, norm, persona], ci) => {
        const r = score(...input(s), KB, { persona, wset, normalize: norm });
        const want = FX.top3[s.id][ci];
        want.forEach(([pid, c, label, ec], i) => {
          const t = r.top[i];
          if (!t || t.profile !== pid || !close(t.C, c) || t.label !== label || t.EC !== ec)
            err.push(`${s.id} ${wset}/${persona} #${i + 1}: ${t?.profile} ${t?.C} ${t?.label} ≠ ${pid} ${c} ${label}`);
        });
      });
    }
    expect(err.slice(0, 20)).toEqual([]);
  });
});

describe(`Bảng 35 hồ sơ đầy đủ – ${Object.keys(FX.full).length} lần tính`, () => {
  it('NF, SR, EC, ENV, C_raw, C, nhãn, hạng, SAT, STR, số KN yếu khớp từng dòng', () => {
    const byId = Object.fromEntries(FX.students.map((s) => [s.id, s]));
    const err = [];
    for (const [key, rows] of Object.entries(FX.full)) {
      const [id, wset, persona] = key.split('|');
      const r = score(...input(byId[id]), KB, { persona, wset, normalize: wset !== 'v6' });
      rows.forEach(([pid, nf, sr, ec, env, craw, c, label, rank, sat, str, weak], i) => {
        const x = r.rows[i];
        const ok = x.profile === pid && close(x.NF, nf) && close(x.SR, sr) && x.EC === ec && x.ENV === env && close(x.C_raw, craw)
          && close(x.C, c) && x.label === label && x.rank === rank && x.SAT === sat && x.STR === str && x.weak === weak;
        if (!ok) err.push(`${key} ${pid}`);
      });
    }
    expect(err.slice(0, 20)).toEqual([]);
  });
});

describe(`Sensitivity – ${FX.sensitivity.length} dòng (300 HS × 5 cấu hình × v6/A/B)`, () => {
  it('Top-1, số Top-3 trùng, EC và C của Top-1 khớp', () => {
    const byId = Object.fromEntries(FX.students.map((s) => [s.id, s]));
    const CFG = { BASE_HS: { persona: 'HS' }, PH: { persona: 'PH' }, TVV: { persona: 'TVV' },
      PY_ONLY: { persona: 'HS', flags: { G1: 1, G5: 1, G6: 0, G4: 0, G2: 0 } }, EQUAL_P: { persona: 'HS', positional: false } };
    const cache = {};
    const run = (id, set, cfg) => (cache[`${id}|${set}|${cfg}`] ??= scoreWithOptions(
      { arch: sigCache[id].arch, skills: byId[id].skills, env: byId[id].env, tops: byId[id].tops }, KB,
      { ...CFG[cfg], wset: set, normalize: set !== 'v6' }));
    const err = [];
    for (const row of FX.sensitivity) {
      const r = run(row.student, row.set, row.cfg);
      const base = new Set(run(row.student, row.set, 'BASE_HS').top.map((t) => t.profile));
      const t1 = r.top[0];
      const ov = r.top.filter((t) => base.has(t.profile)).length;
      if (t1.profile !== row.top1 || ov !== row.overlap || t1.EC !== row.ec || Math.abs(t1.C - row.c) > 5e-7)
        err.push(`${row.student} ${row.set}/${row.cfg}: ${t1.profile} ${ov} ${t1.EC} ${t1.C} ≠ ${row.top1} ${row.overlap} ${row.ec} ${row.c}`);
    }
    expect(err.slice(0, 20)).toEqual([]);
  });
});

// Cảnh báo ngoài phạm vi – đối chiếu với bộ giả lập 120 người (people.json, ngoài repo web nên có thể bỏ qua)
const PEOPLE_PATH = path.resolve(__dirname, '../../ASS3_Pha0-1/sim/people.json');
const MAJORS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/majors.json'), 'utf8'));
const majorByName = new Map(MAJORS.map((m) => [m.name.trim().toLowerCase(), m]).reverse());
describe.skipIf(!fs.existsSync(PEOPLE_PATH))('Cảnh báo ngoài phạm vi – 75 HS mô phỏng', () => {
  it('tập cảnh báo đỏ/vàng trùng people.json', () => {
    const P = JSON.parse(fs.readFileSync(PEOPLE_PATH, 'utf8'));
    const CODE = [[/^Năm sinh/, 'V_DOB'], [/^Tên có ký tự/, 'V_CHAR'], [/^Tên \d âm tiết/, 'V_NAME_LEN'], [/TZ/, 'V_TZ'],
      [/không có trong 300/, 'V_MAJOR'], [/EC = 0/, 'V_EC0'], [/^Xung đột/, 'V_CONFLICT'], [/Chỉ 1 hồ sơ/, 'V_ONE_PROFILE']];
    const err = [];
    for (const s of P.students) {
      const sig = computeSignals(s.full_name, s.dob, KB);
      const skills = Object.fromEntries(Object.entries(s.skills).map(([k, v]) => [k, v]));
      const result = score(sig.arch, skills, s.env, s.top_strength, KB, { persona: 'HS', wset: 'A', normalize: true });
      const major = majorByName.get(s.target_major.trim().toLowerCase()) ?? null;
      const analysis = major ? targetAnalysis(result, major.profile, KB.params) : null;
      if (analysis && s.target && (analysis.row.EC !== s.target.EC || analysis.row.label !== s.target.label)) err.push(`${s.id} target`);
      const got = evaluateValidity({ sig, result, target: { text: s.target_major, major, analysis, inPilot: true }, params: KB.params })
        .filter((w) => ['V_DOB', 'V_CHAR', 'V_NAME_LEN', 'V_TZ', 'V_MAJOR', 'V_EC0', 'V_CONFLICT', 'V_ONE_PROFILE'].includes(w.code)).map((w) => w.code).sort();
      const want = s.warnings.map(([, msg]) => CODE.find(([re]) => re.test(msg))?.[1] ?? `?${msg}`).sort();
      if (got.join() !== want.join()) err.push(`${s.id}: ${got} ≠ ${want}`);
    }
    expect(err).toEqual([]);
  });
});

describe('Bước 5 – ví dụ Phụ lục B2.9 (HS021, Khoa học máy tính, SK01 2 → 3)', () => {
  it('SR 0,604 → 0,667, nhãn Thử thách → Ưu tiên; bậc cần tăng = 1', () => {
    const s = FX.students.find((x) => x.id === 'HS021');
    const pid = MAJORS.find((m) => m.name === 'Khoa học máy tính').profile;
    const before = scoreWithOptions({ arch: sigCache.HS021.arch, skills: s.skills, env: s.env, tops: s.tops }, KB, { persona: 'PH', wset: 'v6', normalize: false });
    const t0 = targetAnalysis(before, pid, KB.params);
    const after = scoreWithOptions({ arch: sigCache.HS021.arch, skills: s.skills, env: s.env, tops: s.tops }, KB, { persona: 'PH', wset: 'v6', normalize: false, delta: { 1: 1 } });
    const t1 = targetAnalysis(after, pid, KB.params);
    expect([t0.row.SR.toFixed(3), t0.row.label, t0.stepsWeak, t1.row.SR.toFixed(3), t1.row.label, t1.stepsWeak, t1.gap])
      .toEqual(['0.604', 'Thử thách', 1, '0.667', 'Ưu tiên', 0, 0]);
  });
});

it('GROUPS giữ đúng thứ tự cộng của engine.py', () => expect(GROUPS).toEqual(Object.keys(KB.params.w)));
