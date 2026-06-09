/**
 * Fixed QA accounts for @promatch.dev — full profiles for recommendations (lat/lng, interested_in, photos).
 * All accounts are in the Bengaluru area (~15 km spread) so distance-based matching works locally.
 *
 * Run from backend/:  npm run seed-test-accounts
 * Login (development): any email below + OTP 123456
 *
 * About you: powertester2–8 include full `about_you` (visible on recommendation cards); powertester does not.
 *
 * Emails (all city: Bengaluru):
 *   powertester@promatch.dev   — Male, Everyone
 *   powertester2@promatch.dev  — Female, Men
 *   powertester3@promatch.dev  — Male, Women
 *   powertester4@promatch.dev  — Female, Everyone
 *   powertester5@promatch.dev  — Non-binary, Everyone
 *   powertester6@promatch.dev  — Male, Men
 *   powertester7@promatch.dev  — Female, Women
 *   powertester8@promatch.dev  — Male, Women + Non-binary
 */

const { initDb, run, all, getOne } = require('./connection');

/** Bengaluru centre — small per-account offsets keep everyone within ~15 km. */
const BLR = { lat: 12.9716, lon: 77.5946 };

async function removeUserCompletely(userId) {
  if (!userId) return;
  const convs = await all('SELECT id FROM conversations WHERE user_id_1 = ? OR user_id_2 = ?', [
    userId,
    userId,
  ]);
  for (const { id } of convs) {
    await run('DELETE FROM messages WHERE conversation_id = ?', [id]);
  }
  await run('DELETE FROM conversations WHERE user_id_1 = ? OR user_id_2 = ?', [userId, userId]);
  await run('DELETE FROM matches WHERE user_id_1 = ? OR user_id_2 = ?', [userId, userId]);
  await run('DELETE FROM likes WHERE user_id = ? OR target_user_id = ?', [userId, userId]);
  await run('DELETE FROM passes WHERE user_id = ? OR target_user_id = ?', [userId, userId]);
  await run('DELETE FROM users WHERE id = ?', [userId]);
}

async function removeUserByEmail(email) {
  const row = await getOne('SELECT id FROM users WHERE lower(email) = lower(?)', [email]);
  if (row) await removeUserCompletely(row.id);
}

const IMG = {
  m1: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=800',
  m2: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=800',
  m3: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=800',
  w1: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
  w2: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=800',
  w3: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=800',
  nb: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=800',
};

function urls(primary, ...more) {
  return JSON.stringify([primary, ...(more.length ? more : [])]);
}

/** Full About-you payload (matches mobile AboutYouScreen / PATCH about_you). */
function aboutYouJson(overrides = {}) {
  const base = {
    topInterests: ['Product', 'Travel', 'Fitness'],
    sameProfessionPreference: false,
    workStyle: 'Hybrid',
    workSchedule: 'Flexible',
    weekendPreference: 'Social',
    fitnessLevel: 'Moderate',
    personalityType: 'Ambivert',
    educationLevel: 'Masters',
  };
  return JSON.stringify({ ...base, ...overrides });
}

