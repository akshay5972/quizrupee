import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const userListSelect = `
  SELECT u.id, u.name,
         p.gender, p.country, p.avatar_seed,
         (SELECT COUNT(*)::int FROM follows WHERE followee_id = u.id) AS follower_count,
         (SELECT COUNT(*)::int FROM follows WHERE follower_id = u.id) AS following_count,
         EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = u.id) AS i_follow,
         EXISTS(SELECT 1 FROM follows WHERE follower_id = u.id AND followee_id = $1) AS follows_me
  FROM users u LEFT JOIN profiles p ON p.user_id = u.id
`;

router.use(authMiddleware);

router.post('/:userId', async (req, res) => {
  const targetId = parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid user id' });
  if (targetId === req.user.id) return res.status(400).json({ error: "You can't follow yourself" });
  try {
    const exists = await pool.query('SELECT 1 FROM users WHERE id = $1', [targetId]);
    if (!exists.rows[0]) return res.status(404).json({ error: 'User not found' });
    await pool.query(
      `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, targetId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:userId', async (req, res) => {
  const targetId = parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid user id' });
  try {
    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2',
      [req.user.id, targetId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me/following', async (req, res) => {
  try {
    const r = await pool.query(
      `${userListSelect}
       WHERE u.id IN (SELECT followee_id FROM follows WHERE follower_id = $1)
         AND u.id <> $1
       ORDER BY u.name ASC LIMIT 200`,
      [req.user.id]
    );
    res.json({ users: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me/followers', async (req, res) => {
  try {
    const r = await pool.query(
      `${userListSelect}
       WHERE u.id IN (SELECT follower_id FROM follows WHERE followee_id = $1)
         AND u.id <> $1
       ORDER BY u.name ASC LIMIT 200`,
      [req.user.id]
    );
    res.json({ users: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me/friends', async (req, res) => {
  try {
    const r = await pool.query(
      `${userListSelect}
       WHERE u.id IN (
         SELECT f1.followee_id FROM follows f1
         JOIN follows f2 ON f2.follower_id = f1.followee_id AND f2.followee_id = f1.follower_id
         WHERE f1.follower_id = $1
       )
       ORDER BY u.name ASC LIMIT 200`,
      [req.user.id]
    );
    res.json({ users: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me/counts', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM follows WHERE follower_id = $1) AS following,
         (SELECT COUNT(*)::int FROM follows WHERE followee_id = $1) AS followers,
         (SELECT COUNT(*)::int FROM follows f1
          JOIN follows f2 ON f2.follower_id = f1.followee_id AND f2.followee_id = f1.follower_id
          WHERE f1.follower_id = $1) AS friends`,
      [req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ users: [] });
  const like = `%${q.replace(/[%_]/g, '\\$&')}%`;
  try {
    const r = await pool.query(
      `${userListSelect}
       WHERE u.id <> $1 AND (u.name ILIKE $2 OR u.email ILIKE $2)
       ORDER BY (u.name ILIKE $3) DESC, u.name ASC LIMIT 30`,
      [req.user.id, like, `${q}%`]
    );
    res.json({ users: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
