const { run } = require('../db/connection');

/** Remove mutual match row and all chat data between two users. */
async function removeMatchAndChat(userId, targetUserId) {
  const u1 = userId < targetUserId ? userId : targetUserId;
  const u2 = userId < targetUserId ? targetUserId : userId;
  const convId = `conv_${u1}_${u2}`;

  await run('DELETE FROM messages WHERE conversation_id = ?', [convId]);
  await run('DELETE FROM conversation_reads WHERE conversation_id = ?', [convId]);
  await run('DELETE FROM conversations WHERE id = ?', [convId]);
  await run('DELETE FROM matches WHERE user_id_1 = ? AND user_id_2 = ?', [u1, u2]);
}

/** Hide target from discover feed for this user. */
async function ensurePass(userId, targetUserId) {
  await run(
    'INSERT INTO passes (user_id, target_user_id) VALUES (?, ?) ON CONFLICT (user_id, target_user_id) DO NOTHING',
    [userId, targetUserId],
  );
}

module.exports = { removeMatchAndChat, ensurePass };
