import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { pool } from '../db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware, adminMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only .xlsx, .xls, or .csv files are allowed'), ok);
  },
});

const VALID_CATEGORIES = ['sports','entertainment','science','space','politics','history','maths','geography','animals','puzzle','tricky','logical'];

function hashQuestion(category, text) {
  const norm = `${category}:${text.toLowerCase().trim().replace(/\s+/g, ' ')}`;
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 32);
}

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

/* ─── QUESTION BANK MANAGEMENT ─── */

router.get('/questions/stats', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT category, COUNT(*)::int AS count
      FROM cached_questions
      GROUP BY category
      ORDER BY category
    `);
    const byCat = {};
    VALID_CATEGORIES.forEach(c => { byCat[c] = 0; });
    r.rows.forEach(row => { byCat[row.category] = row.count; });
    const total = Object.values(byCat).reduce((a,b) => a+b, 0);
    res.json({ stats: byCat, total, valid_categories: VALID_CATEGORIES });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

const MAX_IMPORT_ROWS = 10000;
const INSERT_CHUNK = 500;

function uploadOne(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max 10 MB.' : err.message;
      return res.status(413).json({ error: msg });
    }
    return res.status(400).json({ error: err.message || 'Upload rejected' });
  });
}

router.post('/questions/import', uploadOne, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Send Excel file as "file" field.' });
  const replaceMode = req.body.mode === 'replace';

  const client = await pool.connect();
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return res.status(400).json({ error: 'Excel file is empty.' });
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ error: 'No rows found in Excel file.' });
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(413).json({
        error: `Too many rows (${rows.length}). Max ${MAX_IMPORT_ROWS} per upload — split your file and try again.`,
      });
    }

    const errors = [];
    const valid = [];
    const seenHashesInFile = new Set();
    rows.forEach((row, idx) => {
      const lineNum = idx + 2; // header is line 1
      const lower = {};
      Object.keys(row).forEach(k => { lower[k.toLowerCase().trim()] = row[k]; });

      const category = String(lower.category || '').toLowerCase().trim();
      const question = String(lower.question || '').trim();
      const correct = String(lower.correct || lower.correct_answer || '').trim();
      const w1 = String(lower.wrong1 || lower.wrong_1 || '').trim();
      const w2 = String(lower.wrong2 || lower.wrong_2 || '').trim();
      const w3 = String(lower.wrong3 || lower.wrong_3 || '').trim();

      if (!category || !question || !correct || !w1 || !w2 || !w3) {
        errors.push(`Row ${lineNum}: missing one of category/question/correct/wrong1/wrong2/wrong3`);
        return;
      }
      if (!VALID_CATEGORIES.includes(category)) {
        errors.push(`Row ${lineNum}: invalid category "${category}". Valid: ${VALID_CATEGORIES.join(', ')}`);
        return;
      }
      const hash = hashQuestion(category, question);
      if (seenHashesInFile.has(hash)) {
        errors.push(`Row ${lineNum}: duplicate of an earlier row in this file (same category+question)`);
        return;
      }
      seenHashesInFile.add(hash);
      const opts = [
        { text: correct, isCorrect: true },
        { text: w1, isCorrect: false },
        { text: w2, isCorrect: false },
        { text: w3, isCorrect: false },
      ];
      valid.push({ category, question, options: opts, hash });
    });

    if (valid.length === 0) {
      return res.status(400).json({ error: 'No valid rows found.', errors: errors.slice(0, 50) });
    }

    await client.query('BEGIN');

    let cleared = 0;
    if (replaceMode) {
      const cats = [...new Set(valid.map(v => v.category))];
      const delRes = await client.query(`DELETE FROM cached_questions WHERE category = ANY($1::text[])`, [cats]);
      cleared = delRes.rowCount;
    }

    // Bulk insert in chunks of INSERT_CHUNK rows to avoid thousands of round-trips.
    let inserted = 0;
    for (let off = 0; off < valid.length; off += INSERT_CHUNK) {
      const chunk = valid.slice(off, off + INSERT_CHUNK);
      const params = [];
      const valuesSql = chunk.map((v, i) => {
        const b = i * 4;
        params.push(v.category, v.question, JSON.stringify(v.options), v.hash);
        return `($${b+1}, $${b+2}, $${b+3}::jsonb, $${b+4})`;
      }).join(', ');
      const r = await client.query(`
        INSERT INTO cached_questions (category, question, options, question_hash)
        VALUES ${valuesSql}
        ON CONFLICT (question_hash) DO NOTHING
        RETURNING id
      `, params);
      inserted += r.rowCount;
    }
    const skipped = valid.length - inserted;

    await client.query('COMMIT');

    res.json({
      success: true,
      total_rows: rows.length,
      inserted,
      skipped_duplicates: skipped,
      cleared_in_replace_mode: cleared,
      errors: errors.slice(0, 50),
      mode: replaceMode ? 'replace' : 'add',
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Import error:', e);
    res.status(500).json({ error: e.message || 'Failed to import questions' });
  } finally {
    client.release();
  }
});

router.delete('/questions/:category', async (req, res) => {
  const cat = req.params.category.toLowerCase();
  if (!VALID_CATEGORIES.includes(cat)) return res.status(400).json({ error: 'Invalid category' });
  try {
    const r = await pool.query('DELETE FROM cached_questions WHERE category = $1', [cat]);
    res.json({ success: true, deleted: r.rowCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/reports', async (req, res) => {
  const status = String(req.query.status || 'all').toLowerCase();
  try {
    const where = status === 'open' ? `WHERE r.status = 'open'`
                : status === 'resolved' ? `WHERE r.status = 'resolved'`
                : '';
    const r = await pool.query(
      `SELECT r.id, r.message, r.status, r.admin_note, r.created_at, r.resolved_at,
              u.id AS user_id, u.name AS user_name, u.email AS user_email
       FROM reports r LEFT JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY r.created_at DESC LIMIT 200`
    );
    const counts = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM reports GROUP BY status`
    );
    const byStatus = { open: 0, resolved: 0 };
    counts.rows.forEach(row => { byStatus[row.status] = row.n; });
    res.json({ reports: r.rows, counts: byStatus });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/reports/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const status = String(req.body?.status || '').toLowerCase();
  const adminNote = req.body?.admin_note ? String(req.body.admin_note).slice(0, 500) : null;
  if (!['open', 'resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    await pool.query(
      `UPDATE reports SET status = $1, admin_note = $2,
         resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END
       WHERE id = $3`,
      [status, adminNote, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/questions/template', async (req, res) => {
  const sample = [
    { category: 'animals', question: 'What sound does a cow make?', correct: 'Moo', wrong1: 'Bark', wrong2: 'Meow', wrong3: 'Roar' },
    { category: 'animals', question: 'Which animal is the king of the jungle?', correct: 'Lion', wrong1: 'Tiger', wrong2: 'Bear', wrong3: 'Wolf' },
    { category: 'maths',   question: 'What is 2 + 3?', correct: '5', wrong1: '4', wrong2: '6', wrong3: '7' },
    { category: 'space',   question: 'Which planet do we live on?', correct: 'Earth', wrong1: 'Mars', wrong2: 'Jupiter', wrong3: 'Venus' },
    { category: 'sports',  question: 'How many players are on a football team on the field?', correct: '11', wrong1: '9', wrong2: '10', wrong3: '12' },
  ];
  const ws = XLSX.utils.json_to_sheet(sample, { header: ['category','question','correct','wrong1','wrong2','wrong3'] });
  ws['!cols'] = [{wch:14},{wch:50},{wch:20},{wch:20},{wch:20},{wch:20}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="QuizRupee_question_template.xlsx"');
  res.send(buf);
});

export default router;
