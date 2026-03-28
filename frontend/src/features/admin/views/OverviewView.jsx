import { A } from '../styles';
import { CountUp, fmt } from '../shared';

export default function OverviewView({
  dashboard,
  users,
  ageGroups,
  todayDate,
  setTodayDate,
  todayLoading,
  todaySessions,
  groupStats,
  openGroup,
}) {
  const totalPlayers = dashboard.reduce((s, d) => s + (d.total_players || 0), 0);
  const totalSessions = dashboard.reduce((s, d) => s + (d.total_sessions || 0), 0);
  const completeSess = dashboard.reduce((s, d) => s + (d.complete_sessions || 0), 0);
  const totalScores = dashboard.reduce((s, d) => s + (d.total_scores || 0), 0);
  const activeCoaches = users.filter((u) => u.role === 'scorer' || u.role === 'coordinator').length;

  return (
    <>
      <div style={A.metricGrid}>
        {[
          { label: 'Total Players', val: totalPlayers, accent: '#6B1E2E' },
          { label: 'Sessions', val: totalSessions, accent: '#1A4B8B' },
          { label: 'Scores Entered', val: totalScores, accent: '#6B1E2E' },
          { label: 'Coaches Active', val: activeCoaches, accent: '#145A3C' },
        ].map(({ label, val, accent }) => (
          <div key={label} style={{ ...A.metricCard, borderTop: `3px solid ${accent}` }}>
            <div style={{ ...A.metricVal, color: accent }}>
              <CountUp end={val} />
            </div>
            <div style={A.metricLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div style={A.sectionHdr}>
        <span style={A.sectionLabel}>Age Groups</span>
      </div>
      <div style={A.ageGroupGrid}>
        {ageGroups.map((g) => {
          const stats = groupStats(g.code);
          const pct = stats.total_sessions > 0 ? Math.round((stats.complete_sessions / stats.total_sessions) * 100) : 0;
          return (
            <div key={g.id} style={A.agCard} className="ag-card" onClick={() => openGroup(g)}>
              <div style={A.agName}>{g.name}</div>
              <div style={A.agStats}>
                {[
                  { val: stats.total_players, label: 'Players' },
                  { val: stats.total_sessions, label: 'Sessions' },
                  { val: stats.total_scores, label: 'Scores' },
                ].map(({ val, label }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={A.agStatVal}><CountUp end={val} duration={600} /></div>
                    <div style={A.agStatLabel}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={A.progressTrack}>
                <div style={{ ...A.progressFill, width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--maroon)' }} />
              </div>
              <div style={A.agFooter}>
                <span style={A.agLink}>Manage →</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: pct === 100 ? '#E3F3EA' : '#FDF6E3',
                    color: pct === 100 ? '#145A3C' : '#6B4D0A',
                    border: `1px solid ${pct === 100 ? 'var(--green)' : 'var(--gold-dark)'}`,
                  }}
                >
                  {pct === 100 ? 'Complete' : `${stats.complete_sessions}/${stats.total_sessions} Complete`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={A.sectionHdr}>
        <span style={A.sectionLabel}>
          Today — {new Date(`${todayDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </span>
        <input
          type="date"
          value={todayDate}
          onChange={(e) => setTodayDate(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', width: 'auto', borderRadius: 6 }}
        />
      </div>
      {todayLoading && <p style={A.muted}>Loading sessions…</p>}
      {!todayLoading && todaySessions.length === 0 && (
        <div style={A.emptyCard}>No sessions scheduled for this date.</div>
      )}
      {!todayLoading && todaySessions.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: '#4A1320', fontSize: 10, fontWeight: 700, color: '#F7CC6A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: 16 }}>
            <span style={{ flex: 1 }}>Session</span>
            <span style={{ width: 90 }}>Group</span>
            <span style={{ width: 80 }}>Time</span>
            <span style={{ width: 70 }}>Type</span>
            <span style={{ width: 120 }}>Scorer</span>
          </div>
          {todaySessions.map((sess) => (
            <div key={sess.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--border)', gap: 16 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sess.name}</span>
              <span style={{ width: 90, fontSize: 12, color: 'var(--maroon)' }}>{sess.age_group}</span>
              <span style={{ width: 80, fontSize: 12, color: 'var(--text2)' }}>{fmt.time(sess.start_time)}</span>
              <span style={{ width: 70 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: sess.session_type === 'game' ? '#FEF6E0' : '#E8F0FE',
                    color: sess.session_type === 'game' ? '#8B6914' : '#1A4B8B',
                    border: `1px solid ${sess.session_type === 'game' ? 'var(--amber)' : 'var(--blue)'}`,
                  }}
                >
                  {sess.session_type === 'game' ? 'Game' : 'Skills'}
                </span>
              </span>
              <span style={{ width: 120, fontSize: 12, color: 'var(--text3)' }}>—</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
