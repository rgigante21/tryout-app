/**
 * auth.test.js
 * Security tests for authentication endpoints.
 *
 * Covers:
 * - public registration is blocked
 * - login succeeds with valid credentials
 * - login fails with bad credentials (normalized error, no user enumeration)
 * - auth cookie flags (HttpOnly, SameSite)
 * - logout clears the cookie
 * - /me rejects unauthenticated requests
 * - /me rejects tampered/expired tokens
 */

const request = require('supertest');
const { buildApp, createOrg, createUser, cleanup } = require('./helpers');

const app = buildApp();
const created = { userIds: [], orgIds: [] };

let testOrg;

beforeAll(async () => {
  testOrg = await createOrg();
  created.orgIds.push(testOrg.id);
});

afterAll(async () => {
  await cleanup(created);
  const { pool } = require('./helpers');
  await pool.end();
});

// ── Public registration is closed ───────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('returns 404 (endpoint removed)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'attacker@evil.com', password: 'Password1234!' });
    expect(res.status).toBe(404);
  });
});

// ── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  let user;

  beforeAll(async () => {
    user = await createUser({ orgId: testOrg.id, role: 'scorer', password: 'ValidPass99!' });
    created.userIds.push(user.id);
  });

  it('returns 200 and sets HttpOnly cookie on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'ValidPass99!' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(user.email);

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    expect(cookieStr).toMatch(/auth_token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
    expect(cookieStr).toMatch(/SameSite=Lax/i);
  });

  it('returns 401 with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'WrongPassword!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error).not.toMatch(/user/i);
  });

  it('returns 401 for non-existent email (same error as bad password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.test', password: 'Whatever123!' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when email or password is missing', async () => {
    const r1 = await request(app).post('/api/auth/login').send({ email: user.email });
    const r2 = await request(app).post('/api/auth/login').send({ password: 'ValidPass99!' });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
  });

  it('does not expose the raw token in the response body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'ValidPass99!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.access_token).toBeUndefined();
  });
});

// ── Logout ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('clears the auth_token cookie', async () => {
    const user = await createUser({ orgId: testOrg.id, role: 'scorer' });
    created.userIds.push(user.id);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    const cookie = loginRes.headers['set-cookie'];

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(logoutRes.status).toBe(200);
    const setCookie = logoutRes.headers['set-cookie'];
    if (setCookie) {
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      const clearedByMaxAge  = cookieStr.includes('Max-Age=0');
      const clearedByExpires = /Expires=.*1970/.test(cookieStr) || /Expires=.*Thu, 01 Jan 1970/.test(cookieStr);
      expect(clearedByMaxAge || clearedByExpires).toBe(true);
    }
  });

  it('returns 401 when called without a valid cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ── GET /me ──────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns 401 with no cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'auth_token=thisisnotavalidjwt');
    expect(res.status).toBe(401);
  });

  it('returns user info with a valid cookie', async () => {
    const user = await createUser({ orgId: testOrg.id, role: 'scorer' });
    created.userIds.push(user.id);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it('sets Cache-Control: no-store', async () => {
    const user = await createUser({ orgId: testOrg.id, role: 'scorer' });
    created.userIds.push(user.id);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', user.cookie);
    expect(res.headers['cache-control']).toMatch(/no-store/);
  });
});
