import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function hashQuestion(category, text) {
  const norm = `${category}:${text.toLowerCase().trim().replace(/\s+/g, ' ')}`;
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 32);
}

function shuffleOptions(opts) {
  const arr = opts.map(o => ({ text: o.text, isCorrect: !!o.isCorrect }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CAT_DESC = {
  sports:        "sports, Olympics, cricket, football, tennis, basketball, famous athletes",
  entertainment: "cartoons, Disney, Pixar, kids movies, TV shows, superheroes, popular children's characters",
  science:       "basic science, human body, animals, plants, simple physics and chemistry concepts",
  space:         "planets, solar system, astronauts, stars, rockets, space exploration, galaxies",
  politics:      "Indian government, world capitals, country flags, leaders, democracy basics, Indian history",
  history:       "world history, famous inventors, ancient civilizations, historical events and discoveries",
  maths:         "arithmetic, geometry, multiplication tables, fractions, simple algebra, number facts",
  geography:     "world geography, capital cities, oceans, mountains, rivers, continents, countries",
  animals:       "animal facts, habitats, food chains, pets, wildlife, endangered species, animal behaviors",
};

async function callGemini(category, apiKey) {
  const desc = CAT_DESC[category] || category;
  const seed = Math.floor(Math.random() * 999999);
  const prompt = `Generate exactly 10 unique multiple-choice quiz questions about: ${desc}.
STRICT RULES:
- Questions MUST be for children under 10 years old — very simple and basic
- Each question must have exactly 4 answer choices
- The CORRECT answer must ALWAYS be the FIRST item in the options array (index 0)
- Questions must be fun, clear, and different from each other
- Use variation seed ${seed} to make this set unique every time
Return ONLY a raw JSON array. No markdown. No explanation. No backticks. Just the JSON:
[{"q":"Question here?","options":["Correct answer","Wrong 1","Wrong 2","Wrong 3"]},...]
Exactly 10 items. Nothing else.`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 1.0, maxOutputTokens: 2048 } }),
    }
  );
  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    throw new Error(`Gemini API error: ${err}`);
  }
  const data = await geminiRes.json();
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```json|```/gi, '').trim();
  const raw = JSON.parse(text);
  return raw.slice(0, 10).map(q => {
    const questionText = q.q || q.question;
    const opts = (q.options || q.answers || []).map((t, i) => ({
      text: typeof t === 'string' ? t : t.text || t,
      isCorrect: i === 0,
    }));
    return { question: questionText, options: opts };
  }).filter(q => q.question && q.options.length === 4);
}

router.post('/generate', authMiddleware, async (req, res) => {
  const { category } = req.body;
  const userId = req.user.id;
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured on server.' });
  if (!category) return res.status(400).json({ error: 'Category required' });

  try {
    // 1. CACHE FIRST: atomically pick 10 unseen and claim (mark seen) in one statement.
    //    The CTE prevents the race where two concurrent calls pick the same rows.
    const claimRes = await pool.query(`
      WITH picked AS (
        SELECT cq.id, cq.question, cq.options
        FROM cached_questions cq
        WHERE cq.category = $1
          AND NOT EXISTS (
            SELECT 1 FROM user_seen_questions usq
            WHERE usq.user_id = $2 AND usq.question_id = cq.id
          )
        ORDER BY RANDOM()
        LIMIT 10
      ),
      claimed AS (
        INSERT INTO user_seen_questions (user_id, question_id)
        SELECT $2, id FROM picked
        ON CONFLICT DO NOTHING
        RETURNING question_id
      )
      SELECT p.id, p.question, p.options
      FROM picked p JOIN claimed c ON c.question_id = p.id
    `, [category, userId]);

    if (claimRes.rows.length >= 10) {
      const questions = claimRes.rows.map(r => ({
        question: r.question,
        options: shuffleOptions(r.options),
      }));
      return res.json({ questions, source: 'cache' });
    }

    // 2. CACHE MISS or partial: generate fresh from Gemini
    const generated = await callGemini(category, apiKey);

    // 3. UPSERT each generated question (category-aware hash) and collect canonical rows.
    //    Dedupe by id within this batch in case Gemini repeated itself.
    const seenIdsInBatch = new Set();
    const upserted = []; // {id, question, options} from DB (canonical)
    for (const q of generated) {
      const hash = hashQuestion(category, q.question);
      const insertRes = await pool.query(`
        INSERT INTO cached_questions (category, question, options, question_hash)
        VALUES ($1, $2, $3::jsonb, $4)
        ON CONFLICT (question_hash) DO UPDATE SET question_hash = EXCLUDED.question_hash
        RETURNING id, question, options
      `, [category, q.question, JSON.stringify(q.options), hash]);
      const row = insertRes.rows[0];
      if (seenIdsInBatch.has(row.id)) continue;
      seenIdsInBatch.add(row.id);
      upserted.push(row);
    }

    // 4. Filter out questions this user has already seen (no-repeat guarantee).
    let unseenFromGemini = upserted;
    if (upserted.length > 0) {
      const ids = upserted.map(r => r.id);
      const seenRes = await pool.query(
        `SELECT question_id FROM user_seen_questions WHERE user_id = $1 AND question_id = ANY($2::int[])`,
        [userId, ids]
      );
      const seenSet = new Set(seenRes.rows.map(r => r.question_id));
      unseenFromGemini = upserted.filter(r => !seenSet.has(r.id));
    }

    // 5. Combine: leftover unseen from cache step (already claimed by us) + newly unseen from Gemini.
    //    Both sets are guaranteed unseen-by-this-user. Dedupe by id when merging.
    const merged = [];
    const mergedIds = new Set();
    for (const r of claimRes.rows) {
      if (mergedIds.has(r.id)) continue;
      mergedIds.add(r.id);
      merged.push(r);
    }
    for (const r of unseenFromGemini) {
      if (merged.length >= 10) break;
      if (mergedIds.has(r.id)) continue;
      mergedIds.add(r.id);
      merged.push(r);
    }
    const finalRows = merged.slice(0, 10);

    // 6. Claim (mark seen) any rows from Gemini path that weren't already claimed in step 1.
    const newlyClaimedIds = finalRows
      .map(r => r.id)
      .filter(id => !claimRes.rows.some(c => c.id === id));
    if (newlyClaimedIds.length) {
      await pool.query(
        `INSERT INTO user_seen_questions (user_id, question_id)
         SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
        [userId, newlyClaimedIds]
      );
    }

    if (finalRows.length === 0) {
      return res.status(503).json({ error: 'No fresh questions available right now. Please try a different category or try again shortly.' });
    }

    const questions = finalRows.map(r => ({
      question: r.question,
      options: shuffleOptions(r.options),
    }));
    res.json({ questions, source: 'gemini', count: questions.length });
  } catch (e) {
    console.error('Generate error:', e);
    res.status(500).json({ error: e.message || 'Failed to generate questions' });
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
