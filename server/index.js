// Chạy API local: npm run server  (mặc định cổng 3001; Vite dev proxy /api → đây)
import { app } from './app.js';

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API DSS Thần số học: http://localhost:${port}/api/health`));
