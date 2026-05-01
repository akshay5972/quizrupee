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

    await pool.query(
      'INSERT INTO quiz_sessions (user_id, category, score, points_earned) VALUES ($1, $2, $3, $4)',
      [userId, category, score, pointsEarned]
    );

    await pool.query(
      'UPDATE users SET points = points + $1, total_earned = total_earned + $2 WHERE id = $3',
      [pointsEarned, rupeesEarned, userId]
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

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    res.json({
      success: true,
      pointsEarned,
      rupeesEarned,
      user: {
        id: user.id, name: user.name, email: user.email,
        points: user.points, total_earned: user.total_earned,
        total_withdrawn: user.total_withdrawn, is_admin: user.is_admin,
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
