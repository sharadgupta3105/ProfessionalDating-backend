# AWS Elastic Beanstalk — LinkedUp API (Mumbai)

Environment URL: `http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com`

## Environment failed to launch (no instances)

If events show **`CREATE_FAILED`**, **`AWSEBAutoScalingLaunchConfiguration`**, and **“There are no instances”**:

1. **Upgrade platform** — yellow banner **“Platform branch is deprecated”** → **Upgrade now** (pick latest **Node.js 20** on **Amazon Linux 2023**, not 6.11.x).
2. **Configuration → Capacity** — Instance type e.g. `t3.small` or `t3.micro` (available in **ap-south-1**).
3. **Actions → Restart app server(s)**. If still red → **Actions → Rebuild environment**.
4. If rebuild fails again → **Actions → Terminate environment**, then **Create new environment** (same app `promatch-api`, upload new version), copy env vars from below.
5. Open **CloudFormation** → stack `awseb-e-...-stack` → **Events** → read the exact error on `AWSEBAutoScalingLaunchConfiguration` (often IAM or invalid instance type).

APIs work only when health is **Ok** and `curl .../health` returns `{"ok":true}`.

## Required environment properties

Set in **Elastic Beanstalk → Configuration → Software → Environment properties** (exact values):

| Name | Value |
|------|--------|
| `NODE_ENV` | `production` (use `development` only for QA with OTP `123456`) |
| `DATABASE_URL` | Supabase **Session pooler** URI (port **6543**), not direct `db.*:5432` |
| `JWT_SECRET` | Long random string |
| `API_BASE_URL` | `http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com` |
| `APP_REGION` | `IN` |
| `APP_TIMEZONE` | `Asia/Kolkata` |
| `AWS_REGION` | `ap-south-1` |
| `AWS_S3_BUCKET` | `promatch-uploads-prod-in` |
| `CORS_ORIGINS` | `*` (literal asterisk for mobile + web testing) |
| `FRONTEND_URL` | `http://localhost:8081` (Expo web dev) or your web app URL |

**Do not** paste placeholder text into `CORS_ORIGINS`. It must be `*` or real origins like `http://localhost:8081,exp://192.168.1.5:8081`.

### Email OTP (Resend — recommended for real users)

| Name | Value |
|------|--------|
| `RESEND_API_KEY` | `re_...` from [resend.com](https://resend.com) |
| `OTP_FROM_EMAIL` | `LinkedUp <onboarding@resend.dev>` (test) or `LinkedUp <noreply@yourdomain.com>` |

See **`backend/OTP_EMAIL_SETUP.md`**. Remove `OTP_FIXED_CODE` when email OTP is working.

### Demo account (recommended for QA)

| Name | Value |
|------|--------|
| `DEMO_LOGIN_EMAIL` | `demo@linkedup.app` |
| `DEMO_LOGIN_OTP` | `123456` |
| `SEED_DEMO_ACCOUNT` | `1` (optional — refreshes demo profile on each deploy) |

Run once locally: `npm run seed-demo`. See **`backend/DEMO_TESTING.md`**.

### OTP for all emails (optional)

| Name | Value |
|------|--------|
| `OTP_FIXED_CODE` | `123456` |

Every email gets `123456` with no email. Remove for public launch.

### LinkedIn (optional)

| Name | Value |
|------|--------|
| `LINKEDIN_CLIENT_ID` | Your client id |
| `LINKEDIN_CLIENT_SECRET` | Server secret |
| `LINKEDIN_OAUTH_CALLBACK_URL` | `http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com/auth/linkedin/callback` |

Register that callback URL in LinkedIn Developer Portal.

## Verify deployment

```bash
curl http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com/health
curl http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com/
```

## Mobile app

`mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com
EXPO_PUBLIC_LINKEDIN_CALLBACK_URL=http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com/auth/linkedin/callback
```

Restart Expo after changes.

## Redeploy after code changes

```bash
cd backend
zip -r ../promatch-backend.zip . -x "node_modules/*" -x ".env" -x "uploads/*"
```

Elastic Beanstalk → **Upload and deploy**.

## IAM

Attach policy **PromatchS3Upload** to role **aws-elasticbeanstalk-ec2-role** for photo uploads (when S3 code is enabled).
