/**
 * Send a push via Expo Push API (Expo Go + dev/production builds using Expo push tokens).
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

  // Omit channelId: Android-only; if the channel is missing on device, Expo drops the notification.
  // Omitting uses the default FCM behavior. iOS ignores channelId anyway.
  const message = {
    to,
    sound: 'default',
    title: String(title || 'MatchedIn').slice(0, 120),
    body: String(body || '').slice(0, 200),
    data: data && typeof data === 'object' ? data : {},
    priority: 'high',
  };

  const headers = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

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

/**
 * Notify recipient of a new chat message (fire-and-forget friendly).
 */
function sendNewChatMessagePush({ expoPushToken, senderName, textPreview, conversationId, senderId }) {
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
    },
  });
}

module.exports = { sendExpoPush, sendNewChatMessagePush, isExpoPushToken };
