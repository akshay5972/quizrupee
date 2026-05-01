import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware, adminMiddleware);

router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_admin = false) as total_users,
        (SELECT COUNT(*) FROM quiz_sessions) as total_quizzes,
        (SELECT COALESCE(SUM(points_earned), 0) FROM quiz_sessions) as total_points_given,
        (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending') as pending_withdrawals,
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'approved') as total_paid_out
    `);
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/withdrawals', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT wr.*, u.name, u.email
      FROM withdrawal_requests wr
      JOIN users u ON u.id = wr.user_id
      ORDER BY
        CASE WHEN wr.status = 'pending' THEN 0 ELSE 1 END,
        wr.requested_at DESC
    `);
    res.json({ requests: result.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/withdrawals/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, admin_note } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }
  try {
    const wrResult = await pool.query('SELECT * FROM withdrawal_requests WHERE id = $1', [id]);
    const wr = wrResult.rows[0];
    if (!wr) return res.status(404).json({ error: 'Request not found' });
    if (wr.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    await pool.query('BEGIN');

    await pool.query(
      'UPDATE withdrawal_requests SET status = $1, admin_note = $2, processed_at = NOW() WHERE id = $3',
      [status, admin_note || null, id]
    );

    if (status === 'rejected') {
      await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [wr.points_used, wr.user_id]);
    } else {
      await pool.query('UPDATE users SET total_withdrawn = total_withdrawn + $1 WHERE id = $2', [wr.amount, wr.user_id]);
    }

    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, points, total_earned, total_withdrawn, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ users: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
