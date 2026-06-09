const { all, getOne, run } = require('../db/connection');

async function getBlockedUserIds(userId) {
  const rows = await all(
    'SELECT blocked_id AS id FROM blocks WHERE blocker_id = ? UNION SELECT blocker_id AS id FROM blocks WHERE blocked_id = ?',
    [userId, userId],
  );
  return new Set(rows.map((r) => r.id));
}

async function isBlockedEitherWay(userId, otherUserId) {
  const row = await getOne(
    'SELECT 1 AS x FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1',
    [userId, otherUserId, otherUserId, userId],
  );
  return Boolean(row);
}

async function blockUser(blockerId, blockedId) {
  await run(
    'INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?) ON CONFLICT (blocker_id, blocked_id) DO NOTHING',
    [blockerId, blockedId],
  );
}

module.exports = { getBlockedUserIds, isBlockedEitherWay, blockUser };
