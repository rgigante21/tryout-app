const request = require('supertest');
const { buildApp, createOrg, createUser, createEventFixture, cleanup, pool } = require('./helpers');

const app = buildApp();
const created = { userIds: [], eventIds: [], ageGroupIds: [], orgIds: [] };

let org;
let fixture;
let admin;

async function addPlayer(firstName, lastName, jerseyNumber) {
  const playerRes = await pool.query(
    `INSERT INTO players (organization_id, first_name, last_name)
     VALUES ($1, $2, $3) RETURNING *`,
    [org.id, firstName, lastName]
  );
  const player = playerRes.rows[0];
  await pool.query(
    `INSERT INTO player_event_registrations
       (player_id, event_id, age_group_id, jersey_number, position, will_tryout)
     VALUES ($1, $2, $3, $4, 'skater', true)`,
    [player.id, fixture.event.id, fixture.ageGroup.id, jerseyNumber]
  );
}

beforeAll(async () => {
  org = await createOrg();
  created.orgIds.push(org.id);

  fixture = await createEventFixture(org.id);
  created.eventIds.push(fixture.event.id);
  created.ageGroupIds.push(fixture.ageGroup.id);

  admin = await createUser({ orgId: org.id, role: 'admin' });
  created.userIds.push(admin.id);

  await Promise.all([
    addPlayer('Ari', 'Adams', 2),
    addPlayer('Ben', 'Baker', 3),
    addPlayer('Cam', 'Clark', 4),
    addPlayer('Dev', 'Dunn', 5),
    addPlayer('Eli', 'Evans', 6),
  ]);
});

afterAll(async () => {
  await cleanup(created);
  await pool.end();
});

describe('GET /api/session-blocks/planning-preview', () => {
  it('returns balanced split counts for the selected slot count', async () => {
    const res = await request(app)
      .get(`/api/session-blocks/planning-preview?event_id=${fixture.event.id}&age_group_id=${fixture.ageGroup.id}&slots=3&slot_minutes=30`)
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.totalPlayers).toBe(6);
    expect(res.body.targetPerSlot).toBe(2);
    expect(res.body.balancedSplits.map((split) => split.count)).toEqual([2, 2, 2]);
    expect(res.body.balancedSplits[0].lastNameStart).toBeTruthy();
    expect(res.body.balancedSplits[2].lastNameEnd).toBeTruthy();
  });

  it('includes simple planning gaps inferred from existing sessions', async () => {
    const res = await request(app)
      .get(`/api/session-blocks/planning-preview?event_id=${fixture.event.id}&age_group_id=${fixture.ageGroup.id}&slots=2&slot_minutes=30`)
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.planningGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2099-01-01',
          sessionCount: expect.any(Number),
          openStarts: expect.arrayContaining(['10:30']),
        }),
      ])
    );
  });
});
