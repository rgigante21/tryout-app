/**
 * Seed a new organization with default templates, criteria, and age groups.
 * Used at org creation time. Accepts a transaction client so the caller
 * controls the transaction boundary.
 *
 * Does NOT insert the org row itself — caller must do that first and pass the orgId.
 *
 * Fixture data matches the canonical defaults in postgres/init.sql.
 * age_groups.default_template_id is wired to the new org's own template copies.
 */

const TEMPLATE_FIXTURES = [
  {
    name: '8U/10U Skills',
    description: 'ADM-aligned evaluation for Mites and Squirts — station-based agility focus',
    is_default: true,
    criteria: [
      { key: 'skating_agility', label: 'Skating Agility',     description: 'Edge control, crossovers, balance and speed changes',    weight: 1.00, sort_order: 1 },
      { key: 'puck_control',    label: 'Puck Control',         description: 'Carrying, protecting and stickhandling at pace',         weight: 1.00, sort_order: 2 },
      { key: 'compete',         label: 'Compete & Engagement', description: 'Effort level, battles, attention to instruction',        weight: 1.00, sort_order: 3 },
      { key: 'awareness',       label: 'Small-Area Awareness', description: 'Positioning and reads in tight-space situations',        weight: 1.00, sort_order: 4 },
    ],
  },
  {
    name: '12U Skills',
    description: 'ADM-aligned evaluation for Peewees — skating, puck play, sense and compete',
    is_default: true,
    criteria: [
      { key: 'skating',      label: 'Skating',                         description: 'Technique, speed, agility and transitions',           weight: 1.00, sort_order: 1 },
      { key: 'puck_play',    label: 'Puck Play',                       description: 'Puck skills under pressure and creativity',           weight: 1.00, sort_order: 2 },
      { key: 'hockey_sense', label: 'Hockey Sense / Decision Making',  description: 'Reads, positioning and time-and-space decisions',     weight: 1.25, sort_order: 3 },
      { key: 'compete',      label: 'Compete',                         description: 'Physical and mental compete level',                   weight: 1.00, sort_order: 4 },
    ],
  },
  {
    name: '14U/16U Skills',
    description: 'ADM-aligned evaluation for Bantams and Midgets — full game-readiness rubric',
    is_default: true,
    criteria: [
      { key: 'skating',      label: 'Skating',                  description: 'Power, edges, transitions and gap closing',              weight: 1.00, sort_order: 1 },
      { key: 'puck_play',    label: 'Puck Play',                description: 'Puck skills under pressure and at pace',                 weight: 1.00, sort_order: 2 },
      { key: 'hockey_sense', label: 'Hockey Sense',             description: 'Reads, decision making and positioning',                 weight: 1.25, sort_order: 3 },
      { key: 'compete',      label: 'Compete',                  description: 'Battle level, physicality and will to win',              weight: 1.00, sort_order: 4 },
      { key: 'game_impact',  label: 'Game Impact / Readiness',  description: 'Overall effectiveness in game situations',               weight: 1.50, sort_order: 5 },
    ],
  },
];

const AGE_GROUP_FIXTURES = [
  { name: 'Mites - U8',    code: 'mites',   sort_order: 1, template_index: 0 },
  { name: 'Squirts - U10', code: 'squirts', sort_order: 2, template_index: 0 },
  { name: 'Peewees - U12', code: 'peewees', sort_order: 3, template_index: 1 },
  { name: 'Bantams - U14', code: 'bantams', sort_order: 4, template_index: 2 },
  { name: 'Midgets - U16', code: 'midgets', sort_order: 5, template_index: 2 },
];

/**
 * @param {pg.PoolClient} client  - Active transaction client
 * @param {number} orgId          - The newly created organization's id
 * @returns {{ templates: object[], ageGroups: object[] }}
 */
async function seedOrgDefaults(client, orgId) {
  const templates = [];

  for (const fixture of TEMPLATE_FIXTURES) {
    const tRes = await client.query(
      `INSERT INTO evaluation_templates (organization_id, name, description, is_default)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [orgId, fixture.name, fixture.description, fixture.is_default]
    );
    const template = tRes.rows[0];

    for (const c of fixture.criteria) {
      await client.query(
        `INSERT INTO evaluation_criteria
           (template_id, key, label, description, weight, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [template.id, c.key, c.label, c.description, c.weight, c.sort_order]
      );
    }

    templates.push(template);
  }

  const ageGroups = [];

  for (const ag of AGE_GROUP_FIXTURES) {
    const templateId = templates[ag.template_index].id;
    const agRes = await client.query(
      `INSERT INTO age_groups (organization_id, name, code, sort_order, default_template_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orgId, ag.name, ag.code, ag.sort_order, templateId]
    );
    ageGroups.push(agRes.rows[0]);
  }

  return { templates, ageGroups };
}

module.exports = { seedOrgDefaults };
