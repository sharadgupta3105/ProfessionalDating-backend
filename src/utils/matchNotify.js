const { getOne, run } = require('../db/connection');
const { primaryPhotoUrl } = require('./userJson');
const { sendNewMatchPush } = require('./expoPush');
const { shouldSkipRemotePush } = require('./appPresence');
const { isUserSocketConnected } = require('../socket/chatSocket');

function primaryPhotoFromRow(row) {
  return primaryPhotoUrl(row) || '';
}

/**
 * Notify the user who liked first when the other person likes back (new mutual match).
 */
async function notifyUserOfNewMatch(req, matcherUserId, recipientUserId) {
  const matcher = await getOne('SELECT name, photo_url, photo_urls FROM users WHERE id = ?', [matcherUserId]);
  const recipient = await getOne(
    'SELECT expo_push_token, app_in_foreground, app_presence_updated_at FROM users WHERE id = ?',
    [recipientUserId],
  );

  const u1 = matcherUserId < recipientUserId ? matcherUserId : recipientUserId;
  const u2 = matcherUserId < recipientUserId ? recipientUserId : matcherUserId;
  const conversationId = `conv_${u1}_${u2}`;

  const payload = {
    fromUserId: String(matcherUserId),
    matchUserId: String(matcherUserId),
    matchName: matcher?.name || 'Someone',
    matchPhoto: primaryPhotoFromRow(matcher),
    conversationId,
  };

  const io = req.app.get('io');
  if (io) {
    io.to(`user:${recipientUserId}`).emit('match:new', payload);
  }

  const skipPush = shouldSkipRemotePush(recipient, recipientUserId, isUserSocketConnected);
  if (process.env.DEBUG_PUSH === '1' && skipPush) {
    console.log('[push] match skip: recipient app open with live socket', { recipientUserId });
  }

  if (!recipient?.expo_push_token || skipPush) return;

  setImmediate(() => {
    sendNewMatchPush({
      expoPushToken: recipient.expo_push_token,
      matcherName: payload.matchName,
      matchUserId: payload.matchUserId,
      matchPhoto: payload.matchPhoto,
      conversationId: payload.conversationId,
    })
      .then((resPush) => {
        if (process.env.DEBUG_PUSH === '1') {
          console.log('[push] match ticket ok', { toUser: recipientUserId, res: resPush });
        }
      })
      .catch(async (err) => {
        if (err?.expoPushError === 'DeviceNotRegistered') {
          try {
            await run('UPDATE users SET expo_push_token = NULL, updated_at = NOW() WHERE id = ?', [
              recipientUserId,
            ]);
          } catch (_) {
            /* ignore */
          }
        }
        if (process.env.DEBUG_PUSH === '1') {
          console.error(
            '[push] match failed',
            err?.message || err,
            err?.expoPushError || '',
            err?.details || err?.ticket || '',
          );
        }
      });
  });
}

module.exports = { notifyUserOfNewMatch };
