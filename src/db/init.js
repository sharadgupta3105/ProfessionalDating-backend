const { initDb } = require('./connection');

initDb()
  .then(() => {
    console.log('PostgreSQL schema applied (check DATABASE_URL / Supabase).');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
