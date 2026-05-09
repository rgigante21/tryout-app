/**
 * Test helpers — shared utilities for building the Express app in test mode
 * and seeding / tearing down a real test database.
 *
 * Tests run against a real Postgres database.  Set TEST_DB_URL in your
 * environment (or .env.test) to point at a dedicated test database.
 *
 * Example .env.test:
 *   TEST_DB_URL=postgres://postgres@localhost:5432/tryoutapp_test
 *   JWT_SECRET=test-secret-at-least-32-chars-long-here
 *   DB_PASS=postgres
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.test'), override: true });

// Ensure required env vars are set for tests
process.env.JWT_SECRET  = process.env.JWT_SECRET  || 'test-secret-minimum-32-chars-xxxxxxxxxxx';
process.env.DB_PASS     = process.env.DB_PASS     || 'postgres';
process.env.DB_HOST     = process.env.DB_HOST     || 'localhost';
process.env.DB_NAME     = process.env.DB_NAME     || 'tryoutapp';
process.env.DB_USER     = process.env.DB_USER     || 'postgres';
process.env.NODE_ENV    = 'test';

const { Pool }   = require('pg');
// Use bcryptjs (pure JS) so tests run on macOS without needing the Linux
// native bcrypt binary that Docker compiles inside the container.
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');

// Separate pool so tests can control transactions
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
});

let schemaReady = false;

async function ensureTestSchema() {
  if (schemaReady) return;
  await pool.query(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) DEFAULT '#6B1E2E',
      ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'
  `);
  schemaReady = true;
}

/**
 * Build the Express app without calling app.listen().
 * Imported lazily so env is patched before any module-level pool connections.
 */
function buildApp() {
  const express      = require('express');
  const cookieParser = require('cookie-parser');
  const { buildCors, requestId, helmetMiddleware } = require('../middleware/security');
  const { authMiddleware } = require('../middleware/auth');
  const { orgMiddleware } = require('../middleware/org');

  const app = express();
  app.use(requestId);
  app.use(helmetMiddleware);
  app.use(buildCors());
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/auth',            require('../routes/auth'));
  app.use('/api/sessions',        authMiddleware, orgMiddleware, require('../routes/sessions'));
  app.use('/api/session-players', authMiddleware, orgMiddleware, require('../routes/session-players'));
  app.use('/api/scores',          authMiddleware, orgMiddleware, require('../routes/scores'));
  app.use('/api/admin',           authMiddleware, orgMiddleware, require('../routes/admin'));
  app.use('/api/events',          authMiddleware, orgMiddleware, require('../routes/import'));
  app.use('/api/events',          authMiddleware, orgMiddleware, require('../routes/export'));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });

  return app;
}

/**
 * Create a test organization. Returns the org row.
 */
async function createOrg({ name, subdomain } = {}) {
  await ensureTestSchema();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  subdomain = subdomain || `test-${suffix}`;
  name = name || `Test Org ${suffix}`;
  const r = await pool.query(
    `INSERT INTO organizations (name, subdomain, slug) VALUES ($1, $2, $3) RETURNING *`,
    [name, subdomain, subdomain]
  );
  return r.rows[0];
}

/**
 * Create a user in the DB and return { id, email, password, cookie, orgId }.
 * cookie is a Set-Cookie header value suitable for supertest .set('Cookie', cookie).
 * orgId is required — all users must belong to an organization.
 */
async function createUser({ orgId, email, password = 'TestPass1234!', role = 'scorer', firstName = 'Test', lastName = 'User' } = {}) {
  if (!orgId) throw new Error('createUser: orgId is required');
  email = email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const hash = await bcrypt.hash(password, 4); // low cost for speed in tests
  const r = await pool.query(
    `INSERT INTO users (organization_id, email, password, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role`,
    [orgId, email, hash, firstName, lastName, role]
  );
  const user = r.rows[0];
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName, lastName, organization_id: orgId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const cookie = `auth_token=${token}`;
  return { ...user, password, cookie, orgId };
}

/**
 * Create a minimal tryout event + age group + session for use in tests.
 * orgId is required.
 */
async function createEventFixture(orgId) {
  if (!orgId) throw new Error('createEventFixture: orgId is required');

  const agCode = `AG${Date.now()}`;
  const agR = await pool.query(
    `INSERT INTO age_groups (organization_id, name, code, sort_order) VALUES ($1,$2,$3,99) RETURNING *`,
    [orgId, `TestGroup ${agCode}`, agCode]
  );
  const ageGroup = agR.rows[0];

  const evR = await pool.query(
    `INSERT INTO tryout_events (organization_id, name, season, start_date, end_date)
     VALUES ($1, 'Test Event','Spring 2099','2099-01-01','2099-01-02') RETURNING *`,
    [orgId]
  );
  const event = evR.rows[0];

  const sbR = await pool.query(
    `INSERT INTO session_blocks (event_id, age_group_id, block_type, split_method, session_date)
     VALUES ($1,$2,'skills','none','2099-01-01') RETURNING *`,
    [event.id, ageGroup.id]
  );
  const block = sbR.rows[0];

  const sR = await pool.query(
    `INSERT INTO sessions (organization_id, name, event_id, age_group_id, block_id, session_date, start_time, status, session_type)
     VALUES ($1,'Test Session',$2,$3,$4,'2099-01-01','10:00:00','active','skills') RETURNING *`,
    [orgId, event.id, ageGroup.id, block.id]
  );
  const session = sR.rows[0];

  const pR = await pool.query(
    `INSERT INTO players (organization_id, first_name, last_name)
     VALUES ($1,'Player','One') RETURNING *`,
    [orgId]
  );
  const player = pR.rows[0];

  const regR = await pool.query(
    `INSERT INTO player_event_registrations
       (player_id, event_id, age_group_id, jersey_number, position, will_tryout)
     VALUES ($1,$2,$3,1,'skater',true)
     RETURNING *`,
    [player.id, event.id, ageGroup.id]
  );
  const registration = regR.rows[0];

  await pool.query(
    `INSERT INTO session_players (session_id, player_id, registration_id) VALUES ($1,$2,$3)`,
    [session.id, player.id, registration.id]
  );

  return { event, ageGroup, block, session, player, registration };
}

