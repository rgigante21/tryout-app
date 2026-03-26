const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
const guard  = [authMiddleware, requireRole('admin', 'coordinator')];

// GET /api/evaluation-templates
// List all templates with their criteria
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [templateRes, criteriaRes] = await Promise.all([
      pool.query('SELECT * FROM evaluation_templates ORDER BY id'),
      pool.query('SELECT * FROM evaluation_criteria ORDER BY template_id, sort_order'),
    ]);

    const templates = templateRes.rows.map(t => ({
      ...t,
      criteria: criteriaRes.rows.filter(c => c.template_id === t.id),
    }));

    res.json({ templates });
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/evaluation-templates/for-age-group/:ageGroupId
// Get the default template for an age group
router.get('/for-age-group/:ageGroupId', authMiddleware, async (req, res) => {
  try {
    const agRes = await pool.query(
      'SELECT default_template_id FROM age_groups WHERE id = $1',
      [req.params.ageGroupId]
    );
    if (!agRes.rows[0]) return res.status(404).json({ error: 'Age group not found' });

    const templateId = agRes.rows[0].default_template_id;
    if (!templateId) return res.json({ template: null });

    const [tRes, cRes] = await Promise.all([
      pool.query('SELECT * FROM evaluation_templates WHERE id = $1', [templateId]),
      pool.query(
        'SELECT * FROM evaluation_criteria WHERE template_id = $1 ORDER BY sort_order',
        [templateId]
      ),
    ]);

    res.json({ template: { ...tRes.rows[0], criteria: cRes.rows } });
  } catch (err) {
    console.error('Get template for age group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/evaluation-templates/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [tRes, cRes] = await Promise.all([
      pool.query('SELECT * FROM evaluation_templates WHERE id = $1', [req.params.id]),
      pool.query(
        'SELECT * FROM evaluation_criteria WHERE template_id = $1 ORDER BY sort_order',
        [req.params.id]
      ),
    ]);
    if (!tRes.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.json({ template: { ...tRes.rows[0], criteria: cRes.rows } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/evaluation-templates  (admin only)
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  const { name, description, criteria = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tRes = await client.query(
      `INSERT INTO evaluation_templates (name, description)
       VALUES ($1,$2) RETURNING *`,
      [name, description || null]
    );
    const template = tRes.rows[0];
    const createdCriteria = [];

    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];
      if (!c.key || !c.label) continue;
      const cRes = await client.query(
        `INSERT INTO evaluation_criteria
           (template_id, key, label, description, weight, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [template.id, c.key, c.label, c.description || null,
         c.weight || 1.0, c.sort_order ?? i]
      );
      createdCriteria.push(cRes.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ template: { ...template, criteria: createdCriteria } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PATCH /api/evaluation-templates/:id/assign-age-group
// Set this template as default for an age group
router.patch('/:id/assign-age-group', ...guard, async (req, res) => {
  const { ageGroupId } = req.body;
  if (!ageGroupId) return res.status(400).json({ error: 'ageGroupId required' });
  try {
    await pool.query(
      'UPDATE age_groups SET default_template_id = $1 WHERE id = $2',
      [req.params.id, ageGroupId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
