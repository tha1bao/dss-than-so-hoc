import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001' } },
  test: {
    include: ['scripts/**/*.test.js', 'tests/**/*.test.js'],
    testTimeout: 60000,
    fileParallelism: false, // 2 file hồi quy nạp fixture lớn – chạy song song dễ hết bộ nhớ
    exclude: ['tests/api.test.js', '**/node_modules/**'], // test API cần DB thật → npm run test:api
  },
});