/**
 * Assign a scorer user to a session.
 */
async function assignScorer(sessionId, userId) {
  await pool.query(
    `INSERT INTO session_scorers (session_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [sessionId, userId]
  );
}

/**
 * Clean up rows created during a test by ID sets.
 * Each statement is wrapped individually so one failure does not skip the rest.
 * Call in afterEach / afterAll.
 */
async function cleanup({ userIds = [], eventIds = [], ageGroupIds = [], orgIds = [] } = {}) {
  const run = async (sql, params) => {
    try { await pool.query(sql, params); }
    catch (err) { console.warn('[test cleanup]', err.message, '|', sql.trim().slice(0, 80)); }
  };

  if (eventIds.length) {
    await run(`DELETE FROM scores          WHERE session_id IN (SELECT id FROM sessions WHERE event_id = ANY($1))`, [eventIds]);
    await run(`DELETE FROM session_scorers WHERE session_id IN (SELECT id FROM sessions WHERE event_id = ANY($1))`, [eventIds]);
    await run(`DELETE FROM session_players WHERE session_id IN (SELECT id FROM sessions WHERE event_id = ANY($1))`, [eventIds]);
    await run(`DELETE FROM sessions        WHERE event_id = ANY($1)`, [eventIds]);
    await run(`DELETE FROM session_blocks  WHERE event_id = ANY($1)`, [eventIds]);
    await run(`DELETE FROM player_event_registrations WHERE event_id = ANY($1)`, [eventIds]);
    await run(`DELETE FROM tryout_events   WHERE id = ANY($1)`, [eventIds]);
  }

  if (ageGroupIds.length) {
    await run(`DELETE FROM scores          WHERE session_id IN (SELECT id FROM sessions WHERE age_group_id = ANY($1))`, [ageGroupIds]);
    await run(`DELETE FROM session_scorers WHERE session_id IN (SELECT id FROM sessions WHERE age_group_id = ANY($1))`, [ageGroupIds]);
    await run(`DELETE FROM session_players WHERE session_id IN (SELECT id FROM sessions WHERE age_group_id = ANY($1))`, [ageGroupIds]);
    await run(`DELETE FROM sessions        WHERE age_group_id = ANY($1)`, [ageGroupIds]);
    await run(`DELETE FROM session_blocks  WHERE age_group_id = ANY($1)`, [ageGroupIds]);
    await run(`DELETE FROM player_event_registrations WHERE age_group_id = ANY($1)`, [ageGroupIds]);
    await run(`DELETE FROM age_groups      WHERE id = ANY($1)`, [ageGroupIds]);
  }

  await run(`
    DELETE FROM players p
    WHERE NOT EXISTS (
      SELECT 1 FROM player_event_registrations per WHERE per.player_id = p.id
    )
  `, []);

  if (userIds.length) {
    await run(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
  }

  // Org cleanup — cascade through all org-owned data
  if (orgIds.length) {
    await run(`DELETE FROM audit_log WHERE organization_id = ANY($1)`, [orgIds]);
    await run(`DELETE FROM scores WHERE session_id IN (SELECT id FROM sessions WHERE organization_id = ANY($1))`, [orgIds]);
    await run(`DELETE FROM session_scorers WHERE session_id IN (SELECT id FROM sessions WHERE organization_id = ANY($1))`, [orgIds]);
    await run(`DELETE FROM session_players WHERE session_id IN (SELECT id FROM sessions WHERE organization_id = ANY($1))`, [orgIds]);
    await run(`DELETE FROM sessions WHERE organization_id = ANY($1)`, [orgIds]);
    await run(`DELETE FROM session_blocks WHERE event_id IN (SELECT id FROM tryout_events WHERE organization_id = ANY($1))`, [orgIds]);
    await run(`DELETE FROM player_event_registrations WHERE event_id IN (SELECT id FROM tryout_events WHERE organization_id = ANY($1))`, [orgIds]);
    await run(`DELETE FROM tryout_events WHERE organization_id = ANY($1)`, [orgIds]);
    await run(`DELETE FROM players WHERE organization_id = ANY($1)`, [orgIds]);
    await run(`DELETE FROM evaluation_criteria WHERE template_id IN (SELECT id FROM evaluation_templates WHERE organization_id = ANY($1))`, [orgIds]);
    await run(`DELETE FROM evaluation_templates WHERE organization_id = ANY($1)`, [orgIds]);
    await run(`DELETE FROM age_groups WHERE organization_id = ANY($1)`, [orgIds]);
    await run(`DELETE FROM users WHERE organization_id = ANY($1)`, [orgIds]);
    await run(`DELETE FROM organizations WHERE id = ANY($1)`, [orgIds]);
  }
}

module.exports = { pool, buildApp, createOrg, createUser, createEventFixture, assignScorer, cleanup };
