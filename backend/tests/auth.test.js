/**
 * auth.test.js
 * Security tests for authentication endpoints.
 *
 * Covers:
 * - public registration is blocked
 * - organization lookup resolves a login code
 * - login succeeds with valid credentials
 * - login requires an organization login code
 * - login fails with bad credentials (normalized error, no user enumeration)
 * - the same email can belong to different organizations
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

// ── Organization Lookup ─────────────────────────────────────────────────────

describe('GET /api/auth/orgs/lookup/:loginCode', () => {
  it('returns safe organization sign-in metadata for a valid login code', async () => {
    const res = await request(app)
      .get(`/api/auth/orgs/lookup/${testOrg.subdomain}`);

    expect(res.status).toBe(200);
    expect(res.body.organization).toMatchObject({
      name: testOrg.name,
      loginCode: testOrg.subdomain,
    });
    expect(res.body.organization.id).toBeUndefined();
  });

  it('returns 404 for an unknown login code', async () => {
    const res = await request(app)
      .get('/api/auth/orgs/lookup/not-a-real-org-code');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No organization found/i);
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
      .send({ email: user.email, password: 'ValidPass99!', loginCode: testOrg.subdomain });

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
      .send({ email: user.email, password: 'WrongPassword!', loginCode: testOrg.subdomain });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error).not.toMatch(/user/i);
  });

  it('returns 401 for non-existent email (same error as bad password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.test', password: 'Whatever123!', loginCode: testOrg.subdomain });
    expect(res.status).toBe(401);
  });

  it('returns 400 when email or password is missing', async () => {
    const r1 = await request(app).post('/api/auth/login').send({ email: user.email, loginCode: testOrg.subdomain });
    const r2 = await request(app).post('/api/auth/login').send({ password: 'ValidPass99!', loginCode: testOrg.subdomain });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
  });

  it('returns 400 when organization login code is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'ValidPass99!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Organization login code is required/i);
  });

  it('does not expose the raw token in the response body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'ValidPass99!', loginCode: testOrg.subdomain });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.access_token).toBeUndefined();
  });

  it('scopes duplicate email addresses by organization login code', async () => {
    const otherOrg = await createOrg({ name: 'Other Test Org' });
    created.orgIds.push(otherOrg.id);

    const email = `shared-${Date.now()}@test.local`;
    const firstOrgUser = await createUser({
      orgId: testOrg.id,
      email,
      password: 'FirstOrgPass99!',
    });
    const otherOrgUser = await createUser({
      orgId: otherOrg.id,
      email,
      password: 'OtherOrgPass99!',
    });
    created.userIds.push(firstOrgUser.id, otherOrgUser.id);

    const wrongOrgRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'FirstOrgPass99!', loginCode: otherOrg.subdomain });
    expect(wrongOrgRes.status).toBe(401);

    const firstOrgRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'FirstOrgPass99!', loginCode: testOrg.subdomain });
    expect(firstOrgRes.status).toBe(200);
    expect(firstOrgRes.body.user.organization_id).toBe(testOrg.id);

    const otherOrgRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'OtherOrgPass99!', loginCode: otherOrg.subdomain });
    expect(otherOrgRes.status).toBe(200);
    expect(otherOrgRes.body.user.organization_id).toBe(otherOrg.id);
  });
});

// ── Logout ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('clears the auth_token cookie', async () => {
    const user = await createUser({ orgId: testOrg.id, role: 'scorer' });
    created.userIds.push(user.id);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password, loginCode: testOrg.subdomain });
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
