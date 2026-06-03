const { initDb, all } = require('./connection');

(async () => {
  await initDb();
  const rows = await all(
    'SELECT id, name, city, latitude, longitude FROM users WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0',
  );
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
