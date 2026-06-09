/**
 * Seeds the fixed demo account for app store / QA testing.
 *
 *   npm run seed-demo
 *
 * Login: DEMO_LOGIN_EMAIL (default demo@linkedup.app) + DEMO_LOGIN_OTP (default 123456)
 */
const { randomUUID } = require('crypto');
const { initDb, run, getOne } = require('./connection');
const { getDemoLoginEmail } = require('../config/demoAccount');
const { removeUserByEmail } = require('./seedTestAccounts');

const BLR = { lat: 12.9716, lon: 77.5946 };
const PHOTO =
  'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800';

async function seedDemoAccount() {
  await initDb();
  const email = getDemoLoginEmail();
  await removeUserByEmail(email);

  const id = randomUUID();
  const photoUrls = JSON.stringify([PHOTO]);
  const interestedIn = JSON.stringify(['Everyone']);
  const datingPrefs = JSON.stringify({
    maxDistanceKm: 50,
    ageMin: 22,
    ageMax: 40,
    showMe: 'Everyone',
  });

  await run(
    `INSERT INTO users (
      id, email, name, age, gender, profession, company, city, bio,
      photo_url, photo_urls, interests, education, linkedin_url, is_premium,
      onboarding_complete, interested_in, industry, job_level, experience_years,
      latitude, longitude, dating_prefs_json, linkedin_verified, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [
      id,
      email,
      'Demo User',
      28,
      'Female',
      'Product Manager',
      'LinkedUp',
      'Bengaluru',
      'Official demo account for testing swipes, matches, and chat.',
      PHOTO,
      photoUrls,
      '["Product","Travel","Networking"]',
      'MBA, IIM Bangalore',
      'https://linkedin.com/in/linkedup-demo',
      1,
      1,
      interestedIn,
      'Technology',
      'Mid',
      5,
      BLR.lat,
      BLR.lon + 0.015,
      datingPrefs,
    ],
  );

  const row = await getOne('SELECT id, email, name FROM users WHERE email = ?', [email]);
  // eslint-disable-next-line no-console
  console.log(`✓ Demo account ready: ${row.email} (${row.name})`);
  // eslint-disable-next-line no-console
  console.log(`  Login OTP: ${process.env.DEMO_LOGIN_OTP || '123456'} (no email sent for this address)`);
}

if (require.main === module) {
  seedDemoAccount()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedDemoAccount };
