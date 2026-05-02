import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/report', authMiddleware, async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Please describe the issue' });
  if (message.length > 2000) return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
  try {
    const recent = await pool.query(
      `SELECT COUNT(*)::int AS n FROM reports
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [req.user.id]
    );
    if (recent.rows[0].n >= 5) {
      return res.status(429).json({ error: 'Too many reports. Please try again later.' });
    }
    await pool.query(
      `INSERT INTO reports (user_id, message) VALUES ($1, $2)`,
      [req.user.id, message]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my-reports', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, message, status, admin_note, created_at, resolved_at
       FROM reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ reports: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
