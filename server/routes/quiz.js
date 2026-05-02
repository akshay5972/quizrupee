import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/complete', authMiddleware, async (req, res) => {
  const { category, score } = req.body;
  if (typeof score !== 'number' || score < 0 || score > 10) {
    return res.status(400).json({ error: 'Invalid score' });
  }
  const userId = req.user.id;
  const pointsEarned = score;
  const rupeesEarned = +(score / 10).toFixed(2);

  try {
    await pool.query('BEGIN');

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    const todayUTC = new Date().toISOString().split('T')[0];
    const lastPlayed = user.last_played_date
      ? new Date(user.last_played_date).toISOString().split('T')[0]
      : null;

    let newStreak = user.streak || 0;
    let streakBonus = 0;

    if (lastPlayed === todayUTC) {
      // already played today — no streak change, no bonus
    } else {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastPlayed === yesterdayStr) {
        newStreak = newStreak + 1;
      } else {
        newStreak = 1;
      }

      streakBonus = Math.min(newStreak, 7) * 2;
    }

    const newLongest = Math.max(user.longest_streak || 0, newStreak);
    const totalPoints = pointsEarned + streakBonus;
    const totalRupees = +(totalPoints / 10).toFixed(2);

    await pool.query(
      'INSERT INTO quiz_sessions (user_id, category, score, points_earned) VALUES ($1, $2, $3, $4)',
      [userId, category, score, pointsEarned]
    );

    await pool.query(
      `UPDATE users SET
        points = points + $1,
        total_earned = total_earned + $2,
        streak = $3,
        longest_streak = $4,
        last_played_date = $5
       WHERE id = $6`,
      [totalPoints, totalRupees, newStreak, newLongest, todayUTC, userId]
    );

    await pool.query(`
      INSERT INTO category_stats (user_id, category, played, total_correct, best_score, points_earned)
      VALUES ($1, $2, 1, $3, $3, $4)
      ON CONFLICT (user_id, category) DO UPDATE SET
        played = category_stats.played + 1,
        total_correct = category_stats.total_correct + $3,
        best_score = GREATEST(category_stats.best_score, $3),
        points_earned = category_stats.points_earned + $4
    `, [userId, category, score, pointsEarned]);

    await pool.query('COMMIT');

    const updatedRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const updated = updatedRes.rows[0];

    res.json({
      success: true,
      pointsEarned,
      rupeesEarned,
      streak_bonus: streakBonus,
      new_streak: newStreak,
      user: {
        id: updated.id, name: updated.name, email: updated.email,
        points: updated.points, total_earned: updated.total_earned,
        total_withdrawn: updated.total_withdrawn, is_admin: updated.is_admin,
        referral_code: updated.referral_code, referral_count: updated.referral_count || 0,
        streak: updated.streak || 0, longest_streak: updated.longest_streak || 0,
      },
    });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/category-stats', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cs.*,
        (
          SELECT json_agg(h ORDER BY h.played_at DESC)
          FROM (
            SELECT score, points_earned, TO_CHAR(played_at, 'DD/MM/YYYY') as date, played_at
            FROM quiz_sessions
            WHERE user_id = cs.user_id AND category = cs.category
            ORDER BY played_at DESC LIMIT 3
          ) h
        ) as history
      FROM category_stats cs
      WHERE cs.user_id = $1
    `, [req.user.id]);
    res.json({ stats: result.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
