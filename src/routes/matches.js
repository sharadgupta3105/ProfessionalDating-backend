const express = require('express');
const router = express.Router();
const { getOne, all, run, query } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
const { toUserJson } = require('../utils/userJson');
const { APP_TIMEZONE } = require('../config/region');
const { getBlockedUserIds, isBlockedEitherWay } = require('../utils/blocks');
const { removeMatchAndChat, ensurePass } = require('../utils/matchCleanup');

router.use(authMiddleware);

const MAX_DAILY_SWIPES = 10;

/** Same calendar day in app timezone (India: Asia/Kolkata). */
async function checkDailySwipeLimit(userId) {
  const tz = APP_TIMEZONE.replace(/'/g, "''");
  const likeRow = await getOne(
    `SELECT COUNT(*)::int AS c FROM likes WHERE user_id = ? AND (created_at AT TIME ZONE '${tz}')::date = (NOW() AT TIME ZONE '${tz}')::date`,
    [userId],
  );
  const passRow = await getOne(
    `SELECT COUNT(*)::int AS c FROM passes WHERE user_id = ? AND (created_at AT TIME ZONE '${tz}')::date = (NOW() AT TIME ZONE '${tz}')::date`,
    [userId],
  );
  const likeCount = Number(likeRow?.c ?? 0);
  const passCount = Number(passRow?.c ?? 0);
  const total = likeCount + passCount;
  const remaining = Math.max(0, MAX_DAILY_SWIPES - total);
  const resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return { total, remaining, resetAt };
}

// Map "interested in" labels to DB gender values
const INTERESTED_TO_GENDER = {
  Men: 'Male',
  Women: 'Female',
  'Non-binary': 'Non-binary',
  Everyone: null, // no filter
};

// Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function hashString(input) {
  const s = String(input ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0; // 32-bit
  }
  return Math.abs(h);
}

function parseAboutYouJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch (_) {
    return null;
  }
}

