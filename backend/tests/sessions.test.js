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
const { buildApp, createOrg, createUser, createEventFixture, assignScorer, cleanup, pool } = require('./helpers');

const app = buildApp();
const created = { userIds: [], eventIds: [], ageGroupIds: [], orgIds: [] };

let testOrg;
let fixture;
let assignedScorer;
let unassignedScorer;
let coordinator;
let adminUser;

let otherFixture;
let siblingSession;

beforeAll(async () => {
  testOrg = await createOrg();
  created.orgIds.push(testOrg.id);

  fixture      = await createEventFixture(testOrg.id);
  otherFixture = await createEventFixture(testOrg.id);
  created.eventIds.push(fixture.event.id, otherFixture.event.id);
  created.ageGroupIds.push(fixture.ageGroup.id, otherFixture.ageGroup.id);

  assignedScorer   = await createUser({ orgId: testOrg.id, role: 'scorer' });
  unassignedScorer = await createUser({ orgId: testOrg.id, role: 'scorer' });
  coordinator      = await createUser({ orgId: testOrg.id, role: 'coordinator' });
  adminUser        = await createUser({ orgId: testOrg.id, role: 'admin' });
  created.userIds.push(assignedScorer.id, unassignedScorer.id, coordinator.id, adminUser.id);

  await assignScorer(fixture.session.id, assignedScorer.id);

  const siblingRes = await pool.query(
    `INSERT INTO sessions (organization_id, name, event_id, age_group_id, block_id, session_date, start_time, status, session_type)
     VALUES ($1,'Sibling Session',$2,$3,$4,'2099-01-01','11:00:00','active','skills') RETURNING *`,
    [testOrg.id, fixture.event.id, fixture.ageGroup.id, fixture.block.id]
  );
  siblingSession = siblingRes.rows[0];
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

  it('preserves check-in when requested', async () => {
    await pool.query(
      `UPDATE session_players
       SET checked_in = true, checked_in_at = NOW(), attendance_status = 'late_arrival'
       WHERE session_id = $1 AND player_id = $2`,
      [fixture.session.id, fixture.player.id]
    );

    const res = await request(app)
      .patch('/api/session-players/move')
      .set('Cookie', adminUser.cookie)
      .send({
        playerId:       fixture.player.id,
        fromSessionId:  fixture.session.id,
        toSessionId:    siblingSession.id,
        keepCheckinStatus: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.sessionPlayer.checked_in).toBe(true);
    expect(res.body.sessionPlayer.attendance_status).toBe('late_arrival');
  });

  it('resets check-in when requested', async () => {
    const res = await request(app)
      .patch('/api/session-players/move')
      .set('Cookie', adminUser.cookie)
      .send({
        playerId:       fixture.player.id,
        fromSessionId:  siblingSession.id,
        toSessionId:    fixture.session.id,
        keepCheckinStatus: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.sessionPlayer.checked_in).toBe(false);
    expect(res.body.sessionPlayer.attendance_status).toBe(null);
  });

  it('rejects cross-event or cross-age-group moves', async () => {
    const res = await request(app)
      .patch('/api/session-players/move')
      .set('Cookie', adminUser.cookie)
      .send({
        playerId:       fixture.player.id,
        fromSessionId:  fixture.session.id,
        toSessionId:    otherFixture.session.id,
        keepCheckinStatus: false,
      });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/admin/sessions/:id/finalize', () => {
  it('coordinator can mark scoring complete', async () => {
    const res = await request(app)
      .patch(`/api/admin/sessions/${fixture.session.id}/finalize`)
      .set('Cookie', coordinator.cookie)
      .send({ status: 'scoring_complete' });

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('scoring_complete');
  });

  it('coordinator cannot mark finalized', async () => {
    const res = await request(app)
      .patch(`/api/admin/sessions/${fixture.session.id}/finalize`)
      .set('Cookie', coordinator.cookie)
      .send({ status: 'finalized' });

    expect(res.status).toBe(403);
  });

  it('admin can mark finalized', async () => {
    const res = await request(app)
      .patch(`/api/admin/sessions/${fixture.session.id}/finalize`)
      .set('Cookie', adminUser.cookie)
      .send({ status: 'finalized' });

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('finalized');
    await pool.query(`UPDATE sessions SET status = 'active' WHERE id = $1`, [fixture.session.id]);
  });
});

describe('GET /api/events/:eventId/export', () => {
  it('returns a filtered CSV export', async () => {
    const res = await request(app)
      .get(`/api/events/${fixture.event.id}/export/team-recommendations?ageGroupId=${fixture.ageGroup.id}&finalizedOnly=true`)
      .set('Cookie', adminUser.cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('jersey_number,first_name,last_name');
  });
});
