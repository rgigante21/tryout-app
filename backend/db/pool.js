const { Pool } = require('pg');

if (!process.env.DB_PASS) {
  throw new Error('DB_PASS environment variable is required');
}

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'tryoutapp',
  user:     process.env.DB_USER     || 'tryout',
  password: process.env.DB_PASS,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
