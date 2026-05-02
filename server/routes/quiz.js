import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function shuffleOptions(opts) {
  const arr = opts.map(o => ({ text: o.text, isCorrect: !!o.isCorrect }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Hash a category string into a stable 32-bit signed int for pg_advisory_xact_lock.
function categoryLockKey(category) {
  let h = 0;
  for (let i = 0; i < category.length; i++) h = ((h << 5) - h + category.charCodeAt(i)) | 0;
  return h;
}

// Inside a transaction, atomically pick up to N unseen cached questions and mark them seen.
async function claimUnseen(client, category, userId, limit, excludeIds = []) {
  const r = await client.query(`
    WITH picked AS (
      SELECT cq.id, cq.question, cq.options
      FROM cached_questions cq
      WHERE cq.category = $1
        AND NOT (cq.id = ANY($4::int[]))
        AND NOT EXISTS (
          SELECT 1 FROM user_seen_questions usq
          WHERE usq.user_id = $2 AND usq.question_id = cq.id
        )
      ORDER BY RANDOM()
      LIMIT $3
    ),
    claimed AS (
      INSERT INTO user_seen_questions (user_id, question_id)
      SELECT $2, id FROM picked
      ON CONFLICT DO NOTHING
      RETURNING question_id
    )
    SELECT p.id, p.question, p.options
    FROM picked p JOIN claimed c ON c.question_id = p.id
  `, [category, userId, limit, excludeIds]);
  return r.rows;
}

router.post('/generate', authMiddleware, async (req, res) => {
  const { category } = req.body;
  const userId = req.user.id;
  if (!category) return res.status(400).json({ error: 'Category required' });

  const client = await pool.connect();
  try {
    // Cheap pre-check outside the transaction
    const totalRes = await client.query(
      'SELECT COUNT(*)::int AS n FROM cached_questions WHERE category = $1',
      [category]
    );
    const totalAvailable = totalRes.rows[0].n;

    if (totalAvailable === 0) {
      return res.status(503).json({ error: `No questions available for "${category}" yet. The admin will add more soon.` });
    }
    if (totalAvailable < 10) {
      return res.status(503).json({ error: `Not enough questions for "${category}" yet (only ${totalAvailable} loaded; need 10). Please try another category.` });
    }

    await client.query('BEGIN');

    // Serialize concurrent /generate calls for the same (user, category) to prevent
    // duplicate questions across overlapping requests. Auto-released at COMMIT/ROLLBACK.
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [userId, categoryLockKey(category)]);

    // 1. Try to claim 10 unseen for this user.
    let rows = await claimUnseen(client, category, userId, 10);

    // 2. CYCLE: if not enough unseen, reset only the seen-records that are NOT among the
    //    just-claimed ones, then top up to 10 while excluding the just-claimed IDs so the
    //    user never gets a duplicate inside a single round.
    if (rows.length < 10) {
      const claimedIds = rows.map(r => r.id);
      await client.query(`
        DELETE FROM user_seen_questions
        WHERE user_id = $1
          AND question_id IN (SELECT id FROM cached_questions WHERE category = $2)
          AND NOT (question_id = ANY($3::int[]))
      `, [userId, category, claimedIds]);
      const more = await claimUnseen(client, category, userId, 10 - rows.length, claimedIds);
      rows = rows.concat(more);
    }

    if (rows.length < 10) {
      await client.query('ROLLBACK');
      return res.status(503).json({ error: 'Could not load 10 fresh questions. Please try again.' });
    }

    await client.query('COMMIT');

    const questions = rows.map(r => ({
      question: r.question,
      options: shuffleOptions(r.options),
    }));
    res.json({ questions, total_in_category: totalAvailable });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Generate error:', e);
    res.status(500).json({ error: e.message || 'Failed to load questions' });
  } finally {
    client.release();
  }
});

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

router.post('/watch-ad', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const BONUS = 15;
  const rupeesBonus = +(BONUS / 10).toFixed(2);
  try {
    await pool.query(
      'UPDATE users SET points = points + $1, total_earned = total_earned + $2 WHERE id = $3',
      [BONUS, rupeesBonus, userId]
    );
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const u = result.rows[0];
    res.json({
      success: true, bonus: BONUS,
      user: {
        id: u.id, name: u.name, email: u.email,
        points: u.points, total_earned: u.total_earned,
        total_withdrawn: u.total_withdrawn, is_admin: u.is_admin,
        referral_code: u.referral_code, referral_count: u.referral_count || 0,
        streak: u.streak || 0, longest_streak: u.longest_streak || 0,
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
