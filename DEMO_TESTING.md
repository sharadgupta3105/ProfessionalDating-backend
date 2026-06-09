# Demo account & fixed OTP

## Quick login (no email)

| Field | Default |
|-------|---------|
| **Email** | `demo@linkedup.app` |
| **OTP** | `123456` |

Works in **development and production** when `DEMO_LOGIN_EMAIL` / `DEMO_LOGIN_OTP` are set on the server. Resend can stay enabled for real users.

## Seed the demo profile

Creates a complete user (onboarding done, Bengaluru, photos):

```bash
cd backend
npm run seed-demo
```

Or refresh on every API start:

```env
SEED_DEMO_ACCOUNT=1
```

## Environment variables

```env
DEMO_LOGIN_EMAIL=demo@linkedup.app
DEMO_LOGIN_OTP=123456
```

**AWS Elastic Beanstalk** — add the same two variables in **Configuration → Software**.

### Optional: fixed OTP for every email

```env
OTP_FIXED_CODE=123456
```

All addresses use `123456` and **no email** is sent. Use only for internal QA; remove before public launch.

## Login priority

1. **Demo email** → `DEMO_LOGIN_OTP`, no email  
2. **`OTP_FIXED_CODE`** → same code for all emails, no email  
3. **`RESEND_API_KEY`** → random code emailed  
4. **Dev, no Resend** → `123456` in server logs  

## Other test accounts

- `npm run seed` — `alex@example.com`, `priya@example.com`, …  
- `npm run seed-test-accounts` — `powertester@promatch.dev`, …  

With `OTP_FIXED_CODE=123456` or demo email, use OTP **123456**.
