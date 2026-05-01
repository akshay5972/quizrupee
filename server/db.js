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
      created_at TIMESTAMP DEFAULT NOW()
    );
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
  `);
  console.log('Database initialized');
}
