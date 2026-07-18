# Fix: CloudFormation `CREATE_FAILED` on Elastic Beanstalk

Error:

> The stack … is in **CREATE_FAILED** state. Rebuild or Terminate your environment.

**You cannot “Update platform” on this environment.** The stack never finished creating. **Terminate and create a new environment** (fastest fix).

---

## Step 1 — Terminate the broken environment

1. AWS Console → **Elastic Beanstalk** → **Promatch-api-env**
2. **Actions** → **Terminate environment**
3. Confirm and wait until it disappears (5–15 min)

The application **promatch-api** and your uploaded versions usually remain — only the environment is deleted.

---

## Step 2 — Create a new environment

1. Open application **promatch-api** → **Create new environment**
2. **Web server environment**
3. **Environment name:** e.g. `promatch-api-env` (or `promatch-api-prod`)
4. **Platform:** **Node.js 22** running on **64bit Amazon Linux 2023** (not Node 20)
5. **Application code:** Upload your zip (see Step 3) or use existing version
6. **Presets:** Single instance (free tier) or load balanced — either is fine for testing
7. **Instance:** `t3.micro` or `t3.small`, region **ap-south-1**
8. Create and wait until health is **Ok** (green)

---

## Step 3 — Deploy backend zip

```bash
cd /Users/sharadgupta/Desktop/pro-match-app/backend
zip -r ../promatch-backend.zip . \
  -x "node_modules/*" -x ".env" -x "uploads/*" -x ".git/*" -x "data/*"
```

Upload **promatch-backend.zip** when creating the environment, or after create: **Upload and deploy**.

---

## Step 4 — Environment properties (required)

**Configuration → Software → Environment properties:**

| Name | Value |
|------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` (optional; `.ebextensions` sets this) |
| `DATABASE_URL` | Supabase **session pooler** URI, port **6543** |
| `JWT_SECRET` | long random string |
| `API_BASE_URL` | `http://<NEW-EB-URL>` (no trailing slash) |
| `CORS_ORIGINS` | `*` |
| `APP_REGION` | `IN` |
| `APP_TIMEZONE` | `Asia/Kolkata` |
| `DEMO_LOGIN_EMAIL` | `demo@linkedup.app` |
| `DEMO_LOGIN_OTP` | `123456` |
| `RESEND_API_KEY` | your key (optional) |
| `OTP_FROM_EMAIL` | `MatchedIn <onboarding@resend.dev>` |
| `LINKEDIN_CLIENT_ID` | … |
| `LINKEDIN_CLIENT_SECRET` | … |
| `LINKEDIN_OAUTH_CALLBACK_URL` | `http://<NEW-EB-URL>/auth/linkedin/callback` |

**Apply** configuration.

---

## Step 5 — Seed demo user (once)

From your Mac (uses same `DATABASE_URL` as Supabase):

```bash
cd backend
# temporarily point .env DATABASE_URL at production DB if needed
npm run seed-demo
```

---

## Step 6 — Update mobile app URL

Copy the **new** environment URL from the EB dashboard.

Update:

- `mobile/.env` → `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_LINKEDIN_CALLBACK_URL`
- `mobile/eas.json` → production/preview `env` (if you rebuild the app)

Restart Expo.

---

## Step 7 — Verify

```bash
curl http://<NEW-EB-URL>/health
curl http://<NEW-EB-URL>/health/db
```

Expected: `{"ok":true}` and database connected.

---

## If create fails again

1. **CloudFormation** → failed stack → **Events** → read red line on `AWSEBAutoScalingLaunchConfiguration`
2. **IAM** → role **aws-elasticbeanstalk-ec2-role** exists and has **AWSElasticBeanstalkWebTier** (default)
3. Try **different instance type** (`t3.small`)
4. Ensure default VPC has **subnets** and **internet gateway** in ap-south-1

Do **not** retry “Update platform” on a **CREATE_FAILED** environment — always **Terminate** first.