/** @type {Record<string, unknown>[]} */
const TEST_ACCOUNTS = [
  {
    id: 'b0000001-0001-4000-8000-000000000001',
    email: 'powertester@promatch.dev',
    name: 'Power Tester',
    age: 32,
    gender: 'Male',
    profession: 'Software Engineer',
    company: 'LinkedUp QA',
    city: 'Bengaluru',
    bio: 'QA account — interested in everyone, Bengaluru.',
    photo_url: IMG.m1,
    photo_urls: urls(IMG.m1, IMG.m2),
    interests: '["Tech","Coffee","Hiking"]',
    education: 'B.Tech CS, IIT',
    linkedin_url: 'https://linkedin.com/in/powertester',
    is_premium: 1,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Everyone']),
    industry: 'Technology',
    job_level: 'Senior',
    experience_years: 8,
    latitude: BLR.lat + 0.02,
    longitude: BLR.lon + 0.01,
    about_you_json: null,
  },
  {
    id: 'b0000001-0002-4000-8000-000000000002',
    email: 'powertester2@promatch.dev',
    name: 'Power Tester Two',
    age: 28,
    gender: 'Female',
    profession: 'Product Designer',
    company: 'Design Co',
    city: 'Bengaluru',
    bio: 'QA — interested in men, Bengaluru.',
    photo_url: IMG.w1,
    photo_urls: urls(IMG.w1, IMG.w3),
    interests: '["Design","Museums","Running"]',
    education: 'B.Des, NID',
    linkedin_url: 'https://linkedin.com/in/powertester2',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Men']),
    industry: 'Design',
    job_level: 'Mid',
    experience_years: 5,
    latitude: BLR.lat - 0.015,
    longitude: BLR.lon + 0.02,
    about_you_json: aboutYouJson({
      topInterests: ['Design', 'Museums', 'Coffee', 'Art'],
      sameProfessionPreference: false,
      workStyle: 'Office',
      workSchedule: 'Fixed',
      weekendPreference: 'Social',
      fitnessLevel: 'Moderate',
      personalityType: 'Extrovert',
      educationLevel: 'Graduate',
    }),
  },
  {
    id: 'b0000001-0003-4000-8000-000000000003',
    email: 'powertester3@promatch.dev',
    name: 'Bengaluru QA Male',
    age: 30,
    gender: 'Male',
    profession: 'DevOps Engineer',
    company: 'CloudOps',
    city: 'Bengaluru',
    bio: 'QA — interested in women, Bengaluru.',
    photo_url: IMG.m2,
    photo_urls: urls(IMG.m2),
    interests: '["BBQ","Live Music","Kubernetes"]',
    education: 'B.Tech CS, BITS Pilani',
    linkedin_url: 'https://linkedin.com/in/powertester3',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Women']),
    industry: 'Technology',
    job_level: 'Senior',
    experience_years: 7,
    latitude: BLR.lat + 0.01,
    longitude: BLR.lon - 0.018,
    about_you_json: aboutYouJson({
      topInterests: ['Engineering', 'Startups', 'BBQ', 'Live Music'],
      sameProfessionPreference: 'none',
      workStyle: 'Hybrid',
      workSchedule: 'Flexible',
      weekendPreference: 'Traveling',
      fitnessLevel: 'Very active',
      personalityType: 'Ambivert',
      educationLevel: 'Graduate',
    }),
  },
  {
    id: 'b0000001-0004-4000-8000-000000000004',
    email: 'powertester4@promatch.dev',
    name: 'Bengaluru QA Female',
    age: 27,
    gender: 'Female',
    profession: 'Marketing Lead',
    company: 'Media Labs',
    city: 'Bengaluru',
    bio: 'QA — everyone, Bengaluru.',
    photo_url: IMG.w2,
    photo_urls: urls(IMG.w2, IMG.w1),
    interests: '["Film","Yoga","Travel"]',
    education: 'MBA, IIM',
    linkedin_url: 'https://linkedin.com/in/powertester4',
    is_premium: 1,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Everyone']),
    industry: 'Marketing',
    job_level: 'Lead',
    experience_years: 6,
    latitude: BLR.lat - 0.02,
    longitude: BLR.lon - 0.01,
    about_you_json: aboutYouJson({
      topInterests: ['Film', 'Yoga', 'Travel', 'Cooking'],
      sameProfessionPreference: true,
      workStyle: 'Remote',
      workSchedule: 'Flexible',
      weekendPreference: 'Relaxing',
      fitnessLevel: 'Light',
      personalityType: 'Introvert',
      educationLevel: 'Graduate',
    }),
  },
  {
    id: 'b0000001-0005-4000-8000-000000000005',
    email: 'powertester5@promatch.dev',
    name: 'Bengaluru Non-binary QA',
    age: 29,
    gender: 'Non-binary',
    profession: 'UX Researcher',
    company: 'Research Inc',
    city: 'Bengaluru',
    bio: 'QA — non-binary profile, interested in everyone.',
    photo_url: IMG.nb,
    photo_urls: urls(IMG.nb, IMG.m3),
    interests: '["Research","Coffee","Climbing"]',
    education: 'M.Des, IIT',
    linkedin_url: 'https://linkedin.com/in/powertester5',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Everyone']),
    industry: 'Technology',
    job_level: 'Mid',
    experience_years: 4,
    latitude: BLR.lat + 0.008,
    longitude: BLR.lon + 0.022,
    about_you_json: aboutYouJson({
      topInterests: ['Research', 'Coffee', 'Climbing', 'Reading'],
      sameProfessionPreference: false,
      workStyle: 'Hybrid',
      workSchedule: 'Fixed',
      weekendPreference: 'Social',
      fitnessLevel: 'Active',
      personalityType: 'Ambivert',
      educationLevel: 'Masters',
    }),
  },
  {
    id: 'b0000001-0006-4000-8000-000000000006',
    email: 'powertester6@promatch.dev',
    name: 'Bengaluru QA (MLM)',
    age: 31,
    gender: 'Male',
    profession: 'Sales Director',
    company: 'Coastal Sales',
    city: 'Bengaluru',
    bio: 'QA — male, interested in men.',
    photo_url: IMG.m3,
    photo_urls: urls(IMG.m3, IMG.m1),
    interests: '["Beach","Running","Networking"]',
    education: 'MBA, IIM',
    linkedin_url: 'https://linkedin.com/in/powertester6',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Men']),
    industry: 'Sales',
    job_level: 'Director',
    experience_years: 10,
    latitude: BLR.lat - 0.008,
    longitude: BLR.lon + 0.015,
    about_you_json: aboutYouJson({
      topInterests: ['Networking', 'Fitness', 'Music', 'Travel'],
      sameProfessionPreference: true,
      workStyle: 'Office',
      workSchedule: 'Fixed',
      weekendPreference: 'Social',
      fitnessLevel: 'Active',
      personalityType: 'Extrovert',
      educationLevel: 'Masters',
    }),
  },
  {
    id: 'b0000001-0007-4000-8000-000000000007',
    email: 'powertester7@promatch.dev',
    name: 'Bengaluru QA (WLW)',
    age: 26,
    gender: 'Female',
    profession: 'Data Analyst',
    company: 'Mountain Data',
    city: 'Bengaluru',
    bio: 'QA — female, interested in women.',
    photo_url: IMG.w3,
    photo_urls: urls(IMG.w3, IMG.w2),
    interests: '["Skiing","Data Viz","Dogs"]',
    education: 'B.Sc. Statistics, Christ University',
    linkedin_url: 'https://linkedin.com/in/powertester7',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Women']),
    industry: 'Technology',
    job_level: 'Junior',
    experience_years: 2,
    latitude: BLR.lat + 0.025,
    longitude: BLR.lon - 0.005,
    about_you_json: aboutYouJson({
      topInterests: ['Skiing', 'Data Viz', 'Dogs', 'Fitness'],
      sameProfessionPreference: 'none',
      workStyle: 'Remote',
      workSchedule: 'Flexible',
      weekendPreference: 'Relaxing',
      fitnessLevel: 'Moderate',
      personalityType: 'Introvert',
      educationLevel: 'Graduate',
    }),
  },
  {
    id: 'b0000001-0008-4000-8000-000000000008',
    email: 'powertester8@promatch.dev',
    name: 'Bengaluru Multi-preference',
    age: 33,
    gender: 'Male',
    profession: 'Staff Engineer',
    company: 'Big Tech',
    city: 'Bengaluru',
    bio: 'QA — interested in women and non-binary.',
    photo_url: IMG.m1,
    photo_urls: urls(IMG.m1, IMG.m2, IMG.m3),
    interests: '["Open Source","Biking","Coffee"]',
    education: 'M.Tech CS, IISc',
    linkedin_url: 'https://linkedin.com/in/powertester8',
    is_premium: 1,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Women', 'Non-binary']),
    industry: 'Technology',
    job_level: 'Staff',
    experience_years: 12,
    latitude: BLR.lat - 0.012,
    longitude: BLR.lon + 0.025,
    about_you_json: aboutYouJson({
      topInterests: ['Engineering', 'Startups', 'Coffee', 'Open Source'],
      sameProfessionPreference: false,
      workStyle: 'Hybrid',
      workSchedule: 'Flexible',
      weekendPreference: 'Traveling',
      fitnessLevel: 'Active',
      personalityType: 'Ambivert',
      educationLevel: 'PhD',
    }),
  },
];

