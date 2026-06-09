/**
 * Seeds mutual matches + chat threads for the demo account (demo@linkedup.app).
 * Does NOT delete or recreate the demo user.
 *
 *   npm run seed-demo-matches
 *
 * Creates/updates 6 @promatch.dev personas matched with demo + optional starter messages.
 */
const { randomUUID } = require('crypto');
const { initDb, run, getOne, all } = require('./connection');
const { getDemoLoginEmail } = require('../config/demoAccount');
const { insertTestUser, removeUserByEmail, aboutYouJson } = require('./seedTestAccounts');

const BLR = { lat: 12.9716, lon: 77.5946 };

const IMG = {
  m1: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=800',
  m2: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=800',
  w1: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
  w2: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=800',
  w3: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=800',
};

function urls(primary, ...more) {
  return JSON.stringify([primary, ...(more.length ? more : [])]);
}

/** Fixed demo match personas — stable ids for re-runs. */
const DEMO_MATCH_PERSONAS = [
  {
    id: 'd1000001-0001-4000-8000-000000000001',
    email: 'demomatch1@promatch.dev',
    name: 'Arjun Mehta',
    age: 31,
    gender: 'Male',
    profession: 'Software Engineer',
    company: 'Flipkart',
    city: 'Bengaluru',
    bio: 'Matched with demo — say hi to test chat.',
    photo_url: IMG.m1,
    photo_urls: urls(IMG.m1, IMG.m2),
    interests: '["Tech","Cricket","Coffee"]',
    education: 'B.Tech, BITS Pilani',
    linkedin_url: 'https://linkedin.com/in/demomatch1',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Women']),
    industry: 'Technology',
    job_level: 'Senior',
    experience_years: 8,
    latitude: BLR.lat + 0.008,
    longitude: BLR.lon + 0.006,
    opener: 'Hey Demo — matched! How is MatchedIn treating you?',
    reply: 'Pretty good so far — swipe and chat QA 👋',
  },
  {
    id: 'd1000001-0002-4000-8000-000000000002',
    email: 'demomatch2@promatch.dev',
    name: 'Priya Sharma',
    age: 27,
    gender: 'Female',
    profession: 'UX Designer',
    company: 'Razorpay',
    city: 'Bengaluru',
    bio: 'Design lead — demo match for testing.',
    photo_url: IMG.w1,
    photo_urls: urls(IMG.w1, IMG.w3),
    interests: '["Design","Travel","Yoga"]',
    education: 'B.Des, NID',
    linkedin_url: 'https://linkedin.com/in/demomatch2',
    is_premium: 1,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Men']),
    industry: 'Design',
    job_level: 'Mid',
    experience_years: 5,
    latitude: BLR.lat + 0.012,
    longitude: BLR.lon - 0.004,
    opener: 'Hi! Loved your profile — want to grab virtual coffee?',
    reply: null,
  },
  {
    id: 'd1000001-0003-4000-8000-000000000003',
    email: 'demomatch3@promatch.dev',
    name: 'Rohan Kapoor',
    age: 29,
    gender: 'Male',
    profession: 'Product Manager',
    company: 'Swiggy',
    city: 'Bengaluru',
    bio: 'PM in hypergrowth — matched for QA.',
    photo_url: IMG.m2,
    photo_urls: urls(IMG.m2, IMG.m1),
    interests: '["Product","Running","Food"]',
    education: 'MBA, ISB',
    linkedin_url: 'https://linkedin.com/in/demomatch3',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Everyone']),
    industry: 'Technology',
    job_level: 'Mid',
    experience_years: 6,
    latitude: BLR.lat - 0.006,
    longitude: BLR.lon + 0.01,
    about_you_json: aboutYouJson({ topInterests: ['Product', 'Fitness', 'Food'] }),
    opener: 'Matched! Testing push + chat from demo account?',
    reply: 'Works on my end — try replying here.',
  },
  {
    id: 'd1000001-0004-4000-8000-000000000004',
    email: 'demomatch4@promatch.dev',
    name: 'Ananya Iyer',
    age: 26,
    gender: 'Female',
    profession: 'Data Scientist',
    company: 'PhonePe',
    city: 'Bengaluru',
    bio: 'ML engineer — demo match persona.',
    photo_url: IMG.w2,
    photo_urls: urls(IMG.w2, IMG.w1),
    interests: '["AI","Music","Hiking"]',
    education: 'M.Tech, IISc',
    linkedin_url: 'https://linkedin.com/in/demomatch4',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Men']),
    industry: 'Technology',
    job_level: 'Mid',
    experience_years: 4,
    latitude: BLR.lat + 0.004,
    longitude: BLR.lon + 0.014,
    opener: 'Hello from Ananya — your Matches tab should show this thread.',
    reply: null,
  },
  {
    id: 'd1000001-0005-4000-8000-000000000005',
    email: 'demomatch5@promatch.dev',
    name: 'Vikram Singh',
    age: 34,
    gender: 'Male',
    profession: 'Investment Banker',
    company: 'Goldman Sachs',
    city: 'Bengaluru',
    bio: 'Finance — matched with demo for block/unmatch tests.',
    photo_url: IMG.m1,
    photo_urls: urls(IMG.m1),
    interests: '["Finance","Golf","Wine"]',
    education: 'MBA, Wharton',
    linkedin_url: 'https://linkedin.com/in/demomatch5',
    is_premium: 1,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Women']),
    industry: 'Finance',
    job_level: 'Senior',
    experience_years: 10,
    latitude: BLR.lat - 0.01,
    longitude: BLR.lon - 0.008,
    opener: null,
    reply: null,
  },
  {
    id: 'd1000001-0006-4000-8000-000000000006',
    email: 'demomatch6@promatch.dev',
    name: 'Meera Nair',
    age: 30,
    gender: 'Female',
    profession: 'Marketing Director',
    company: 'Zomato',
    city: 'Bengaluru',
    bio: 'Brand & growth — another demo match.',
    photo_url: IMG.w3,
    photo_urls: urls(IMG.w3, IMG.w2),
    interests: '["Marketing","Art","Travel"]',
    education: 'MBA, IIM Ahmedabad',
    linkedin_url: 'https://linkedin.com/in/demomatch6',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Men']),
    industry: 'Marketing',
    job_level: 'Director',
    experience_years: 9,
    latitude: BLR.lat + 0.016,
    longitude: BLR.lon - 0.012,
    opener: 'Meera here — long-press a match to test block/report too.',
    reply: 'Good tip, thanks!',
  },
];

