-- =====================================================================
-- DSS Thần số học · DSS301 · Nhóm 2 · ASS3 – Lược đồ cơ sở tri thức
-- Đích: TiDB Cloud Serverless 8.0.11-TiDB-v8.5.3 (tương thích MySQL 8)
-- Bản thiết kế PHA 2 (02/11/2026) – CHỜ NHÓM DUYỆT trước khi nạp vào DB thật.
--
-- Quy ước:
--  * utf8mb4 / utf8mb4_unicode_ci cho mọi bảng.
--  * Mọi bảng tri thức có cột src_ref = "tệp › sheet › dòng" (lineage cho tầng L7).
--  * Không trigger / stored procedure / event (TiDB không hỗ trợ):
--    audit_log, phiên bản hóa, kiểm tra miền giá trị làm ở tầng Node.
--  * Bảng ghi nhiều (run, run_result, audit_log, comment) dùng BIGINT AUTO_RANDOM
--    để tránh hotspot; bảng tri thức dùng khóa tự nhiên (P01, SK01, F-G1…).
--  * CHECK chỉ có tác dụng khi bật tidb_enable_check_constraint – vẫn giữ để
--    tài liệu hóa miền giá trị; Node validate lại.
-- =====================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- NHÓM 1 · TRI THỨC NGUỒN (L5–L6)
-- ---------------------------------------------------------------------

