/** Skip remote push only when presence pings are fresh (heartbeat is ~25s). */
const MAX_PRESENCE_AGE_MS = 35_000;

function recipientLikelyInForeground(row) {
  if (!row || Number(row.app_in_foreground) !== 1) return false;
  const raw = row.app_presence_updated_at;
  if (!raw || typeof raw !== 'string') return false;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return false;
  const age = Date.now() - t;
  return age >= 0 && age < MAX_PRESENCE_AGE_MS;
}

/**
 * Skip remote push only when the recipient is actively in-app with a live socket.
 * Explicit background or stale presence must never block push (e.g. after force-quit).
 */
function shouldSkipRemotePush(recipientRow, recipientId, isSocketConnected) {
  if (recipientRow && Number(recipientRow.app_in_foreground) === 0) return false;
  if (!isSocketConnected(recipientId)) return false;
  return recipientLikelyInForeground(recipientRow);
}

module.exports = {
  recipientLikelyInForeground,
  shouldSkipRemotePush,
  MAX_PRESENCE_AGE_MS,
};
