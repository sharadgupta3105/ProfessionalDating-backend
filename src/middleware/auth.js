const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  req.userId = decoded.userId;
  next();
}

module.exports = { signToken, verifyToken, authMiddleware, JWT_SECRET };
