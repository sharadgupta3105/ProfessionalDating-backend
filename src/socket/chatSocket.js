const { verifyToken } = require('../middleware/auth');
const { getOne, run } = require('../db/connection');
const { resolveConversationId } = require('../utils/conversation');

/** userId → active Socket.io connection count (multi-device safe). */
const connectionCounts = new Map();

function incrementUserConnection(userId) {
  const key = String(userId);
  connectionCounts.set(key, (connectionCounts.get(key) || 0) + 1);
}

function decrementUserConnection(userId) {
  const key = String(userId);
  const next = (connectionCounts.get(key) || 0) - 1;
  if (next <= 0) connectionCounts.delete(key);
  else connectionCounts.set(key, next);
}

function isUserSocketConnected(userId) {
  return (connectionCounts.get(String(userId)) || 0) > 0;
}

/**
 * Realtime chat: clients join `conv:<id>` after JWT auth; REST POST also emits `message:new` here.
 */
function attachChatSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const decoded = verifyToken(typeof token === 'string' ? token : null);
    if (!decoded?.userId) {
      return next(new Error('Unauthorized'));
    }
    socket.data.userId = decoded.userId;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    incrementUserConnection(userId);
    socket.on('disconnect', () => {
      decrementUserConnection(userId);
      if (!isUserSocketConnected(userId)) {
        const iso = new Date().toISOString();
        run(
          'UPDATE users SET app_in_foreground = 0, app_presence_updated_at = ?, updated_at = NOW() WHERE id = ?',
          [iso, userId],
        ).catch(() => {});
      }
    });
    socket.join(`user:${userId}`);

    socket.on('join_conversation', async (chatId, ack) => {
      try {
        if (typeof chatId !== 'string' || !chatId.length) {
          ack?.({ ok: false, error: 'chatId required' });
          return;
        }
        const convId = await resolveConversationId(userId, chatId);
        if (!convId) {
          ack?.({ ok: false, error: 'Conversation not found' });
          return;
        }
        const conv = await getOne('SELECT * FROM conversations WHERE id = ?', [convId]);
        if (!conv || (conv.user_id_1 !== userId && conv.user_id_2 !== userId)) {
          ack?.({ ok: false, error: 'Not allowed' });
          return;
        }
        socket.join(`conv:${conv.id}`);
        ack?.({ ok: true, conversationId: conv.id });
      } catch (e) {
        ack?.({ ok: false, error: 'join failed' });
      }
    });

    socket.on('leave_conversation', async (chatId) => {
      if (typeof chatId !== 'string') return;
      const convId = await resolveConversationId(userId, chatId);
      if (convId) socket.leave(`conv:${convId}`);
    });

    socket.on('typing', async (payload, ack) => {
      try {
        const chatId = payload?.chatId;
        const isTyping = Boolean(payload?.isTyping);
        if (typeof chatId !== 'string' || !chatId.length) {
          ack?.({ ok: false, error: 'chatId required' });
          return;
        }
        const convId = await resolveConversationId(userId, chatId);
        if (!convId) {
          ack?.({ ok: false, error: 'Conversation not found' });
          return;
        }
        const conv = await getOne('SELECT * FROM conversations WHERE id = ?', [convId]);
        if (!conv || (conv.user_id_1 !== userId && conv.user_id_2 !== userId)) {
          ack?.({ ok: false, error: 'Not allowed' });
          return;
        }
        socket.to(`conv:${conv.id}`).emit('typing', {
          conversationId: conv.id,
          isTyping,
        });
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: 'typing failed' });
      }
    });
  });
}

module.exports = { attachChatSocket, isUserSocketConnected };
