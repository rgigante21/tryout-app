require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const { startScheduler } = require('./scheduler');

const authRoutes              = require('./routes/auth');
const sessionRoutes           = require('./routes/sessions');
const sessionBlockRoutes      = require('./routes/session-blocks');
const scoreRoutes             = require('./routes/scores');
const adminRoutes             = require('./routes/admin');
const importRoutes            = require('./routes/import');
const evaluationTemplateRoutes = require('./routes/evaluation-templates');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '2mb' })); // raised for CSV text payloads

if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

app.use('/api/auth',                 authRoutes);
app.use('/api/sessions',             sessionRoutes);
app.use('/api/session-blocks',       sessionBlockRoutes);
app.use('/api/scores',               scoreRoutes);
app.use('/api/admin',                adminRoutes);
app.use('/api/import',               importRoutes);
app.use('/api/evaluation-templates', evaluationTemplateRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`\n🏒 Tryout API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
  startScheduler();
});
