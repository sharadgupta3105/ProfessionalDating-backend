const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
  getActiveSubscription,
  subscriptionToJson,
  upsertSubscription,
  deactivateSubscriptions,
  planFromProductId,
  PLAN_DURATION_MS,
} = require('../utils/subscriptionUtils');

/** RevenueCat webhook — configure REVENUECAT_WEBHOOK_SECRET in EB env. */
router.post('/webhooks/revenuecat', async (req, res) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  }

  try {
    const event = req.body?.event;
    if (!event) return res.status(400).json({ message: 'Missing event' });

    const appUserId = event.app_user_id;
    const productId = event.product_id;
    const type = event.type;
    const expiresMs = event.expiration_at_ms ? Number(event.expiration_at_ms) : null;
    const plan = planFromProductId(productId);

    if (!appUserId) return res.json({ ok: true, skipped: true });

    const activeTypes = new Set([
      'INITIAL_PURCHASE',
      'RENEWAL',
      'UNCANCELLATION',
      'NON_RENEWING_PURCHASE',
      'PRODUCT_CHANGE',
    ]);
    const inactiveTypes = new Set(['EXPIRATION', 'CANCELLATION', 'BILLING_ISSUE']);

    if (activeTypes.has(type) && plan) {
      const expiresAt = expiresMs
        ? new Date(expiresMs).toISOString()
        : new Date(Date.now() + (PLAN_DURATION_MS[plan] || PLAN_DURATION_MS.month)).toISOString();

      await upsertSubscription({
        userId: String(appUserId),
        plan,
        productId,
        source: event.store || 'revenuecat',
        expiresAt,
        revenuecatId: event.id || null,
        isActive: true,
      });
    } else if (inactiveTypes.has(type)) {
      await deactivateSubscriptions(String(appUserId));
    }

    return res.json({ ok: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[subscriptions] webhook error', e?.message || e);
    return res.status(500).json({ message: 'Webhook handler failed' });
  }
});

router.use(authMiddleware);

router.get('/me', async (req, res, next) => {
  try {
    const row = await getActiveSubscription(req.userId);
    res.json(subscriptionToJson(row));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
