/**
 * Full reset + seed 60 India-based QA accounts (Bengaluru area), all with multiple photos.
 *
 * Run from backend/: npm run seed-india-60
 * Dev login OTP: 123456
 */

const { initDb } = require('./connection');
const { insertTestUser } = require('./seedTestAccounts');
const { wipeAll } = require('./wipeAllData');

const IMG = {
  m1: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=800',
  m2: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=800',
  m3: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=800',
  m4: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=800',
  m5: 'https://images.pexels.com/photos/936117/pexels-photo-936117.jpeg?auto=compress&cs=tinysrgb&w=800',
  w1: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
  w2: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=800',
  w3: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=800',
  w4: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=800',
  w5: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=800',
  nb1: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=800',
  nb2: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=800',
};

const maleFirst = [
  'Rahul', 'Arjun', 'Vikram', 'Rohan', 'Aman', 'Karan', 'Aditya', 'Siddharth', 'Nikhil', 'Varun',
  'Yash', 'Harsh', 'Ishaan', 'Dev', 'Pranav', 'Akash', 'Tarun', 'Ritvik', 'Ankit', 'Raghav',
  'Abhinav', 'Manav', 'Puneet', 'Tejas', 'Sameer', 'Neeraj', 'Shivam', 'Nitin', 'Jay', 'Kunal',
];
const femaleFirst = [
  'Priya', 'Ananya', 'Kavya', 'Meera', 'Isha', 'Riya', 'Sneha', 'Aditi', 'Nisha', 'Pooja',
  'Diya', 'Naina', 'Shreya', 'Neha', 'Maya', 'Tanya', 'Sara', 'Radhika', 'Payal', 'Vaishnavi',
  'Komal', 'Simran', 'Aarohi', 'Mitali', 'Sonali', 'Ritu', 'Preeti', 'Khushi', 'Madhuri', 'Saanvi',
];
const lastNames = [
  'Sharma', 'Nair', 'Iyer', 'Reddy', 'Mehta', 'Gupta', 'Patel', 'Verma', 'Joshi', 'Kapoor',
  'Agarwal', 'Bansal', 'Chopra', 'Kulkarni', 'Desai', 'Singh', 'Yadav', 'Mishra', 'Malhotra', 'Saxena',
  'Khan', 'Das', 'Menon', 'Pillai', 'Bhatt', 'Tripathi', 'Arora', 'Jain', 'Bose', 'Chatterjee',
];

const professions = [
  'Software Engineer', 'Product Manager', 'UX Designer', 'Data Scientist', 'Marketing Manager',
  'Sales Manager', 'DevOps Engineer', 'Business Analyst', 'Consultant', 'Finance Manager',
  'HR Partner', 'Operations Lead', 'Content Strategist', 'QA Engineer', 'Solution Architect',
];
const companies = [
  'Infosys', 'TCS', 'Wipro', 'Accenture', 'Flipkart',
  'Amazon India', 'Google India', 'Razorpay', 'Swiggy', 'Zomato',
  'Meesho', 'Myntra', 'PhonePe', 'Freshworks', 'CRED',
];
const industries = [
  'Technology', 'Design', 'Finance', 'Marketing', 'Consulting', 'E-commerce',
];
const interestsPool = [
  'Tech', 'Startups', 'Coffee', 'Travel', 'Fitness', 'Cricket', 'Books', 'Music',
  'Photography', 'Movies', 'Yoga', 'Badminton', 'Cycling', 'Food', 'Hiking',
];
const educations = [
  'B.Tech', 'MBA', 'B.Des', 'M.Tech', 'B.Com', 'BBA', 'MCA', 'B.Sc. Statistics',
];
const jobLevels = ['Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Staff'];

const BLR = { lat: 12.9716, lon: 77.5946 };
const TOTAL = 60;

function pick(arr, i) {
  return arr[i % arr.length];
}

function makePhotos(gender, i) {
  const malePool = [IMG.m1, IMG.m2, IMG.m3, IMG.m4, IMG.m5];
  const femalePool = [IMG.w1, IMG.w2, IMG.w3, IMG.w4, IMG.w5];
  const nbPool = [IMG.nb1, IMG.nb2, IMG.m2, IMG.w2, IMG.m4];
  const pool = gender === 'Male' ? malePool : gender === 'Female' ? femalePool : nbPool;
  const a = pick(pool, i);
  const b = pick(pool, i + 1);
  const c = pick(pool, i + 2);
  return [a, b, c];
}

function makeInterestedIn(gender, i) {
  if (i % 11 === 0) return ['Everyone'];
  if (gender === 'Male') return i % 7 === 0 ? ['Men'] : ['Women'];
  if (gender === 'Female') return i % 9 === 0 ? ['Women'] : ['Men'];
  return ['Everyone'];
}

function makeUser(i) {
  const idx = i - 1;
  const gender = i % 10 === 0 ? 'Non-binary' : i % 2 === 0 ? 'Female' : 'Male';
  const first = gender === 'Female' ? pick(femaleFirst, idx) : pick(maleFirst, idx);
  const last = pick(lastNames, idx);
  const name = `${first} ${last}`;
  const email = `india${String(i).padStart(2, '0')}@promatch.dev`;
  const photos = makePhotos(gender, idx);
  const interestedIn = makeInterestedIn(gender, i);
  const age = 24 + (idx % 12);
  const exp = 2 + (idx % 10);
  const latOffset = ((idx % 10) - 5) * 0.0065;
  const lonOffset = ((Math.floor(idx / 10) % 6) - 3) * 0.0068;

  return {
    id: `e0000001-${String(i).padStart(4, '0')}-4000-8000-${String(i).padStart(12, '0')}`,
    email,
    name,
    age,
    gender,
    profession: pick(professions, idx),
    company: pick(companies, idx),
    city: 'Bengaluru',
    bio: `QA profile ${i} - Bengaluru professional, open to meaningful connections.`,
    photo_url: photos[0],
    photo_urls: JSON.stringify(photos),
    interests: JSON.stringify([
      pick(interestsPool, idx),
      pick(interestsPool, idx + 3),
      pick(interestsPool, idx + 6),
    ]),
    education: `${pick(educations, idx)}, India`,
    linkedin_url: `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-${String(i).padStart(2, '0')}`,
    linkedin_verified: i % 3 === 0 ? 1 : 0,
    is_premium: i % 8 === 0 ? 1 : 0,
    onboarding_complete: 1,
    interested_in: JSON.stringify(interestedIn),
    industry: pick(industries, idx),
    job_level: pick(jobLevels, idx),
    experience_years: exp,
    latitude: BLR.lat + latOffset,
    longitude: BLR.lon + lonOffset,
  };
}

async function main() {
  await initDb();
  await wipeAll();

  const users = Array.from({ length: TOTAL }, (_, n) => makeUser(n + 1));
  for (const u of users) {
    await insertTestUser(u);
  }

  console.log('');
  console.log('✓ Database fully reset and seeded for India QA.');
  console.log(`✓ Seeded ${users.length} Bengaluru accounts (all have 3 photos).`);
  console.log('✓ Development OTP: 123456');
  console.log('');
  console.log('Sample test accounts:');
  for (const u of users.slice(0, 12)) {
    console.log(`  • ${u.email} — ${u.gender}, ${u.profession}`);
  }
  console.log('');
  console.log(`Range available: india01@promatch.dev ... india${String(TOTAL).padStart(2, '0')}@promatch.dev`);
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

