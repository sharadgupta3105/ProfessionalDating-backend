/** Skip remote push if we believe the recipient has the app open (fresh presence ping). */
const MAX_PRESENCE_AGE_MS = 75_000;

function recipientLikelyInForeground(row) {
  if (!row || row.app_in_foreground !== 1) return false;
  const raw = row.app_presence_updated_at;
  if (!raw || typeof raw !== 'string') return false;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return false;
  const age = Date.now() - t;
  return age >= 0 && age < MAX_PRESENCE_AGE_MS;
}

module.exports = { recipientLikelyInForeground, MAX_PRESENCE_AGE_MS };
