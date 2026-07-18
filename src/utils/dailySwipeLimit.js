const MAX_DAILY_SWIPES = 10;
const LOCK_HOURS = 24;

function toLimitResult(row) {
  const total = Math.max(0, Number(row?.swipe_count ?? 0));
  const resetAt = row?.reset_at ? new Date(row.reset_at).toISOString() : null;
  return {
    total,
    remaining: Math.max(0, MAX_DAILY_SWIPES - total),
    resetAt,
    maxDaily: MAX_DAILY_SWIPES,
  };
}

/**
 * Return the current allowance. An expired lock starts a fresh allowance;
 * unlike the old calendar-day implementation, midnight has no effect.
 */
async function checkDailySwipeLimit(userId, getOne) {
  let row = await getOne(
    'SELECT swipe_count, reset_at FROM swipe_limit_states WHERE user_id = ?',
    [userId],
  );

  if (row?.reset_at && new Date(row.reset_at).getTime() <= Date.now()) {
    row = await getOne(
      `UPDATE swipe_limit_states
       SET swipe_count = 0, reset_at = NULL, updated_at = NOW()
       WHERE user_id = ?
       RETURNING swipe_count, reset_at`,
      [userId],
    );
  }

  return toLimitResult(row);
}

/**
 * Consume one successful swipe. The 24-hour lock is created exactly when
 * swipe_count reaches the allowance, and remains stable until it expires.
 */
async function recordSwipe(userId, getOne) {
  const row = await getOne(
    `INSERT INTO swipe_limit_states (user_id, swipe_count, reset_at, updated_at)
     VALUES (?, 1, NULL, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       swipe_count = CASE
         WHEN swipe_limit_states.reset_at IS NOT NULL
           AND swipe_limit_states.reset_at <= NOW() THEN 1
         ELSE LEAST(swipe_limit_states.swipe_count + 1, ?)
       END,
       reset_at = CASE
         WHEN swipe_limit_states.reset_at IS NOT NULL
           AND swipe_limit_states.reset_at > NOW()
           THEN swipe_limit_states.reset_at
         WHEN swipe_limit_states.reset_at IS NOT NULL
           AND swipe_limit_states.reset_at <= NOW()
           THEN NULL
         WHEN swipe_limit_states.swipe_count + 1 >= ?
           THEN NOW() + interval '${LOCK_HOURS} hours'
         ELSE NULL
       END,
       updated_at = NOW()
     RETURNING swipe_count, reset_at`,
    [userId, MAX_DAILY_SWIPES, MAX_DAILY_SWIPES],
  );
  return toLimitResult(row);
}

module.exports = {
  MAX_DAILY_SWIPES,
  checkDailySwipeLimit,
  recordSwipe,
};
