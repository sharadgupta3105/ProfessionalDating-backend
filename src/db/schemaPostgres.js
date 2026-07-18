/**
 * Supabase / PostgreSQL DDL — run in order on empty DB (initDb).
 * Mirrors SQLite schema + columns previously added via ALTER in SQLite.
 */
module.exports = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    age INTEGER,
    profession TEXT,
    company TEXT,
    city TEXT,
    bio TEXT,
    photo_url TEXT,
    photo_urls TEXT,
    interests TEXT,
    education TEXT,
    linkedin_url TEXT,
    linkedin_verified SMALLINT NOT NULL DEFAULT 0,
    is_premium SMALLINT NOT NULL DEFAULT 0,
    onboarding_complete SMALLINT NOT NULL DEFAULT 0,
    gender TEXT,
    interested_in TEXT,
    industry TEXT,
    job_level TEXT,
    experience_years INTEGER,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    about_you_json TEXT,
    dating_prefs_json TEXT,
    expo_push_token TEXT,
    expo_push_token_saved_at TEXT,
    app_in_foreground SMALLINT NOT NULL DEFAULT 0,
    app_presence_updated_at TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS otp_codes (
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email)`,

  `CREATE TABLE IF NOT EXISTS likes (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    target_user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('like', 'super_like')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, target_user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_user_id)`,

  `CREATE TABLE IF NOT EXISTS passes (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    target_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, target_user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_passes_user ON passes(user_id)`,

  `CREATE TABLE IF NOT EXISTS swipe_limit_states (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    swipe_count INTEGER NOT NULL DEFAULT 0,
    reset_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (swipe_count >= 0)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_swipe_limit_reset ON swipe_limit_states(reset_at)`,

  `CREATE TABLE IF NOT EXISTS matches (
    id BIGSERIAL PRIMARY KEY,
    user_id_1 TEXT NOT NULL REFERENCES users(id),
    user_id_2 TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id_1, user_id_2),
    CHECK (user_id_1 < user_id_2)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_matches_u1 ON matches(user_id_1)`,
  `CREATE INDEX IF NOT EXISTS idx_matches_u2 ON matches(user_id_2)`,

  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id_1 TEXT NOT NULL REFERENCES users(id),
    user_id_2 TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id_1, user_id_2),
    CHECK (user_id_1 < user_id_2)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conv_u1 ON conversations(user_id_1)`,
  `CREATE INDEX IF NOT EXISTS idx_conv_u2 ON conversations(user_id_2)`,

  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    sender_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seq BIGSERIAL UNIQUE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)`,

  `CREATE TABLE IF NOT EXISTS conversation_reads (
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    last_read_at TIMESTAMPTZ NOT NULL,
    last_read_rowid BIGINT,
    PRIMARY KEY (conversation_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conv_reads_user ON conversation_reads(user_id)`,

  `CREATE TABLE IF NOT EXISTS blocks (
    id BIGSERIAL PRIMARY KEY,
    blocker_id TEXT NOT NULL REFERENCES users(id),
    blocked_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id)`,
  `CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id)`,

  `CREATE TABLE IF NOT EXISTS user_reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id TEXT NOT NULL REFERENCES users(id),
    reported_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reports_reported ON user_reports(reported_id)`,

  `CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    plan TEXT NOT NULL,
    product_id TEXT,
    source TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active SMALLINT NOT NULL DEFAULT 1,
    revenuecat_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(user_id, expires_at)`,
];
