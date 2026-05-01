import express from 'express';
import cors from 'cors';
import { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import quizRoutes from './routes/quiz.js';
import withdrawRoutes from './routes/withdraw.js';
import adminRoutes from './routes/admin.js';
import leaderboardRoutes from './routes/leaderboard.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.BACKEND_PORT || 3001;

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuizRupee backend running on port ${PORT}`);
  });
}).catch(e => {
  console.error('DB init failed:', e);
  process.exit(1);
});
