/**
 * multitenancy.test.js
 * L3 cross-tenant isolation probe.
 *
 * Seeds two completely separate organizations (org A and org B), logs in as
 * org A's admin, then attempts to access org B's resources via every admin
 * endpoint that accepts entity IDs. Every response must be 404 or 403 —
 * never 200 with org B data.
 */

const request = require('supertest');
const { buildApp, createOrg, createUser, createEventFixture, cleanup, pool } = require('./helpers');

const app = buildApp();

let orgA, orgB;
let adminA;
let fixtureA, fixtureB;
const created = { orgIds: [] };

beforeAll(async () => {
  [orgA, orgB] = await Promise.all([createOrg(), createOrg()]);
  created.orgIds.push(orgA.id, orgB.id);

  [adminA, fixtureA, fixtureB] = await Promise.all([
    createUser({ orgId: orgA.id, role: 'admin' }),
    createEventFixture(orgA.id),
    createEventFixture(orgB.id),
  ]);
});

afterAll(async () => {
  await cleanup(created);
  await pool.end();
});

// Helper — assert a response is either 404 or 403 (never leaks org B data)
function assertNoLeak(res) {
  expect([403, 404]).toContain(res.status);
}

// ── Age groups ───────────────────────────────────────────────────────────────

describe('Cross-tenant: age groups', () => {
  it('GET /api/admin/age-groups does not return org B age groups', async () => {
    const res = await request(app)
      .get('/api/admin/age-groups')
      .set('Cookie', adminA.cookie);
    expect(res.status).toBe(200);
    const ids = (res.body.ageGroups || []).map(ag => ag.id);
    expect(ids).not.toContain(fixtureB.ageGroup.id);
  });
});

// ── Events ───────────────────────────────────────────────────────────────────

describe('Cross-tenant: events', () => {
  it('GET /api/admin/events does not return org B events', async () => {
    const res = await request(app)
      .get('/api/admin/events')
      .set('Cookie', adminA.cookie);
    expect(res.status).toBe(200);
    const ids = (res.body.events || []).map(e => e.id);
    expect(ids).not.toContain(fixtureB.event.id);
  });

  it('PATCH /api/admin/events/:id/archive on org B event returns 404', async () => {
    const res = await request(app)
      .patch(`/api/admin/events/${fixtureB.event.id}/archive`)
      .set('Cookie', adminA.cookie)
      .send({ archived: true });
    assertNoLeak(res);
  });

  it('GET /api/admin/events/:id/stats on org B event returns 404', async () => {
    const res = await request(app)
      .get(`/api/admin/events/${fixtureB.event.id}/stats`)
      .set('Cookie', adminA.cookie);
    assertNoLeak(res);
  });
});

// ── Sessions ─────────────────────────────────────────────────────────────────

describe('Cross-tenant: sessions', () => {
  it('GET /api/sessions/:id/players on org B session returns 403 or 404', async () => {
    const res = await request(app)
      .get(`/api/sessions/${fixtureB.session.id}/players`)
      .set('Cookie', adminA.cookie);
    assertNoLeak(res);
  });

  it('PATCH /api/admin/sessions/:id/finalize on org B session returns 404', async () => {
    const res = await request(app)
      .patch(`/api/admin/sessions/${fixtureB.session.id}/finalize`)
      .set('Cookie', adminA.cookie)
      .send({ status: 'scoring_complete' });
    assertNoLeak(res);
  });
});

// ── Scores ───────────────────────────────────────────────────────────────────

describe('Cross-tenant: scores', () => {
  it('POST /api/scores targeting org B session returns 404', async () => {
    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', adminA.cookie)
      .send({
        sessionId:   fixtureB.session.id,
        playerId:    fixtureB.player.id,
        skating:     3,
        puckSkills:  3,
        hockeySense: 3,
      });
    assertNoLeak(res);
  });

  it('GET /api/scores/rankings for org B age group returns empty or 404', async () => {
    const res = await request(app)
      .get(`/api/scores/rankings/${fixtureB.ageGroup.id}/${fixtureB.event.id}`)
      .set('Cookie', adminA.cookie);
    // Rankings query scopes by org — result should be empty (not 404), but
    // must not contain org B players
    if (res.status === 200) {
      const playerIds = (res.body.rankings || []).map(r => r.player_id);
      expect(playerIds).not.toContain(fixtureB.player.id);
    } else {
      assertNoLeak(res);
    }
  });
});

// ── Players ──────────────────────────────────────────────────────────────────

describe('Cross-tenant: players', () => {
  it('GET /api/admin/players for org B event returns empty or 404', async () => {
    const res = await request(app)
      .get(`/api/admin/players?eventId=${fixtureB.event.id}&ageGroupId=${fixtureB.ageGroup.id}`)
      .set('Cookie', adminA.cookie);
    if (res.status === 200) {
      expect((res.body.players || []).length).toBe(0);
    } else {
      assertNoLeak(res);
    }
  });

  it('DELETE /api/admin/players/:id on org B player returns 404', async () => {
    const res = await request(app)
      .delete(`/api/admin/players/${fixtureB.registration.id}`)
      .set('Cookie', adminA.cookie);
    assertNoLeak(res);
  });
});

// ── Users ─────────────────────────────────────────────────────────────────────

describe('Cross-tenant: users', () => {
  it('GET /api/admin/users does not return org B users', async () => {
    const orgBAdmin = await createUser({ orgId: orgB.id, role: 'admin' });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', adminA.cookie);
    expect(res.status).toBe(200);
    const ids = (res.body.users || []).map(u => u.id);
    expect(ids).not.toContain(orgBAdmin.id);
  });
});

// ── Move player cross-org ────────────────────────────────────────────────────

describe('Cross-tenant: session-player move', () => {
  it('cannot move org B player into org A session', async () => {
    const res = await request(app)
      .patch('/api/session-players/move')
      .set('Cookie', adminA.cookie)
      .send({
        playerId:       fixtureB.player.id,
        fromSessionId:  fixtureB.session.id,
        toSessionId:    fixtureA.session.id,
        keepCheckinStatus: false,
      });
    assertNoLeak(res);
  });
});
