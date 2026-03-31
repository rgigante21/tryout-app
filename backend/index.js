require('dotenv').config();
const express      = require('express');
const cookieParser = require('cookie-parser');
const { startScheduler } = require('./scheduler');

const { buildCors, apiLimiter, requestId, helmetMiddleware } = require('./middleware/security');

const authRoutes              = require('./routes/auth');
const sessionRoutes           = require('./routes/sessions');
const sessionBlockRoutes      = require('./routes/session-blocks');
const sessionPlayerRoutes     = require('./routes/session-players');
const scoreRoutes             = require('./routes/scores');
const adminRoutes             = require('./routes/admin');
const importRoutes            = require('./routes/import');
const evaluationTemplateRoutes = require('./routes/evaluation-templates');

// ── Required env validation ───────────────────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'];
const isProd = process.env.NODE_ENV === 'production';

const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error('[startup] Missing required environment variables:', missingEnv.join(', '));
  process.exit(1);
}

if (isProd && !process.env.CORS_ORIGINS) {
  console.error('[startup] CORS_ORIGINS must be set in production');
  process.exit(1);
}

// ── App setup ─────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 4000;

// Trust reverse proxy (needed for correct rate-limit IP detection behind Nginx/Traefik)
if (isProd) app.set('trust proxy', 1);

app.use(requestId);
app.use(helmetMiddleware);
app.use(buildCors());
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(apiLimiter);

// ── Request logging (structured in production, simple in dev) ────────────────
app.use((req, _res, next) => {
  if (isProd) {
    console.log(JSON.stringify({
      ts:     new Date().toISOString(),
      method: req.method,
      path:   req.path,
      rid:    req.requestId,
    }));
  } else {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
// Cache-Control: no-store on all auth + session-sensitive responses
app.use('/api/auth', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
}, authRoutes);

app.use('/api/sessions',             sessionRoutes);
app.use('/api/session-blocks',       sessionBlockRoutes);
app.use('/api/session-players',      sessionPlayerRoutes);
app.use('/api/scores',               scoreRoutes);
app.use('/api/admin',                adminRoutes);
app.use('/api/import',               importRoutes);
app.use('/api/evaluation-templates', evaluationTemplateRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Centralized error handler ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const rid = req.requestId || '-';
  console.error(`[error][${rid}]`, err.message, err.stack);
  // Never expose internal error details in production
  const message = isProd ? 'An unexpected error occurred' : err.message;
  res.status(err.status || 500).json({ error: message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nTryout API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}\n`);
  startScheduler();
});
