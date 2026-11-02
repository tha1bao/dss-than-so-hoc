// Nạp tri thức từ DB thành cấu trúc `kb` cho engine dùng chung (server + client qua GET /api/knowledge).
// Cache theo bộ tham số; Admin sửa tri thức → invalidateKb().
import { q, q1 } from './db.js';
import { GROUPS } from '../shared/engine/index.js';

const TTL_MS = 5 * 60 * 1000;
let cache = new Map();
export const invalidateKb = () => { cache = new Map(); };

export async function loadKb(setCode = null) {
  const key = setCode ?? '*default*';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.kb;

  const pset = setCode
    ? await q1("SELECT * FROM parameter_set WHERE code = ? AND status = 'active' ORDER BY version DESC LIMIT 1", [setCode])
    : await q1("SELECT * FROM parameter_set WHERE is_default AND status = 'active' ORDER BY version DESC LIMIT 1");
  if (!pset) throw Object.assign(new Error(`Không có bộ tham số ${setCode ?? 'mặc định'}`), { status: 400 });

  const [letters, sw, wd, profs, psig, pws, th, rules, tmpl, envs, skills, archs, groups, majors, adm, kbr, sets] = await Promise.all([
    q('SELECT letter, is_digraph, pythagorean, hebraic, is_vowel FROM letter_mapping'),
    q('SELECT group_code, w FROM signal_weight WHERE param_set_id = ?', [pset.id]),
    q('SELECT iso_weekday, key_number FROM weekday_map'),
    q('SELECT id, env_code, sort_order, example_majors FROM major_profile ORDER BY sort_order'),
    q('SELECT profile_id, position, archetype_no FROM profile_signal ORDER BY profile_id, position'),
    q("SELECT p.code AS set_code, w.persona, w.alpha, w.beta, w.gamma, w.expr, w.criteria_rank, w.evidence FROM persona_weight w JOIN parameter_set p ON p.id = w.param_set_id WHERE p.status = 'active'"),
    q('SELECT kpi_code, level, min_value, max_value, match_text, rationale FROM threshold WHERE param_set_id = ?', [pset.id]),
    q('SELECT code, level, condition_text, message_vi, params_json FROM validity_rule'),
    q('SELECT code, layer, template_vi FROM explanation_template'),
    q('SELECT code, name_vi, name_en FROM env_code'),
    q('SELECT code, archetype_no, name_vi FROM skill ORDER BY archetype_no'),
    q('SELECT code, number, trait, skill_cluster, motivation, typical_env, status FROM archetype ORDER BY number'),
    q('SELECT code, name_vi, school_code, rule_code, formula_code, in_nf FROM signal_group'),
    q('SELECT id, name_vi, category, profile_id, env_code FROM major ORDER BY id'),
    q('SELECT * FROM admission_benchmark'),
    q1('SELECT id, label, content_hash FROM kb_release ORDER BY id DESC LIMIT 1'),
    q("SELECT id, code, method, normalize_minmax, is_default, note FROM parameter_set WHERE status = 'active' ORDER BY id"),
  ]);

  const wMap = Object.fromEntries(sw.map((r) => [r.group_code, Number(r.w)]));
  const posOf = {};
  for (const r of psig) (posOf[r.profile_id] ??= [])[r.position - 1] = r.archetype_no;
  const weights = {};
  for (const r of pws) (weights[r.set_code] ??= {})[r.persona] = [r.alpha, r.beta, r.gamma];

  const kb = {
    paramSet: { id: pset.id, code: pset.code, version: pset.version, normalize: !!pset.normalize_minmax, method: pset.method },
    sets: sets.map((s) => ({ id: s.id, code: s.code, method: s.method, normalize: !!s.normalize_minmax, isDefault: !!s.is_default, note: s.note })),
    kbRelease: kbr,
    letters: Object.fromEntries(letters.filter((l) => !l.is_digraph).map((l) => [l.letter, [l.pythagorean, l.hebraic, !!l.is_vowel]])),
    digraphs: Object.fromEntries(letters.filter((l) => l.is_digraph).map((l) => [l.letter, l.hebraic])),
    weekdayKey: Object.fromEntries(wd.map((r) => [r.iso_weekday, r.key_number])),
    profiles: profs.map((p) => ({ id: p.id, A: posOf[p.id], env: p.env_code, examples: p.example_majors })),
    params: {
      w: Object.fromEntries(GROUPS.map((g) => [g, wMap[g]])), // thứ tự G1, G5, G6, G4, G2
      p: [Number(pset.p1), Number(pset.p2), Number(pset.p3)], EC_min: pset.ec_min, SR_min: Number(pset.sr_min), Weak_max: pset.weak_max,
    },
    weights, weightMeta: pws,
    thresholds: th,
    rules: Object.fromEntries(rules.map((r) => [r.code, { level: r.level, message_vi: r.message_vi, condition: r.condition_text, params: r.params_json }])),
    templates: Object.fromEntries(tmpl.map((t) => [t.code, t.template_vi])),
    envs: Object.fromEntries(envs.map((e) => [e.code, e.name_vi])),
    envsEn: Object.fromEntries(envs.map((e) => [e.code, e.name_en])),
    skills, archetypes: archs, groups,
    majors, admission: adm,
  };
  cache.set(key, { at: Date.now(), kb });
  return kb;
}

export { findMajor } from '../shared/engine/view.js';
