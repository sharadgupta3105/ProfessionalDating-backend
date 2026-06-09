/**
 * Send login OTP via Resend (https://resend.com).
 * Requires RESEND_API_KEY and OTP_FROM_EMAIL in environment.
 */

const APP_NAME = process.env.OTP_APP_NAME?.trim() || 'MatchedIn';

function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function buildOtpEmailHtml(code) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#FAF8F5; padding:24px;">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #E8E4DD;">
    <p style="margin:0 0 8px;font-size:13px;color:#57534E;text-transform:uppercase;letter-spacing:2px;">${APP_NAME}</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#1C1917;">Your sign-in code</h1>
    <p style="margin:0 0 24px;color:#57534E;line-height:1.5;">Enter this code in the app. It expires in <strong>10 minutes</strong>.</p>
    <p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:8px;color:#5B21B6;text-align:center;">${code}</p>
    <p style="margin:0;font-size:13px;color:#A8A29E;">If you didn't request this, you can ignore this email.</p>
  </div>
</body>
</html>`.trim();
}

/**
 * @param {{ to: string, code: string }} params
 */
async function sendLoginOtpEmail({ to, code }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.OTP_FROM_EMAIL?.trim() || 'LinkedUp <onboarding@resend.dev>';

  if (!apiKey) {
    const err = new Error(
      'Email OTP is not configured. Add RESEND_API_KEY and OTP_FROM_EMAIL to the server (see backend/OTP_EMAIL_SETUP.md).',
    );
    err.status = 503;
    throw err;
  }

  const normalizedTo = to.trim().toLowerCase();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [normalizedTo],
      subject: `Your ${APP_NAME} sign-in code`,
      html: buildOtpEmailHtml(code),
      text: `Your ${APP_NAME} sign-in code is ${code}. It expires in 10 minutes.`,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.message || JSON.stringify(body);
    } catch {
      detail = await response.text().catch(() => '');
    }
    const err = new Error(detail || `Failed to send OTP email (${response.status})`);
    err.status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw err;
  }

  if (process.env.DEBUG_OTP === '1') {
    // eslint-disable-next-line no-console
    console.log(`[otp] Email sent to ${normalizedTo}`);
  }

  return { ok: true };
}

module.exports = {
  isResendConfigured,
  sendLoginOtpEmail,
};
