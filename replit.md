# QuizRupee

AI-powered quiz app where users earn real money via UPI withdrawals.

## Architecture

- **Frontend**: React + Vite on port 5000 (`npm run dev`)
- **Backend**: Express.js on port 3001 (`npm run server`)
- **Database**: Replit PostgreSQL (via `DATABASE_URL`)
- **AI**: Google Gemini 2.0 Flash for question generation

## Workflows

- `Start application` — Vite frontend (port 5000, webview)
- `Backend API` — Express backend (port 3001, console)

## Points System

- 1 correct answer = 1 point
- 10 points = ₹1
- Minimum withdrawal = 1000 points = ₹100
- Withdrawal method: UPI ID

## Environment Variables (Secrets)

| Key | Description |
|-----|-------------|
| `VITE_GEMINI_API_KEY` | Google Gemini API key (free at aistudio.google.com) |
| `JWT_SECRET` | Auto-generated JWT signing secret |
| `DATABASE_URL` | Replit PostgreSQL connection string (auto-set) |
| `ADMIN_EMAIL` | Email address that gets admin access on registration |

## Admin Panel

Set `ADMIN_EMAIL` secret to your email address, then register with that email to get admin access. Admin users see an ⚙️ Admin tab with:
- Overview stats (users, quizzes, pending payouts, total paid)
- All withdrawal requests with approve/reject + note field
- Points auto-refunded on rejection

## File Structure

```
server/
  index.js              # Express entry point
  db.js                 # PostgreSQL pool + initDB
  middleware/auth.js    # JWT auth + admin middleware
  routes/
    auth.js             # Register, Login, /me
    quiz.js             # Complete quiz, category stats
    withdraw.js         # Request withdrawal, history
    admin.js            # Admin stats, manage withdrawals
    leaderboard.js      # Overall and category leaderboards

src/
  App.jsx               # Complete React frontend (single file)

vite.config.js          # Proxy /api/* → localhost:3001
```

## Database Schema

- `users` — id, name, email, password_hash, points, total_earned, total_withdrawn, is_admin
- `quiz_sessions` — id, user_id, category, score, points_earned, played_at
- `withdrawal_requests` — id, user_id, upi_id, amount, points_used, status, admin_note
- `category_stats` — id, user_id, category, played, total_correct, best_score, points_earned
