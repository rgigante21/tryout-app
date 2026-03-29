import { A } from '../styles';
import { CountUp, fmt } from '../shared';

// ── Helpers ──────────────────────────────────────────────────────────────────

function CoachChips({ scorers = [] }) {
  if (!scorers.length) {
    return <span style={ov.noCoach}>No coach assigned</span>;
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {scorers.map((sc) => (
        <div key={sc.id} title={`${sc.first_name} ${sc.last_name}`} style={ov.coachChip}>
          <span style={ov.coachAvatar}>
            {sc.first_name?.[0]}{sc.last_name?.[0]}
          </span>
          <span style={ov.coachName}>{sc.first_name} {sc.last_name}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ value, total, color = 'var(--maroon)' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>
        <span>{value} <span style={{ fontWeight: 400 }}>of</span> {total} scored</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  const isGame = type === 'game';
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      background: isGame ? 'var(--amber-bg)' : 'var(--blue-bg)',
      color:      isGame ? 'var(--amber-txt)' : 'var(--blue-txt)',
      border:     `1px solid ${isGame ? 'var(--amber)' : 'var(--blue)'}`,
    }}>
      {isGame ? 'Game' : 'Skills'}
    </span>
  );
}

// ── Live Session Card ─────────────────────────────────────────────────────────

function LiveCard({ sess, scorers }) {
  const scored = sess.total_scores ?? 0;
  const total  = sess.player_count ?? 0;
  const pct    = total > 0 ? Math.round((scored / total) * 100) : 0;
  const isComplete = pct === 100;

  return (
    <div className="live-card" style={ov.liveCard}>
      {/* Top strip */}
      <div style={ov.liveCardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="live-dot" style={ov.liveDot} />
          <span style={ov.liveLabel}>LIVE</span>
          <TypeBadge type={sess.session_type} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={ov.liveGroup}>{sess.age_group}</span>
          <span style={ov.liveTime}>{fmt.time(sess.start_time)}</span>
        </div>
      </div>

      {/* Session name */}
      <div style={ov.liveSessionName}>{sess.name}</div>

      {/* Body: coaches + progress */}
      <div style={ov.liveBody}>
        <div style={{ flex: 1 }}>
          <div style={ov.liveSectionLabel}>Coaches</div>
          <CoachChips scorers={scorers} />
        </div>

        <div style={ov.liveProgressBox}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, color: isComplete ? 'var(--green)' : 'var(--maroon)', lineHeight: 1 }}>
              {scored}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text3)', margin: '0 4px' }}>/</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--text2)' }}>
              {total}
            </span>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginTop: 2 }}>players</div>
          </div>
          <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 6, overflow: 'hidden', width: 120 }}>
            <div style={{ height: 8, width: `${pct}%`, background: isComplete ? 'var(--green)' : 'var(--maroon)', borderRadius: 6, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: isComplete ? 'var(--green)' : 'var(--text3)', marginTop: 4, textAlign: 'center' }}>
            {isComplete ? '✓ Complete' : `${pct}%`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Session Row ──────────────────────────────────────────────────────

function ScheduleCard({ sess, scorers }) {
  const scored  = sess.total_scores ?? 0;
  const total   = sess.player_count ?? 0;
  const pct     = total > 0 ? Math.round((scored / total) * 100) : 0;
  const status  = sess.status;

  const statusMeta = {
    active:   { color: 'var(--green)',  bg: 'var(--green-bg)',  label: '● Active',   txtColor: 'var(--green-txt)' },
    complete: { color: 'var(--border)', bg: 'var(--bg3)',       label: '✓ Done',     txtColor: 'var(--text3)' },
    pending:  { color: 'var(--border)', bg: '#FAFAFA',          label: 'Pending',    txtColor: 'var(--text3)' },
  }[status] || { color: 'var(--border)', bg: '#FAFAFA', label: status, txtColor: 'var(--text3)' };

  return (
    <div style={{ ...ov.schedCard, borderLeftColor: statusMeta.color }}>
      {/* Time column */}
      <div style={ov.schedTime}>
        <div style={ov.schedTimeMain}>{fmt.time(sess.start_time)}</div>
        <TypeBadge type={sess.session_type} />
      </div>

      {/* Middle: name + coaches */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={ov.schedName}>{sess.name}</span>
          <span style={{ ...ov.schedGroupTag }}>{sess.age_group}</span>
        </div>
        <CoachChips scorers={scorers} />
      </div>

      {/* Right: status + progress */}
      <div style={ov.schedRight}>
        <span style={{ ...ov.schedStatus, background: statusMeta.bg, color: statusMeta.txtColor, border: `1px solid ${statusMeta.color}` }}>
          {statusMeta.label}
        </span>
        {status !== 'pending' && (
          <div style={{ marginTop: 8, width: 100 }}>
            <ProgressBar value={scored} total={total} color={pct === 100 ? 'var(--green)' : 'var(--maroon)'} />
          </div>
        )}
        {status === 'pending' && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            {total} players
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OverviewView({
  dashboard,
  users,
  ageGroups,
  todayDate,
  setTodayDate,
  todayLoading,
  todaySessions,
  todayScorers = {},
  groupStats,
  openGroup,
  openRankings,
}) {
  const totalPlayers  = dashboard.reduce((s, d) => s + (d.total_players   || 0), 0);
  const totalSessions = dashboard.reduce((s, d) => s + (d.total_sessions  || 0), 0);
  const totalScores   = dashboard.reduce((s, d) => s + (d.total_scores    || 0), 0);
  const activeCoaches = users.filter((u) => u.role === 'scorer' || u.role === 'coordinator').length;

  const activeSessions  = todaySessions.filter((s) => s.status === 'active');
  const otherSessions   = todaySessions.filter((s) => s.status !== 'active');

  const todayLabel = new Date(`${todayDate}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <>
      {/* ── Metric cards ───────────────────────────────────────── */}
      <div style={A.metricGrid}>
        {[
          { label: 'Total Players',   val: totalPlayers,  accent: '#6B1E2E' },
          { label: 'Sessions',        val: totalSessions, accent: '#1A4B8B' },
          { label: 'Scores Entered',  val: totalScores,   accent: '#6B1E2E' },
          { label: 'Coaches Active',  val: activeCoaches, accent: '#145A3C' },
        ].map(({ label, val, accent }) => (
          <div key={label} style={{ ...A.metricCard, borderTop: `3px solid ${accent}` }}>
            <div style={{ ...A.metricVal, color: accent }}><CountUp end={val} /></div>
            <div style={A.metricLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Live Now ───────────────────────────────────────────── */}
      {!todayLoading && activeSessions.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...A.sectionHdr, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="live-dot" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ ...A.sectionLabel, color: 'var(--green)' }}>Live Right Now</span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green-txt)', border: '1px solid var(--green)' }}>
                {activeSessions.length} session{activeSessions.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: activeSessions.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 14,
          }}>
            {activeSessions.map((sess) => (
              <LiveCard key={sess.id} sess={sess} scorers={todayScorers[sess.id] || []} />
            ))}
          </div>
        </div>
      )}

      {/* ── Today's Schedule ───────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ ...A.sectionHdr, marginBottom: 12 }}>
          <div>
            <div style={A.sectionLabel}>Today's Schedule</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{todayLabel}</div>
          </div>
          <input
            type="date"
            value={todayDate}
            onChange={(e) => setTodayDate(e.target.value)}
            style={{ fontSize: 12, padding: '5px 10px', width: 'auto', borderRadius: 6 }}
          />
        </div>

        {todayLoading && <p style={A.muted}>Loading…</p>}

        {!todayLoading && todaySessions.length === 0 && (
          <div style={{ ...A.emptyCard, padding: '28px 24px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600, color: 'var(--text2)' }}>No sessions scheduled for this date.</div>
          </div>
        )}

        {!todayLoading && todaySessions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Active sessions appear first if not already in Live Now */}
            {activeSessions.length === 0 && todaySessions
              .slice()
              .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
              .map((sess) => (
                <ScheduleCard key={sess.id} sess={sess} scorers={todayScorers[sess.id] || []} />
              ))
            }
            {activeSessions.length > 0 && (
              <>
                {otherSessions
                  .slice()
                  .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                  .map((sess) => (
                    <ScheduleCard key={sess.id} sess={sess} scorers={todayScorers[sess.id] || []} />
                  ))
                }
                {otherSessions.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>
                    All sessions today are currently live.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Age Groups ─────────────────────────────────────────── */}
      <div style={{ ...A.sectionHdr, marginBottom: 8 }}>
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
                  { val: stats.total_players,  label: 'Players'  },
                  { val: stats.total_sessions, label: 'Sessions' },
                  { val: stats.total_scores,   label: 'Scores'   },
                ].map(({ val, label }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={A.agStatVal}><CountUp end={val} duration={600} /></div>
                    <div style={A.agStatLabel}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 600 }}>
                <span>{stats.complete_sessions}/{stats.total_sessions} sessions done</span>
                <span>{pct}%</span>
              </div>
              <div style={A.progressTrack}>
                <div style={{ ...A.progressFill, width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--maroon)' }} />
              </div>
              <div style={A.agFooter}>
                <span style={A.agLink}>Manage →</span>
                <button onClick={(e) => { e.stopPropagation(); openRankings(g); }} style={A.agRankBtn}>
                  Rankings →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Local styles ──────────────────────────────────────────────────────────────

const ov = {
  // Live card
  liveCard: {
    background: '#FFFFFF',
    border: '1.5px solid var(--green)',
    borderLeft: '4px solid var(--green)',
    borderRadius: 12,
    padding: '16px 18px',
    boxShadow: '0 2px 12px rgba(58,141,93,0.10)',
  },
  liveCardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  liveDot: {
    width: 9, height: 9, borderRadius: '50%',
    background: 'var(--green)', display: 'inline-block', flexShrink: 0,
  },
  liveLabel: {
    fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
    color: 'var(--green)', textTransform: 'uppercase',
  },
  liveGroup: {
    fontSize: 12, fontWeight: 700, color: 'var(--maroon)',
    background: 'var(--maroon-bg)', border: '1px solid #D4A0AC',
    borderRadius: 20, padding: '2px 10px',
  },
  liveTime: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 16, fontWeight: 700, color: 'var(--text2)',
  },
  liveSessionName: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 20, fontWeight: 700, color: 'var(--text)',
    marginBottom: 14, letterSpacing: '0.02em',
  },
  liveBody: {
    display: 'flex', gap: 20, alignItems: 'flex-start',
  },
  liveSectionLabel: {
    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 8,
  },
  liveProgressBox: {
    flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '10px 14px', background: 'var(--bg)', borderRadius: 10,
    border: '1px solid var(--border)',
  },

  // Coach chips
  coachChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#F7F5F2', border: '1px solid var(--border)',
    borderRadius: 20, padding: '4px 10px 4px 4px',
  },
  coachAvatar: {
    width: 24, height: 24, borderRadius: '50%',
    background: '#4A1320', color: '#F0B429',
    fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  coachName: {
    fontSize: 12, fontWeight: 600, color: 'var(--text)',
  },
  noCoach: {
    fontSize: 12, color: 'var(--text3)', fontStyle: 'italic',
  },

  // Schedule cards
  schedCard: {
    background: '#FFFFFF', border: '1px solid var(--border)',
    borderLeft: '4px solid var(--border)',
    borderRadius: 10, padding: '14px 16px',
    display: 'flex', gap: 16, alignItems: 'flex-start',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  },
  schedTime: {
    flexShrink: 0, width: 80, display: 'flex', flexDirection: 'column', gap: 6,
  },
  schedTimeMain: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 18, fontWeight: 700, color: 'var(--text)',
  },
  schedName: {
    fontSize: 14, fontWeight: 700, color: 'var(--text)',
  },
  schedGroupTag: {
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
    background: 'var(--maroon-bg)', color: 'var(--maroon)', border: '1px solid #D4A0AC',
    whiteSpace: 'nowrap',
  },
  schedRight: {
    flexShrink: 0, textAlign: 'right', minWidth: 110,
  },
  schedStatus: {
    fontSize: 11, fontWeight: 700, padding: '3px 10px',
    borderRadius: 20, display: 'inline-block',
  },
};
