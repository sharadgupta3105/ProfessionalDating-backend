/**
 * MatchedIn DB schema (SQLite)
 * Run via: npm run init-db
 */

const schema = `
-- Users (profiles)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  profession TEXT,
  company TEXT,
  city TEXT,
  bio TEXT,
  photo_url TEXT,
  interests TEXT,
  education TEXT,
  linkedin_url TEXT,
  linkedin_verified INTEGER DEFAULT 0,
  is_premium INTEGER DEFAULT 0,
  onboarding_complete INTEGER DEFAULT 0,
  gender TEXT,
  interested_in TEXT,
  industry TEXT,
  job_level TEXT,
  experience_years INTEGER,
  latitude REAL,
  longitude REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- OTP codes for email login (expire after 10 min)
CREATE TABLE IF NOT EXISTS otp_codes (
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

-- Likes (like / super_like)
CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'super_like')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, target_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_user_id);

-- Passes (so we don't show them again)
CREATE TABLE IF NOT EXISTS passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, target_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_passes_user ON passes(user_id);

-- Per-user swipe allowance. The 24-hour lock starts when the allowance is exhausted.
CREATE TABLE IF NOT EXISTS swipe_limit_states (
  user_id TEXT PRIMARY KEY,
  swipe_count INTEGER NOT NULL DEFAULT 0,
  reset_at TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  CHECK (swipe_count >= 0),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_swipe_limit_reset ON swipe_limit_states(reset_at);

-- Matches (mutual likes) – one row per pair, ordered by id
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id_1 TEXT NOT NULL,
  user_id_2 TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id_1, user_id_2),
  CHECK (user_id_1 < user_id_2),
  FOREIGN KEY (user_id_1) REFERENCES users(id),
  FOREIGN KEY (user_id_2) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_matches_u1 ON matches(user_id_1);
CREATE INDEX IF NOT EXISTS idx_matches_u2 ON matches(user_id_2);

-- Conversations (one per match; user1_id < user2_id for consistency)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id_1 TEXT NOT NULL,
  user_id_2 TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id_1, user_id_2),
  CHECK (user_id_1 < user_id_2),
  FOREIGN KEY (user_id_1) REFERENCES users(id),
  FOREIGN KEY (user_id_2) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_conv_u1 ON conversations(user_id_1);
CREATE INDEX IF NOT EXISTS idx_conv_u2 ON conversations(user_id_2);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

-- Per-user read cursor (last_read_rowid avoids fragile string compares on created_at)
CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_read_at TEXT NOT NULL,
  last_read_rowid INTEGER,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_conv_reads_user ON conversation_reads(user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  product_id TEXT,
  source TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  revenuecat_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
`;

module.exports = { schema };
