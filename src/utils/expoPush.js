/**
 * Send a push via Expo Push API (Expo Go + dev/production builds using Expo push tokens).
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

function pushHeaders() {
  const headers = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function extractTicketIds(json) {
  const raw = json?.data;
  const tickets = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  return tickets.filter((t) => t?.status === 'ok' && t?.id).map((t) => String(t.id));
}

function isExpoPushToken(s) {
  return typeof s === 'string' && s.startsWith('ExponentPushToken[');
}

/**
 * Expo returns HTTP 200 with per-message ticket errors — must inspect `data`.
 */
function assertPushTicketsOk(json) {
  const raw = json?.data;
  const tickets = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  for (const t of tickets) {
    if (t && t.status === 'error') {
      const err = new Error(t.message || 'Expo push ticket error');
      err.expoPushError = t.details?.error || 'UNKNOWN';
      err.ticket = t;
      throw err;
    }
  }
}

/**
 * @param {object} opts
 * @param {string} opts.to - ExponentPushToken[...]
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {Record<string, string>} [opts.data]
 */
async function sendExpoPush({ to, title, body, data }) {
  if (!isExpoPushToken(to)) return { skipped: true };

  const stringData = {};
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = value == null ? '' : String(value);
    }
  }

  const message = {
    to,
    sound: 'default',
    title: String(title || 'MatchedIn').slice(0, 120),
    body: String(body || '').slice(0, 200),
    data: stringData,
    priority: 'high',
    channelId: 'messages',
    android: {
      channelId: 'messages',
      priority: 'high',
      sound: 'default',
      vibrate: [0, 250, 250, 250],
      notification: {
        channelId: 'messages',
        sound: 'default',
        priority: 'max',
        defaultVibratePattern: true,
        visibility: 'public',
      },
    },
  };

  const headers = pushHeaders();

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify([message]),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.errors?.[0]?.message || json?.error || 'Expo push HTTP failed');
    err.details = json;
    err.status = res.status;
    throw err;
  }

  assertPushTicketsOk(json);
  return json;
}

/** Poll Expo for FCM/APNs delivery result (call a few seconds after send). */
async function getPushReceipts(ticketIds, { attempts = 4, delayMs = 1500 } = {}) {
  const ids = (Array.isArray(ticketIds) ? ticketIds : []).filter(Boolean);
  if (!ids.length) return { receipts: {}, errors: ['No ticket ids'] };

  const headers = pushHeaders();
  let lastJson = {};

  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    const res = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids }),
    });
    lastJson = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { receipts: {}, errors: [lastJson?.errors?.[0]?.message || 'Receipt HTTP failed'] };
    }
    const receipts = lastJson?.data && typeof lastJson.data === 'object' ? lastJson.data : {};
    const pending = ids.some((id) => !receipts[id]);
    if (!pending) {
      return { receipts };
    }
  }

  return { receipts: lastJson?.data || {}, pending: true };
}

function formatReceiptSummary(receipts) {
  const entries = Object.entries(receipts || {});
  if (!entries.length) return 'No delivery receipt yet';
  return entries
    .map(([id, r]) => `${id.slice(0, 8)}…: ${r?.status || 'unknown'}${r?.details?.error ? ` (${r.details.error})` : ''}`)
    .join('\n');
}

function receiptDeliveryHint(receipts) {
  const list = Object.values(receipts || {});
  for (const r of list) {
    if (!r || r.status === 'ok') continue;
    const code = r.details?.error || r.message || 'DELIVERY_ERROR';
    if (code === 'DeviceNotRegistered') {
      return 'Device token is stale. Rebuild the APK after FCM upload, reinstall, then Settings → Register again.';
    }
    if (code === 'InvalidCredentials' || /MismatchSenderId|FCM/i.test(String(r.message || ''))) {
      return 'FCM mismatch: rebuild the APK after uploading FCM to expo.dev, uninstall old app, reinstall, Register again.';
    }
    return `Push delivery failed: ${code}. ${r.message || ''}`.trim();
  }
  return null;
}

/**
 * Notify recipient of a new chat message (fire-and-forget friendly).
 */
function sendNewChatMessagePush({
  expoPushToken,
  senderName,
  textPreview,
  conversationId,
  senderId,
  senderImageUrl,
}) {
  if (!isExpoPushToken(expoPushToken)) return Promise.resolve({ skipped: true });
  const preview = (textPreview || '').replace(/\s+/g, ' ').trim();
  const body =
    preview.length > 100 ? `${preview.slice(0, 97)}…` : preview || 'Sent you a message';
  return sendExpoPush({
    to: expoPushToken,
    title: senderName || 'New message',
    body,
    data: {
      type: 'chat_message',
      conversationId: String(conversationId || ''),
      senderId: String(senderId || ''),
      senderName: String(senderName || ''),
      senderImageUrl: String(senderImageUrl || ''),
    },
  });
}

/**
 * Notify recipient of a new mutual match (fire-and-forget friendly).
 */
function sendNewMatchPush({ expoPushToken, matcherName, matchUserId, matchPhoto, conversationId }) {
  if (!isExpoPushToken(expoPushToken)) return Promise.resolve({ skipped: true });
  const name = (matcherName || 'Someone').trim() || 'Someone';
  return sendExpoPush({
    to: expoPushToken,
    title: "It's a match!",
    body: `You and ${name} liked each other. Say hello!`,
    data: {
      type: 'new_match',
      matchUserId: String(matchUserId || ''),
      matchName: name,
      matchPhoto: String(matchPhoto || ''),
      conversationId: String(conversationId || ''),
    },
  });
}

module.exports = {
  sendExpoPush,
  sendNewChatMessagePush,
  sendNewMatchPush,
  isExpoPushToken,
  getPushReceipts,
  extractTicketIds,
  receiptDeliveryHint,
  formatReceiptSummary,
};
