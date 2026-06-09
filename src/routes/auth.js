const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { getOne, run } = require("../db/connection");
const { signToken, authMiddleware, JWT_SECRET } = require("../middleware/auth");
const { toUserJson } = require("../utils/userJson");
const { randomUUID } = require("crypto");
const { isResendConfigured, sendLoginOtpEmail } = require("../services/emailOtp");
const {
  isDemoLoginEmail,
  getDemoLoginEmail,
  getDemoLoginOtp,
} = require("../config/demoAccount");

/** Prevent open-redirect abuse: only allow redirect URIs used by our mobile app + Expo dev. */
function isAllowedLinkedInRedirectUri(uri) {
  if (!uri || typeof uri !== "string") return false;
  const trimmed = uri.trim();
  const fromEnv = process.env.LINKEDIN_REDIRECT_URI_ALLOWLIST;
  const extra = fromEnv
    ? fromEnv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (trimmed.startsWith("https://auth.expo.io/")) return true;
  const serverCb = process.env.LINKEDIN_OAUTH_CALLBACK_URL?.trim();
  if (serverCb && trimmed === serverCb) return true;
  const defaults = ["mobile://linkedin"];
  if ([...defaults, ...extra].includes(trimmed)) return true;
  if (/^exp:\/\/.+\/--\/linkedin/.test(trimmed)) return true;
  if (trimmed.startsWith("http://localhost") && trimmed.includes("linkedin"))
    return true;
  if (trimmed.startsWith("http://127.0.0.1") && trimmed.includes("linkedin"))
    return true;
  if (trimmed.startsWith("https://localhost") && trimmed.includes("linkedin"))
    return true;
  return false;
}

function linkedinOAuthCallbackUrl() {
  const raw = process.env.LINKEDIN_OAUTH_CALLBACK_URL?.trim() || "";
  return raw.replace(/\/$/, "");
}

function isAllowedAppLinkedInReturnUrl(url) {
  if (!url || typeof url !== "string") return false;
  const t = url.trim();
  if (t.startsWith("exp://")) return true;
  if (t.startsWith("mobile://")) return true;
  if (t.startsWith("ethos://")) return true;
  if (t.startsWith("https://auth.expo.io/")) return true;
  if (
    /^https?:\/\/localhost(:\d+)?\//.test(t) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?\//.test(t)
  )
    return true;
  return false;
}

function extractLinkedInProfileUrlFromPayload(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const v of Object.values(obj)) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s.includes("linkedin.com") || !/\/in\//i.test(s)) continue;
    try {
      const u = new URL(
        s.startsWith("http") ? s : `https://${s.replace(/^\/\//, "")}`,
      );
      if (
        u.hostname.replace(/^www\./, "") === "linkedin.com" &&
        u.pathname.includes("/in/")
      ) {
        return `${u.origin}${u.pathname}`.split("?")[0];
      }
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

const LINKEDIN_ME_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": "202401",
  "X-Restli-Protocol-Version": "2.0.0",
});

