import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const VALID_GENDERS = ['male', 'female', 'other'];
const makeAvatarSeed = () => Math.random().toString(36).slice(2, 12);

const publicProfile = (row) => ({
  id: row.id,
  name: row.name,
  gender: row.gender || null,
  country: row.country || null,
  avatar_seed: row.avatar_seed || null,
  created_at: row.created_at,
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT u.id, u.name, u.email, u.created_at, p.gender, p.country, p.avatar_seed
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ profile: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/me', authMiddleware, async (req, res) => {
  const { gender, country, regenerate_avatar } = req.body;
  const g = gender ? String(gender).toLowerCase().trim() : null;
  const c = country ? String(country).trim() : null;
  if (g && !VALID_GENDERS.includes(g)) return res.status(400).json({ error: 'Invalid gender' });
  if (c && c.length > 80) return res.status(400).json({ error: 'Country name too long' });

  try {
    const existing = await pool.query('SELECT * FROM profiles WHERE user_id = $1', [req.user.id]);
    if (!existing.rows[0] && (!g || !c)) {
      return res.status(400).json({ error: 'Gender and country are required to create profile' });
    }
    const cur = existing.rows[0] || {};
    const finalGender = g || cur.gender;
    const finalCountry = c || cur.country;
    const finalSeed = regenerate_avatar ? makeAvatarSeed() : (cur.avatar_seed || makeAvatarSeed());
    await pool.query(
      `INSERT INTO profiles (user_id, gender, country, avatar_seed)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET gender = EXCLUDED.gender, country = EXCLUDED.country,
           avatar_seed = EXCLUDED.avatar_seed, updated_at = NOW()`,
      [req.user.id, finalGender, finalCountry, finalSeed]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:userId', authMiddleware, async (req, res) => {
  const uid = parseInt(req.params.userId, 10);
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'Invalid user id' });
  try {
    const r = await pool.query(
      `SELECT u.id, u.name, u.created_at, p.gender, p.country, p.avatar_seed
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [uid]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ profile: publicProfile(r.rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
