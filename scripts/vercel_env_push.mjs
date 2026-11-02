// Đẩy biến môi trường từ ../.env lên Vercel (production) qua Vercel CLI – giá trị đi qua stdin, KHÔNG in ra.
// Cần: npx vercel login  và  npx vercel link (project dss-than-so-hoc). Chạy: node scripts/vercel_env_push.mjs
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

const env = dotenv.parse(fs.readFileSync(new URL('../../.env', import.meta.url)));
const KEYS = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
for (const k of KEYS) {
  if (!env[k]) { console.error(`Thiếu ${k} trong .env`); process.exit(1); }
  for (const target of ['production']) {
    spawnSync('npx', ['-y', 'vercel@latest', 'env', 'rm', k, target, '--yes'], { stdio: 'ignore', shell: true });
    const r = spawnSync('npx', ['-y', 'vercel@latest', 'env', 'add', k, target], { input: env[k], stdio: ['pipe', 'ignore', 'pipe'], shell: true });
    console.log(`${k} → ${target}: ${r.status === 0 ? 'OK' : `LỖI ${String(r.stderr).split('\n').filter(Boolean).pop()}`}`);
  }
}
