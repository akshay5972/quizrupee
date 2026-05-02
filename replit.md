# QuizRupee

Quiz app where users earn real money via UPI withdrawals. Questions come from a curated, admin-managed bank — no third-party AI calls at runtime.

## Architecture

- **Frontend**: React + Vite on port 5000 (`npm run dev`)
- **Backend**: Express.js on port 3001 (`npm run server`)
- **Database**: Replit PostgreSQL (via `DATABASE_URL`)
- **Question Source**: Static question bank in PostgreSQL, uploaded by admin via Excel (.xlsx). Per-user no-repeat-per-category guarantee with auto-cycling once a user exhausts a category.

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
| `JWT_SECRET` | Auto-generated JWT signing secret |
| `DATABASE_URL` | Replit PostgreSQL connection string (auto-set) |
| `ADMIN_EMAIL` | Email address that gets admin access on registration |

`VITE_GEMINI_API_KEY` / `GEMINI_API_KEY` may still exist in env from earlier iterations but are unused.

## Admin Panel

Set `ADMIN_EMAIL` secret, then register/login with that email. Admin users see an ⚙️ Admin tab with:
- Overview stats (users, quizzes, pending payouts, total paid)
- **Question Bank manager**: per-category counts, Excel upload (Add or Replace mode), template download, per-category clear
- All withdrawal requests with approve/reject + note field
- Points auto-refunded on rejection

### Excel format for question import
Columns: `category | question | correct | wrong1 | wrong2 | wrong3`
Valid categories: `sports, entertainment, science, space, politics, history, maths, geography, animals, puzzle, tricky, logical`
- **Add mode** — appends new rows; duplicates (same category + question text) are skipped via SHA-256 hash unique index.
- **Replace mode** — wipes all existing questions in any category present in the file before inserting.
- Recommended: 200+ per category. Below 10 the `/quiz/generate` endpoint returns 503.

## Question delivery (no-repeat guarantee)

`POST /api/quiz/generate` atomically claims 10 unseen questions for the user via a CTE that joins `cached_questions` against `user_seen_questions` and inserts the chosen IDs. If the user has seen everything in that category, their `user_seen_questions` rows for that category are deleted and 10 are re-claimed (cycling). Returns 503 if the bank has fewer than 10 questions for the category.

## File Structure

```
server/
  index.js              # Express entry point
  db.js                 # PostgreSQL pool + initDB (cached_questions, user_seen_questions)
  middleware/auth.js    # JWT auth + admin middleware
  routes/
    auth.js             # Register (gender+country required), Login, /me (joins profiles)
    quiz.js             # Cache-only /generate with cycling, complete quiz, category stats
    withdraw.js         # Request withdrawal, history
    admin.js            # Admin stats, withdrawals, question-bank, user reports
    leaderboard.js      # Overall and category leaderboards
    profile.js          # GET/PATCH /me, GET /:userId — gender, country, avatar_seed, follow info
    help.js             # POST /report (text-only user help/report), GET /my-reports
    follows.js          # POST/DELETE /:userId, GET /me/{friends,following,followers,counts}, /search

src/
  App.jsx               # Complete React frontend (single file)

vite.config.js          # Proxy /api/* → localhost:3001
```

## Database Schema

- `users` — id, name, email, password_hash, points, total_earned, total_withdrawn, is_admin
- `quiz_sessions` — id, user_id, category, score, points_earned, played_at
- `withdrawal_requests` — id, user_id, upi_id, amount, points_used, status, admin_note
- `category_stats` — id, user_id, category, played, total_correct, best_score, points_earned
- `cached_questions` — id, category, question, options jsonb, question_hash unique (sha256 of category+text), created_at
- `user_seen_questions` — (user_id, question_id) PK pair, ON DELETE CASCADE → cached_questions
- `profiles` — user_id PK FK→users, gender (male|female|other), country, avatar_seed, updated_at
- `reports` — id, user_id, message, status (open|resolved), admin_note, created_at, resolved_at
- `follows` — (follower_id, followee_id) PK, CHECK (follower<>followee), CASCADE on user delete

## Social / Profile (Ship 1)

- Signup requires gender (M/F/Other) + country (dropdown ~70 countries).
- Avatar = DiceBear `avataaars` SVG, seeded per user; gender biases hair styles. "Shuffle" generates a new seed.
- Header shows hamburger (left) + avatar (right). Hamburger opens a left slide-in side menu with: Profile, Help/Report, Logout.
- Profile page (`page === "profile"`): avatar + name/email/badges, stats (points / earned / streak), edit gender + country, shuffle avatar.
- Help page (`page === "help"`): textarea (max 2000 chars) → `POST /api/help/report`. Rate-limited to 5/hour.
- Admin panel adds **USER REPORTS / HELP** section above withdrawals: filter Open/Resolved/All, mark resolved / reopen.

## Friends / Follows (Ship 2)

- One-way **follow** model. **Friends** = mutual follows.
- Endpoints (`/api/follows`, all auth-required):
  - `POST /:userId` — follow (idempotent via `ON CONFLICT DO NOTHING`)
  - `DELETE /:userId` — unfollow
  - `GET /me/{friends,following,followers,counts}` — own lists + counts
  - `GET /search?q=` — find users by name/email (min 2 chars, escapes `%_`)
- `GET /api/profile/:userId` returns `i_follow`, `follows_me`, `follower_count`, `following_count`, `is_me` so the UI can render the right Follow/Unfollow CTA.
- Frontend: bottom nav has new **Friends** tab (👥) with sub-tabs Friends / Following / Followers / Find People (debounced search). Tapping any user opens a profile modal with stats and Follow/Unfollow. Profile page also shows a 3-stat bar (Friends / Following / Followers) that links to the Friends tab.

Roadmap (not yet built): Ship 3 chat (mutual-only, 5s polling, 50-msg cap, EN+Hindi profanity filter), Ship 4 one-way block.
