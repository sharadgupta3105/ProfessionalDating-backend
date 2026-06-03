const { initDb, getOne, all } = require('./connection');

/** @type {{ col: string; sql: string }[]} */
const statDefinitions = [
  { col: 'age', sql: 'SELECT COUNT(*)::int AS c FROM users WHERE age IS NULL OR age <= 0' },
  {
    col: 'gender',
    sql: "SELECT COUNT(*)::int AS c FROM users WHERE gender IS NULL OR trim(coalesce(gender::text, '')) = ''",
  },
  {
    col: 'profession',
    sql: "SELECT COUNT(*)::int AS c FROM users WHERE profession IS NULL OR trim(coalesce(profession::text, '')) = ''",
  },
  {
    col: 'education',
    sql: "SELECT COUNT(*)::int AS c FROM users WHERE education IS NULL OR trim(coalesce(education::text, '')) = ''",
  },
  {
    col: 'latitude',
    sql: 'SELECT COUNT(*)::int AS c FROM users WHERE latitude IS NULL OR longitude IS NULL',
  },
  {
    col: 'longitude',
    sql: 'SELECT COUNT(*)::int AS c FROM users WHERE latitude IS NULL OR longitude IS NULL',
  },
  {
    col: 'interested_in',
    sql: "SELECT COUNT(*)::int AS c FROM users WHERE interested_in IS NULL OR trim(coalesce(interested_in::text, '')) = ''",
  },
  {
    col: 'photo_urls',
    sql: "SELECT COUNT(*)::int AS c FROM users WHERE photo_urls IS NULL OR trim(coalesce(photo_urls::text, '')) = ''",
  },
  {
    col: 'photo_url',
    sql: "SELECT COUNT(*)::int AS c FROM users WHERE photo_url IS NULL OR trim(coalesce(photo_url::text, '')) = ''",
  },
];

async function main() {
  await initDb();
  const totalRow = await getOne('SELECT COUNT(*)::int AS c FROM users');
  const total = totalRow?.c ?? 0;

  const stats = [];
  for (const { col, sql } of statDefinitions) {
    const r = await getOne(sql);
    stats.push({ col, nullOrEmptyCount: r?.c ?? 0 });
  }

  const sample = await all(
    'SELECT id, name, age, gender, profession, education, latitude, longitude, city, photo_url, photo_urls FROM users LIMIT 5',
  );

  console.log(JSON.stringify({ total, stats, sample }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
