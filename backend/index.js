require('dotenv').config();
const express      = require('express');
const cookieParser = require('cookie-parser');
const { startScheduler } = require('./scheduler');

const { buildCors, apiLimiter, importUploadLimiter, requestId, helmetMiddleware } = require('./middleware/security');

const authRoutes              = require('./routes/auth');
const sessionRoutes           = require('./routes/sessions');
const sessionBlockRoutes      = require('./routes/session-blocks');
const sessionPlayerRoutes     = require('./routes/session-players');
const scoreRoutes             = require('./routes/scores');
const adminRoutes             = require('./routes/admin');
const importRoutes            = require('./routes/import');
const importLegacyRoutes      = require('./routes/import-legacy');
const exportRoutes            = require('./routes/export');
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
// Upload endpoint gets a tighter rate limit (10/min); other import routes use apiLimiter
app.post('/api/events/:eventId/import/upload', importUploadLimiter);
// Event-scoped import/export routes: /api/events/:eventId/import/... and /api/events/:eventId/export/...
app.use('/api/events',               importRoutes);
app.use('/api/events',               exportRoutes);
// Legacy import routes (deprecated — kept for WorkspacePage/GroupsView backward compatibility)
app.use('/api/import',               importLegacyRoutes);
app.use('/api/evaluation-templates', evaluationTemplateRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Multer error handler (file upload validation) ─────────────────────────────
// 4-arg error handlers must be registered before the 404 catch-all.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File exceeds the 5 MB size limit' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field — use field name "file"' });
  }
  if (err.message && err.message.includes('Only CSV and XLSX')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// ── Centralized error handler ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const rid = req.requestId || '-';
  console.error(`[error][${rid}]`, err.message, err.stack);
  // Never expose internal error details in production
  const message = isProd ? 'An unexpected error occurred' : err.message;
  res.status(err.status || 500).json({ error: message });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nTryout API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}\n`);
  startScheduler();
});
