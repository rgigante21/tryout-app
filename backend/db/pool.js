const { Pool } = require('pg');

if (!process.env.DB_PASS) {
  throw new Error('DB_PASS environment variable is required');
}

const isProd = process.env.NODE_ENV === 'production';

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'tryoutapp',
  user:     process.env.DB_USER     || 'tryout',
  password: process.env.DB_PASS,

  // SSL: required in production; disabled locally
  ...(isProd ? { ssl: { rejectUnauthorized: true } } : {}),

  // Pool sizing (tune via env if needed)
  max:              parseInt(process.env.DB_POOL_MAX)  || 10,
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_MS) || 30_000,
  connectionTimeoutMillis: 5_000,

  // Statement-level safety timeouts
  statement_timeout: 30_000,
  idle_in_transaction_session_timeout: 10_000,
});

pool.on('error', (err) => {
  // Log without leaking credentials or connection strings
  console.error('Unexpected database pool error:', err.code || err.message);
});

module.exports = pool;
