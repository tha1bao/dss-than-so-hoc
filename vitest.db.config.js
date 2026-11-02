// Test API trên DB thật (TiDB) – chạy riêng: npm run test:api. Không nằm trong `npm run verify`.
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/api.test.js'], testTimeout: 120000, hookTimeout: 120000, fileParallelism: false } });
