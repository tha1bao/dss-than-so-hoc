// Pha 4 – ghi bản tiếng Anh (db/etl/i18n_en.json) vào explanation_template.template_en và validity_rule.message_en
// trên DB đang chạy, không cần ETL --reset. Mỗi dòng đổi ghi audit_log (tầng ứng dụng – TiDB không có trigger).
// Chạy: node db/etl/apply_en.js
import fs from 'node:fs';
import { pool, tx } from '../../server/db.js';
import { audit } from '../../server/audit.js';

const EN = JSON.parse(fs.readFileSync(new URL('./i18n_en.json', import.meta.url), 'utf8'));
let n = 0;
await tx(async (conn) => {
  for (const [table, key, col, map] of [['explanation_template', 'code', 'template_en', EN.templates], ['validity_rule', 'code', 'message_en', EN.rules]]) {
    for (const [code, text] of Object.entries(map)) {
      const [[row]] = await conn.execute(`SELECT ${col} AS v FROM ${table} WHERE ${key} = ?`, [code]);
      if (!row) { console.log(`bỏ qua ${table}.${code} (không có)`); continue; }
      if (row.v === text) continue;
      await conn.execute(`UPDATE ${table} SET ${col} = ? WHERE ${key} = ?`, [text, code]);
      await audit({ conn, action: 'UPDATE', table, rowKey: code, before: { [col]: row.v }, after: { [col]: text }, reason: 'Pha 4 – bản tiếng Anh (i18n_en.json)' });
      n++;
    }
  }
});
console.log(`Đã cập nhật ${n} dòng tiếng Anh.`);
await pool.end();
