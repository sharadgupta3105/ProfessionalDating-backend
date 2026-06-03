const { initDb, all, run } = require('./connection');
const { lookupCityCoords } = require('../config/region');

function isNullOrEmpty(v) {
  return v == null || v === '' || (typeof v === 'string' && !v.trim());
}

function inferInterestedInFromGender(gender) {
  if (gender === 'Male') return ['Women'];
  if (gender === 'Female') return ['Men'];
  return ['Everyone'];
}

async function main() {
  await initDb();

  const users = await all(
    'SELECT id, name, age, gender, profession, education, city, latitude, longitude, interested_in, photo_url, photo_urls FROM users',
  );

  let updatedCount = 0;
  for (const u of users) {
    let nextAge = u.age;
    let nextGender = u.gender;
    let nextProfession = u.profession;
    let nextEducation = u.education;
    let nextLat = u.latitude;
    let nextLon = u.longitude;
    let nextInterestedIn = u.interested_in;
    let nextPhotoUrls = u.photo_urls;

    let changed = false;

    if (isNullOrEmpty(nextAge) || Number(nextAge) <= 0) {
      nextAge = 30;
      changed = true;
    }
    if (isNullOrEmpty(nextGender)) {
      nextGender = 'Male';
      changed = true;
    }
    if (isNullOrEmpty(nextProfession)) {
      nextProfession = 'Other';
      changed = true;
    }
    if (isNullOrEmpty(nextEducation)) {
      nextEducation = 'Graduate';
      changed = true;
    }

    const coords = lookupCityCoords(u.city);
    if ((nextLat == null || isNullOrEmpty(nextLat)) && coords) {
      nextLat = coords.lat;
      nextLon = coords.lon;
      changed = true;
    }

    if (isNullOrEmpty(nextInterestedIn)) {
      nextInterestedIn = JSON.stringify(inferInterestedInFromGender(nextGender));
      changed = true;
    }

    if (isNullOrEmpty(nextPhotoUrls)) {
      if (!isNullOrEmpty(u.photo_url)) {
        nextPhotoUrls = JSON.stringify([u.photo_url]);
      } else {
        nextPhotoUrls = JSON.stringify([]);
      }
      changed = true;
    }

    if (changed) {
      await run(
        `UPDATE users SET
          age = ?,
          gender = ?,
          profession = ?,
          education = ?,
          latitude = ?,
          longitude = ?,
          interested_in = ?,
          photo_urls = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          nextAge,
          nextGender,
          nextProfession,
          nextEducation,
          nextLat,
          nextLon,
          nextInterestedIn,
          nextPhotoUrls,
          u.id,
        ],
      );
      updatedCount += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Backfill complete. Updated rows: ${updatedCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