function splitCommaList(q) {
  if (typeof q !== 'string' || !q.trim()) return [];
  return q
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Viewer wants `pref`; candidate self value `selfVal`. "Any" = no preference. */
function lifestyleMatchScore(pref, selfVal, weight) {
  if (!pref || pref === 'Any' || !weight) return 0;
  if (!selfVal || selfVal === 'Any') return 0;
  return String(pref) === String(selfVal) ? weight : 0;
}

function overlapRatio(viewerList, candidateList) {
  if (!Array.isArray(viewerList) || viewerList.length === 0) return null;
  if (!Array.isArray(candidateList) || candidateList.length === 0) return 0;
  const setC = new Set(candidateList);
  let hit = 0;
  for (const x of viewerList) {
    if (setC.has(x)) hit += 1;
  }
  return hit / viewerList.length;
}

// GET /matches/recommendations - users not yet liked/passed, filtered by onboarding "interested_in"
// plus optional query params from Dating Preferences.
router.get('/recommendations', async (req, res, next) => {
  try {
    const limit = await checkDailySwipeLimit(req.userId);
    if (limit.remaining <= 0) {
      return res
        .status(429)
        .json({ message: 'Daily swipe limit reached', limitReached: true, resetAt: limit.resetAt });
    }
    const me = await getOne(
      'SELECT interested_in, latitude, longitude, profession FROM users WHERE id = ?',
      [req.userId],
    );
    const liked = await all('SELECT target_user_id FROM likes WHERE user_id = ?', [req.userId]);
    const passed = await all('SELECT target_user_id FROM passes WHERE user_id = ?', [req.userId]);
    const blocked = await getBlockedUserIds(req.userId);
    const exclude = new Set([
      req.userId,
      ...liked.map((r) => r.target_user_id),
      ...passed.map((r) => r.target_user_id),
      ...blocked,
    ]);
    let rows = await all('SELECT * FROM users WHERE id != ?', [req.userId]);
    rows = rows.filter((r) => !exclude.has(r.id));

    let interestedIn = [];
    if (me?.interested_in) {
      try {
        interestedIn = typeof me.interested_in === 'string' ? JSON.parse(me.interested_in) : me.interested_in;
      } catch (_) {}
    }
    // Optional query-based filters coming from the Preferences screen
    const rawMaxDistanceKm = req.query.maxDistance != null ? Number(req.query.maxDistance) : null;
    // 100 means "worldwide" (no distance cap), like Bumble max distance behavior.
    const hasDistanceParam = rawMaxDistanceKm != null && Number.isFinite(rawMaxDistanceKm);
    const maxDistanceKm = hasDistanceParam ? Math.max(0, rawMaxDistanceKm) : null;
    const worldwideDistance = maxDistanceKm != null && maxDistanceKm >= 100;
    const distanceCapKm = worldwideDistance ? null : maxDistanceKm;
    const rawAgeMin = req.query.ageMin != null ? Number(req.query.ageMin) : null;
    const rawAgeMax = req.query.ageMax != null ? Number(req.query.ageMax) : null;
    const hasAgeMin = rawAgeMin != null && Number.isFinite(rawAgeMin);
    const hasAgeMax = rawAgeMax != null && Number.isFinite(rawAgeMax);
    const normalizedAgeMin = hasAgeMin && hasAgeMax ? Math.min(rawAgeMin, rawAgeMax) : null;
    const normalizedAgeMax = hasAgeMin && hasAgeMax ? Math.max(rawAgeMin, rawAgeMax) : null;
    // Preferences semantics:
    // - 0 means no minimum age from prefs (platform still excludes under-18 when age is known)
    // - 60 means 60+ (no upper cap)
    const ageMin =
      normalizedAgeMin != null && normalizedAgeMin > 0 ? Math.max(18, normalizedAgeMin) : null;
    const ageMax = normalizedAgeMax != null && normalizedAgeMax < 60 ? normalizedAgeMax : null;
    const showMe = typeof req.query.showMe === 'string' ? req.query.showMe : null; // 'Women' | 'Men' | 'Everyone'
    const educationPreference = typeof req.query.educationPreference === 'string' ? req.query.educationPreference : null;
    const industryPreference = typeof req.query.industry === 'string' ? req.query.industry : null;

    const professionPreferences =
      typeof req.query.professionPreferences === 'string' && req.query.professionPreferences.trim().length
        ? req.query.professionPreferences.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    const relationshipGoalsViewer = splitCommaList(req.query.relationshipGoals);
    const drinkingPref = typeof req.query.drinking === 'string' ? req.query.drinking : null;
    const smokingPref = typeof req.query.smoking === 'string' ? req.query.smoking : null;
    const workoutPref = typeof req.query.workoutFrequency === 'string' ? req.query.workoutFrequency : null;
    const topInterestsViewer = splitCommaList(req.query.topInterests);
    const wantSameProfession =
      req.query.sameProfessionPreference === 'true' || req.query.sameProfessionPreference === true;

    const SHOWME_TO_GENDER = {
      Women: 'Female',
      Men: 'Male',
      Everyone: null,
    };

    const allowedFromInterestedIn = (() => {
      const allowAll = !interestedIn.length || (Array.isArray(interestedIn) && interestedIn.includes('Everyone'));
      if (allowAll) return null; // no filter
      const allowed = new Set(interestedIn.map((label) => INTERESTED_TO_GENDER[label]).filter(Boolean));
      return allowed.size ? allowed : new Set();
    })();

    const allowedFromShowMe = (() => {
      if (!showMe || showMe === 'Everyone') return null;
      const g = SHOWME_TO_GENDER[showMe];
      if (!g) return null;
      return new Set([g]);
    })();

    const allowedGenders = (() => {
      if (allowedFromInterestedIn === null && allowedFromShowMe === null) return null; // no filter
      if (allowedFromInterestedIn === null) return allowedFromShowMe;
      if (allowedFromShowMe === null) return allowedFromInterestedIn;
      // Intersect
      const intersect = new Set();
      for (const g of allowedFromInterestedIn) {
        if (allowedFromShowMe.has(g)) intersect.add(g);
      }
      return intersect;
    })();

    if (allowedGenders && allowedGenders.size > 0) {
      rows = rows.filter((r) => r.gender && allowedGenders.has(r.gender));
    } else if (allowedGenders && allowedGenders.size === 0) {
      // User preferences conflict and leave no genders
      rows = [];
    }

    const myLat = me?.latitude != null ? Number(me.latitude) : null;
    const myLon = me?.longitude != null ? Number(me.longitude) : null;
    if (distanceCapKm != null && myLat != null && myLon != null) {
      rows = rows.filter((r) => {
        const lat = r.latitude != null ? Number(r.latitude) : null;
        const lon = r.longitude != null ? Number(r.longitude) : null;
        if (lat == null || lon == null) return true;
        return haversineKm(myLat, myLon, lat, lon) <= distanceCapKm;
      });
    }

    rows = rows.filter((r) => {
      if (r.age == null) return true;
      const age = Number(r.age);
      if (!Number.isFinite(age)) return true;
      if (age < 18) return false;
      return true;
    });

    if (ageMin != null || ageMax != null) {
      rows = rows.filter((r) => {
        if (r.age == null) return false;
        const age = Number(r.age);
        if (!Number.isFinite(age)) return false;
        if (ageMin != null && age < ageMin) return false;
        if (ageMax != null && age > ageMax) return false;
        return true;
      });
    }

    const inferEducationLevel = (edu) => {
      const e = String(edu || '').toLowerCase();
      if (!e.trim()) return null;
      if (e.includes('phd') || e.includes('doctorate')) return 'PhD';
      const isMasters =
        e.includes('ms') ||
        e.includes('m.s') ||
        e.includes('m.sc') ||
        e.includes('msc') ||
        e.includes('mtech') ||
        e.includes('m.tech') ||
        e.includes('mba') ||
        e.includes('ma ') ||
        e.includes('m.a ') ||
        e.includes('masters') ||
        e.includes('mfa');
      if (isMasters) return 'Masters';

      // If it's not masters/phd and looks like an undergraduate degree, treat as Graduate.
      const isBachelors =
        e.includes('b.tech') ||
        e.includes('bsc') ||
        e.includes('bs ') ||
        e.includes('ba ') ||
        e.includes('b.a') ||
        e.includes('bfa') ||
        e.includes('b.eng') ||
        e.includes('bachelor');
      if (isBachelors) return 'Graduate';

      return 'Graduate';
    };

    if (educationPreference && educationPreference !== 'Any') {
      // Education is handled as a SCORE preference (not a hard filter).
    }

    // Soft scoring weights — higher = more influence on ordering (not normalized to 100).
    const wGender = 22;
    const wDistance = 22;
    const wAge = 18;
    const wProfession = 14;
    const wEducation = 9;
    const wIndustry = 5;
    const wRelationshipGoals = 12;
    const wDrinking = 8;
    const wSmoking = 8;
    const wWorkout = 8;
    const wTopInterests = 10;
    const wSameProfession = 10;

    const ageRangeSize =
      ageMax != null && ageMin != null ? Math.max(1, Math.abs(Number(ageMax) - Number(ageMin))) : null;

    const scored = rows.map((r) => {
      let score = 0;
      const candAbout = parseAboutYouJson(r.about_you_json);

      // Gender match (mostly redundant because we filter by allowedGenders already, but keep for scoring clarity)
      if (allowedGenders && allowedGenders.size > 0) {
        if (r.gender && allowedGenders.has(r.gender)) score += wGender;
      }

      // Distance preference as closeness to your location within your maxDistance
      if (distanceCapKm != null && distanceCapKm > 0 && myLat != null && myLon != null) {
        const lat = r.latitude != null ? Number(r.latitude) : null;
        const lon = r.longitude != null ? Number(r.longitude) : null;
        if (lat != null && lon != null) {
          const dist = haversineKm(myLat, myLon, lat, lon);
          const norm = Math.max(0, Math.min(1, dist / distanceCapKm));
          score += wDistance * (1 - norm);
        } else {
          // Candidate has no coords; keep them but slightly lower than located candidates.
          score -= 3;
        }
      }

      // Age preference: closeness to the center of your requested age band
      if (ageMin != null && ageMax != null && ageRangeSize != null && r.age != null) {
        const mid = (ageMin + ageMax) / 2;
        const d = Math.abs(Number(r.age) - mid);
        const norm = Math.max(0, Math.min(1, d / (ageRangeSize / 2)));
        score += wAge * (1 - norm);
      }

      // Profession preference: exact match highest, includes next
      if (Array.isArray(professionPreferences) && professionPreferences.length > 0 && r.profession) {
        const cand = String(r.profession).toLowerCase();
        let best = 0;
        for (const p of professionPreferences) {
          const want = String(p).toLowerCase();
          if (!want) continue;
          if (cand === want) best = Math.max(best, 1);
          else if (cand.includes(want)) best = Math.max(best, 0.75);
        }
        score += wProfession * best;
      }

      // Education preference: exact inferred level match
      if (educationPreference && educationPreference !== 'Any') {
        const level = inferEducationLevel(r.education);
        if (level) {
          if (educationPreference === level) score += wEducation;
        }
      }

      // Industry preference (from About You): strict match on users.industry
      if (industryPreference && r.industry) {
        if (String(r.industry).toLowerCase() === String(industryPreference).toLowerCase()) {
          score += wIndustry;
        }
      }

      // Relationship goals: overlap between viewer's dating prefs and candidate's self-stated goals (about_you)
      const relRatio = overlapRatio(relationshipGoalsViewer, candAbout?.relationship_goals_self);
      if (relRatio != null) score += wRelationshipGoals * relRatio;

      score += lifestyleMatchScore(drinkingPref, candAbout?.drinking_self, wDrinking);
      score += lifestyleMatchScore(smokingPref, candAbout?.smoking_self, wSmoking);
      score += lifestyleMatchScore(workoutPref, candAbout?.workout_self, wWorkout);

      // Shared interests: overlap viewer topInterests with candidate about_you.topInterests
      const intRatio = overlapRatio(topInterestsViewer, candAbout?.topInterests);
      if (intRatio != null) score += wTopInterests * intRatio;

      // Same profession (viewer About-you answer): boost exact profession match with candidate
      if (wantSameProfession && me?.profession && r.profession) {
        if (String(me.profession).toLowerCase().trim() === String(r.profession).toLowerCase().trim()) {
          score += wSameProfession;
        }
      }

      // Tiny deterministic jitter for Tinder-like variety on equal scores.
      const jitter = (hashString(r.id) % 1000) / 1000 * 1.5;
      return { r, score: score + jitter };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-breaker: recently created users first
      const da = a.r.created_at ? new Date(a.r.created_at).getTime() : 0;
      const db2 = b.r.created_at ? new Date(b.r.created_at).getTime() : 0;
      return db2 - da;
    });

    const top = scored.slice(0, 30);

    res.json(
      top.map(({ r, score }) => {
        const user = toUserJson(r);
        let distanceKm = null;
        if (myLat != null && myLon != null) {
          const lat = r.latitude != null ? Number(r.latitude) : null;
          const lon = r.longitude != null ? Number(r.longitude) : null;
          if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
            distanceKm = Math.round(haversineKm(myLat, myLon, lat, lon));
          }
        }
        return { ...user, matchScore: score, distance_km: distanceKm };
      }),
    );
  } catch (e) {
    next(e);
  }
});

