/**
 * Wipes ALL app data (users, OTPs, likes, passes, matches, chats) and seeds
 * two matched accounts with an existing conversation so you can test chat on
 * web + phone immediately.
 *
 * Run from backend/:  npm run reset-dev-for-chat
 *
 * Login (requires NODE_ENV=development for fixed OTP — see auth route):
 *   Email: chattester@promatch.dev     → use on one device (e.g. phone)
 *   Email: chattester2@promatch.dev    → use on the other (e.g. web)
 *   OTP:  123456
 *
 * Point both clients at the same API (e.g. EXPO_PUBLIC_API_URL=http://<your-lan-ip>:5000).
 *
 * Accounts are located in Bengaluru for consistent distance-based matching with other seeds.
 */

const { randomUUID } = require('crypto');

const BLR = { lat: 12.9716, lon: 77.5946 };
const { initDb, run } = require('./connection');
const { wipeAll } = require('./wipeAllData');
const { insertTestUser } = require('./seedTestAccounts');

const IMG = {
  m1: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=800',
  w1: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
};

function urls(a, b) {
  return JSON.stringify(b ? [a, b] : [a]);
}

const CHAT_TESTER_A = {
  id: 'c0000001-0001-4000-8000-000000000001',
  email: 'chattester@promatch.dev',
  name: 'Chat Tester Alpha',
  age: 30,
  gender: 'Male',
  profession: 'Engineer',
  company: 'MatchedIn QA',
  city: 'Bengaluru',
  bio: 'Dev account — use with chattester2 for cross-device chat.',
  photo_url: IMG.m1,
  photo_urls: urls(IMG.m1, IMG.w1),
  interests: '["Chat QA","Coffee"]',
  education: 'BS CS',
  linkedin_url: 'https://linkedin.com/in/chattester',
  is_premium: 1,
  onboarding_complete: 1,
  interested_in: JSON.stringify(['Women']),
  industry: 'Technology',
  job_level: 'Senior',
  experience_years: 5,
  latitude: BLR.lat + 0.003,
  longitude: BLR.lon + 0.004,
};

const CHAT_TESTER_B = {
  id: 'c0000001-0002-4000-8000-000000000002',
  email: 'chattester2@promatch.dev',
  name: 'Chat Tester Beta',
  age: 28,
  gender: 'Female',
  profession: 'Designer',
  company: 'MatchedIn QA',
  city: 'Bengaluru',
  bio: 'Dev account — matched with chattester; open Chats to reply.',
  photo_url: IMG.w1,
  photo_urls: urls(IMG.w1, IMG.m1),
  interests: '["Design","Chat QA"]',
  education: 'BFA',
  linkedin_url: 'https://linkedin.com/in/chattester2',
  is_premium: 0,
  onboarding_complete: 1,
  interested_in: JSON.stringify(['Men']),
  industry: 'Design',
  job_level: 'Mid',
  experience_years: 4,
  latitude: BLR.lat + 0.004,
  longitude: BLR.lon + 0.005,
};

async function seedChatMatch() {
  const a = CHAT_TESTER_A.id;
  const b = CHAT_TESTER_B.id;
  await run('INSERT INTO likes (user_id, target_user_id, type) VALUES (?, ?, ?)', [a, b, 'like']);
  await run('INSERT INTO likes (user_id, target_user_id, type) VALUES (?, ?, ?)', [b, a, 'like']);
  const u1 = a < b ? a : b;
  const u2 = a < b ? b : a;
  await run('INSERT INTO matches (user_id_1, user_id_2) VALUES (?, ?)', [u1, u2]);
  const convId = `conv_${u1}_${u2}`;
  await run('INSERT INTO conversations (id, user_id_1, user_id_2) VALUES (?, ?, ?)', [convId, u1, u2]);

  const msgA = randomUUID();
  const msgB = randomUUID();
  await run('INSERT INTO messages (id, conversation_id, sender_id, text) VALUES (?, ?, ?, ?)', [
    msgA,
    convId,
    a,
    'Hey — chat test thread. Open this on your other device with chattester2@promatch.dev.',
  ]);
  await run('INSERT INTO messages (id, conversation_id, sender_id, text) VALUES (?, ?, ?, ?)', [
    msgB,
    convId,
    b,
    'Hi Alpha — replies work. Cross-device OK 👋',
  ]);
}

async function main() {
  await initDb();
  await wipeAll();

  await insertTestUser(CHAT_TESTER_A);
  await insertTestUser(CHAT_TESTER_B);
  await seedChatMatch();

  console.log('');
  console.log('✓ Database reset: all users and activity cleared.');
  console.log('✓ Seeded 2 matched users + conversation + 2 messages.');
  console.log('');
  console.log('  Account 1 (e.g. phone):   chattester@promatch.dev');
  console.log('  Account 2 (e.g. web):     chattester2@promatch.dev');
  console.log('  OTP (dev):                123456   ← set NODE_ENV=development when starting the API');
  console.log('');
  console.log('  Same API URL on both clients (LAN IP for a physical phone).');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
