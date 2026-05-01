import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const overall = await pool.query(`
      SELECT u.id, u.name, u.points, u.total_earned,
        COUNT(qs.id)::int as total_played,
        COALESCE(SUM(qs.score), 0)::int as total_correct
      FROM users u
      LEFT JOIN quiz_sessions qs ON qs.user_id = u.id
      WHERE u.is_admin = false
      GROUP BY u.id
      ORDER BY total_correct DESC
      LIMIT 20
    `);

    const earners = await pool.query(`
      SELECT u.id, u.name, u.total_earned, u.points,
        COUNT(qs.id)::int as total_played,
        COALESCE(SUM(qs.score), 0)::int as total_correct
      FROM users u
      LEFT JOIN quiz_sessions qs ON qs.user_id = u.id
      WHERE u.is_admin = false
      GROUP BY u.id
      ORDER BY u.total_earned DESC
      LIMIT 20
    `);

    res.json({ overall: overall.rows, earners: earners.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/category/:catId', async (req, res) => {
  const allowed = ['sports','entertainment','science','space','politics','history','maths','geography','animals'];
  const catId = req.params.catId;
  if (!allowed.includes(catId)) return res.status(400).json({ error: 'Invalid category' });
  try {
    const result = await pool.query(`
      SELECT u.name, cs.total_correct, cs.played, cs.best_score, cs.points_earned
      FROM category_stats cs
      JOIN users u ON u.id = cs.user_id
      WHERE cs.category = $1 AND u.is_admin = false
      ORDER BY cs.total_correct DESC
      LIMIT 10
    `, [catId]);
    res.json({ stats: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
