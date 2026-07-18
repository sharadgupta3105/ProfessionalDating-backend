# Email OTP setup (Resend)

MatchedIn sends a **6-digit code** to the user's email on `POST /auth/login` when Resend is configured.

## 1. Create a Resend account

1. Sign up at [https://resend.com](https://resend.com) (free tier: ~100 emails/day).
2. **API Keys** → **Create API Key** → copy key (`re_...`).

## 2. Sender address

**Quick test (no domain):**

```env
OTP_FROM_EMAIL=MatchedIn <onboarding@resend.dev>
```

Resend only delivers to **your own verified email** on the free test sender.

**Production (your domain):**

1. Resend → **Domains** → add `matchedin.app` (or your domain).
2. Add the DNS records Resend shows (SPF, DKIM).
3. After verified:

```env
OTP_FROM_EMAIL=MatchedIn <noreply@matchedin.app>
```

## 3. Local backend (`backend/.env`)

```env
RESEND_API_KEY=re_your_key_here
OTP_FROM_EMAIL=MatchedIn <onboarding@resend.dev>
# Optional: log sends without printing the code
# DEBUG_OTP=1
```

Remove or comment out `OTP_FIXED_CODE` when testing real email.

Restart:

```bash
cd backend
npm start
```

Test:

```bash
curl -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL@gmail.com"}'
```

Check inbox (and spam). Then verify in the app with the code from the email.

## 4. AWS Elastic Beanstalk (production app)

**Configuration → Software → Environment properties:**

| Name | Value |
|------|--------|
| `RESEND_API_KEY` | `re_...` |
| `OTP_FROM_EMAIL` | `MatchedIn <noreply@yourdomain.com>` or test sender |
| Remove `OTP_FIXED_CODE` | (delete variable when going live) |

**Apply** and wait for health **Ok**.

Verify:

```bash
curl -X POST http://promatch-api-env.eba-rt5gymna.ap-south-1.elasticbeanstalk.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

Expected: `"emailed":true` and message about inbox.

## Modes summary

| Config | Behavior |
|--------|----------|
| `demo@linkedup.app` (or `DEMO_LOGIN_EMAIL`) | Always OTP **123456**, no email — see `DEMO_TESTING.md` |
| `RESEND_API_KEY` set | Random 6-digit OTP **emailed** (other addresses) |
| `OTP_FIXED_CODE=123456` | Same code for everyone, **no email** (QA only) |
| Dev, no Resend | Code `123456` in logs only |
| Production, no Resend, no fixed code | Error 503 |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 503 "not configured" | Add `RESEND_API_KEY` on EB and redeploy |
| Resend 403 / domain | Verify domain or use `onboarding@resend.dev` + send to your Resend account email |
| No email in inbox | Check spam; confirm `OTP_FROM_EMAIL` format: `Name <email@domain.com>` |
| Invalid code | Code expires in 10 minutes; request a new login |