async function resolveLinkedInProfileUrl(accessToken, userinfo) {
  const fromUserinfo = extractLinkedInProfileUrlFromPayload(userinfo);
  if (fromUserinfo) return fromUserinfo;

  const tryMeJson = (me) => {
    if (!me || typeof me !== "object") return null;
    const v = me.vanityName;
    if (typeof v === "string" && v.trim()) {
      return `https://www.linkedin.com/in/${encodeURIComponent(v.trim())}`;
    }
    return extractLinkedInProfileUrlFromPayload(me);
  };

  try {
    const urls = [
      "https://api.linkedin.com/v2/me?projection=(vanityName)",
      "https://api.linkedin.com/v2/me",
    ];
    for (const url of urls) {
      const meRes = await fetch(url, {
        headers: LINKEDIN_ME_HEADERS(accessToken),
      });
      if (meRes.ok) {
        const me = await meRes.json().catch(() => ({}));
        const out = tryMeJson(me);
        if (out) return out;
      }
    }
  } catch (_) {
    /* ignore */
  }

  const nick = userinfo.nickname || userinfo.preferred_username;
  if (
    typeof nick === "string" &&
    nick.trim() &&
    !nick.includes("@") &&
    !nick.includes("://")
  ) {
    return `https://www.linkedin.com/in/${encodeURIComponent(nick.trim())}`;
  }
  if (
    typeof userinfo.profile === "string" &&
    userinfo.profile.startsWith("http")
  ) {
    return userinfo.profile;
  }
  return null;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post("/login", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    const isDemo = isDemoLoginEmail(normalizedEmail);
    const fixedOtp = process.env.OTP_FIXED_CODE?.trim();
    const useFixedOtp = !isDemo && fixedOtp && /^\d{4,8}$/.test(fixedOtp);
    const resendOn = isResendConfigured();
    const isDev = process.env.NODE_ENV !== "production";

    let code;
    let message;
    let emailed = false;
    let demo = false;

    if (isDemo) {
      code = getDemoLoginOtp();
      demo = true;
      message = `Demo account — use OTP ${code} (no email sent).`;
    } else if (useFixedOtp) {
      code = fixedOtp;
      message = `OTP ready. Use code ${code} (fixed test mode, no email).`;
    } else if (resendOn) {
      code = generateOtp();
      await sendLoginOtpEmail({ to: normalizedEmail, code });
      emailed = true;
      message = "We sent a 6-digit code to your email. Check your inbox and spam folder.";
    } else if (isDev) {
      code = "123456";
      message = "Dev mode: use OTP 123456 (set RESEND_API_KEY to send real emails).";
      // eslint-disable-next-line no-console
      console.log(`[otp] Dev code for ${normalizedEmail}: ${code}`);
    } else {
      const err = new Error(
        "Email sign-in is not configured. Set RESEND_API_KEY on the server. See backend/OTP_EMAIL_SETUP.md.",
      );
      err.status = 503;
      throw err;
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await run("DELETE FROM otp_codes WHERE email = ?", [normalizedEmail]);
    await run("INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)", [
      normalizedEmail,
      code,
      expiresAt,
    ]);

    res.json({
      success: true,
      message,
      emailed,
      demo,
      ...(demo ? { demoEmail: getDemoLoginEmail() } : {}),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/verify-otp", async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }
    const row = await getOne(
      "SELECT * FROM otp_codes WHERE email = ? AND code = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [email.trim().toLowerCase(), String(code).trim()],
    );
    if (!row) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }
    await run("DELETE FROM otp_codes WHERE email = ?", [email.trim().toLowerCase()]);

    let user = await getOne("SELECT * FROM users WHERE email = ?", [
      email.trim().toLowerCase(),
    ]);
    if (!user) {
      const id = randomUUID();
      await run(
        "INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
        [id, email.trim().toLowerCase(), email.split("@")[0]],
      );
      user = await getOne("SELECT * FROM users WHERE id = ?", [id]);
    }

    const token = signToken({ userId: user.id });
    res.json({ token, user: toUserJson(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", authMiddleware, (req, res) => {
  res.json({ success: true });
});

async function exchangeLinkedInAndUpsertUser(code, redirectUriTrimmed) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const e = new Error("LinkedIn sign-in is not configured");
    e.status = 503;
    throw e;
  }

  const tokenRes = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code.trim(),
        redirect_uri: redirectUriTrimmed,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
  );
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    const msg =
      tokenJson.error_description ||
      tokenJson.error ||
      tokenJson.message ||
      "Token exchange failed";
    const e = new Error(String(msg));
    e.status = 400;
    throw e;
  }
  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    const e = new Error("No access token from LinkedIn");
    e.status = 400;
    throw e;
  }

  const userinfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await userinfoRes.json().catch(() => ({}));
  if (!userinfoRes.ok) {
    const e = new Error(
      profile.message || profile.error || "Could not load LinkedIn profile",
    );
    e.status = 400;
    throw e;
  }
  const emailRaw = profile.email;
  if (!emailRaw || typeof emailRaw !== "string") {
    const e = new Error(
      "LinkedIn did not return an email. Grant email permission.",
    );
    e.status = 400;
    throw e;
  }
  const email = emailRaw.trim().toLowerCase();
  const name =
    profile.name ||
    [profile.given_name, profile.family_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    email.split("@")[0];
  const picture = typeof profile.picture === "string" ? profile.picture : null;
  const profileUrl = await resolveLinkedInProfileUrl(accessToken, profile);

  let user = await getOne("SELECT * FROM users WHERE email = ?", [email]);
  const mergedLinkedinUrl = profileUrl || (user && user.linkedin_url) || null;

  if (!user) {
    const id = randomUUID();
    await run(
      "INSERT INTO users (id, email, name, photo_url, linkedin_url, linkedin_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())",
      [id, email, name, picture, mergedLinkedinUrl],
    );
    user = await getOne("SELECT * FROM users WHERE id = ?", [id]);
  } else {
    let nextPhoto = user.photo_url;
    if (picture && !user.photo_url) nextPhoto = picture;
    await run(
      "UPDATE users SET linkedin_verified = 1, linkedin_url = ?, photo_url = ?, updated_at = NOW() WHERE id = ?",
      [mergedLinkedinUrl, nextPhoto, user.id],
    );
    user = await getOne("SELECT * FROM users WHERE id = ?", [user.id]);
  }
  return user;
}

/** Public: exact redirect_uri registered in LinkedIn Developer Portal (for debugging). */
router.get("/linkedin/redirect-uri", (req, res) => {
  const redirectUri = linkedinOAuthCallbackUrl();
  if (!redirectUri) {
    return res.status(503).json({
      message:
        "Set LINKEDIN_OAUTH_CALLBACK_URL on the API (e.g. https://YOUR_HOST/auth/linkedin/callback).",
    });
  }
  res.json({
    redirectUri,
    hint: "Add this exact string to LinkedIn → Auth → Authorized redirect URLs (no trailing slash).",
  });
});

router.post("/linkedin/start", (req, res) => {
  try {
    const callbackUrl = linkedinOAuthCallbackUrl();
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!callbackUrl || !clientId) {
      return res.status(503).json({
        message:
          "Set LINKEDIN_OAUTH_CALLBACK_URL on the API (public https URL + /auth/linkedin/callback) and LINKEDIN_CLIENT_ID.",
      });
    }
    const { appReturnUrl } = req.body || {};
    if (
      !appReturnUrl ||
      typeof appReturnUrl !== "string" ||
      !isAllowedAppLinkedInReturnUrl(appReturnUrl)
    ) {
      return res.status(400).json({
        message:
          "Invalid appReturnUrl (expected exp:// or mobile:// deep link).",
      });
    }
    const state = jwt.sign({ returnUrl: appReturnUrl.trim() }, JWT_SECRET, {
      expiresIn: "10m",
    });
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: callbackUrl,
      state,
      scope: "openid profile email",
    });
    const authorizeUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    res.json({ authorizeUrl });
  } catch (e) {
    res
      .status(500)
      .json({ message: e.message || "Failed to start LinkedIn OAuth" });
  }
});

