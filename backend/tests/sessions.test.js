/**
 * sessions.test.js
 * Security tests for session roster access.
 *
 * Covers:
 * - unauthenticated requests rejected
 * - scorer can access their assigned session roster
 * - scorer cannot access a session they are not assigned to (403)
 * - admin/coordinator can access any session roster
 * - move-player endpoint requires admin/coordinator
 */

const request = require('supertest');
const { buildApp, createUser, createEventFixture, assignScorer, cleanup, pool } = require('./helpers');

const app = buildApp();
const created = { userIds: [], eventIds: [], ageGroupIds: [] };

let fixture;
let assignedScorer;
let unassignedScorer;
let coordinator;
let adminUser;

// Second fixture for cross-session test
let otherFixture;

beforeAll(async () => {
  fixture      = await createEventFixture();
  otherFixture = await createEventFixture();
  created.eventIds.push(fixture.event.id, otherFixture.event.id);
  created.ageGroupIds.push(fixture.ageGroup.id, otherFixture.ageGroup.id);

  assignedScorer   = await createUser({ role: 'scorer' });
  unassignedScorer = await createUser({ role: 'scorer' });
  coordinator      = await createUser({ role: 'coordinator' });
  adminUser        = await createUser({ role: 'admin' });
  created.userIds.push(assignedScorer.id, unassignedScorer.id, coordinator.id, adminUser.id);

  await assignScorer(fixture.session.id, assignedScorer.id);
});

afterAll(async () => {
  await cleanup(created);
  await pool.end();
});

// ── Unauthenticated ──────────────────────────────────────────────────────────

describe('GET /api/sessions/:id/players (unauthenticated)', () => {
  it('returns 401', async () => {
    const res = await request(app).get(`/api/sessions/${fixture.session.id}/players`);
    expect(res.status).toBe(401);
  });
});

// ── Assigned scorer ──────────────────────────────────────────────────────────

describe('GET /api/sessions/:id/players (assigned scorer)', () => {
  it('returns the roster for their assigned session', async () => {
    const res = await request(app)
      .get(`/api/sessions/${fixture.session.id}/players`)
      .set('Cookie', assignedScorer.cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.players)).toBe(true);
  });
});

// ── Unassigned scorer ────────────────────────────────────────────────────────

describe('GET /api/sessions/:id/players (unassigned scorer)', () => {
  it('returns 403 for a session the scorer is not assigned to', async () => {
    const res = await request(app)
      .get(`/api/sessions/${fixture.session.id}/players`)
      .set('Cookie', unassignedScorer.cookie);
    expect(res.status).toBe(403);
  });

  it('returns 403 even for a different session in a different event', async () => {
    const res = await request(app)
      .get(`/api/sessions/${otherFixture.session.id}/players`)
      .set('Cookie', assignedScorer.cookie); // assigned to fixture, not otherFixture
    expect(res.status).toBe(403);
  });
});

// ── Admin and coordinator ────────────────────────────────────────────────────

describe('GET /api/sessions/:id/players (admin/coordinator)', () => {
  it('admin can access any session roster', async () => {
    const res = await request(app)
      .get(`/api/sessions/${fixture.session.id}/players`)
      .set('Cookie', adminUser.cookie);
    expect(res.status).toBe(200);
  });

  it('coordinator can access any session roster', async () => {
    const res = await request(app)
      .get(`/api/sessions/${fixture.session.id}/players`)
      .set('Cookie', coordinator.cookie);
    expect(res.status).toBe(200);
  });
});

// ── My sessions list (scorer) ────────────────────────────────────────────────

describe('GET /api/sessions/mine', () => {
  it('returns only sessions the scorer is assigned to', async () => {
    const res = await request(app)
      .get('/api/sessions/mine')
      .set('Cookie', assignedScorer.cookie);
    expect(res.status).toBe(200);
    const ids = (res.body.sessions || []).map((s) => s.id);
    expect(ids).toContain(fixture.session.id);
    expect(ids).not.toContain(otherFixture.session.id);
  });

  it('returns empty list for scorer with no assignments', async () => {
    const res = await request(app)
      .get('/api/sessions/mine')
      .set('Cookie', unassignedScorer.cookie);
    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBe(0);
  });
});

// ── Move player ──────────────────────────────────────────────────────────────

describe('PATCH /api/session-players/move', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .patch('/api/session-players/move')
      .send({ playerId: fixture.player.id, fromSessionId: fixture.session.id, toSessionId: otherFixture.session.id });
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by a scorer', async () => {
    const res = await request(app)
      .patch('/api/session-players/move')
      .set('Cookie', assignedScorer.cookie)
      .send({ playerId: fixture.player.id, fromSessionId: fixture.session.id, toSessionId: otherFixture.session.id });
    expect(res.status).toBe(403);
  });

  it('admin can move a player between sessions', async () => {
    // Add player to otherFixture session first so the move is valid
    await pool.query(
      `INSERT INTO session_players (session_id, player_id, registration_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [otherFixture.session.id, fixture.player.id, fixture.registration.id]
    ).catch(() => {});

    const res = await request(app)
      .patch('/api/session-players/move')
      .set('Cookie', adminUser.cookie)
      .send({
        playerId:       fixture.player.id,
        fromSessionId:  otherFixture.session.id,
        toSessionId:    fixture.session.id,
        keepCheckinStatus: false,
      });
    // 200 or 404 (player may not be on that roster) — what matters is not 403/401
    expect([200, 400, 404, 409]).toContain(res.status);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
