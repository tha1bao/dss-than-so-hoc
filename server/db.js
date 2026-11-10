// Kết nối TiDB Cloud / MySQL 8 – pool, prepared statements, TLS bắt buộc (trừ khi DB_SSL=false cho MySQL local).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const p of [path.join(WEB, '.env'), path.join(WEB, '..', '.env')]) if (fs.existsSync(p)) { dotenv.config({ path: p, quiet: true }); break; }

for (const k of ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET']) if (!process.env[k]) throw new Error(`Thiếu biến môi trường ${k}`);

export const pool = mysql.createPool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 4000), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  connectionLimit: Number(process.env.DB_POOL || 10), waitForConnections: true, enableKeepAlive: true,
  supportBigNumbers: true, bigNumberStrings: false, // số > 2^53 (id AUTO_RANDOM) → chuỗi; COUNT… vẫn là số
  decimalNumbers: true, dateStrings: true, timezone: 'Z', charset: 'utf8mb4',
  ssl: process.env.DB_SSL === 'false' ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: true },
});

export const q = async (sql, params = []) => (await pool.execute(sql, params))[0];
export const q1 = async (sql, params = []) => (await q(sql, params))[0] ?? null;

/** Chạy fn(conn) trong một transaction. */
export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}
