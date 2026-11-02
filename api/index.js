// Vercel Serverless Function: mọi /api/* được rewrite về đây (vercel.json). Biến môi trường đặt trong Vercel Project Settings.
import { app } from '../server/app.js';

export default app;
