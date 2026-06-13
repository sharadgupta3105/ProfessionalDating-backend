const { APP_TIMEZONE } = require('../config/region');

const MAX_DAILY_SWIPES = 10;

function escapeTz(tz) {
  return String(tz || 'UTC').replace(/'/g, "''");
}

/**
 * Next midnight in APP_TIMEZONE (when daily swipe counts reset).
 * Stable across API calls — not "now + 24h".
 */
async function getDailyResetAt(getOne) {
  const tz = escapeTz(APP_TIMEZONE);
  const row = await getOne(
    `SELECT (
      (((NOW() AT TIME ZONE '${tz}')::date + interval '1 day')::timestamp) AT TIME ZONE '${tz}'
    ) AS reset_at`,
    [],
  );
  if (row?.reset_at) {
    return new Date(row.reset_at).toISOString();
  }
  const fallback = new Date();
  fallback.setUTCHours(24, 0, 0, 0);
  return fallback.toISOString();
}

/** Count likes + passes for the current calendar day in APP_TIMEZONE. */
async function checkDailySwipeLimit(userId, getOne) {
  const tz = escapeTz(APP_TIMEZONE);
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
  const resetAt = await getDailyResetAt(getOne);
  return { total, remaining, resetAt, maxDaily: MAX_DAILY_SWIPES };
}

module.exports = {
  MAX_DAILY_SWIPES,
  getDailyResetAt,
  checkDailySwipeLimit,
};