async function insertTestUser(u) {
  await run(
    `INSERT INTO users (
      id, email, name, age, gender, profession, company, city, bio,
      photo_url, photo_urls, interests, education, linkedin_url, linkedin_verified, is_premium,
      onboarding_complete, interested_in, industry, job_level, experience_years,
      latitude, longitude, about_you_json, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, NOW(), NOW()
    )`,
    [
      u.id,
      u.email,
      u.name,
      u.age,
      u.gender,
      u.profession,
      u.company,
      u.city,
      u.bio,
      u.photo_url,
      u.photo_urls,
      u.interests,
      u.education,
      u.linkedin_url,
      u.linkedin_verified ?? 0,
      u.is_premium,
      u.onboarding_complete,
      u.interested_in,
      u.industry,
      u.job_level,
      u.experience_years,
      u.latitude,
      u.longitude,
      u.about_you_json ?? null,
    ],
  );
}

async function seedTestUsersAsync() {
  for (const u of TEST_ACCOUNTS) {
    await removeUserByEmail(u.email);
    await insertTestUser(u);
  }
}

async function main() {
  await initDb();
  await seedTestUsersAsync();
  console.log(`Seeded ${TEST_ACCOUNTS.length} @promatch.dev test accounts (likes/passes/matches cleared for those emails).`);
  for (const u of TEST_ACCOUNTS) {
    console.log(`  • ${u.email} — ${u.gender}, ${u.city}`);
  }
  console.log('Set OTP_FIXED_CODE or use Resend for production OTP.');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { TEST_ACCOUNTS, seedTestUsersAsync, removeUserByEmail, aboutYouJson, insertTestUser };
