import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const MIN_POINTS = 1000;

router.post('/request', authMiddleware, async (req, res) => {
  const { upi_id } = req.body;
  const userId = req.user.id;
  if (!upi_id?.trim()) return res.status(400).json({ error: 'UPI ID is required' });

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    if (user.points < MIN_POINTS) {
      return res.status(400).json({ error: `You need at least ${MIN_POINTS} points (₹100) to withdraw` });
    }

    const pending = await pool.query(
      "SELECT id FROM withdrawal_requests WHERE user_id = $1 AND status = 'pending'",
      [userId]
    );
    if (pending.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a pending withdrawal request' });
    }

    const pointsToWithdraw = Math.floor(user.points / MIN_POINTS) * MIN_POINTS;
    const amount = +(pointsToWithdraw / 10).toFixed(2);

    await pool.query('BEGIN');

    await pool.query(
      'INSERT INTO withdrawal_requests (user_id, upi_id, amount, points_used) VALUES ($1, $2, $3, $4)',
      [userId, upi_id.trim(), amount, pointsToWithdraw]
    );

    await pool.query('UPDATE users SET points = points - $1 WHERE id = $2', [pointsToWithdraw, userId]);

    await pool.query('COMMIT');

    res.json({ success: true, amount, pointsToWithdraw, upi_id: upi_id.trim() });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM withdrawal_requests WHERE user_id = $1 ORDER BY requested_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json({ requests: result.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
