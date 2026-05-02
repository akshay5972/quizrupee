import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      points INTEGER DEFAULT 0,
      total_earned NUMERIC(10,2) DEFAULT 0,
      total_withdrawn NUMERIC(10,2) DEFAULT 0,
      is_admin BOOLEAN DEFAULT FALSE,
      streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_played_date DATE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_played_date DATE;
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      category VARCHAR(50) NOT NULL,
      score INTEGER NOT NULL,
      points_earned INTEGER NOT NULL,
      played_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      upi_id VARCHAR(255) NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      points_used INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      requested_at TIMESTAMP DEFAULT NOW(),
      processed_at TIMESTAMP,
      admin_note TEXT
    );
    CREATE TABLE IF NOT EXISTS category_stats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      category VARCHAR(50) NOT NULL,
      played INTEGER DEFAULT 0,
      total_correct INTEGER DEFAULT 0,
      best_score INTEGER DEFAULT 0,
      points_earned INTEGER DEFAULT 0,
      UNIQUE(user_id, category)
    );
    CREATE TABLE IF NOT EXISTS cached_questions (
      id SERIAL PRIMARY KEY,
      category VARCHAR(50) NOT NULL,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      question_hash VARCHAR(64) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cached_questions_category ON cached_questions(category);
    CREATE TABLE IF NOT EXISTS user_seen_questions (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      question_id INTEGER REFERENCES cached_questions(id) ON DELETE CASCADE,
      seen_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, question_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_seen_user ON user_seen_questions(user_id);
    CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      gender VARCHAR(20) NOT NULL,
      country VARCHAR(80) NOT NULL,
      avatar_seed VARCHAR(64) NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      admin_note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
    CREATE TABLE IF NOT EXISTS follows (
      follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followee_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (follower_id, followee_id),
      CHECK (follower_id <> followee_id)
    );
    CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
    CREATE TABLE IF NOT EXISTS messages (
      id          SERIAL PRIMARY KEY,
      sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      is_read     BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMP DEFAULT NOW(),
      CHECK (sender_id <> receiver_id)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_pair2 ON messages(receiver_id, sender_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read);
  `);
  console.log('Database initialized');
}
