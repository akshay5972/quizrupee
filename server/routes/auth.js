import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { JWT_SECRET, authMiddleware } from '../middleware/auth.js';

const router = Router();

const safeUser = (u) => ({
  id: u.id, name: u.name, email: u.email,
  points: u.points, total_earned: u.total_earned,
  total_withdrawn: u.total_withdrawn, is_admin: u.is_admin,
  referral_code: u.referral_code, referral_count: u.referral_count || 0,
  streak: u.streak || 0, longest_streak: u.longest_streak || 0,
  created_at: u.created_at,
  gender: u.gender || null, country: u.country || null, avatar_seed: u.avatar_seed || null,
});

const VALID_GENDERS = ['male', 'female', 'other'];
const makeAvatarSeed = () => Math.random().toString(36).slice(2, 12);

const generateReferralCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const getOrCreateReferralCode = async (userId) => {
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    try {
      await pool.query(
        'UPDATE users SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL',
        [code, userId]
      );
      return code;
    } catch { /* collision, retry */ }
  }
};

router.post('/register', async (req, res) => {
  const { name, email, password, ref_code, gender, country } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email?.includes('@')) return res.status(400).json({ error: 'Invalid email address' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const g = String(gender || '').toLowerCase().trim();
  if (!VALID_GENDERS.includes(g)) return res.status(400).json({ error: 'Please select your gender' });
  const c = String(country || '').trim();
  if (!c || c.length > 80) return res.status(400).json({ error: 'Please select your country' });

  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash(password, 10);
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
    const isAdmin = !!(ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    let referrerId = null;
    if (ref_code) {
      const refResult = await client.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [ref_code.toUpperCase()]
      );
      if (refResult.rows[0]) referrerId = refResult.rows[0].id;
    }

    const newCode = generateReferralCode();
    const bonusPoints = referrerId ? 10 : 0;
    const bonusRupees = +(bonusPoints / 10).toFixed(2);
    const seed = makeAvatarSeed();

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, is_admin, referral_code, referred_by, points, total_earned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name.trim(), email.toLowerCase(), hash, isAdmin, newCode, referrerId, bonusPoints, bonusRupees]
    );
    const user = result.rows[0];

    await client.query(
      `INSERT INTO profiles (user_id, gender, country, avatar_seed) VALUES ($1, $2, $3, $4)`,
      [user.id, g, c, seed]
    );
    user.gender = g; user.country = c; user.avatar_seed = seed;

    if (referrerId) {
      await client.query(
        'UPDATE users SET points = points + 20, total_earned = total_earned + 2, referral_count = referral_count + 1 WHERE id = $1',
        [referrerId]
      );
    }

    await client.query('COMMIT');

    const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: safeUser(user), bonus_points: bonusPoints });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await pool.query(
      `SELECT u.*, p.gender, p.country, p.avatar_seed
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
    const shouldBeAdmin = !!(ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    if (shouldBeAdmin && !user.is_admin) {
      await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [user.id]);
      user.is_admin = true;
    }
    if (!user.referral_code) {
      const code = generateReferralCode();
      try {
        await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, user.id]);
        user.referral_code = code;
      } catch {}
    }
    const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: safeUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.*, p.gender, p.country, p.avatar_seed
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.referral_code) {
      const code = generateReferralCode();
      try {
        await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, user.id]);
        user.referral_code = code;
      } catch {}
    }
    res.json({ user: safeUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
