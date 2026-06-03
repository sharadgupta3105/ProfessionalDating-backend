/**
 * Full reset + seed India-based QA accounts (Bengaluru area) for local matching (≤50 km).
 *
 * Run from backend/:  npm run seed-india
 *
 * Dev login: OTP 123456 (NODE_ENV=development)
 *
 * Swipe testing (same city, compatible prefs — use two devices or accounts):
 *   india1@promatch.dev — Male, interested in Women
 *   india2@promatch.dev — Female, interested in Men
 *   india3@promatch.dev — Male, interested in Women
 *   india4@promatch.dev — Female, interested in Men
 *   india5@promatch.dev — Male, interested in Everyone
 *   india6@promatch.dev — Female, interested in Men
 *
 * About you: india2–6 have full `about_you` on cards; india1 does not (contrast).
 */

const { initDb } = require('./connection');
const { aboutYouJson, insertTestUser } = require('./seedTestAccounts');
const { wipeAll } = require('./wipeAllData');

const IMG = {
  m1: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=800',
  m2: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=800',
  m3: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=800',
  w1: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
  w2: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=800',
  w3: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=800',
};

function urls(primary, ...more) {
  return JSON.stringify([primary, ...(more.length ? more : [])]);
}

/** Bengaluru centre + small offsets so everyone stays within ~15 km for recommendations. */
const BLR = { lat: 12.9716, lon: 77.5946 };

