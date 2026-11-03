import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // API_TARGET=https://dss-than-so-hoc.vercel.app → xem giao diện (chế độ khách) khi máy không tới được TiDB
  server: { proxy: { '/api': { target: process.env.API_TARGET ?? 'http://localhost:3001', changeOrigin: true } } },
  test: {
    include: ['scripts/**/*.test.js', 'tests/**/*.test.js'],
    testTimeout: 60000,
    fileParallelism: false, // 2 file hồi quy nạp fixture lớn – chạy song song dễ hết bộ nhớ
    exclude: ['tests/api.test.js', '**/node_modules/**'], // test API cần DB thật → npm run test:api
  },
});
