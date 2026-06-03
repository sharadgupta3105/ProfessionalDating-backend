# ProMatch Backend

Node.js + Express API for the ProMatch dating app. Uses **PostgreSQL** (recommended: [Supabase](https://supabase.com) free tier) via **`DATABASE_URL`** and **JWT** for auth.

---

## Quick start

1. **Supabase (or any Postgres)**  
   Create a project → **Project Settings → Database → Connection string (URI)** → set as `DATABASE_URL` in `.env`.

2. **Install and run**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Set DATABASE_URL in .env
   npm run init-db
   npm run seed
   npm start
   ```
3. API: `http://localhost:5000` by default (`PORT` in `.env` overrides; `.env.example` uses `5001`). In development, use **any email** + OTP **`123456`** to log in when `NODE_ENV=development`.
4. Start the mobile app (`cd mobile && npm start`) and point it at your API (see `mobile/src/services/api.js`).

---

## Database schema

Tables: **users**, **otp_codes**, **likes**, **passes**, **matches**, **conversations**, **messages** (with monotonic `seq` for read cursors), **conversation_reads**.

Schema is applied on **`npm run init-db`** and on server start (`initDb()` in `src/index.js`). To wipe dev data, use scripts such as `npm run reset-and-seed` or delete rows in the Supabase SQL editor.

---

## API summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Body: `{ email }` – sends OTP (dev: use 123456) |
| POST | `/auth/verify-otp` | No | Body: `{ email, code }` – returns `{ token, user }` |
| POST | `/auth/logout` | Yes | Invalidates session (JWT is stateless; 200 OK) |
| GET | `/users/me` | Yes | Current user profile |
| PATCH | `/users/me` | Yes | Update profile |
| POST | `/users/me/photo` | Yes | Body: `{ photo_url }` or `{ url }` – set profile photo URL |
| GET | `/users/:userId` | Yes | Get user by id |
| GET | `/matches/recommendations` | Yes | Users to swipe (excludes liked/passed) |
| POST | `/matches/like` | Yes | Body: `{ userId }` – like; response may include `isMatch` |
| POST | `/matches/pass` | Yes | Body: `{ userId }` – pass |
| POST | `/matches/super-like` | Yes | Body: `{ userId }` – super-like; response may include `isMatch` |
| GET | `/matches` | Yes | List mutual matches |
| GET | `/chats` | Yes | List conversations (with last message + other user) |
| GET | `/chats/:chatId/messages` | Yes | Messages; `chatId` can be conversation id or other user id |
| POST | `/chats/:chatId/messages` | Yes | Body: `{ text }` – send message |

---

## Environment variables

Copy `.env.example` to `.env` and adjust:

```env
DATABASE_URL=postgresql://...
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-key-change-in-production
FRONTEND_URL=http://localhost:8081
# Optional: Resend for OTP emails
# RESEND_API_KEY=re_xxxxx
# OTP_FROM_EMAIL=onboarding@resend.dev
```

- **DATABASE_URL** – Required. Supabase URI from the dashboard (pooler or direct connection).
- **JWT_SECRET** – Use a long random string in production.
- **FRONTEND_URL** – Allowed CORS origin (Expo web: `http://localhost:8081`; replace with your app URL in production).

---

## Scripts

- `npm start` – Run API (ensures schema on start).
- `npm run init-db` – Apply DDL only.
- `npm run seed` – Insert demo users (`alex@example.com`, …; dev OTP `123456`).
- `npm run seed-test-accounts` – Bengaluru `@promatch.dev` QA accounts.
- `npm run reset-and-seed` – Full wipe + powertesters + onboarding / verified / chat fixtures (dev).

---

## Optional services

| Service | Purpose | Sign up |
|---------|--------|--------|
| **Resend** | OTP emails | [resend.com](https://resend.com) |
| **Render** (optional) | Host API | [render.com](https://render.com) |

Set `DATABASE_URL` on the host. Uploaded files live under `backend/uploads/`; use persistent disk or object storage if you need them to survive restarts.
