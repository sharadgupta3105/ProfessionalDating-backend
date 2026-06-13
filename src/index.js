require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { initDb } = require('./db/connection');
const { errorHandler } = require('./middleware/errorHandler');
const { attachChatSocket } = require('./socket/chatSocket');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const matchesRoutes = require('./routes/matches');
const chatsRoutes = require('./routes/chats');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8081';

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : [FRONTEND_URL];
const allowAllOrigins = corsOrigins.includes('*');
const corsMiddlewareOptions = allowAllOrigins
  ? { origin: '*', credentials: false, optionsSuccessStatus: 204 }
  : { origin: corsOrigins, credentials: true, optionsSuccessStatus: 204 };

app.use(cors(corsMiddlewareOptions));
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/matches', matchesRoutes);
app.use('/chats', chatsRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/health/db', async (req, res) => {
  try {
    const { getPool } = require('./db/connection');
    await getPool().query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (e) {
    res.status(503).json({
      ok: false,
      database: 'error',
      message: e?.message || 'Database connection failed',
      hint: 'See backend/SUPABASE_DATABASE_FIX.md',
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'promatch-api',
    health: '/health',
    region: process.env.APP_REGION || 'IN',
  });
});

app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
  path: '/socket.io',
  // Detect dead clients faster so push is not skipped after the app is killed.
  pingInterval: 10_000,
  pingTimeout: 20_000,
  cors: allowAllOrigins
    ? { origin: '*', credentials: false }
    : { origin: corsOrigins, credentials: true },
});
app.set('io', io);
attachChatSocket(io);

async function maybeSeedDemoAccount() {
  if (process.env.SEED_DEMO_ACCOUNT !== '1') return;
  try {
    const { seedDemoAccount } = require('./db/seedDemoAccount');
    await seedDemoAccount();
    // eslint-disable-next-line no-console
    console.log('[boot] SEED_DEMO_ACCOUNT: demo user refreshed');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[boot] SEED_DEMO_ACCOUNT failed:', err.message || err);
  }
}

async function maybeSeedPromatchTestAccounts() {
  if (process.env.SEED_PROMATCH_TEST_ACCOUNTS !== '1') return;
  try {
    const { seedTestUsersAsync } = require('./db/seedTestAccounts');
    await seedTestUsersAsync();
    // eslint-disable-next-line no-console
    console.log('[boot] SEED_PROMATCH_TEST_ACCOUNTS: @promatch.dev test users refreshed');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[boot] SEED_PROMATCH_TEST_ACCOUNTS failed:', err.message || err);
  }
}

async function start() {
  await initDb();
  await maybeSeedDemoAccount();
  await maybeSeedPromatchTestAccounts();
  server.listen(PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`LinkedUp API + Socket.io at http://localhost:${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`CORS / socket origins: ${allowAllOrigins ? '*' : corsOrigins.join(', ')}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
