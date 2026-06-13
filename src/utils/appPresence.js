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

/** Skip push only when the app is actively open *and* still connected over Socket.io. */
function shouldSkipRemotePush(recipientRow, recipientId, isSocketConnected) {
  return recipientLikelyInForeground(recipientRow) && Boolean(isSocketConnected(recipientId));
}

module.exports = {
  recipientLikelyInForeground,
  shouldSkipRemotePush,
  MAX_PRESENCE_AGE_MS,
};
