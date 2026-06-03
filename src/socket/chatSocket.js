const { verifyToken } = require('../middleware/auth');
const { getOne } = require('../db/connection');
const { resolveConversationId } = require('../utils/conversation');

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

module.exports = { attachChatSocket };
