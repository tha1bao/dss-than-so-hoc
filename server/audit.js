// audit_log ghi ở tầng ứng dụng (TiDB không có trigger). Truyền `conn` để ghi CÙNG transaction với thay đổi.
import { pool } from './db.js';

export async function audit({ conn = null, userId = null, action, table = null, rowKey = null, before = null, after = null,
  paramSetId = null, kbReleaseId = null, reason = null, requestId = null }) {
  const sql = `INSERT INTO audit_log (user_id, action, table_name, row_key, before_json, after_json, param_set_id, kb_release_id, reason, request_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const args = [userId, action, table, rowKey, before && JSON.stringify(before), after && JSON.stringify(after), paramSetId, kbReleaseId, reason, requestId];
  await (conn ?? pool).execute(sql, args);
}
