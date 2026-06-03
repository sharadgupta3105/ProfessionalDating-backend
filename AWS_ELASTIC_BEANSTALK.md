# AWS Elastic Beanstalk — ProMatch API (Mumbai)

Environment URL: `http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com`

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

### OTP for testing (until Resend is configured)

Add temporarily:

| Name | Value |
|------|--------|
| `OTP_FIXED_CODE` | `123456` |

Remove before real users. Or set `NODE_ENV=development` (not recommended for production).

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
