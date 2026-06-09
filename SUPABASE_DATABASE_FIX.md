# Fix: `tenant/user postgres.dwzdajbzrlrdvelvhywn not found`

## What it means

Your API’s `DATABASE_URL` points at a **Supabase project that no longer exists** (deleted, paused too long, or wrong connection string).

The app calls **AWS Elastic Beanstalk** (`promatch-api-env...`), and login fails there because `DATABASE_URL` on EB still uses the old project ref **`dwzdajbzrlrdvelvhywn`**.

---

## Fix (about 10 minutes)

### 1. Open Supabase

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Open your **active** project (e.g. **linkedup-f295e** or create a **new** project if the old one is gone).
3. If the project is **Paused**, click **Restore project**.

### 2. Copy a new connection string

1. **Project Settings** → **Database**
2. Under **Connection string**, choose **URI**
3. For **AWS / production**, use **Session pooler** (recommended):
   - Mode: **Session**
   - Port: **6543**
   - Host looks like: `aws-0-ap-south-1.pooler.supabase.com`
   - User looks like: `postgres.XXXXXXXX` (includes your **new** project ref)
4. Replace `[YOUR-PASSWORD]` with your database password (URL-encode `@` as `%40`).

Example shape (not real values):

```text
postgresql://postgres.NEW_PROJECT_REF:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

### 3. Update AWS Elastic Beanstalk

1. [AWS Console](https://console.aws.amazon.com/elasticbeanstalk) → **promatch-api-env** (ap-south-1)
2. **Configuration** → **Software** → **Edit**
3. Set **`DATABASE_URL`** to the **new** pooler URI from step 2
4. **Apply** and wait for environment **Health: Ok** (green)

### 4. Update local backend (for `npm start` on your Mac)

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://postgres.NEW_PROJECT_REF:...@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

Restart:

```bash
cd backend
npm start
```

### 5. Re-apply schema (new / empty database only)

If this is a **brand-new** Supabase project with no tables:

```bash
cd backend
npm run init-db
npm run seed
```

### 6. Verify

```bash
curl http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com/health/db
```

Should return `{"ok":true,"database":"connected"}`.

Then test login:

```bash
curl -X POST http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

With `OTP_FIXED_CODE=123456` on EB, use OTP `123456` in the app.

---

## Do not use (for AWS)

- Old host: `db.dwzdajbzrlrdvelvhywn.supabase.co` — **does not resolve** anymore
- Direct port `5432` on EB — often causes `ENETUNREACH`; prefer pooler **6543**
