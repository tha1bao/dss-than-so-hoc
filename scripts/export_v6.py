"""Xuất dữ liệu từ bản dump văn bản của DSS_ASS2_ThanSoHoc_v6 sang JSON cho web.

Cách dùng:  python3 scripts/export_v6.py <đường-dẫn-file-v6-dạng-text>
Kết quả:   src/data/*.json (dữ liệu web dùng) và scripts/fixtures/*.json (dữ liệu kiểm chứng).
"""
import csv
import io
import json
import os
import sys

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data")
FIX = os.path.join(ROOT, "scripts", "fixtures")
os.makedirs(DATA, exist_ok=True)
os.makedirs(FIX, exist_ok=True)

# ---- tách sheet ----
sheets, cur = {}, None
with open(SRC, encoding="utf-8") as f:
    for line in f:
        if line.startswith("## Sheet name: "):
            cur = line[len("## Sheet name: "):].strip()
            sheets[cur] = []
        elif cur:
            sheets[cur].append(line)


def rows(name):
    return list(csv.reader(io.StringIO("".join(sheets[name]))))


def num(s):
    s = (s or "").strip()
    if s == "":
        return None
    try:
        v = float(s.replace(",", "."))
        return int(v) if v.is_integer() and "," not in s and "." not in s else v
    except ValueError:
        return s


def table(name, header_first_cell, stop_blank=True):
    rs = rows(name)
    i = next(k for k, r in enumerate(rs) if r and r[0] == header_first_cell)
    head = rs[i]
    out = []
    for r in rs[i + 1:]:
        if not r or not r[0].strip():
            if stop_blank:
                break
            continue
        out.append(dict(zip(head, r)))
    return out


