/**
 * Full dev reset: wipe DB, then seed accounts to exercise onboarding, swipe deck,
 * preferences matrix, premium vs free, LinkedIn verified, matches, and chat.
 *
 * From backend/:  npm run reset-and-seed
 *
 * Dev login: any email below + OTP 123456 (NODE_ENV=development on the API).
 *
 * Extra QA users (onboarding, verified, chat testers) are in the Bengaluru area for local matching.
 */

const { randomUUID } = require('crypto');

const BLR = { lat: 12.9716, lon: 77.5946 };
const { initDb, run } = require('./connection');
const { wipeAll } = require('./wipeAllData');
const { seedTestUsersAsync, insertTestUser } = require('./seedTestAccounts');

const IMG = {
  m1: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=800',
  m2: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=800',
  w1: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
};

function urls(a, b) {
  return JSON.stringify(b ? [a, b] : [a]);
}

const ONBOARDING_USER = {
  id: 'd0000001-0001-4000-8000-000000000001',
  email: 'onboarding@promatch.dev',
  name: 'Fresh Onboarding',
  age: 26,
  gender: 'Female',
  profession: 'Analyst',
  company: 'Acme',
  city: 'Bengaluru',
  bio: 'Use this account to walk through onboarding from the start.',
  photo_url: IMG.w1,
  photo_urls: urls(IMG.w1),
  interests: '["Reading","Coffee"]',
  education: 'BA Economics',
  linkedin_url: 'https://linkedin.com/in/fresh-onboarding',
  is_premium: 0,
  onboarding_complete: 0,
  interested_in: JSON.stringify(['Men']),
  industry: 'Finance',
  job_level: 'Junior',
  experience_years: 1,
  latitude: BLR.lat + 0.018,
  longitude: BLR.lon - 0.012,
};

const LINKEDIN_VERIFIED_USER = {
  id: 'd0000001-0002-4000-8000-000000000002',
  email: 'verified@promatch.dev',
  name: 'LinkedIn Verified QA',
  age: 34,
  gender: 'Male',
  profession: 'Engineering Manager',
  company: 'MatchedIn QA',
  city: 'Bengaluru',
  bio: 'Shows linkedin_verified in the app (seeded as verified).',
  photo_url: IMG.m1,
  photo_urls: urls(IMG.m1, IMG.m2),
  interests: '["Leadership","Coffee"]',
  education: 'MS CS',
  linkedin_url: 'https://linkedin.com/in/verified-qa',
  is_premium: 0,
  onboarding_complete: 1,
  interested_in: JSON.stringify(['Everyone']),
  industry: 'Technology',
  job_level: 'Manager',
  experience_years: 10,
  latitude: BLR.lat + 0.011,
  longitude: BLR.lon + 0.014,
};

const CHAT_TESTER_A = {
  id: 'c0000001-0001-4000-8000-000000000001',
  email: 'chattester@promatch.dev',
  name: 'Chat Tester Alpha',
  age: 30,
  gender: 'Male',
  profession: 'Engineer',
  company: 'MatchedIn QA',
  city: 'Bengaluru',
  bio: 'Matched with Chat Tester Beta — open Chats to test messaging.',
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
  bio: 'Matched with chattester@ — use two devices or switch accounts.',
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
    'Hey — chat test thread. Open as chattester2@promatch.dev on another client to reply.',
  ]);
  await run('INSERT INTO messages (id, conversation_id, sender_id, text) VALUES (?, ?, ?, ?)', [
    msgB,
    convId,
    b,
    'Hi Alpha — thread is ready for cross-device testing.',
  ]);
}

async function main() {
  await initDb();
  await wipeAll();

  await seedTestUsersAsync();

  for (const u of [ONBOARDING_USER, LINKEDIN_VERIFIED_USER, CHAT_TESTER_A, CHAT_TESTER_B]) {
    await insertTestUser(u);
  }

  await run('UPDATE users SET linkedin_verified = 1, updated_at = NOW() WHERE id = ?', [
    LINKEDIN_VERIFIED_USER.id,
  ]);

  await seedChatMatch();

  console.log('');
  console.log('✓ Full reset: all users, likes, passes, matches, chats, and OTPs cleared.');
  console.log('✓ Seeded 8 powertester accounts + onboarding + LinkedIn-verified + 2 matched chat testers.');
  console.log('');
  console.log('── Main QA (premium, Everyone, SF) ──');
  console.log('  powertester@promatch.dev');
  console.log('');
  console.log('── Onboarding (not finished) ──');
  console.log('  onboarding@promatch.dev');
  console.log('');
  console.log('── LinkedIn verified badge ──');
  console.log('  verified@promatch.dev');
  console.log('');
  console.log('── Chat / matches (mutual like + 2 messages) ──');
  console.log('  chattester@promatch.dev');
  console.log('  chattester2@promatch.dev');
  console.log('');
  console.log('── Preferences & deck variety ──');
  console.log('  powertester2@ … powertester8@promatch.dev  (see seedTestAccounts.js header)');
  console.log('');
  console.log('Dev OTP: 123456  (run API with NODE_ENV=development)');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

module.exports = { main };
