/**
 * Add 30 India (Bengaluru) QA accounts — 15 Male, 15 Female — without wiping the DB.
 * Emails: inqa01@promatch.dev … inqa30@promatch.dev
 *
 * Run from backend/: npm run seed-india-30
 * Dev OTP: 123456 | Production: set OTP_FIXED_CODE or use email OTP
 */

const { initDb, run } = require('./connection');
const { removeUserByEmail } = require('./seedTestAccounts');

const IMG = {
  m1: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=800',
  m2: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=800',
  m3: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=800',
  m4: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=800',
  w1: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
  w2: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=800',
  w3: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=800',
  w4: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=800',
};

const maleFirst = [
  'Rahul', 'Arjun', 'Vikram', 'Rohan', 'Aman', 'Karan', 'Aditya', 'Siddharth', 'Nikhil', 'Varun',
  'Yash', 'Harsh', 'Ishaan', 'Dev', 'Pranav',
];
const femaleFirst = [
  'Priya', 'Ananya', 'Kavya', 'Meera', 'Isha', 'Riya', 'Sneha', 'Aditi', 'Nisha', 'Pooja',
  'Diya', 'Naina', 'Shreya', 'Neha', 'Maya',
];
const lastNames = [
  'Sharma', 'Nair', 'Iyer', 'Reddy', 'Mehta', 'Gupta', 'Patel', 'Verma', 'Joshi', 'Kapoor',
  'Agarwal', 'Bansal', 'Chopra', 'Kulkarni', 'Desai',
];

const professions = [
  'Software Engineer', 'Product Manager', 'UX Designer', 'Data Scientist', 'Marketing Manager',
  'DevOps Engineer', 'Business Analyst', 'Consultant', 'Finance Manager', 'HR Partner',
];
const companies = [
  'Infosys', 'TCS', 'Wipro', 'Accenture', 'Flipkart', 'Amazon India', 'Razorpay', 'Swiggy',
  'Zomato', 'PhonePe', 'Freshworks', 'CRED', 'Meesho', 'Myntra', 'Google India',
];
const industries = ['Technology', 'Design', 'Finance', 'Marketing', 'Consulting', 'E-commerce'];
const interestsPool = [
  'Tech', 'Startups', 'Coffee', 'Travel', 'Fitness', 'Cricket', 'Books', 'Music',
  'Photography', 'Movies', 'Yoga', 'Badminton', 'Food', 'Hiking',
];
const educations = ['B.Tech', 'MBA', 'B.Des', 'M.Tech', 'B.Com', 'MCA', 'B.Sc'];
const jobLevels = ['Junior', 'Mid', 'Senior', 'Lead', 'Manager'];

const BLR = { lat: 12.9716, lon: 77.5946 };
const TOTAL = 30;

function pick(arr, i) {
  return arr[i % arr.length];
}

function makePhotos(gender, i) {
  const malePool = [IMG.m1, IMG.m2, IMG.m3, IMG.m4];
  const femalePool = [IMG.w1, IMG.w2, IMG.w3, IMG.w4];
  const pool = gender === 'Male' ? malePool : femalePool;
  return [pick(pool, i), pick(pool, i + 1), pick(pool, i + 2)];
}

function makeInterestedIn(gender, i) {
  if (i % 6 === 0) return ['Everyone'];
  if (gender === 'Male') return ['Women'];
  return ['Men'];
}

function makeUser(i) {
  const idx = i - 1;
  const gender = i % 2 === 1 ? 'Male' : 'Female';
  const first = gender === 'Female' ? pick(femaleFirst, idx) : pick(maleFirst, idx);
  const last = pick(lastNames, idx);
  const name = `${first} ${last}`;
  const email = `inqa${String(i).padStart(2, '0')}@promatch.dev`;
  const photos = makePhotos(gender, idx);
  const interestedIn = makeInterestedIn(gender, i);
  const age = 24 + (idx % 10);
  const exp = 1 + (idx % 8);
  const latOffset = ((idx % 8) - 4) * 0.007;
  const lonOffset = ((Math.floor(idx / 8) % 5) - 2) * 0.007;

  return {
    id: `f0000001-${String(i).padStart(4, '0')}-4000-8000-${String(i).padStart(12, '0')}`,
    email,
    name,
    age,
    gender,
    profession: pick(professions, idx),
    company: pick(companies, idx),
    city: 'Bengaluru',
    bio: `India QA — ${name.split(' ')[0]}, ${pick(professions, idx)} in Bengaluru.`,
    photo_url: photos[0],
    photo_urls: JSON.stringify(photos),
    interests: JSON.stringify([pick(interestsPool, idx), pick(interestsPool, idx + 2), pick(interestsPool, idx + 4)]),
    education: `${pick(educations, idx)}, India`,
    linkedin_url: `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-inqa${String(i).padStart(2, '0')}`,
    linkedin_verified: i % 4 === 0 ? 1 : 0,
    is_premium: i % 7 === 0 ? 1 : 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(interestedIn),
    industry: pick(industries, idx),
    job_level: pick(jobLevels, idx),
    experience_years: exp,
    latitude: BLR.lat + latOffset,
    longitude: BLR.lon + lonOffset,
  };
}

async function insertIndiaUser(u) {
  await run(
    `INSERT INTO users (
      id, email, name, age, gender, profession, company, city, bio,
      photo_url, photo_urls, interests, education, linkedin_url, linkedin_verified, is_premium,
      onboarding_complete, interested_in, industry, job_level, experience_years,
      latitude, longitude, created_at, updated_at
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
      u.linkedin_verified,
      u.is_premium,
      u.onboarding_complete,
      u.interested_in,
      u.industry,
      u.job_level,
      u.experience_years,
      u.latitude,
      u.longitude,
    ],
  );
}

async function main() {
  await initDb();
  const users = Array.from({ length: TOTAL }, (_, n) => makeUser(n + 1));
  for (const u of users) {
    await removeUserByEmail(u.email);
    await insertIndiaUser(u);
  }

  console.log('');
  console.log(`✓ Seeded ${users.length} India QA accounts (15 Male, 15 Female) — Bengaluru.`);
  console.log('✓ Emails: inqa01@promatch.dev … inqa30@promatch.dev');
  console.log('✓ Other users in the DB were left unchanged.');
  console.log('');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { makeUser, TOTAL };
