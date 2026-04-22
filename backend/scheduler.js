const cron = require('node-cron');
const pool = require('./db/pool');

/**
 * Every minute: auto-activate sessions whose start time is ≤ 10 minutes away
 * and are still 'pending'.
 *
 * Intentional tenant-global bypass: the scheduler is a system process with no
 * request context. It activates pending sessions across ALL organizations, which
 * is the correct behavior. The pool connection runs as the postgres superuser
 * (or tryout_migrations role) which bypasses RLS. This is documented as expected.
 *
 * Postgres can add a DATE + TIME directly to get a TIMESTAMP, so:
 *   session_date + start_time  →  timestamp without tz
 *   NOW() is compared in the DB's local timezone context
 */
function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const result = await pool.query(`
        UPDATE sessions
        SET    status = 'active'
        WHERE  status     = 'pending'
          AND  start_time IS NOT NULL
          AND  (session_date + start_time) - INTERVAL '10 minutes' <= NOW()
        RETURNING id, name, session_date, start_time
      `);
      if (result.rowCount > 0) {
        result.rows.forEach(s => {
          console.log(`[scheduler] Auto-activated session #${s.id} "${s.name}" (${s.session_date} ${s.start_time})`);
        });
      }
    } catch (err) {
      console.error('[scheduler] Auto-activate error:', err.message);
    }
  });

  console.log('[scheduler] Session auto-activate job running (every minute)');
}

module.exports = { startScheduler };