// GET /matches/swipe-limit-status - current user's daily swipe usage + block status
router.get('/swipe-limit-status', async (req, res, next) => {
  try {
    const limit = await checkDailySwipeLimit(req.userId);
    res.json({
      total: limit.total,
      remaining: limit.remaining,
      limitReached: limit.remaining <= 0,
      resetAt: limit.resetAt,
    });
  } catch (e) {
    next(e);
  }
});

// POST /matches/clear-passes - clear all passes for current user so they can see those profiles again (e.g. "Find more people")
router.post('/clear-passes', async (req, res, next) => {
  try {
    await run('DELETE FROM passes WHERE user_id = ?', [req.userId]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// POST /matches/like - like a user; if mutual, create match and conversation
router.post('/like', async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ message: 'userId required' });
    if (targetUserId === req.userId) return res.status(400).json({ message: 'Cannot like yourself' });
    if (await isBlockedEitherWay(req.userId, targetUserId)) {
      return res.status(403).json({ message: 'Cannot interact with this user' });
    }

    const limit = await checkDailySwipeLimit(req.userId);
    if (limit.remaining <= 0) {
      return res
        .status(429)
        .json({ message: 'Daily swipe limit reached', limitReached: true, resetAt: limit.resetAt });
    }

    await run(
      'INSERT INTO likes (user_id, target_user_id, type) VALUES (?, ?, ?) ON CONFLICT (user_id, target_user_id) DO NOTHING',
      [req.userId, targetUserId, 'like'],
    );

    const mutual = await getOne('SELECT 1 AS x FROM likes WHERE user_id = ? AND target_user_id = ?', [
      targetUserId,
      req.userId,
    ]);
    let isMatch = false;
    if (mutual) {
      const u1 = req.userId < targetUserId ? req.userId : targetUserId;
      const u2 = req.userId < targetUserId ? targetUserId : req.userId;
      const insMatch = await query(
        'INSERT INTO matches (user_id_1, user_id_2) VALUES (?, ?) ON CONFLICT (user_id_1, user_id_2) DO NOTHING RETURNING id',
        [u1, u2],
      );
      const convId = `conv_${u1}_${u2}`;
      await run(
        'INSERT INTO conversations (id, user_id_1, user_id_2) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING',
        [convId, u1, u2],
      );
      isMatch = true;
      if (insMatch.rowCount > 0) {
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${targetUserId}`).emit('match:new', { fromUserId: req.userId });
        }
      }
    }
    res.json({ success: true, isMatch });
  } catch (e) {
    next(e);
  }
});

// POST /matches/pass
router.post('/pass', async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ message: 'userId required' });
    const limit = await checkDailySwipeLimit(req.userId);
    if (limit.remaining <= 0) {
      return res
        .status(429)
        .json({ message: 'Daily swipe limit reached', limitReached: true, resetAt: limit.resetAt });
    }

    await run(
      'INSERT INTO passes (user_id, target_user_id) VALUES (?, ?) ON CONFLICT (user_id, target_user_id) DO NOTHING',
      [req.userId, targetUserId],
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// POST /matches/super-like
router.post('/super-like', async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ message: 'userId required' });
    if (targetUserId === req.userId) return res.status(400).json({ message: 'Cannot super-like yourself' });
    if (await isBlockedEitherWay(req.userId, targetUserId)) {
      return res.status(403).json({ message: 'Cannot interact with this user' });
    }

    const limit = await checkDailySwipeLimit(req.userId);
    if (limit.remaining <= 0) {
      return res
        .status(429)
        .json({ message: 'Daily swipe limit reached', limitReached: true, resetAt: limit.resetAt });
    }

    await run(
      `INSERT INTO likes (user_id, target_user_id, type) VALUES (?, ?, ?)
       ON CONFLICT (user_id, target_user_id) DO UPDATE SET type = EXCLUDED.type, created_at = NOW()`,
      [req.userId, targetUserId, 'super_like'],
    );

    const mutual = await getOne('SELECT 1 AS x FROM likes WHERE user_id = ? AND target_user_id = ?', [
      targetUserId,
      req.userId,
    ]);
    let isMatch = false;
    if (mutual) {
      const u1 = req.userId < targetUserId ? req.userId : targetUserId;
      const u2 = req.userId < targetUserId ? targetUserId : req.userId;
      const insMatch = await query(
        'INSERT INTO matches (user_id_1, user_id_2) VALUES (?, ?) ON CONFLICT (user_id_1, user_id_2) DO NOTHING RETURNING id',
        [u1, u2],
      );
      const convId = `conv_${u1}_${u2}`;
      await run(
        'INSERT INTO conversations (id, user_id_1, user_id_2) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING',
        [convId, u1, u2],
      );
      isMatch = true;
      if (insMatch.rowCount > 0) {
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${targetUserId}`).emit('match:new', { fromUserId: req.userId });
        }
      }
    }
    res.json({ success: true, isMatch });
  } catch (e) {
    next(e);
  }
});

// GET /matches - mutual matches
router.get('/', async (req, res, next) => {
  try {
    const blocked = await getBlockedUserIds(req.userId);
    const rows = await all(
      `
      SELECT u.* FROM users u
      INNER JOIN matches m ON (u.id = m.user_id_2 OR u.id = m.user_id_1)
      WHERE (m.user_id_1 = ? OR m.user_id_2 = ?) AND u.id != ?
      ORDER BY m.created_at DESC
    `,
      [req.userId, req.userId, req.userId],
    );
    res.json(rows.filter((r) => !blocked.has(r.id)).map(toUserJson));
  } catch (e) {
    next(e);
  }
});

// POST /matches/:targetUserId/unmatch — remove match + chat; hide from discover
router.post('/:targetUserId/unmatch', async (req, res, next) => {
  try {
    const targetUserId = req.params.targetUserId;
    if (!targetUserId) return res.status(400).json({ message: 'targetUserId required' });
    if (targetUserId === req.userId) return res.status(400).json({ message: 'Invalid user' });

    const other = await getOne('SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (!other) return res.status(404).json({ message: 'User not found' });

    await removeMatchAndChat(req.userId, targetUserId);
    await ensurePass(req.userId, targetUserId);

    res.json({ success: true, unmatch: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
