function friendlyDbMessage(err) {
  const msg = String(err?.message || err || '');
  if (/tenant\/user|ENOTFOUND|ECONNREFUSED|ENETUNREACH/i.test(msg)) {
    return (
      'Database is not reachable. Update DATABASE_URL in AWS Elastic Beanstalk (and backend/.env) ' +
      'with a current Supabase Session pooler URI. See backend/SUPABASE_DATABASE_FIX.md.'
    );
  }
  return null;
}

function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status ?? 500;
  const dbHint = friendlyDbMessage(err);
  const message = dbHint || err.message || 'Internal server error';
  res.status(status).json({ message });
}

module.exports = { errorHandler };
