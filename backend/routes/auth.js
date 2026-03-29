const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const result = await pool.query(
      'SELECT id, email, password, first_name, last_name, role FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = result.rows[0];

    // Use a dummy compare when user not found to prevent timing attacks
    const dummyHash = '$2b$10$abcdefghijklmnopqrstuvuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu';
    const hashToCompare = user ? user.password : dummyHash;

    let valid = false;
    try {
      valid = await bcrypt.compare(password, hashToCompare);
    } catch (bcryptErr) {
      // Malformed hash in DB — treat as wrong password, log for ops
      console.error('bcrypt.compare error for', normalizedEmail, ':', bcryptErr.message);
      valid = false;
    }

    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id:        user.id,
        email:     user.email,
        role:      user.role,
        firstName: user.first_name,
        lastName:  user.last_name,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: {
        id:        user.id,
        email:     user.email,
        firstName: user.first_name,
        lastName:  user.last_name,
        role:      user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed — please try again' });
  }
});

// POST /api/auth/register  (admin-initiated account creation)
router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName, role } = req.body || {};

  if (!email || typeof email !== 'string' ||
      !password || typeof password !== 'string' ||
      !firstName || typeof firstName !== 'string' ||
      !lastName || typeof lastName !== 'string') {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const allowedRoles = ['scorer', 'coordinator', 'admin'];
  const assignedRole = allowedRoles.includes(role) ? role : 'scorer';

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, role`,
      [normalizedEmail, hashed, firstName.trim(), lastName.trim(), assignedRole]
    );
    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Account creation failed — please try again' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
