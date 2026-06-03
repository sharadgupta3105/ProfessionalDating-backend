const { initDb, all } = require('./connection');

(async () => {
  await initDb();
  const rows = await all('SELECT city, COUNT(*)::int AS c FROM users GROUP BY city ORDER BY c DESC');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
