/**
 * Deletes all app rows (order respects FKs). Used by dev reset scripts.
 */
const { run } = require('./connection');

async function wipeAll() {
  await run('DELETE FROM conversation_reads');
  await run('DELETE FROM messages');
  await run('DELETE FROM conversations');
  await run('DELETE FROM matches');
  await run('DELETE FROM likes');
  await run('DELETE FROM passes');
  await run('DELETE FROM otp_codes');
  await run('DELETE FROM users');
}

module.exports = { wipeAll };
