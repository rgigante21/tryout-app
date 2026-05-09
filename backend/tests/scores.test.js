/**
 * scores.test.js
 * Security tests for score submission authorization.
 *
 * Covers:
 * - unauthenticated user cannot submit scores
 * - scorer assigned to a session can submit scores
 * - scorer NOT assigned to a session is rejected (403)
 * - player not on session roster is rejected (403)
 * - score values outside 1-5 range are rejected (400)
 * - finalized sessions reject score edits from scorers
 * - admin can score any session regardless of assignment
 */

const request = require('supertest');
const { buildApp, createOrg, createUser, createEventFixture, assignScorer, cleanup, pool } = require('./helpers');

const app = buildApp();
const created = { userIds: [], eventIds: [], ageGroupIds: [], orgIds: [] };

let testOrg;
let fixture;
let assignedScorer;
let unassignedScorer;
let adminUser;

beforeAll(async () => {
  testOrg = await createOrg();
  created.orgIds.push(testOrg.id);

  fixture = await createEventFixture(testOrg.id);
  created.eventIds.push(fixture.event.id);
  created.ageGroupIds.push(fixture.ageGroup.id);

  assignedScorer   = await createUser({ orgId: testOrg.id, role: 'scorer' });
  unassignedScorer = await createUser({ orgId: testOrg.id, role: 'scorer' });
  adminUser        = await createUser({ orgId: testOrg.id, role: 'admin' });
  created.userIds.push(assignedScorer.id, unassignedScorer.id, adminUser.id);

  await assignScorer(fixture.session.id, assignedScorer.id);
});

afterAll(async () => {
  await cleanup(created);
  await pool.end();
});

const validScore = () => ({
  sessionId:   fixture.session.id,
  playerId:    fixture.player.id,
  skating:     3,
  puckSkills:  4,
  hockeySense: 2,
});

// ── Unauthenticated ──────────────────────────────────────────────────────────

describe('POST /api/scores (unauthenticated)', () => {
  it('returns 401', async () => {
    const res = await request(app).post('/api/scores').send(validScore());
    expect(res.status).toBe(401);
  });
});

// ── Assigned scorer ──────────────────────────────────────────────────────────

describe('POST /api/scores (assigned scorer)', () => {
  it('accepts a valid score submission', async () => {
    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', assignedScorer.cookie)
      .send(validScore());
    expect(res.status).toBe(200);
    expect(res.body.score).toBeDefined();
    expect(res.body.score.skating).toBe(3);
  });

  it('rejects scores outside 1-5 range', async () => {
    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', assignedScorer.cookie)
      .send({ ...validScore(), skating: 6 });
    expect(res.status).toBe(400);
  });

  it('rejects score of 0', async () => {
    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', assignedScorer.cookie)
      .send({ ...validScore(), puckSkills: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects when required fields are missing', async () => {
    const { hockeySense: _, ...incomplete } = validScore();
    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', assignedScorer.cookie)
      .send(incomplete);
    expect(res.status).toBe(400);
  });

  it('rejects invalid session or player IDs', async () => {
    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', assignedScorer.cookie)
      .send({ ...validScore(), sessionId: 'banana' });

    expect(res.status).toBe(400);
  });
});

// ── Unassigned scorer ────────────────────────────────────────────────────────

describe('POST /api/scores (unassigned scorer)', () => {
  it('returns 403 when scorer is not assigned to the session', async () => {
    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', unassignedScorer.cookie)
      .send(validScore());
    expect(res.status).toBe(403);
  });
});

// ── Player not on roster ─────────────────────────────────────────────────────

describe('POST /api/scores (player not on roster)', () => {
  it('returns 403 when player is not on the session roster', async () => {
    const pR = await pool.query(
      `INSERT INTO players (organization_id, first_name, last_name)
       VALUES ($1,'Ghost','Player') RETURNING id`,
      [testOrg.id]
    );
    const ghostPlayerId = pR.rows[0].id;

    await pool.query(
      `INSERT INTO player_event_registrations
         (player_id, event_id, age_group_id, jersey_number, position, will_tryout)
       VALUES ($1,$2,$3,99,'skater',true)`,
      [ghostPlayerId, fixture.event.id, fixture.ageGroup.id]
    );

    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', assignedScorer.cookie)
      .send({ ...validScore(), playerId: ghostPlayerId });

    expect(res.status).toBe(403);

    await pool.query('DELETE FROM player_event_registrations WHERE player_id = $1', [ghostPlayerId]);
    await pool.query('DELETE FROM players WHERE id = $1', [ghostPlayerId]);
  });
});

// ── Admin override ───────────────────────────────────────────────────────────

describe('POST /api/scores (admin)', () => {
  it('admin can score any session without being assigned', async () => {
    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', adminUser.cookie)
      .send(validScore());
    expect(res.status).toBe(200);
  });
});

// ── Finalized session ────────────────────────────────────────────────────────

describe('POST /api/scores (finalized session)', () => {
  it('returns 403 when session is finalized and caller is a scorer', async () => {
    await pool.query(`UPDATE sessions SET status='finalized' WHERE id=$1`, [fixture.session.id]);

    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', assignedScorer.cookie)
      .send(validScore());

    await pool.query(`UPDATE sessions SET status='active' WHERE id=$1`, [fixture.session.id]);

    expect(res.status).toBe(403);
  });

  it('admin can still score a finalized session', async () => {
    await pool.query(`UPDATE sessions SET status='finalized' WHERE id=$1`, [fixture.session.id]);

    const res = await request(app)
      .post('/api/scores')
      .set('Cookie', adminUser.cookie)
      .send(validScore());

    await pool.query(`UPDATE sessions SET status='active' WHERE id=$1`, [fixture.session.id]);

    expect(res.status).toBe(200);
  });
});
