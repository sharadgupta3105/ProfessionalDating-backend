/**
 * Demo login for QA / Play internal testing — always uses a fixed OTP (no email).
 */

function getDemoLoginEmail() {
  return (process.env.DEMO_LOGIN_EMAIL || 'demo@linkedup.app').trim().toLowerCase();
}

function getDemoLoginOtp() {
  const otp = process.env.DEMO_LOGIN_OTP?.trim() || '123456';
  return /^\d{4,8}$/.test(otp) ? otp : '123456';
}

function isDemoLoginEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return email.trim().toLowerCase() === getDemoLoginEmail();
}

module.exports = {
  getDemoLoginEmail,
  getDemoLoginOtp,
  isDemoLoginEmail,
};
