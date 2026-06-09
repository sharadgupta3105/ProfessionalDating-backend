const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { getOne, run, all } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
const { toUserJson } = require('../utils/userJson');
const { blockUser, isBlockedEitherWay } = require('../utils/blocks');
const { removeMatchAndChat, ensurePass } = require('../utils/matchCleanup');

const REPORT_REASONS = new Set([
  'Harassment',
  'Spam',
  'Fake profile',
  'Inappropriate content',
  'Other',
]);

router.use(authMiddleware);

router.get('/me', async (req, res, next) => {
  try {
    const row = await getOne('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!row) return res.status(404).json({ message: 'User not found' });
    res.json(toUserJson(row, { self: true }));
  } catch (e) {
    next(e);
  }
});

router.patch('/me', async (req, res, next) => {
  try {
    const allowed = [
      'name', 'age', 'profession', 'company', 'city', 'bio', 'education', 'linkedin_url', 'is_premium', 'onboarding_complete',
      'gender', 'industry', 'job_level', 'experience_years', 'latitude', 'longitude', 'photo_urls'
    ];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (req.body.interests !== undefined) updates.interests = JSON.stringify(req.body.interests);
    if (req.body.interested_in !== undefined) updates.interested_in = JSON.stringify(req.body.interested_in);
    if (req.body.photo_urls !== undefined && Array.isArray(req.body.photo_urls)) updates.photo_urls = JSON.stringify(req.body.photo_urls);
    const MAX_ABOUT_YOU = 16384;
    if (req.body.about_you !== undefined) {
      if (req.body.about_you === null) {
        updates.about_you_json = null;
      } else if (typeof req.body.about_you === 'object' && !Array.isArray(req.body.about_you)) {
        const raw = JSON.stringify(req.body.about_you);
        if (raw.length > MAX_ABOUT_YOU) {
          return res.status(400).json({ message: 'about_you payload too large' });
        }
        updates.about_you_json = raw;
      }
    }
    const MAX_DATING_PREFS = 8192;
    if (req.body.dating_prefs !== undefined) {
      if (req.body.dating_prefs === null) {
        updates.dating_prefs_json = null;
      } else if (typeof req.body.dating_prefs === 'object' && !Array.isArray(req.body.dating_prefs)) {
        const raw = JSON.stringify(req.body.dating_prefs);
        if (raw.length > MAX_DATING_PREFS) {
          return res.status(400).json({ message: 'dating_prefs payload too large' });
        }
        updates.dating_prefs_json = raw;
      }
    }
    if (updates.linkedin_url !== undefined) {
      updates.linkedin_verified = 0;
    }
    if (updates.onboarding_complete === true) updates.onboarding_complete = 1;
    if (updates.onboarding_complete === false) updates.onboarding_complete = 0;
    if (Object.keys(updates).length === 0) {
      const row = await getOne('SELECT * FROM users WHERE id = ?', [req.userId]);
      return res.json(toUserJson(row, { self: true }));
    }
    if (updates.age !== undefined && updates.age !== null) {
      const a = Number(updates.age);
      if (!Number.isFinite(a) || a < 18 || a > 120) {
        return res.status(400).json({ message: 'Age must be between 18 and 120' });
      }
      updates.age = Math.round(a);
    }
    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.userId];
    await run(`UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`, values);
    const row = await getOne('SELECT * FROM users WHERE id = ?', [req.userId]);
    res.json(toUserJson(row, { self: true }));
  } catch (e) {
    next(e);
  }
});

