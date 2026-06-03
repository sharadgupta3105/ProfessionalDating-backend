/**
 * PostgreSQL (Supabase) via DATABASE_URL.
 */
const dns = require('dns');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// AWS EC2 / Elastic Beanstalk often has no IPv6 route; Supabase direct host resolves to IPv6 first.
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const { Pool } = require('pg');
const statements = require('./schemaPostgres');
const { prepare } = require('./sqlPg');

let pool = null;

function getPool() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. In Supabase: Project Settings → Database → Connection string (URI). ' +
        'Add it to backend/.env and Render environment variables.',
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      ssl: url.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function query(sql, params = []) {
  const { text, values } = prepare(sql, params);
  return getPool().query(text, values);
}

async function getOne(sql, params = []) {
  const r = await query(sql, params);
  return r.rows[0] ?? null;
}

async function all(sql, params = []) {
  const r = await query(sql, params);
  return r.rows;
}

/** INSERT/UPDATE/DELETE — returns { changes: number } */
async function run(sql, params = []) {
  const r = await query(sql, params);
  return { changes: r.rowCount ?? 0 };
}

async function initDb() {
  const p = getPool();
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    await p.query(trimmed);
  }
  // eslint-disable-next-line no-console
  console.log('[db] PostgreSQL schema ensured (Supabase).');
}

module.exports = {
  getPool,
  query,
  getOne,
  all,
  run,
  initDb,
};
