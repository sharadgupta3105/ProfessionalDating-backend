/**
 * Adapt SQLite-style ? placeholders and datetime('now') for node-postgres.
 */
function toPgParams(sql, values) {
  let n = 0;
  const text = sql.replace(/\?/g, () => `$${++n}`);
  return { text, values };
}

/** Normalize common SQLite datetime / date helpers to PostgreSQL. */
function normalizeSql(sql) {
  let s = sql;
  s = s.replace(/datetime\('now'\)/gi, 'NOW()');
  s = s.replace(/datetime\("now"\)/gi, 'NOW()');
  s = s.replace(/datetime\('now',\s*'utc'\)/gi, "NOW() AT TIME ZONE 'UTC'");
  // Swipe limit: same calendar day in UTC (matches typical serverless DB behavior)
  s = s.replace(
    /date\(created_at,\s*'localtime'\)\s*=\s*date\('now',\s*'localtime'\)/gi,
    "(created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date",
  );
  s = s.replace(/ORDER BY datetime\(created_at\)/gi, 'ORDER BY created_at');
  return s;
}

/**
 * @param {string} sql - may use ? placeholders
 * @param {unknown[]} [values]
 */
function prepare(sql, values = []) {
  const merged = normalizeSql(sql);
  return toPgParams(merged, values);
}

module.exports = { prepare, normalizeSql, toPgParams };
