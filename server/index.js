import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import quizRoutes from './routes/quiz.js';
import withdrawRoutes from './routes/withdraw.js';
import adminRoutes from './routes/admin.js';
import leaderboardRoutes from './routes/leaderboard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.get('/api/health', (_, res) => res.json({ ok: true }));

// In production, serve built React files
const distPath = join(__dirname, '..', 'dist');
if (isProd && existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const PORT = isProd ? (process.env.PORT || 5000) : (process.env.BACKEND_PORT || 3001);

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuizRupee backend running on port ${PORT} [${isProd ? 'production' : 'development'}]`);
  });
}).catch(e => {
  console.error('DB init failed:', e);
  process.exit(1);
});
