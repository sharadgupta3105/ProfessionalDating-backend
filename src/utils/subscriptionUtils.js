const { getOne, run, all } = require('../db/connection');

const PLAN_DURATION_MS = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

function planFromProductId(productId) {
  if (!productId) return null;
  const id = String(productId);
  if (id.includes('day')) return 'day';
  if (id.includes('week')) return 'week';
  if (id.includes('month')) return 'month';
  if (id.includes('year')) return 'year';
  return null;
}

async function getActiveSubscription(userId, getOneFn = getOne) {
  const row = await getOneFn(
    `SELECT * FROM subscriptions
     WHERE user_id = ? AND is_active = 1 AND expires_at > NOW()
     ORDER BY expires_at DESC LIMIT 1`,
    [userId],
  );
  return row || null;
}

async function hasUnlimitedSwipes(userId, getOneFn = getOne) {
  const sub = await getActiveSubscription(userId, getOneFn);
  return !!sub;
}

async function upsertSubscription({
  userId,
  plan,
  productId,
  source,
  expiresAt,
  revenuecatId,
  isActive = true,
}) {
  await run(
    `UPDATE subscriptions SET is_active = 0, updated_at = NOW() WHERE user_id = ? AND is_active = 1`,
    [userId],
  );

  await run(
    `INSERT INTO subscriptions (
      user_id, plan, product_id, source, started_at, expires_at, is_active, revenuecat_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, NOW(), NOW())`,
    [userId, plan, productId, source, expiresAt, isActive ? 1 : 0, revenuecatId || null],
  );

  if (isActive) {
    await run('UPDATE users SET is_premium = 1, updated_at = NOW() WHERE id = ?', [userId]);
  }
}

async function deactivateSubscriptions(userId) {
  await run(
    `UPDATE subscriptions SET is_active = 0, updated_at = NOW() WHERE user_id = ?`,
    [userId],
  );
  const active = await getActiveSubscription(userId);
  if (!active) {
    await run('UPDATE users SET is_premium = 0, updated_at = NOW() WHERE id = ?', [userId]);
  }
}

function subscriptionToJson(row) {
  if (!row) {
    return { active: false, plan: null, product_id: null, expires_at: null, unlimited: false };
  }
  return {
    active: true,
    plan: row.plan,
    product_id: row.product_id,
    expires_at: row.expires_at,
    unlimited: true,
    source: row.source,
  };
}

module.exports = {
  PLAN_DURATION_MS,
  planFromProductId,
  getActiveSubscription,
  hasUnlimitedSwipes,
  upsertSubscription,
  deactivateSubscriptions,
  subscriptionToJson,
};