router.post('/me/push-token', async (req, res, next) => {
  try {
    const { token } = req.body ?? {};
    if (token != null && typeof token !== 'string') {
      return res.status(400).json({ message: 'token must be a string or null' });
    }
    const value = token && String(token).trim() ? String(token).trim() : null;
    if (value) {
      await run(
        "UPDATE users SET expo_push_token = ?, expo_push_token_saved_at = NOW(), updated_at = NOW() WHERE id = ?",
        [value, req.userId],
      );
    } else {
      await run(
        "UPDATE users SET expo_push_token = NULL, expo_push_token_saved_at = NULL, updated_at = NOW() WHERE id = ?",
        [req.userId],
      );
    }
    const row = await getOne('SELECT expo_push_token, expo_push_token_saved_at FROM users WHERE id = ?', [req.userId]);
    res.json({
      ok: true,
      expo_push_token: row?.expo_push_token ?? null,
      expo_push_token_saved_at: row?.expo_push_token_saved_at ?? null,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/me/app-presence', async (req, res, next) => {
  try {
    const { foreground } = req.body ?? {};
    if (typeof foreground !== 'boolean') {
      return res.status(400).json({ message: 'foreground (boolean) required' });
    }
    const iso = new Date().toISOString();
    await run(
      "UPDATE users SET app_in_foreground = ?, app_presence_updated_at = ?, updated_at = NOW() WHERE id = ?",
      [foreground ? 1 : 0, iso, req.userId],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/me/photo', async (req, res, next) => {
  try {
    let url = req.body?.photo_url ?? req.body?.url ?? req.body?.imageUrl;
    const base64 = req.body?.photo_base64;
    if (base64 && typeof base64 === 'string') {
      const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
      const ext = match ? (match[1] === 'jpeg' ? 'jpg' : match[1]) : 'jpg';
      const data = Buffer.from(match ? match[2] : base64, 'base64');
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const filename = `${req.userId}_${Date.now()}.${ext}`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, data);
      const base = process.env.API_BASE_URL || `${req.protocol || 'http'}://${req.get('host')}`;
      url = `${base}/uploads/${filename}`;
    }
    await run("UPDATE users SET photo_url = ?, updated_at = NOW() WHERE id = ?", [url || null, req.userId]);
    const row = await getOne('SELECT * FROM users WHERE id = ?', [req.userId]);
    res.json(toUserJson(row, { self: true }));
  } catch (e) {
    next(e);
  }
});

router.post('/me/photos', async (req, res, next) => {
  try {
    const list = Array.isArray(req.body?.photos) ? req.body.photos : [];
    const base = process.env.API_BASE_URL || `${req.protocol || 'http'}://${req.get('host')}`;
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const urls = [];
    for (let i = 0; i < Math.min(4, list.length); i++) {
      const base64 = list[i];
      if (typeof base64 !== 'string') continue;
      const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
      const ext = match ? (match[1] === 'jpeg' ? 'jpg' : match[1]) : 'jpg';
      const data = Buffer.from(match ? match[2] : base64, 'base64');
      const filename = `${req.userId}_${Date.now()}_${i}.${ext}`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, data);
      urls.push(`${base}/uploads/${filename}`);
    }
    const photoUrlsJson = JSON.stringify(urls);
    await run("UPDATE users SET photo_urls = ?, photo_url = ?, updated_at = NOW() WHERE id = ?", [
      photoUrlsJson,
      urls[0] || null,
      req.userId,
    ]);
    const row = await getOne('SELECT * FROM users WHERE id = ?', [req.userId]);
    res.json(toUserJson(row, { self: true }));
  } catch (e) {
    next(e);
  }
});

router.put('/me/photos', async (req, res, next) => {
  try {
    const list = Array.isArray(req.body?.photos) ? req.body.photos : [];
    const row = await getOne('SELECT * FROM users WHERE id = ?', [req.userId]);
    let existingUrls = [];
    try {
      const parsed = row?.photo_urls ? JSON.parse(row.photo_urls) : [];
      existingUrls = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      existingUrls = row?.photo_url ? [row.photo_url] : [];
    }

    const base = process.env.API_BASE_URL || `${req.protocol || 'http'}://${req.get('host')}`;
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const urls = [];
    for (let i = 0; i < 4; i++) {
      const item = list[i];
      if (item == null) {
        if (existingUrls[i]) urls.push(existingUrls[i]);
        continue;
      }
      if (typeof item === 'object' && item.url && typeof item.url === 'string') {
        urls.push(item.url);
        continue;
      }
      const b64 = item?.base64;
      if (typeof b64 === 'string') {
        const match = b64.match(/^data:image\/(\w+);base64,(.+)$/);
        const ext = match ? (match[1] === 'jpeg' ? 'jpg' : match[1]) : 'jpg';
        const data = Buffer.from(match ? match[2] : b64, 'base64');
        const filename = `${req.userId}_${Date.now()}_${i}.${ext}`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, data);
        urls.push(`${base}/uploads/${filename}`);
        continue;
      }
      if (existingUrls[i]) urls.push(existingUrls[i]);
    }
    const photoUrlsJson = JSON.stringify(urls);
    await run("UPDATE users SET photo_urls = ?, photo_url = ?, updated_at = NOW() WHERE id = ?", [
      photoUrlsJson,
      urls[0] || null,
      req.userId,
    ]);
    const out = await getOne('SELECT * FROM users WHERE id = ?', [req.userId]);
    res.json(toUserJson(out, { self: true }));
  } catch (e) {
    next(e);
  }
});

router.delete('/me', async (req, res, next) => {
  try {
    const id = req.userId;
    const convRows = await all(
      'SELECT id FROM conversations WHERE user_id_1 = ? OR user_id_2 = ?',
      [id, id],
    );
    for (const c of convRows) {
      await run('DELETE FROM messages WHERE conversation_id = ?', [c.id]);
      await run('DELETE FROM conversation_reads WHERE conversation_id = ?', [c.id]);
    }
    await run('DELETE FROM conversations WHERE user_id_1 = ? OR user_id_2 = ?', [id, id]);
    await run('DELETE FROM matches WHERE user_id_1 = ? OR user_id_2 = ?', [id, id]);
    await run('DELETE FROM likes WHERE user_id = ? OR target_user_id = ?', [id, id]);
    await run('DELETE FROM passes WHERE user_id = ? OR target_user_id = ?', [id, id]);
    await run('DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?', [id, id]);
    await run('DELETE FROM user_reports WHERE reporter_id = ? OR reported_id = ?', [id, id]);
    const user = await getOne('SELECT email FROM users WHERE id = ?', [id]);
    if (user?.email) {
      await run('DELETE FROM otp_codes WHERE email = ?', [user.email]);
    }
    await run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ ok: true, message: 'Account deleted' });
  } catch (e) {
    next(e);
  }
});