const INDIA_ACCOUNTS = [
  {
    id: 'd0000001-0001-4000-8000-000000000001',
    email: 'india1@promatch.dev',
    name: 'Rahul Sharma',
    age: 29,
    gender: 'Male',
    profession: 'Software Engineer',
    company: 'Tech Park Bengaluru',
    city: 'Bengaluru',
    bio: 'QA — loves cricket and filter coffee.',
    photo_url: IMG.m1,
    photo_urls: urls(IMG.m1, IMG.m2),
    interests: '["Tech","Cricket","Travel"]',
    education: 'B.Tech, IIT',
    linkedin_url: 'https://linkedin.com/in/rahul-sharma-demo',
    is_premium: 1,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Women']),
    industry: 'Technology',
    job_level: 'Senior',
    experience_years: 6,
    latitude: BLR.lat + 0.02,
    longitude: BLR.lon + 0.01,
    about_you_json: null,
  },
  {
    id: 'd0000001-0002-4000-8000-000000000002',
    email: 'india2@promatch.dev',
    name: 'Priya Nair',
    age: 27,
    gender: 'Female',
    profession: 'Product Designer',
    company: 'Design Studio',
    city: 'Bengaluru',
    bio: 'QA — classical dance & UX.',
    photo_url: IMG.w1,
    photo_urls: urls(IMG.w1, IMG.w3),
    interests: '["Design","Bharatanatyam","Coffee"]',
    education: 'B.Des, NID',
    linkedin_url: 'https://linkedin.com/in/priya-nair-demo',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Men']),
    industry: 'Design',
    job_level: 'Mid',
    experience_years: 4,
    latitude: BLR.lat - 0.015,
    longitude: BLR.lon + 0.02,
    about_you_json: aboutYouJson({
      topInterests: ['Design', 'Coffee', 'Art', 'Travel'],
      sameProfessionPreference: false,
      workStyle: 'Hybrid',
      workSchedule: 'Flexible',
      weekendPreference: 'Social',
      fitnessLevel: 'Moderate',
      personalityType: 'Ambivert',
      educationLevel: 'Graduate',
    }),
  },
  {
    id: 'd0000001-0003-4000-8000-000000000003',
    email: 'india3@promatch.dev',
    name: 'Arjun Mehta',
    age: 31,
    gender: 'Male',
    profession: 'DevOps Lead',
    company: 'Cloud India',
    city: 'Bengaluru',
    bio: 'QA — weekend treks in the Western Ghats.',
    photo_url: IMG.m2,
    photo_urls: urls(IMG.m2),
    interests: '["Kubernetes","Trekking","Photography"]',
    education: 'M.Tech, IISc',
    linkedin_url: 'https://linkedin.com/in/arjun-mehta-demo',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Women']),
    industry: 'Technology',
    job_level: 'Lead',
    experience_years: 8,
    latitude: BLR.lat + 0.01,
    longitude: BLR.lon - 0.018,
    about_you_json: aboutYouJson({
      topInterests: ['Engineering', 'Fitness', 'Photography', 'Travel'],
      sameProfessionPreference: 'none',
      workStyle: 'Office',
      workSchedule: 'Fixed',
      weekendPreference: 'Traveling',
      fitnessLevel: 'Very active',
      personalityType: 'Extrovert',
      educationLevel: 'Masters',
    }),
  },
  {
    id: 'd0000001-0004-4000-8000-000000000004',
    email: 'india4@promatch.dev',
    name: 'Ananya Iyer',
    age: 26,
    gender: 'Female',
    profession: 'Marketing Manager',
    company: 'BrandWorks',
    city: 'Bengaluru',
    bio: 'QA — books and filter kaapi.',
    photo_url: IMG.w2,
    photo_urls: urls(IMG.w2, IMG.w1),
    interests: '["Reading","Yoga","Startups"]',
    education: 'MBA, IIM',
    linkedin_url: 'https://linkedin.com/in/ananya-iyer-demo',
    is_premium: 1,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Men']),
    industry: 'Marketing',
    job_level: 'Manager',
    experience_years: 5,
    latitude: BLR.lat - 0.02,
    longitude: BLR.lon - 0.01,
    about_you_json: aboutYouJson({
      topInterests: ['Reading', 'Yoga', 'Startups', 'Cooking'],
      sameProfessionPreference: true,
      workStyle: 'Remote',
      workSchedule: 'Flexible',
      weekendPreference: 'Relaxing',
      fitnessLevel: 'Light',
      personalityType: 'Introvert',
      educationLevel: 'Masters',
    }),
  },
  {
    id: 'd0000001-0005-4000-8000-000000000005',
    email: 'india5@promatch.dev',
    name: 'Vikram Reddy',
    age: 33,
    gender: 'Male',
    profession: 'Staff Engineer',
    company: 'BigTech India',
    city: 'Bengaluru',
    bio: 'QA — open to everyone on the app.',
    photo_url: IMG.m3,
    photo_urls: urls(IMG.m3, IMG.m1),
    interests: '["Open Source","Badminton","Carnatic music"]',
    education: 'M.S., BITS',
    linkedin_url: 'https://linkedin.com/in/vikram-reddy-demo',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Everyone']),
    industry: 'Technology',
    job_level: 'Staff',
    experience_years: 10,
    latitude: BLR.lat + 0.008,
    longitude: BLR.lon + 0.022,
    about_you_json: aboutYouJson({
      topInterests: ['Open Source', 'Music', 'Networking', 'Fitness'],
      sameProfessionPreference: false,
      workStyle: 'Hybrid',
      workSchedule: 'Flexible',
      weekendPreference: 'Social',
      fitnessLevel: 'Active',
      personalityType: 'Ambivert',
      educationLevel: 'Masters',
    }),
  },
  {
    id: 'd0000001-0006-4000-8000-000000000006',
    email: 'india6@promatch.dev',
    name: 'Kavya Krishnan',
    age: 28,
    gender: 'Female',
    profession: 'Data Analyst',
    company: 'Analytics Hub',
    city: 'Bengaluru',
    bio: 'QA — dogs and data viz.',
    photo_url: IMG.w3,
    photo_urls: urls(IMG.w3, IMG.w2),
    interests: '["Dogs","Data Viz","Cafes"]',
    education: 'B.Sc. Statistics',
    linkedin_url: 'https://linkedin.com/in/kavya-krishnan-demo',
    is_premium: 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(['Men']),
    industry: 'Technology',
    job_level: 'Mid',
    experience_years: 3,
    latitude: BLR.lat - 0.008,
    longitude: BLR.lon + 0.015,
    about_you_json: aboutYouJson({
      topInterests: ['Dogs', 'Data Viz', 'Coffee', 'Reading'],
      sameProfessionPreference: 'none',
      workStyle: 'Hybrid',
      workSchedule: 'Fixed',
      weekendPreference: 'Relaxing',
      fitnessLevel: 'Moderate',
      personalityType: 'Introvert',
      educationLevel: 'Graduate',
    }),
  },
];

async function main() {
  await initDb();
  await wipeAll();

  for (const u of INDIA_ACCOUNTS) {
    await insertTestUser({ ...u, about_you_json: u.about_you_json ?? null });
  }

  console.log('');
  console.log('✓ Database reset: all users, OTPs, likes, passes, matches, chats cleared.');
  console.log(`✓ Seeded ${INDIA_ACCOUNTS.length} Bengaluru-area accounts (India QA).`);
  console.log('');
  console.log('  Login (development): OTP 123456');
  console.log('');
  for (const u of INDIA_ACCOUNTS) {
    console.log(`  • ${u.email} — ${u.gender}, ${u.city}`);
  }
  console.log('');
  console.log('  Use india1 + india2 (or any Male↔Female pair) on two devices to swipe & match.');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
