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
  created_at: u.created_at,
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email?.includes('@')) return res.status(400).json({ error: 'Invalid email address' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
    const isAdmin = !!(ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), email.toLowerCase(), hash, isAdmin]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: safeUser(user) });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
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
    const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: safeUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(result.rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
