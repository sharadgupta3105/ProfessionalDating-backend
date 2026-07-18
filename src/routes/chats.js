const express = require('express');
const router = express.Router();
const { getOne, all, run } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
const { toUserJson, primaryPhotoUrl } = require('../utils/userJson');
const { randomUUID } = require('crypto');
const { resolveConversationId } = require('../utils/conversation');
const { sendNewChatMessagePush } = require('../utils/expoPush');
const { shouldSkipRemotePush } = require('../utils/appPresence');
const { isUserSocketConnected } = require('../socket/chatSocket');
const { getBlockedUserIds, isBlockedEitherWay } = require('../utils/blocks');

router.use(authMiddleware);

const unreadCountStmtSql = `
  SELECT COUNT(*)::int AS n
  FROM messages m
  LEFT JOIN conversation_reads r
    ON r.conversation_id = m.conversation_id AND r.user_id = ?
  WHERE m.conversation_id = ?
    AND m.sender_id != ?
    AND (
      r.user_id IS NULL
      OR (r.last_read_rowid IS NOT NULL AND m.seq > r.last_read_rowid)
      OR (r.last_read_rowid IS NULL AND m.created_at > r.last_read_at)
    )
`;

router.get('/', async (req, res, next) => {
  try {
    const convs = await all(
      `
      SELECT c.id, c.user_id_1, c.user_id_2, c.created_at
      FROM conversations c
      WHERE c.user_id_1 = ? OR c.user_id_2 = ?
      ORDER BY COALESCE(
        (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id),
        c.created_at
      ) DESC
    `,
      [req.userId, req.userId],
    );

    const blocked = await getBlockedUserIds(req.userId);
    const list = [];
    for (const c of convs) {
      const otherId = c.user_id_1 === req.userId ? c.user_id_2 : c.user_id_1;
      if (blocked.has(otherId)) continue;
      const other = await getOne('SELECT * FROM users WHERE id = ?', [otherId]);
      const lastMsg = await getOne(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
        [c.id],
      );
      const unreadRow = await getOne(unreadCountStmtSql, [req.userId, c.id, req.userId]);
      const unreadCount = Number(unreadRow?.n ?? 0) || 0;
      list.push({
        id: c.id,
        otherUser: toUserJson(other),
        name: other?.name,
        imageUrl: toUserJson(other)?.imageUrl,
        lastMessage: lastMsg?.text ?? null,
        time: lastMsg?.created_at ?? c.created_at,
        unreadCount,
      });
    }
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post('/:chatId/read', async (req, res, next) => {
  try {
    const convId = await resolveConversationId(req.userId, req.params.chatId);
    const conv = convId ? await getOne('SELECT * FROM conversations WHERE id = ?', [convId]) : null;
    if (!conv) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (conv.user_id_1 !== req.userId && conv.user_id_2 !== req.userId) {
      return res.status(403).json({ message: 'Not in this conversation' });
    }
    const lastMsg = await getOne(
      `SELECT seq AS row_id, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, seq DESC LIMIT 1`,
      [conv.id],
    );
    const nowRow = await getOne('SELECT NOW() AS t');
    const lastReadAt = lastMsg?.created_at ?? nowRow?.t;
    const lastReadRowid = lastMsg?.row_id != null ? lastMsg.row_id : null;
    await run(
      `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at, last_read_rowid)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(conversation_id, user_id) DO UPDATE SET
         last_read_at = EXCLUDED.last_read_at,
         last_read_rowid = EXCLUDED.last_read_rowid`,
      [conv.id, req.userId, lastReadAt, lastReadRowid],
    );
    res.json({ ok: true, lastReadAt });
  } catch (e) {
    next(e);
  }
});

router.get('/:chatId/messages', async (req, res, next) => {
  try {
    const convId = await resolveConversationId(req.userId, req.params.chatId);
    const conv = convId ? await getOne('SELECT * FROM conversations WHERE id = ?', [convId]) : null;
    if (!conv) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (conv.user_id_1 !== req.userId && conv.user_id_2 !== req.userId) {
      return res.status(403).json({ message: 'Not in this conversation' });
    }
    const otherId = conv.user_id_1 === req.userId ? conv.user_id_2 : conv.user_id_1;
    if (await isBlockedEitherWay(req.userId, otherId)) {
      return res.status(403).json({ message: 'Cannot access this conversation' });
    }
    const rows = await all(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conv.id],
    );
    const messages = rows.map((m) => ({
      id: m.id,
      text: m.text,
      createdAt: m.created_at,
      fromMe: m.sender_id === req.userId,
    }));
    res.json(messages);
  } catch (e) {
    next(e);
  }
});

router.post('/:chatId/messages', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'text required' });
    }
    const convId = await resolveConversationId(req.userId, req.params.chatId);
    const conv = convId ? await getOne('SELECT * FROM conversations WHERE id = ?', [convId]) : null;
    if (!conv) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (conv.user_id_1 !== req.userId && conv.user_id_2 !== req.userId) {
      return res.status(403).json({ message: 'Not in this conversation' });
    }
    const otherId = conv.user_id_1 === req.userId ? conv.user_id_2 : conv.user_id_1;
    if (await isBlockedEitherWay(req.userId, otherId)) {
      return res.status(403).json({ message: 'Cannot message this user' });
    }
    const id = randomUUID();
    await run('INSERT INTO messages (id, conversation_id, sender_id, text) VALUES (?, ?, ?, ?)', [
      id,
      conv.id,
      req.userId,
      text.trim(),
    ]);
    const row = await getOne('SELECT * FROM messages WHERE id = ?', [id]);

    const recipientId = conv.user_id_1 === req.userId ? conv.user_id_2 : conv.user_id_1;
    const senderRow = await getOne('SELECT name, photo_url, photo_urls FROM users WHERE id = ?', [req.userId]);
    const recipientRow = await getOne(
      'SELECT expo_push_token, app_in_foreground, app_presence_updated_at FROM users WHERE id = ?',
      [recipientId],
    );

    const payload = {
      conversationId: conv.id,
      senderName: senderRow?.name || 'Someone',
      message: {
        id: row.id,
        text: row.text,
        createdAt: row.created_at,
        senderId: req.userId,
      },
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${conv.id}`).emit('message:new', payload);
      io.to(`user:${recipientId}`).emit('message:new', payload);
    }

    if (process.env.DEBUG_PUSH === '1' && !recipientRow?.expo_push_token) {
      console.log('[push] skip: recipient has no expo_push_token (Expo Go Android cannot register; or denied / simulator)', {
        recipientId,
      });
    }

    const skipPushForeground = shouldSkipRemotePush(
      recipientRow,
      recipientId,
      isUserSocketConnected,
    );
    if (process.env.DEBUG_PUSH === '1' && skipPushForeground) {
      console.log('[push] skip: app open with live socket', { recipientId });
    }

    if (recipientRow?.expo_push_token && !skipPushForeground) {
      setImmediate(() => {
        sendNewChatMessagePush({
          expoPushToken: recipientRow.expo_push_token,
          senderName: senderRow?.name || 'Someone',
          textPreview: text.trim(),
          conversationId: conv.id,
          senderId: req.userId,
          senderImageUrl: primaryPhotoUrl(senderRow) || '',
        })
          .then((resPush) => {
            if (process.env.DEBUG_PUSH === '1') {
              console.log('[push] expo ticket ok', { toUser: recipientId, conversationId: conv.id, res: resPush });
            }
          })
          .catch(async (err) => {
            if (err?.expoPushError === 'DeviceNotRegistered') {
              try {
                await run('UPDATE users SET expo_push_token = NULL, updated_at = NOW() WHERE id = ?', [
                  recipientId,
                ]);
              } catch (_) {
                /* ignore */
              }
            }
            if (process.env.DEBUG_PUSH === '1') {
              console.error(
                '[push] failed',
                err?.message || err,
                err?.expoPushError || '',
                err?.details || err?.ticket || '',
              );
            }
          });
      });
    }

    res.status(201).json({
      message: {
        id: row.id,
        text: row.text,
        createdAt: row.created_at,
        fromMe: true,
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