CREATE TABLE school (                      -- 3 trường phái
  code        VARCHAR(4)   PRIMARY KEY,    -- PY | KB | VE
  name_vi     VARCHAR(50)  NOT NULL,       -- Pythagoras | Kabala | Vệ Đà
  name_en     VARCHAR(50)  NOT NULL,
  main_source VARCHAR(8)   NULL            -- S01 / S03 / S02
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE source_book (                 -- S01–S09 sách/tài liệu, E1–E13 bằng chứng trọng số, W* URL điểm chuẩn
  code        VARCHAR(8)    PRIMARY KEY,
  kind        ENUM('book','evidence','web','dataset','team') NOT NULL,
  author      VARCHAR(200)  NULL,
  title       VARCHAR(400)  NOT NULL,
  role_in_dss VARCHAR(400)  NULL,
  used_for    TEXT          NULL,
  locator     VARCHAR(400)  NULL,          -- trang / chương / URL
  src_ref     VARCHAR(200)  NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE letter_mapping (              -- 26 chữ + 3 chữ ghép (TH, PH, TZ)
  letter        VARCHAR(2)   PRIMARY KEY,
  is_digraph    BOOLEAN      NOT NULL DEFAULT FALSE,
  pythagorean   TINYINT      NULL,         -- NULL với chữ ghép (= tổng 2 chữ)
  vedic_unit    TINYINT      NULL,         -- = Pythagoras; bảng Johari chưa xác minh (Data_Gap #10)
  hebraic       TINYINT      NOT NULL,     -- Sepharial tr.30; TH 9, PH 8, TZ 9
  is_vowel      BOOLEAN      NOT NULL DEFAULT FALSE,  -- Y = phụ âm (Phillips tr.173)
  note          VARCHAR(400) NULL,
  src_ref       VARCHAR(200) NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE calc_rule (                   -- 20 quy tắc PY00–PY07, VE01–VE03, KB01–KB04, SC01, GEN01–02
  code        VARCHAR(8)    PRIMARY KEY,
  school_code VARCHAR(4)    NULL,
  indicator   VARCHAR(200)  NOT NULL,
  pseudocode  TEXT          NOT NULL,
  example     TEXT          NULL,
  source_note TEXT          NULL,
  src_ref     VARCHAR(200)  NULL,
  CONSTRAINT fk_rule_school FOREIGN KEY (school_code) REFERENCES school(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE formula (                     -- 25 công thức F-PY00 … F-ROC, gắn tầng L0–L7
  code        VARCHAR(16)   PRIMARY KEY,
  layer       ENUM('L0','L1','L2','L3','L4','L5','L6','L7') NOT NULL,
  name_vi     VARCHAR(200)  NOT NULL,
  expr        TEXT          NOT NULL,      -- biểu thức dạng chữ
  explain_vi  TEXT          NULL,          -- giải thích ngôn ngữ HS/PH
  rule_code   VARCHAR(8)    NULL,          -- liên kết calc_rule (nếu có)
  src_ref     VARCHAR(200)  NULL,
  CONSTRAINT fk_formula_rule FOREIGN KEY (rule_code) REFERENCES calc_rule(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE number_meaning (              -- 29 dòng: PY 11 · VE 9 · KB 9
  id           INT           PRIMARY KEY AUTO_INCREMENT,
  school_code  VARCHAR(4)    NOT NULL,
  number       TINYINT       NOT NULL,
  indicator    VARCHAR(200)  NOT NULL,
  meaning      TEXT          NOT NULL,
  vocations    TEXT          NULL,
  archetype_code VARCHAR(4)  NULL,         -- FK thêm sau khi tạo bảng archetype
  dss_use      VARCHAR(50)   NULL,
  source_note  TEXT          NULL,
  row_version  INT           NOT NULL DEFAULT 1,   -- khóa lạc quan khi Admin sửa
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by   BIGINT        NULL,
  src_ref      VARCHAR(200)  NULL,
  UNIQUE KEY uq_meaning (school_code, number, indicator(100)),
  CONSTRAINT fk_meaning_school FOREIGN KEY (school_code) REFERENCES school(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE citation (                    -- nối 1 quy tắc/ý nghĩa/công thức với nguồn + trang
  id          INT           PRIMARY KEY AUTO_INCREMENT,
  source_code VARCHAR(8)    NOT NULL,
  target_type ENUM('calc_rule','formula','number_meaning','archetype','persona_weight','parameter','major','admission') NOT NULL,
  target_key  VARCHAR(40)   NOT NULL,      -- vd 'PY01', 'F-NF', '12' (number_meaning.id)
  locator     VARCHAR(200)  NULL,          -- 'PDF p.68–69'
  note        TEXT          NULL,
  KEY ix_cit_target (target_type, target_key),
  CONSTRAINT fk_cit_source FOREIGN KEY (source_code) REFERENCES source_book(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE glossary (                    -- Phụ lục A1–A5 (~70 thuật ngữ) → tooltip & trang Từ điển
  term        VARCHAR(60)   PRIMARY KEY,   -- NF, SR, EC, G1, archetype…
  group_code  VARCHAR(4)    NULL,          -- A1…A5
  full_name   VARCHAR(300)  NULL,
  plain_vi    TEXT          NOT NULL,      -- giải thích cho HS/PH
  plain_en    TEXT          NULL,
  appears_in  VARCHAR(200)  NULL,          -- sheet/slide nơi dùng
  src_ref     VARCHAR(200)  NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- NHÓM 2 · ÁNH XẠ: số → archetype → hồ sơ → ngành (L3)
-- ---------------------------------------------------------------------

CREATE TABLE env_code (                    -- 4 môi trường làm việc
  code     VARCHAR(8)   PRIMARY KEY,       -- LEAD | COLLAB | CREATE | STRUCT
  name_en  VARCHAR(60)  NOT NULL UNIQUE,   -- đúng chuỗi trong Major_Data (khóa ETL)
  name_vi  VARCHAR(80)  NOT NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE archetype (                   -- 12 archetype A01–A09, A11, A22, A33 (Number_Archetype_Map)
  code          VARCHAR(4)   PRIMARY KEY,
  number        TINYINT      NOT NULL UNIQUE,
  trait         TEXT         NOT NULL,
  skill_cluster TEXT         NOT NULL,
  motivation    TEXT         NOT NULL,
  typical_env   VARCHAR(8)   NULL,
  link_text     TEXT         NULL,
  evidence      TEXT         NULL,
  status        VARCHAR(80)  NOT NULL DEFAULT 'suy luận – chờ xác nhận',  -- D7 / Data_Gap #11
  row_version   INT          NOT NULL DEFAULT 1,
  src_ref       VARCHAR(200) NULL,
  CONSTRAINT fk_arch_env FOREIGN KEY (typical_env) REFERENCES env_code(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE number_meaning
  ADD CONSTRAINT fk_meaning_arch FOREIGN KEY (archetype_code) REFERENCES archetype(code);

CREATE TABLE number_archetype_map (        -- con số tín hiệu → số archetype (10 → 1; 11, 22 giữ nguyên)
  number        TINYINT      PRIMARY KEY,  -- 1–11, 22, 33
  archetype_no  TINYINT      NOT NULL,
  rule_note     VARCHAR(200) NULL,
  src_ref       VARCHAR(200) NULL,
  CONSTRAINT fk_nam_arch FOREIGN KEY (archetype_no) REFERENCES archetype(number)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE skill (                       -- 12 kỹ năng SK01…SK09, SK11, SK22, SK33 (1-1 với archetype)
  code          VARCHAR(4)   PRIMARY KEY,
  archetype_no  TINYINT      NOT NULL UNIQUE,
  name_vi       VARCHAR(120) NOT NULL,     -- nhãn thân thiện cho HS
  description   TEXT         NULL,
  CONSTRAINT fk_skill_arch FOREIGN KEY (archetype_no) REFERENCES archetype(number)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE major_profile (               -- 35 hồ sơ P01–P35; sort_order = thứ tự phá hòa
  id           VARCHAR(4)   PRIMARY KEY,
  sort_order   TINYINT      NOT NULL UNIQUE,
  env_code     VARCHAR(8)   NOT NULL,
  name_vi      VARCHAR(200) NULL,          -- tên hiển thị (nhóm ngành tiêu biểu)
  example_majors TEXT       NULL,
  major_groups TEXT         NULL,
  row_version  INT          NOT NULL DEFAULT 1,
  src_ref      VARCHAR(200) NULL,
  CONSTRAINT fk_prof_env FOREIGN KEY (env_code) REFERENCES env_code(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE profile_signal (              -- 3 archetype có thứ tự của mỗi hồ sơ (105 dòng)
  profile_id   VARCHAR(4)   NOT NULL,
  position     TINYINT      NOT NULL,      -- 1 | 2 | 3  → p = 1 / 0,8 / 0,6 (lấy từ parameter_set)
  archetype_no TINYINT      NOT NULL,
  PRIMARY KEY (profile_id, position),
  UNIQUE KEY uq_prof_arch (profile_id, archetype_no),
  KEY ix_ps_arch (archetype_no),
  CONSTRAINT fk_ps_prof FOREIGN KEY (profile_id) REFERENCES major_profile(id),
  CONSTRAINT fk_ps_arch FOREIGN KEY (archetype_no) REFERENCES archetype(number)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE major (                       -- 300 ngành (Major_Data)
  id            INT          PRIMARY KEY,
  category      VARCHAR(120) NOT NULL,
  name_vi       VARCHAR(200) NOT NULL,
  traits        TEXT         NULL,
  competencies  TEXT         NULL,
  motivations   TEXT         NULL,
  ideal_env_text TEXT        NULL,
  skill_codes   VARCHAR(60)  NULL,         -- giữ nguyên chuỗi gốc để đối chiếu
  env_code      VARCHAR(8)   NOT NULL,
  profile_id    VARCHAR(4)   NOT NULL,
  row_version   INT          NOT NULL DEFAULT 1,
  src_ref       VARCHAR(200) NULL,
  KEY ix_major_name (name_vi),
  KEY ix_major_profile (profile_id),
  CONSTRAINT fk_major_prof FOREIGN KEY (profile_id) REFERENCES major_profile(id),
  CONSTRAINT fk_major_env  FOREIGN KEY (env_code)  REFERENCES env_code(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE major_alias (                 -- tên gọi khác để tìm ngành ("CNTT", "IT"…); không có → cảnh báo ngoài phạm vi
  alias      VARCHAR(120) PRIMARY KEY,
  major_id   INT          NOT NULL,
  CONSTRAINT fk_alias_major FOREIGN KEY (major_id) REFERENCES major(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admission_benchmark (         -- Admission_Pilot: 18 ngành HaUI
  major_id     INT          PRIMARY KEY,
  haui_name    VARCHAR(200) NOT NULL,
  haui_code    VARCHAR(12)  NOT NULL,
  combos_2026  VARCHAR(80)  NULL,
  has_A00 BOOLEAN NOT NULL DEFAULT FALSE, has_A01 BOOLEAN NOT NULL DEFAULT FALSE,
  has_D01 BOOLEAN NOT NULL DEFAULT FALSE, has_B00 BOOLEAN NOT NULL DEFAULT FALSE,
  cutoff_2024  DECIMAL(5,2) NULL,
  cutoff_2025  DECIMAL(5,2) NULL,
  cutoff_2026  DECIMAL(5,2) NULL,
  delta_used   DECIMAL(5,2) NULL,
  mapping_note VARCHAR(200) NULL,
  src_2024 VARCHAR(8) NULL, src_2025 VARCHAR(8) NULL, src_2026 VARCHAR(8) NULL,  -- → source_book (kind=web)
  src_ref      VARCHAR(200) NULL,
  CONSTRAINT fk_adm_major FOREIGN KEY (major_id) REFERENCES major(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- NHÓM 3 · MÔ HÌNH (tham số có phiên bản)
-- ---------------------------------------------------------------------

CREATE TABLE parameter_set (               -- v6 / A / B + bản nháp Admin; KHÔNG sửa bản đã active → clone
  id            INT          PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(16)  NOT NULL,     -- 'v6' | 'A' | 'B' | 'A-2026-11-05'…
  version       INT          NOT NULL DEFAULT 1,
  status        ENUM('draft','active','archived') NOT NULL DEFAULT 'draft',
  is_default    BOOLEAN      NOT NULL DEFAULT FALSE,   -- đúng 1 dòng TRUE (Node kiểm)
  method        VARCHAR(60)  NULL,         -- 'ROC', 'Rank-sum', 'Nhóm ASS2'
  normalize_minmax BOOLEAN   NOT NULL DEFAULT TRUE,
  p1 DECIMAL(4,3) NOT NULL DEFAULT 1.000,
  p2 DECIMAL(4,3) NOT NULL DEFAULT 0.800,
  p3 DECIMAL(4,3) NOT NULL DEFAULT 0.600,
  ec_min        TINYINT      NOT NULL DEFAULT 2,
  sr_min        DECIMAL(5,4) NOT NULL DEFAULT 0.6250,
  weak_max      TINYINT      NOT NULL DEFAULT 2,
  parent_id     INT          NULL,         -- bản gốc khi clone
  note          TEXT         NULL,
  created_by    BIGINT       NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at  DATETIME     NULL,
  src_ref       VARCHAR(200) NULL,
  UNIQUE KEY uq_pset (code, version),
  CONSTRAINT fk_pset_parent FOREIGN KEY (parent_id) REFERENCES parameter_set(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE signal_group (                -- G1, G2, G4, G5, G6 (+ SU chỉ cho SAT)
  code        VARCHAR(4)   PRIMARY KEY,
  name_vi     VARCHAR(120) NOT NULL,
  school_code VARCHAR(4)   NOT NULL,
  rule_code   VARCHAR(8)   NULL,
  formula_code VARCHAR(16) NULL,
  in_nf       BOOLEAN      NOT NULL,
  src_ref     VARCHAR(200) NULL,
  CONSTRAINT fk_sg_school  FOREIGN KEY (school_code) REFERENCES school(code),
  CONSTRAINT fk_sg_rule    FOREIGN KEY (rule_code) REFERENCES calc_rule(code),
  CONSTRAINT fk_sg_formula FOREIGN KEY (formula_code) REFERENCES formula(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE signal_weight (               -- w Decoz theo bộ tham số: G1 .35 · G5 .25 · G6 .15 · G4 .15 · G2 .10
  param_set_id INT          NOT NULL,
  group_code   VARCHAR(4)   NOT NULL,
  w            DECIMAL(5,4) NOT NULL,
  PRIMARY KEY (param_set_id, group_code),
  CONSTRAINT fk_sw_pset  FOREIGN KEY (param_set_id) REFERENCES parameter_set(id),
  CONSTRAINT fk_sw_group FOREIGN KEY (group_code) REFERENCES signal_group(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE persona_weight (              -- α, β, γ theo persona và bộ tham số (9 dòng cho v6/A/B)
  param_set_id INT           NOT NULL,
  persona      ENUM('HS','PH','TVV') NOT NULL,
  alpha        DOUBLE        NOT NULL,     -- DOUBLE (không DECIMAL) để giữ đúng 1/9, 5/18… như engine.py – tránh lệch khi hòa điểm
  beta         DOUBLE        NOT NULL,
  gamma        DOUBLE        NOT NULL,
  expr         VARCHAR(40)   NULL,         -- dạng phân số để hiển thị: '1/9 · 5/18 · 11/18'
  criteria_rank VARCHAR(60)  NULL,         -- 'ENV > SR > NF'
  evidence     VARCHAR(80)   NULL,         -- 'E1–E13'
  PRIMARY KEY (param_set_id, persona),
  CONSTRAINT fk_pw_pset FOREIGN KEY (param_set_id) REFERENCES parameter_set(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE label_rule (                  -- luật nhãn xét theo thứ tự
  param_set_id INT          NOT NULL,
  seq          TINYINT      NOT NULL,
  cond_text    VARCHAR(200) NOT NULL,      -- 'EC = 0', 'có KN ≤ Weak_max', 'EC ≥ EC_min và SR ≥ SR_min', 'còn lại'
  label        ENUM('Không đề xuất','Thử thách','Ưu tiên','Cân nhắc') NOT NULL,
  src_ref      VARCHAR(200) NULL,
  PRIMARY KEY (param_set_id, seq),
  CONSTRAINT fk_lr_pset FOREIGN KEY (param_set_id) REFERENCES parameter_set(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weekday_map (                 -- G4: thứ → hành tinh → key (Sepharial tr.16)
  iso_weekday TINYINT     PRIMARY KEY,     -- 1 = Thứ 2 … 7 = Chủ nhật
  name_vi     VARCHAR(20) NOT NULL,
  name_en     VARCHAR(20) NOT NULL,
  planet      VARCHAR(20) NOT NULL,
  key_number  TINYINT     NOT NULL,
  src_ref     VARCHAR(200) NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE decision_question (           -- Q1–Q5 + C + Bước 5 (KPI_Formula_Chain)
  code        VARCHAR(8)   PRIMARY KEY,
  users_text  TEXT         NULL,
  question_vi TEXT         NOT NULL,
  criterion   TEXT         NULL,
  output_text TEXT         NULL,
  src_ref     VARCHAR(200) NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kpi (                         -- 6 KPI dashboard (mục 1.5)
  code          VARCHAR(16)  PRIMARY KEY,  -- K_LABEL, K_EC, K_SR, K_WEAK, K_STAB, K_ADMIT
  name_vi       VARCHAR(120) NOT NULL,
  question_code VARCHAR(8)   NULL,
  formula_code  VARCHAR(16)  NULL,
  unit          VARCHAR(20)  NULL,
  description   TEXT         NULL,
  sort_order    TINYINT      NOT NULL,
  CONSTRAINT fk_kpi_q FOREIGN KEY (question_code) REFERENCES decision_question(code),
  CONSTRAINT fk_kpi_f FOREIGN KEY (formula_code) REFERENCES formula(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE threshold (                   -- ngưỡng xanh/vàng/đỏ (phiên bản theo parameter_set)
  param_set_id INT          NOT NULL,
  kpi_code     VARCHAR(16)  NOT NULL,
  level        ENUM('green','yellow','red','grey') NOT NULL,
  min_value    DECIMAL(8,4) NULL,          -- khoảng số: min ≤ x < max (NULL = không chặn)
  max_value    DECIMAL(8,4) NULL,
  match_text   VARCHAR(120) NULL,          -- KPI dạng nhãn: 'Ưu tiên' / 'An toàn'…
  rationale    VARCHAR(200) NULL,
  PRIMARY KEY (param_set_id, kpi_code, level),
  CONSTRAINT fk_th_pset FOREIGN KEY (param_set_id) REFERENCES parameter_set(id),
  CONSTRAINT fk_th_kpi  FOREIGN KEY (kpi_code) REFERENCES kpi(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE validity_rule (               -- cảnh báo ngoài phạm vi (mục 1.7) – Admin chỉnh được
  code        VARCHAR(16)  PRIMARY KEY,    -- V_DOB, V_NAME_LEN, V_CHAR, V_TZ, V_MAJOR, V_EC0, V_EC1, V_ONE_PROFILE, V_SELF, V_ADMIT
  level       ENUM('green','yellow','red','grey') NOT NULL,
  condition_text VARCHAR(300) NOT NULL,
  message_vi  VARCHAR(300) NOT NULL,
  message_en  VARCHAR(300) NULL,
  params_json JSON         NULL,           -- {"dob_min":"2009-01-01","dob_max":"2011-12-31"}
  src_ref     VARCHAR(200) NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kb_release (                  -- ảnh chụp tri thức ảnh hưởng tới điểm (hồ sơ, ngành→hồ sơ, chữ, thứ)
  id            INT          PRIMARY KEY AUTO_INCREMENT,
  label         VARCHAR(60)  NOT NULL,
  content_hash  CHAR(64)     NOT NULL,     -- SHA-256 của snapshot_json
  snapshot_json JSON         NOT NULL,
  note          TEXT         NULL,
  created_by    BIGINT       NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_kbr_hash (content_hash)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE whatif_scenario (             -- 12 kịch bản ASS2 (T1–T3 × S1–S4) – dùng cả làm test hồi quy
  code          VARCHAR(12)  PRIMARY KEY,  -- 'T1-S1'
  situation     VARCHAR(200) NOT NULL,
  change_text   TEXT         NOT NULL,
  student_id    VARCHAR(12)  NOT NULL,     -- FK sau khi tạo student
  persona       ENUM('HS','PH','TVV') NOT NULL,
  param_set_id  INT          NULL,         -- NULL = v6 (nguồn ASS2)
  options_json  JSON         NOT NULL,     -- {flags:{G1..G2}, pm, y, target_major, delta:{SK01..}}
  expected_json JSON         NOT NULL,     -- Top-1..3, nhãn, C, mục tiêu… (từ Excel)
  interpretation TEXT        NULL,
  src_ref       VARCHAR(200) NULL,
  CONSTRAINT fk_wi_pset FOREIGN KEY (param_set_id) REFERENCES parameter_set(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sensitivity_result (          -- 300 HS × 5 cấu hình × bộ tham số → KPI độ ổn định
  param_set_id  INT          NOT NULL,
  student_id    VARCHAR(12)  NOT NULL,
  config_code   VARCHAR(16)  NOT NULL,     -- BASE_HS | PH | TVV | PY_ONLY | EQUAL_P
  top1_profile  VARCHAR(4)   NULL,
  top3_overlap  TINYINT      NULL,         -- 0–3 so với cấu hình gốc
  top1_ec       TINYINT      NULL,
  top1_c        DECIMAL(8,6) NULL,
  PRIMARY KEY (param_set_id, student_id, config_code),
  CONSTRAINT fk_sens_pset FOREIGN KEY (param_set_id) REFERENCES parameter_set(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_document (                -- Data_Gap, Change_Log, Data_Dictionary, Model Card, Member_Contribution (L7)
  doc_type    ENUM('data_gap','change_log','data_dictionary','major_data_dictionary','model_card','member_contribution','sensitivity_summary') NOT NULL,
  item_key    VARCHAR(40)  NOT NULL,
  seq         INT          NOT NULL,
  content     JSON         NOT NULL,       -- giữ nguyên cột gốc
  src_ref     VARCHAR(200) NULL,
  PRIMARY KEY (doc_type, item_key)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- NHÓM 4 · NGƯỜI DÙNG & KẾT QUẢ (dữ liệu mô phỏng)
-- ---------------------------------------------------------------------

CREATE TABLE app_user (                    -- đăng nhập 4 vai trò (JWT + bcrypt)
  id            BIGINT       PRIMARY KEY AUTO_RANDOM,
  username      VARCHAR(40)  NOT NULL UNIQUE,     -- 'sim-hs001'
  password_hash CHAR(60)     NOT NULL,            -- bcrypt; KHÔNG lưu mật khẩu rõ
  role          ENUM('student','parent','counselor','admin') NOT NULL,
  admin_scope   ENUM('kb','major','auditor','system','demo') NULL,  -- chỉ role=admin; auditor/demo = chỉ xem (TC12)
  display_name  VARCHAR(120) NOT NULL,            -- tên viết tắt "L. N. Trang"
  person_code   VARCHAR(12)  NULL UNIQUE,         -- SIM-HS001 / SIM-PH001 / SIM-TVV01 / SIM-AD01
  locale        ENUM('vi','en') NOT NULL DEFAULT 'vi',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  is_simulated  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME     NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student (                     -- 300 HS ASS2 (HS001…) + 75 HS mô phỏng (SIM-HS001…)
  id            VARCHAR(12)  PRIMARY KEY,
  dataset       ENUM('ASS2_300','SIM_120','LIVE') NOT NULL,
  user_id       BIGINT       NULL UNIQUE,
  full_name     VARCHAR(120) NOT NULL,     -- PII – chỉ trả về cho chính HS / PH / TVV phụ trách
  name_masked   VARCHAR(60)  NOT NULL,     -- "N. G. Hà" – dùng ở màn hình tổng hợp
  gender        ENUM('Nam','Nữ','Khác') NULL,
  dob           DATE         NOT NULL,     -- PII – màn hình tổng hợp chỉ hiện năm
  birth_year    SMALLINT     AS (YEAR(dob)) STORED,
  grade         TINYINT      NULL,
  school_year   VARCHAR(9)   NULL,
  preferred_env VARCHAR(8)   NULL,
  top_strength_1 TINYINT NULL, top_strength_2 TINYINT NULL, top_strength_3 TINYINT NULL,
  target_major_text VARCHAR(200) NULL,     -- nguyên văn HS gõ (vd 'Y khoa')
  target_major_id   INT      NULL,         -- NULL nếu không có trong 300 ngành → cảnh báo đỏ
  edge_case     VARCHAR(200) NULL,         -- E1–E6
  is_simulated  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  src_ref       VARCHAR(200) NULL,
  KEY ix_student_dataset (dataset),
  CONSTRAINT fk_st_user  FOREIGN KEY (user_id) REFERENCES app_user(id),
  CONSTRAINT fk_st_env   FOREIGN KEY (preferred_env) REFERENCES env_code(code),
  CONSTRAINT fk_st_major FOREIGN KEY (target_major_id) REFERENCES major(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE whatif_scenario
  ADD CONSTRAINT fk_wi_student FOREIGN KEY (student_id) REFERENCES student(id);
ALTER TABLE sensitivity_result
  ADD CONSTRAINT fk_sens_student FOREIGN KEY (student_id) REFERENCES student(id);

CREATE TABLE student_context (             -- PII nhạy cảm (Ch6): chỉ Admin + TVV phụ trách; dashboard chỉ dùng dạng nhóm
  student_id    VARCHAR(12)  PRIMARY KEY,
  school_name   VARCHAR(160) NULL,
  province      VARCHAR(80)  NULL,
  region        VARCHAR(60)  NULL,
  school_type   VARCHAR(40)  NULL,
  area          VARCHAR(40)  NULL,
  ethnicity     VARCHAR(40)  NULL,
  income_band   VARCHAR(40)  NULL,
  family        VARCHAR(80)  NULL,
  birth_order   VARCHAR(40)  NULL,
  academic_level VARCHAR(40) NULL,
  interest      VARCHAR(200) NULL,
  CONSTRAINT fk_sc_student FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_skill (               -- 12 kỹ năng tự đánh giá 1–5
  student_id  VARCHAR(12) NOT NULL,
  skill_code  VARCHAR(4)  NOT NULL,
  level       TINYINT     NOT NULL CHECK (level BETWEEN 1 AND 5),
  PRIMARY KEY (student_id, skill_code),
  CONSTRAINT fk_ss_student FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
  CONSTRAINT fk_ss_skill   FOREIGN KEY (skill_code) REFERENCES skill(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_exam (                -- điểm thi thử theo tổ hợp (cho KPI khả năng đỗ)
  student_id  VARCHAR(12)  NOT NULL,
  combo       VARCHAR(4)   NOT NULL,       -- A00 | A01 | D01 | B00
  score       DECIMAL(5,2) NOT NULL,
  PRIMARY KEY (student_id, combo),
  CONSTRAINT fk_se_student FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_signal (              -- G1, G2, G4, G5, G6, SU – kết quả engine + bước trung gian (L2, L5)
  student_id    VARCHAR(12)  NOT NULL,
  group_code    VARCHAR(4)   NOT NULL,
  raw_total     INT          NULL,         -- tổng trước rút gọn (Σ chữ số, Σ tên, Σ Hebraic điều chỉnh…)
  value         TINYINT      NOT NULL,     -- con số sau rút gọn (có thể 10/11/22)
  archetype_no  TINYINT      NOT NULL,     -- sau 10 → 1
  trace_json    JSON         NULL,         -- {digits, TH, PH, TZ, weekday…} cho tầng L5
  engine_version VARCHAR(20) NOT NULL,
  computed_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, group_code),
  KEY ix_sig_arch (group_code, archetype_no),
  CONSTRAINT fk_sig_student FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
  CONSTRAINT fk_sig_group   FOREIGN KEY (group_code) REFERENCES signal_group(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE parent (                      -- 30 PH mô phỏng
  id            VARCHAR(12)  PRIMARY KEY,
  user_id       BIGINT       NULL UNIQUE,
  full_name     VARCHAR(120) NOT NULL,
  name_masked   VARCHAR(60)  NOT NULL,
  relation      VARCHAR(20)  NULL,
  child_id      VARCHAR(12)  NOT NULL,
  occupation    VARCHAR(120) NULL,
  social_group  VARCHAR(60)  NULL,
  income_band   VARCHAR(40)  NULL,
  education     VARCHAR(40)  NULL,
  attitude      VARCHAR(200) NULL,
  CONSTRAINT fk_par_user  FOREIGN KEY (user_id) REFERENCES app_user(id),
  CONSTRAINT fk_par_child FOREIGN KEY (child_id) REFERENCES student(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE counselor (                   -- 10 TVV mô phỏng
  id            VARCHAR(12)  PRIMARY KEY,
  user_id       BIGINT       NULL UNIQUE,
  full_name     VARCHAR(120) NOT NULL,
  name_masked   VARCHAR(60)  NOT NULL,
  role_title    VARCHAR(120) NULL,
  organization  VARCHAR(160) NULL,
  years         TINYINT      NULL,
  numerology_view VARCHAR(40) NULL,
  CONSTRAINT fk_cou_user FOREIGN KEY (user_id) REFERENCES app_user(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE counselor_assignment (        -- TVV chỉ xem HS được phân công
  counselor_id VARCHAR(12) NOT NULL,
  student_id   VARCHAR(12) NOT NULL,
  PRIMARY KEY (counselor_id, student_id),
  KEY ix_ca_student (student_id),
  CONSTRAINT fk_ca_cou FOREIGN KEY (counselor_id) REFERENCES counselor(id),
  CONSTRAINT fk_ca_st  FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE run (                         -- mỗi lần tính (gốc hoặc What-if) – lưu đủ tham số để tái lập
  id             BIGINT       PRIMARY KEY AUTO_RANDOM,
  student_id     VARCHAR(12)  NOT NULL,
  requested_by   BIGINT       NULL,
  persona        ENUM('HS','PH','TVV') NOT NULL,
  param_set_id   INT          NOT NULL,
  kb_release_id  INT          NOT NULL,
  normalize_minmax BOOLEAN    NOT NULL,
  is_whatif      BOOLEAN      NOT NULL DEFAULT FALSE,
  scenario_code  VARCHAR(12)  NULL,
  options_json   JSON         NOT NULL,    -- flags G, positional, env_override, y_vowel, delta KN, α/β/γ tùy chỉnh
  weights_used   JSON         NOT NULL,    -- [α, β, γ] thực dùng
  minmax_json    JSON         NULL,        -- {NF:[min,max], SR:[…], ENV:[…]}
  target_major_id INT         NULL,
  engine_version VARCHAR(20)  NOT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_run_student (student_id, created_at),
  CONSTRAINT fk_run_student FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
  CONSTRAINT fk_run_user    FOREIGN KEY (requested_by) REFERENCES app_user(id),
  CONSTRAINT fk_run_pset    FOREIGN KEY (param_set_id) REFERENCES parameter_set(id),
  CONSTRAINT fk_run_kbr     FOREIGN KEY (kb_release_id) REFERENCES kb_release(id),
  CONSTRAINT fk_run_major   FOREIGN KEY (target_major_id) REFERENCES major(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE run_result (                  -- 35 dòng / run
  run_id      BIGINT        NOT NULL,
  profile_id  VARCHAR(4)    NOT NULL,
  rank_no     TINYINT       NULL,          -- NULL khi EC = 0
  ec          TINYINT       NOT NULL,
  nf          DECIMAL(10,8) NOT NULL,
  sr          DECIMAL(10,8) NOT NULL,
  env_fit     TINYINT       NOT NULL,
  nf_n        DECIMAL(10,8) NULL,          -- giá trị min–max (NULL khi EC = 0)
  sr_n        DECIMAL(10,8) NULL,
  env_n       DECIMAL(10,8) NULL,
  c_raw       DECIMAL(10,8) NOT NULL,
  c           DECIMAL(10,8) NOT NULL,
  label       ENUM('Không đề xuất','Thử thách','Ưu tiên','Cân nhắc') NOT NULL,
  weak_count  TINYINT       NOT NULL,
  kn_json     JSON          NOT NULL,      -- [r1, r2, r3]
  match_json  JSON          NOT NULL,      -- {G1:p, G5:p, …}
  sat         TINYINT       NULL,
  str_count   TINYINT       NULL,
  PRIMARY KEY (run_id, profile_id),
  KEY ix_rr_rank (run_id, rank_no),
  CONSTRAINT fk_rr_run  FOREIGN KEY (run_id) REFERENCES run(id) ON DELETE CASCADE,
  CONSTRAINT fk_rr_prof FOREIGN KEY (profile_id) REFERENCES major_profile(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE run_warning (                 -- cảnh báo ngoài phạm vi phát sinh ở lần tính
  run_id        BIGINT       NOT NULL,
  seq           TINYINT      NOT NULL,
  validity_code VARCHAR(16)  NOT NULL,
  level         ENUM('green','yellow','red','grey') NOT NULL,
  message_vi    VARCHAR(300) NOT NULL,
  PRIMARY KEY (run_id, seq),
  CONSTRAINT fk_rw_run  FOREIGN KEY (run_id) REFERENCES run(id) ON DELETE CASCADE,
  CONSTRAINT fk_rw_rule FOREIGN KEY (validity_code) REFERENCES validity_rule(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE explanation_template (        -- mẫu câu "Vì sao?" (Admin sửa được, có biến {NF}, {G1}…)
  code        VARCHAR(24)  PRIMARY KEY,
  layer       ENUM('L0','L1','L2','L3','L4','L5','L6','L7') NOT NULL,
  template_vi TEXT         NOT NULL,
  template_en TEXT         NULL,
  row_version INT          NOT NULL DEFAULT 1
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE explanation (                 -- câu giải thích đã sinh cho 1 hồ sơ trong 1 run
  run_id        BIGINT       NOT NULL,
  profile_id    VARCHAR(4)   NOT NULL,
  template_code VARCHAR(24)  NOT NULL,
  text_vi       TEXT         NOT NULL,
  PRIMARY KEY (run_id, profile_id, template_code),
  CONSTRAINT fk_ex_rr   FOREIGN KEY (run_id, profile_id) REFERENCES run_result(run_id, profile_id) ON DELETE CASCADE,
  CONSTRAINT fk_ex_tmpl FOREIGN KEY (template_code) REFERENCES explanation_template(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- NHÓM 5 · ĐÁNH GIÁ & CỘNG TÁC
-- ---------------------------------------------------------------------

CREATE TABLE test_case (                   -- 18 kịch bản test 4 vai trò (bộ giả lập 120 người)
  code        VARCHAR(12)  PRIMARY KEY,
  role        ENUM('student','parent','counselor','admin') NOT NULL,
  question_code VARCHAR(8) NULL,
  title_vi    VARCHAR(200) NOT NULL,
  steps       TEXT         NULL,
  expected    TEXT         NULL,
  persona_ref VARCHAR(12)  NULL,           -- SIM-HS071…
  CONSTRAINT fk_tc_q FOREIGN KEY (question_code) REFERENCES decision_question(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE usability_session (           -- buổi test người thật (che danh: chỉ mã P01…)
  id            BIGINT       PRIMARY KEY AUTO_RANDOM,
  participant_code VARCHAR(12) NOT NULL,   -- 'U01' – không lưu tên thật
  role          ENUM('student','parent','counselor','admin','teacher') NOT NULL,
  ui_version    VARCHAR(20)  NOT NULL,     -- 'before' / 'after' cải tiến
  device        VARCHAR(40)  NULL,
  consent       BOOLEAN      NOT NULL,
  started_at    DATETIME     NOT NULL,
  ended_at      DATETIME     NULL,
  notes         TEXT         NULL,
  created_by    BIGINT       NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE usability_task (              -- 3 nhiệm vụ / buổi: thời gian, lỗi, thành công
  session_id  BIGINT       NOT NULL,
  task_no     TINYINT      NOT NULL,
  test_case_code VARCHAR(12) NULL,
  time_sec    INT          NULL,
  errors      TINYINT      NULL,
  success     BOOLEAN      NULL,
  observation TEXT         NULL,
  PRIMARY KEY (session_id, task_no),
  CONSTRAINT fk_ut_sess FOREIGN KEY (session_id) REFERENCES usability_session(id) ON DELETE CASCADE,
  CONSTRAINT fk_ut_tc   FOREIGN KEY (test_case_code) REFERENCES test_case(code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sus_answer (                  -- SUS 10 câu, thang 1–5
  session_id  BIGINT   NOT NULL,
  item_no     TINYINT  NOT NULL CHECK (item_no BETWEEN 1 AND 10),
  score       TINYINT  NOT NULL CHECK (score BETWEEN 1 AND 5),
  PRIMARY KEY (session_id, item_no),
  CONSTRAINT fk_sus_sess FOREIGN KEY (session_id) REFERENCES usability_session(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comment (                     -- ghi chú chia sẻ HS ↔ PH ↔ TVV (Ch11)
  id           BIGINT       PRIMARY KEY AUTO_RANDOM,
  author_id    BIGINT       NOT NULL,
  student_id   VARCHAR(12)  NOT NULL,      -- phạm vi chia sẻ = HS đó + PH + TVV phụ trách
  run_id       BIGINT       NULL,
  profile_id   VARCHAR(4)   NULL,
  body         TEXT         NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_cmt_student (student_id, created_at),
  CONSTRAINT fk_cmt_author  FOREIGN KEY (author_id) REFERENCES app_user(id),
  CONSTRAINT fk_cmt_student FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
  CONSTRAINT fk_cmt_run     FOREIGN KEY (run_id) REFERENCES run(id) ON DELETE SET NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (                   -- ghi ở tầng Node trong CÙNG transaction với thay đổi
  id            BIGINT       PRIMARY KEY AUTO_RANDOM,
  at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_id       BIGINT       NULL,
  action        ENUM('INSERT','UPDATE','DELETE','ACTIVATE','LOGIN','LOGIN_FAIL','EXPORT') NOT NULL,
  table_name    VARCHAR(40)  NULL,
  row_key       VARCHAR(80)  NULL,
  before_json   JSON         NULL,
  after_json    JSON         NULL,
  param_set_id  INT          NULL,
  kb_release_id INT          NULL,
  reason        VARCHAR(300) NULL,         -- Admin bắt buộc nhập lý do khi sửa tri thức
  request_id    VARCHAR(40)  NULL,
  KEY ix_audit_table (table_name, row_key),
  KEY ix_audit_at (at)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- VIEW phục vụ từng tầng
-- ---------------------------------------------------------------------

-- L0: run gốc mới nhất của mỗi HS (không What-if)
CREATE VIEW v_latest_run AS
SELECT r.* FROM (
  SELECT run.*, ROW_NUMBER() OVER (PARTITION BY student_id, persona ORDER BY created_at DESC, id DESC) AS rn
  FROM run WHERE is_whatif = FALSE
) r WHERE r.rn = 1;

-- L0/(c): Top-3 + nhãn, chỉ tên viết tắt (che PII)
CREATE VIEW v_l0_top3 AS
SELECT s.id AS student_id, s.name_masked, s.birth_year, lr.persona, lr.id AS run_id,
       rr.rank_no, rr.profile_id, mp.name_vi AS profile_name, rr.label, rr.c, rr.ec, rr.sr, rr.env_fit, rr.weak_count
FROM v_latest_run lr
JOIN student s       ON s.id = lr.student_id
JOIN run_result rr   ON rr.run_id = lr.id AND rr.rank_no <= 3
JOIN major_profile mp ON mp.id = rr.profile_id;

-- L1: thanh đóng góp α·NF*, β·SR*, γ·ENV*
CREATE VIEW v_l1_contribution AS
SELECT rr.run_id, rr.profile_id, rr.rank_no, rr.label,
       JSON_EXTRACT(r.weights_used, '$[0]') * COALESCE(rr.nf_n, rr.nf)     AS contrib_nf,
       JSON_EXTRACT(r.weights_used, '$[1]') * COALESCE(rr.sr_n, rr.sr)     AS contrib_sr,
       JSON_EXTRACT(r.weights_used, '$[2]') * COALESCE(rr.env_n, rr.env_fit) AS contrib_env,
       rr.c
FROM run_result rr JOIN run r ON r.id = rr.run_id;

-- L3: chuỗi ánh xạ archetype → hồ sơ → ngành
CREATE VIEW v_l3_mapping AS
SELECT a.number AS archetype_no, a.code AS archetype_code, sk.code AS skill_code, sk.name_vi AS skill_name,
       ps.profile_id, ps.position, mp.env_code, m.id AS major_id, m.name_vi AS major_name, a.status AS archetype_status
FROM archetype a
JOIN skill sk          ON sk.archetype_no = a.number
JOIN profile_signal ps ON ps.archetype_no = a.number
JOIN major_profile mp  ON mp.id = ps.profile_id
JOIN major m           ON m.profile_id = mp.id;

-- L6: tri thức kèm trích dẫn
CREATE VIEW v_l6_rule_citation AS
SELECT c.target_type, c.target_key, sb.code AS source_code, sb.author, sb.title, c.locator, c.note
FROM citation c JOIN source_book sb ON sb.code = c.source_code;

-- Tổng hợp (Admin/TVV): chỉ dữ liệu đã che
CREATE VIEW v_student_masked AS
SELECT id, dataset, name_masked, birth_year, gender, grade, preferred_env, target_major_id, is_simulated
FROM student;

-- Đánh giá: điểm SUS chuẩn (0–100)
CREATE VIEW v_sus_score AS
SELECT session_id,
       2.5 * SUM(CASE WHEN item_no % 2 = 1 THEN score - 1 ELSE 5 - score END) AS sus,
       COUNT(*) AS n_items
FROM sus_answer GROUP BY session_id;

-- KPI độ ổn định: số cấu hình (/5) giữ Top-1 như cấu hình gốc
CREATE VIEW v_stability AS
SELECT sr.param_set_id, sr.student_id,
       SUM(CASE WHEN sr.top1_profile = b.top1_profile THEN 1 ELSE 0 END) AS stable_of_5
FROM sensitivity_result sr
JOIN sensitivity_result b
  ON b.param_set_id = sr.param_set_id AND b.student_id = sr.student_id AND b.config_code = 'BASE_HS'
GROUP BY sr.param_set_id, sr.student_id;
