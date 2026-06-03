/**
 * Resolve URL param to stored conversation id: accepts conv_* or the other user's user id.
 */
const { getOne } = require('../db/connection');

async function resolveConversationId(currentUserId, chatId) {
  if (typeof chatId !== 'string' || !chatId.length) return null;
  if (chatId.startsWith('conv_')) return chatId;

  const u1 = currentUserId < chatId ? currentUserId : chatId;
  const u2 = currentUserId < chatId ? chatId : currentUserId;
  const id = `conv_${u1}_${u2}`;
  const conv = await getOne('SELECT id FROM conversations WHERE id = ?', [id]);
  return conv ? id : null;
}

module.exports = { resolveConversationId };