def dump(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


SKILLS = ["SK01", "SK02", "SK03", "SK04", "SK05", "SK06", "SK07", "SK08", "SK09", "SK11", "SK22", "SK33"]

# ---- hồ sơ ngành ----
profiles = []
for r in table("Major_Profiles", "Profile_ID"):
    profiles.append({
        "id": r["Profile_ID"],
        "a": [int(r["A1 (chính)"]), int(r["A2"]), int(r["A3"])],
        "env": r["Env_Code"],
        "n": int(r["Số ngành"]),
        "examples": r["Ngành ví dụ (≤4)"],
        "categories": r["Nhóm ngành"],
    })

# ---- ngành ----
majors = []
for r in table("Major_Data", "ID"):
    majors.append({
        "id": int(r["ID"]),
        "category": r["Major Category"],
        "name": r["Academic Major"],
        "profile": r["Profile_ID"],
    })

# ---- archetype & kỹ năng ----
archetypes = []
for r in table("Number_Archetype_Map", "Archetype_Code"):
    archetypes.append({
        "n": int(r["Number"]),
        "skill": r["Skill_Code"],
        "trait": r["Trait text (exact, as in Major_Data)"],
        "skillText": r["Skill cluster text (exact)"],
        "motivation": r["Motivation text (exact)"],
        "env": r["Typical environment (most frequent in Major_Data)"],
    })

# ---- tham số (đọc lại từ sheet để web dùng đúng số của nhóm) ----
prm = {r[0]: r for r in rows("Parameters") if r}
def pv(key_prefix):
    k = next(k for k in prm if k.startswith(key_prefix))
    return num(prm[k][1])

params = {
    "w": {"G1": pv("w_G1"), "G5": pv("w_G5"), "G6": pv("w_G6"), "G4": pv("w_G4"), "G2": pv("w_G2")},
    "p": [pv("p_1"), pv("p_2"), pv("p_3")],
    "personas": {
        "student": [num(x) for x in prm["Học sinh (Student)"][1:4]],
        "parent": [num(x) for x in prm["Phụ huynh (Parent)"][1:4]],
        "counselor": [num(x) for x in prm["Tư vấn viên (Counselor)"][1:4]],
    },
    "ecMin": pv("EC_min"),
    "srMin": pv("SR_min"),
    "weakMax": pv("Weak_max"),
}

# ---- học sinh ----
students = []
for r in table("Students_300", "student_id"):
    d, m, y = r["date_of_birth"].split("/")
    students.append({
        "id": r["student_id"],
        "name": r["full_name"],
        "gender": r["gender"],
        "dob": f"{y}-{m}-{d}",
        "skills": {s: int(r["skill_" + s]) for s in SKILLS},
        "top": [int(r["top_strength_%d" % i][2:]) for i in (1, 2, 3)],
        "env": r["preferred_work_env"],
        # các chỉ số đã tính trong Excel – dùng để kiểm chứng
        "check": {k: r[k] for k in [
            "normalized_name", "py_ruling_raw", "py_ruling_number", "py_vowel_total", "py_soul_urge_number",
            "py_consonant_total", "py_outer_expression_number", "py_name_total", "py_complete_name_number",
            "vedic_psychic_number", "vedic_destiny_number", "vedic_name_number", "kab_birth_key", "kab_weekday",
            "kab_day_key", "kab_name_hebraic_total", "kab_name_key", "py_birth_chart", "py_missing_numbers", "py_arrows"]},
    })

signals = {}
for r in table("Student_Signals", "student_id"):
    signals[r["student_id"]] = {
        "G1": int(r["G1 arch (Ruling; 10→1)"]), "G5": int(r["G5 arch (Complete Name; 10→1)"]),
        "G6": int(r["G6 (Kabala name key)"]), "G4": int(r["G4 (Kabala day key)"]), "G2": int(r["G2 (Vedic psychic)"]),
        "soul": int(r["Soul Urge arch (Y phụ âm)"]), "soulY": int(r["Soul Urge arch (Y nguyên âm)"]),
    }

# ---- fixtures What-if (12 kịch bản) ----
wi = rows("WhatIf_Scenarios")
hi = next(k for k, r in enumerate(wi) if r and r[0] == "ID")
head = wi[hi]
scen = []
for r in wi[hi + 1:]:
    if not r or not r[0].strip():
        break
    d = dict(zip(head, r))
    scen.append(d)

# ---- fixtures độ nhạy (300 × 5) ----
sen = table("Sensitivity", "student_id")

# ---- fixture Student_Report (HS007, persona Học sinh) ----
sr = rows("Student_Report")
ei = next(k for k, r in enumerate(sr) if r and r[0] == "Profile_ID")
engine_rows = []
for r in sr[ei + 1:]:
    if not r or not r[0].startswith("P"):
        break
    engine_rows.append({"id": r[0], "NF": num(r[11]), "EC": num(r[12]), "SR": num(r[16]), "weak": num(r[17]),
                        "ENV": num(r[18]), "C": num(r[19]), "label": r[20], "rank": num(r[22]),
                        "SAT": num(r[23]), "STR": num(r[24])})

sample_ids = ["HS001", "HS007", "HS015", "HS021"]
samples = [{k: v for k, v in s.items() if k != "check"} for s in students if s["id"] in sample_ids]

dump(os.path.join(DATA, "profiles.json"), profiles)
dump(os.path.join(DATA, "majors.json"), majors)
dump(os.path.join(DATA, "archetypes.json"), archetypes)
dump(os.path.join(DATA, "params.json"), params)
dump(os.path.join(DATA, "samples.json"), samples)
dump(os.path.join(FIX, "students.json"), students)
dump(os.path.join(FIX, "signals.json"), signals)
dump(os.path.join(FIX, "whatif.json"), scen)
dump(os.path.join(FIX, "sensitivity.json"), sen)
dump(os.path.join(FIX, "student_report_HS007.json"), engine_rows)
print("profiles", len(profiles), "majors", len(majors), "students", len(students),
      "signals", len(signals), "scenarios", len(scen), "sensitivity", len(sen), "engine", len(engine_rows))
print(json.dumps(params, ensure_ascii=False))
