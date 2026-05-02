import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { filterProfanity } from '../profanity.js';

const router = Router();
router.use(authMiddleware);

const MAX_MSGS = 50;   // sliding window per conversation
const MAX_BODY = 500;  // character limit per message

/* Check mutual follow between two users */
async function isMutual(a, b) {
  const r = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND followee_id=$2) AS ab,
            EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND followee_id=$1) AS ba`,
    [a, b]
  );
  return r.rows[0].ab && r.rows[0].ba;
}

/* GET /api/messages/unread — unread counts grouped by sender */
router.get('/unread', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT sender_id, COUNT(*)::int AS count
       FROM messages
       WHERE receiver_id = $1 AND is_read = FALSE
       GROUP BY sender_id`,
      [req.user.id]
    );
    const counts = {};
    r.rows.forEach(row => { counts[row.sender_id] = row.count; });
    res.json({ counts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* GET /api/messages/:userId — fetch conversation (last 50, oldest first) */
router.get('/:userId', async (req, res) => {
  const other = parseInt(req.params.userId, 10);
  if (!Number.isFinite(other)) return res.status(400).json({ error: 'Invalid user id' });
  if (other === req.user.id) return res.status(400).json({ error: 'Cannot chat with yourself' });
  try {
    if (!(await isMutual(req.user.id, other)))
      return res.status(403).json({ error: 'You must be friends (mutual follows) to chat' });

    const r = await pool.query(
      `SELECT id, sender_id, receiver_id, body, is_read, created_at
       FROM messages
       WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)
       ORDER BY created_at ASC
       LIMIT $3`,
      [req.user.id, other, MAX_MSGS]
    );

    // mark incoming as read
    await pool.query(
      `UPDATE messages SET is_read=TRUE
       WHERE receiver_id=$1 AND sender_id=$2 AND is_read=FALSE`,
      [req.user.id, other]
    );

    res.json({ messages: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* POST /api/messages/:userId — send a message */
router.post('/:userId', async (req, res) => {
  const other = parseInt(req.params.userId, 10);
  if (!Number.isFinite(other)) return res.status(400).json({ error: 'Invalid user id' });
  if (other === req.user.id) return res.status(400).json({ error: 'Cannot message yourself' });

  let body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Message cannot be empty' });
  if (body.length > MAX_BODY)
    return res.status(400).json({ error: `Message too long (max ${MAX_BODY} chars)` });

  body = filterProfanity(body);

  try {
    if (!(await isMutual(req.user.id, other)))
      return res.status(403).json({ error: 'You must be friends (mutual follows) to chat' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ins = await client.query(
        `INSERT INTO messages (sender_id, receiver_id, body)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.user.id, other, body]
      );

      // sliding window — delete oldest if over cap
      await client.query(
        `DELETE FROM messages WHERE id IN (
           SELECT id FROM messages
           WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)
           ORDER BY created_at ASC
           OFFSET $3
         )`,
        [req.user.id, other, MAX_MSGS]
      );

      await client.query('COMMIT');
      res.json({ message: ins.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