async function ensureMutualMatchWithChat(demoId, persona) {
  const otherId = persona.id;
  const u1 = demoId < otherId ? demoId : otherId;
  const u2 = demoId < otherId ? otherId : demoId;
  const convId = `conv_${u1}_${u2}`;

  await run(
    `INSERT INTO likes (user_id, target_user_id, type) VALUES (?, ?, ?)
     ON CONFLICT (user_id, target_user_id) DO NOTHING`,
    [demoId, otherId, 'like'],
  );
  await run(
    `INSERT INTO likes (user_id, target_user_id, type) VALUES (?, ?, ?)
     ON CONFLICT (user_id, target_user_id) DO NOTHING`,
    [otherId, demoId, 'like'],
  );
  await run(
    'INSERT INTO matches (user_id_1, user_id_2) VALUES (?, ?) ON CONFLICT (user_id_1, user_id_2) DO NOTHING',
    [u1, u2],
  );
  await run(
    'INSERT INTO conversations (id, user_id_1, user_id_2) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING',
    [convId, u1, u2],
  );

  const existing = await getOne(
    'SELECT COUNT(*)::int AS n FROM messages WHERE conversation_id = ?',
    [convId],
  );
  if (Number(existing?.n ?? 0) > 0) return;

  if (persona.opener) {
    await run('INSERT INTO messages (id, conversation_id, sender_id, text) VALUES (?, ?, ?, ?)', [
      randomUUID(),
      convId,
      otherId,
      persona.opener,
    ]);
  }
  if (persona.reply) {
    await run('INSERT INTO messages (id, conversation_id, sender_id, text) VALUES (?, ?, ?, ?)', [
      randomUUID(),
      convId,
      demoId,
      persona.reply,
    ]);
  }
}

async function seedDemoMatches() {
  await initDb();
  const demoEmail = getDemoLoginEmail();
  const demo = await getOne('SELECT id, name FROM users WHERE lower(email) = lower(?)', [demoEmail]);
  if (!demo) {
    throw new Error(`Demo user not found (${demoEmail}). Run: npm run seed-demo`);
  }

  for (const persona of DEMO_MATCH_PERSONAS) {
    const { opener, reply, ...userRow } = persona;
    await removeUserByEmail(userRow.email);
    await insertTestUser(userRow);
    await ensureMutualMatchWithChat(demo.id, persona);
  }

  // Re-match any real onboarded user not blocked (e.g. founder account) if not already matched
  const blocked = await all(
    'SELECT blocked_id AS id FROM blocks WHERE blocker_id = ? UNION SELECT blocker_id AS id FROM blocks WHERE blocked_id = ?',
    [demo.id, demo.id],
  );
  const blockedSet = new Set(blocked.map((r) => r.id));

  const extras = await all(
    `SELECT id, name, email FROM users
     WHERE lower(email) != lower(?)
       AND onboarding_complete = 1
       AND id NOT IN (${DEMO_MATCH_PERSONAS.map(() => '?').join(',')})
     ORDER BY created_at DESC
     LIMIT 5`,
    [demoEmail, ...DEMO_MATCH_PERSONAS.map((p) => p.id)],
  );

  for (const u of extras) {
    if (blockedSet.has(u.id)) continue;
    const already = await getOne(
      'SELECT 1 AS x FROM matches WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)',
      [demo.id, u.id, u.id, demo.id],
    );
    if (already) continue;
    await ensureMutualMatchWithChat(demo.id, {
      id: u.id,
      opener: `Hey Demo — ${u.name} matched with you for testing.`,
      reply: null,
    });
  }

  const matchCount = await getOne(
    `SELECT COUNT(*)::int AS n FROM users u
     INNER JOIN matches m ON (u.id = m.user_id_1 OR u.id = m.user_id_2)
     WHERE (m.user_id_1 = ? OR m.user_id_2 = ?) AND u.id != ?`,
    [demo.id, demo.id, demo.id],
  );

  // eslint-disable-next-line no-console
  console.log(`✓ Demo matches ready for ${demoEmail} (${demo.name})`);
  // eslint-disable-next-line no-console
  console.log(`  Mutual matches: ${matchCount?.n ?? 0}`);
  // eslint-disable-next-line no-console
  console.log(`  Personas: ${DEMO_MATCH_PERSONAS.map((p) => p.name).join(', ')}`);
  // eslint-disable-next-line no-console
  console.log('  Login: demo@linkedup.app + OTP 123456 → Matches / Chats tabs');
}

if (require.main === module) {
  seedDemoMatches()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedDemoMatches, DEMO_MATCH_PERSONAS };
