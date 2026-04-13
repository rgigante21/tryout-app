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

function sessionStartMs(session, fallbackDate) {
  const date = String(session.session_date || fallbackDate || '').slice(0, 10);
  const time = session.start_time ? String(session.start_time).slice(0, 5) : '23:59';
  const stamp = new Date(`${date}T${time}:00`).getTime();
  return Number.isNaN(stamp) ? Number.MAX_SAFE_INTEGER : stamp;
}

function TodayCommandCenter({
  activeEvent,
  todayDate,
  todayLoading,
  todaySessions,
  todayScorers,
  todayCheckIns,
  ageGroups,
  openCheckIn,
  openSessions,
  openTryoutSetup,
  openResults,
}) {
  const nowMs = Date.now();
  const sortedSessions = todaySessions
    .slice()
    .sort((a, b) => sessionStartMs(a, todayDate) - sessionStartMs(b, todayDate));
  const activeSessions = sortedSessions.filter((s) => s.status === 'active');
  const nextSession = activeSessions[0]
    || sortedSessions.find((s) => sessionStartMs(s, todayDate) >= nowMs && !['complete', 'scoring_complete', 'finalized'].includes(s.status))
    || sortedSessions.find((s) => !['complete', 'scoring_complete', 'finalized'].includes(s.status))
    || sortedSessions[0]
    || null;

  const totalPlayersToday = todaySessions.reduce((sum, session) => sum + (Number(session.player_count) || 0), 0);
  const checkedIn = Object.values(todayCheckIns).reduce((sum, stat) => sum + (Number(stat?.checked) || 0), 0);
  const checkInTotal = Object.values(todayCheckIns).reduce((sum, stat) => sum + (Number(stat?.total) || 0), 0);

  const missingScorers = todaySessions.filter((session) => !(todayScorers[session.id] || []).length);
  const activeIncomplete = todaySessions.filter((session) => (
    session.status === 'active'
    && (Number(session.player_count) || 0) > 0
    && (Number(session.total_scores) || 0) < (Number(session.player_count) || 0)
  ));
  const checkInGaps = Object.values(todayCheckIns).filter((stat) => (
    (Number(stat?.total) || 0) > 0
    && (Number(stat?.checked) || 0) < (Number(stat?.total) || 0)
  ));

  const attentionItems = [];
  if (!activeEvent) {
    attentionItems.push({
      tone: 'red',
      title: 'Create a tryout',
      body: 'Set up the active tryout window before adding sessions, rosters, or check-in.',
      action: 'Open Tryout Setup',
      onAction: openTryoutSetup,
    });
  } else if (todayLoading) {
    attentionItems.push({
      tone: 'blue',
      title: "Loading today's plan",
      body: 'Checking sessions, coaches, and check-in for the selected date.',
      action: 'Open Sessions',
      onAction: openSessions,
    });
  } else if (!todayLoading && !todaySessions.length) {
    attentionItems.push({
      tone: 'blue',
      title: 'No sessions today',
      body: 'Use Sessions to build the day plan or change the date below to review another day.',
      action: 'Open Sessions',
      onAction: openSessions,
    });
  }
  if (activeEvent && !ageGroups.length) {
    attentionItems.push({
      tone: 'red',
      title: 'No age groups yet',
      body: 'Add age groups before importing players or building tryout blocks.',
      action: 'Open Tryout Setup',
      onAction: openTryoutSetup,
    });
  }
  if (!todayLoading && missingScorers.length) {
    attentionItems.push({
      tone: 'gold',
      title: `${missingScorers.length} session${missingScorers.length === 1 ? '' : 's'} missing coaches`,
      body: 'Assign scorers before players arrive so score sheets are ready.',
      action: 'Open Sessions',
      onAction: openSessions,
    });
  }
  if (!todayLoading && activeIncomplete.length) {
    attentionItems.push({
      tone: 'green',
      title: `${activeIncomplete.length} live session${activeIncomplete.length === 1 ? '' : 's'} need scores`,
      body: 'Open scoring progress and keep live evaluations moving.',
      action: 'View Results',
      onAction: openResults,
    });
  }
  if (!todayLoading && checkInGaps.length) {
    attentionItems.push({
      tone: 'blue',
      title: 'Check-in still open',
      body: `${checkedIn} of ${checkInTotal} players are marked in for today.`,
      action: 'Open Check-In',
      onAction: openCheckIn,
    });
  }
  if (!attentionItems.length) {
    attentionItems.push({
      tone: 'green',
      title: 'Today is ready',
      body: 'Sessions, coaches, and check-in look ready from here.',
      action: 'Open Sessions',
      onAction: openSessions,
    });
  }

  return (
    <section style={ov.commandCenter}>
      <div style={ov.commandMain}>
        <div style={ov.commandEyebrow}>Today</div>
        <h3 style={ov.commandTitle}>{activeEvent ? activeEvent.name : 'No current tryout selected'}</h3>
        <div style={ov.commandMeta}>
          {activeEvent
            ? `${activeEvent.season} · ${fmt.date(activeEvent.start_date)} to ${fmt.date(activeEvent.end_date)}`
            : 'Create a tryout window to begin scheduling.'}
        </div>
        <div style={ov.commandActions}>
          <button onClick={openCheckIn} style={{ ...A.primaryBtn, borderRadius: 8 }}>Open Check-In</button>
          <button onClick={openSessions} style={ov.commandGhostBtn}>Manage Sessions</button>
          <button onClick={openTryoutSetup} style={ov.commandGhostBtn}>Tryout Setup</button>
        </div>
      </div>

      <div style={ov.commandPanel}>
        <div style={ov.commandPanelHeader}>
          <span>Needs Attention</span>
          <span style={ov.commandPanelCount}>{attentionItems.length}</span>
        </div>
        <div style={ov.attentionList}>
          {attentionItems.slice(0, 3).map((item) => (
            <div key={item.title} style={{ ...ov.attentionItem, borderLeftColor: ov.attentionTone[item.tone] || 'var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={ov.attentionTitle}>{item.title}</div>
                <div style={ov.attentionBody}>{item.body}</div>
              </div>
              {item.onAction && (
                <button onClick={item.onAction} style={ov.attentionAction}>{item.action}</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={ov.commandStats}>
        <div style={ov.commandStat}>
          <span style={ov.commandStatLabel}>Next Up</span>
          <strong style={ov.commandStatValue}>{nextSession ? fmt.time(nextSession.start_time) : '-'}</strong>
          <span style={ov.commandStatMeta}>{nextSession ? nextSession.name : 'No session selected'}</span>
        </div>
        <div style={ov.commandStat}>
          <span style={ov.commandStatLabel}>Sessions</span>
          <strong style={ov.commandStatValue}>{todaySessions.length}</strong>
          <span style={ov.commandStatMeta}>on this date</span>
        </div>
        <div style={ov.commandStat}>
          <span style={ov.commandStatLabel}>Players</span>
          <strong style={ov.commandStatValue}>{totalPlayersToday}</strong>
          <span style={ov.commandStatMeta}>scheduled today</span>
        </div>
      </div>
    </section>
  );
}

// ── Live Session Card ─────────────────────────────────────────────────────────

function LiveCard({ sess, scorers, checkIns }) {
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
          {checkIns && (
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: 'var(--blue-txt)', background: 'var(--blue-bg)', border: '1px solid var(--blue)', borderRadius: 20, padding: '3px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
              👤 {checkIns.checked} / {checkIns.total} checked in
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Schedule Session Row ──────────────────────────────────────────────────────

function ScheduleCard({ sess, scorers, checkIns }) {
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
        {checkIns && checkIns.total > 0 && (
          <div style={{ fontSize: 11, color: 'var(--blue-txt)', marginTop: 4, fontWeight: 600 }}>
            👤 {checkIns.checked} / {checkIns.total} in
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
  todayCheckIns = {},
  groupStats,
  activeEvent,
  openGroup,
  openRankings,
  openWorkspace,
  openCheckIn,
  openSessions,
  openTryoutSetup,
  openResults,
}) {
  const activeSessions  = todaySessions.filter((s) => s.status === 'active');
  const otherSessions   = todaySessions.filter((s) => s.status !== 'active');

  const todayLabel = new Date(`${todayDate}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <>
      <TodayCommandCenter
        activeEvent={activeEvent}
        todayDate={todayDate}
        todayLoading={todayLoading}
        todaySessions={todaySessions}
        todayScorers={todayScorers}
        todayCheckIns={todayCheckIns}
        ageGroups={ageGroups}
        openCheckIn={openCheckIn}
        openSessions={openSessions}
        openTryoutSetup={openTryoutSetup}
        openResults={openResults}
      />

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
              <LiveCard key={sess.id} sess={sess} scorers={todayScorers[sess.id] || []} checkIns={todayCheckIns[sess.id]} />
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
                <ScheduleCard key={sess.id} sess={sess} scorers={todayScorers[sess.id] || []} checkIns={todayCheckIns[sess.id]} />
              ))
            }
            {activeSessions.length > 0 && (
              <>
                {otherSessions
                  .slice()
                  .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                  .map((sess) => (
                    <ScheduleCard key={sess.id} sess={sess} scorers={todayScorers[sess.id] || []} checkIns={todayCheckIns[sess.id]} />
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
                <div style={{ display: 'flex', gap: 6 }}>
                  {openWorkspace && (
                    <button onClick={(e) => { e.stopPropagation(); openWorkspace(g); }} style={{ ...A.agRankBtn, background: 'var(--maroon)', color: '#fff', borderColor: 'var(--maroon)' }}>
                      Workspace →
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); openRankings(g); }} style={A.agRankBtn}>
                    Rankings →
                  </button>
                </div>
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
  commandCenter: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 14,
    alignItems: 'stretch',
    marginBottom: 28,
  },
  commandMain: {
    background: 'linear-gradient(135deg, #471420 0%, #641b2b 54%, #294766 100%)',
    color: '#fff',
    borderRadius: 8,
    padding: '24px 26px',
    boxShadow: '0 18px 40px rgba(74,19,32,0.18)',
  },
  commandEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'rgba(255,255,255,0.68)',
    marginBottom: 10,
  },
  commandTitle: {
    margin: 0,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 42,
    lineHeight: 0.98,
    color: '#fff',
  },
  commandMeta: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 1.5,
  },
  commandActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 22,
  },
  commandGhostBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    padding: '0 14px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.22)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  commandPanel: {
    background: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '18px',
    boxShadow: '0 12px 30px rgba(26,18,18,0.05)',
  },
  commandPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--maroon)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  commandPanelCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--maroon-bg)',
    color: 'var(--maroon)',
    letterSpacing: 0,
  },
  attentionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  attentionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    border: '1px solid var(--border)',
    borderLeft: '4px solid var(--border)',
    borderRadius: 8,
    padding: '12px',
    background: '#FAF8F5',
  },
  attentionTone: {
    red: 'var(--red)',
    gold: 'var(--gold)',
    green: 'var(--green)',
    blue: 'var(--blue)',
  },
  attentionTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: 'var(--text)',
    marginBottom: 3,
  },
  attentionBody: {
    fontSize: 12,
    color: 'var(--text3)',
    lineHeight: 1.45,
  },
  attentionAction: {
    flexShrink: 0,
    minHeight: 32,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: '#fff',
    color: 'var(--maroon)',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  commandStats: {
    gridColumn: '1 / -1',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
  },
  commandStat: {
    background: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '14px 16px',
    minHeight: 96,
    boxShadow: '0 8px 24px rgba(26,18,18,0.04)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  commandStatLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  commandStatValue: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 32,
    lineHeight: 1,
    color: 'var(--maroon)',
    marginTop: 8,
  },
  commandStatMeta: {
    fontSize: 12,
    color: 'var(--text3)',
    lineHeight: 1.4,
    marginTop: 6,
  },

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