// POST /users/:userId/block — block user, remove match/chat, hide from discover
router.post('/:userId/block', async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (targetUserId === req.userId) return res.status(400).json({ message: 'Cannot block yourself' });

    const other = await getOne('SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (!other) return res.status(404).json({ message: 'User not found' });

    await blockUser(req.userId, targetUserId);
    await removeMatchAndChat(req.userId, targetUserId);
    await ensurePass(req.userId, targetUserId);

    res.json({ success: true, blocked: true });
  } catch (e) {
    next(e);
  }
});

// POST /users/:userId/report — report user (optional details)
router.post('/:userId/report', async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (targetUserId === req.userId) return res.status(400).json({ message: 'Cannot report yourself' });

    const other = await getOne('SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (!other) return res.status(404).json({ message: 'User not found' });

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!REPORT_REASONS.has(reason)) {
      return res.status(400).json({ message: 'Invalid report reason' });
    }

    let details = req.body?.details;
    if (details != null && typeof details !== 'string') {
      return res.status(400).json({ message: 'details must be a string' });
    }
    details = details ? String(details).trim().slice(0, 2000) : null;

    await run(
      'INSERT INTO user_reports (reporter_id, reported_id, reason, details) VALUES (?, ?, ?, ?)',
      [req.userId, targetUserId, reason, details],
    );

    res.status(201).json({ success: true, reported: true });
  } catch (e) {
    next(e);
  }
});

router.get('/:userId', async (req, res, next) => {
  try {
    const row = await getOne('SELECT * FROM users WHERE id = ?', [req.params.userId]);
    if (!row) return res.status(404).json({ message: 'User not found' });
    if (await isBlockedEitherWay(req.userId, req.params.userId)) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(toUserJson(row));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