router.get("/linkedin/callback", async (req, res, next) => {
  try {
    const callbackUrl = linkedinOAuthCallbackUrl();
    if (!callbackUrl) {
      return res
        .status(404)
        .send("LinkedIn callback URL is not configured on the server.");
    }
    const { code, state, error, error_description } = req.query;
    if (error) {
      return res
        .status(400)
        .send(
          `<!DOCTYPE html><html><body><p>LinkedIn: ${String(error_description || error)}</p><p>You can close this tab.</p></body></html>`,
        );
    }
    if (
      !code ||
      !state ||
      typeof code !== "string" ||
      typeof state !== "string"
    ) {
      return res.status(400).send("Missing authorization code or state.");
    }
    let decoded;
    try {
      decoded = jwt.verify(state, JWT_SECRET);
    } catch {
      return res
        .status(400)
        .send("Invalid or expired sign-in state. Try again from the app.");
    }
    const returnUrl = decoded.returnUrl;
    if (
      !returnUrl ||
      typeof returnUrl !== "string" ||
      !isAllowedAppLinkedInReturnUrl(returnUrl)
    ) {
      return res.status(400).send("Invalid return URL in state.");
    }

    const user = await exchangeLinkedInAndUpsertUser(code, callbackUrl);
    const appJwt = signToken({ userId: user.id });
    const join = returnUrl.includes("?") ? "&" : "?";
    const dest = `${returnUrl}${join}ethos_token=${encodeURIComponent(appJwt)}`;
    res.redirect(302, dest);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).send(String(e.message));
    }
    next(e);
  }
});

router.post("/linkedin/exchange", async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body;
    if (
      !code ||
      typeof code !== "string" ||
      !redirectUri ||
      typeof redirectUri !== "string"
    ) {
      return res
        .status(400)
        .json({ message: "code and redirectUri are required" });
    }
    if (!isAllowedLinkedInRedirectUri(redirectUri.trim())) {
      return res.status(400).json({ message: "Invalid redirect URI" });
    }
    const user = await exchangeLinkedInAndUpsertUser(code, redirectUri.trim());
    const token = signToken({ userId: user.id });
    res.json({ token, user: toUserJson(user) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ message: String(e.message) });
    }
    next(e);
  }
});

module.exports = router;
