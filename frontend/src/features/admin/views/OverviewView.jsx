import { useState, useEffect, useCallback } from 'react';
import { A } from '../styles';
import { fmt, STATUS_META } from '../shared';
import { api } from '../../../utils/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const ATTENDANCE_OPTIONS = [
  { value: 'checked_in',  label: 'Checked in',  color: 'var(--green-txt)' },
  { value: 'late_arrival',label: 'Late arrival', color: 'var(--amber-txt)' },
  { value: 'no_show',     label: 'No show',      color: 'var(--red-txt)'   },
  { value: 'excused',     label: 'Excused',      color: 'var(--text3)'     },
];

const STATUS_SEQUENCE = ['pending', 'active', 'complete', 'scoring_complete', 'finalized'];

const GROUP_META = {
  active:  { label: '● On Ice Now', color: 'var(--green)',  bg: 'var(--green-bg)'  },
  pending: { label: 'Up Next',      color: 'var(--text3)',  bg: 'transparent'      },
  done:    { label: 'Done',         color: 'var(--text3)',  bg: 'transparent'      },
};

function sessionKey(s) {
  if (s.status === 'active') return 'active';
  if (s.status === 'pending') return 'pending';
  return 'done';
}

// ── Slim header ───────────────────────────────────────────────────────────────

function SlimHeader({ activeEvent, todayDate, setTodayDate, attentionCount, attentionItems }) {
  const [showWarnings, setShowWarnings] = useState(false);
  const label = new Date(`${todayDate}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <div style={{ marginBottom: 20, position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '12px 16px', background: '#fff',
        border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--maroon)', lineHeight: 1 }}>
            {activeEvent?.name || 'No active tryout'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
        </div>
        <input
          type="date" value={todayDate}
          onChange={(e) => setTodayDate(e.target.value)}
          style={{ fontSize: 12, padding: '5px 8px', width: 'auto', borderRadius: 6, border: '1px solid var(--border)' }}
        />
        {attentionCount > 0 && (
          <button
            onClick={() => setShowWarnings((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 20,
              background: showWarnings ? 'var(--amber-bg)' : 'var(--amber-bg)',
              border: '1px solid var(--amber)', color: 'var(--amber-txt)',
              fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ⚠ {attentionCount}
          </button>
        )}
      </div>

      {showWarnings && attentionItems.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 6,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 320, maxWidth: '100vw',
          padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {attentionItems.map((item) => (
            <div key={item.title} style={{
              padding: '10px 12px', borderRadius: 8, background: '#FAF8F5',
              borderLeft: `4px solid ${item.color || 'var(--border)'}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{item.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Session card (departure board style) ─────────────────────────────────────

function SessionCard({ sess, scorers, checkIns, onClick }) {
  const sm = STATUS_META[sess.status] || STATUS_META.pending;
  const isLive = sess.status === 'active';
  const isDone = ['complete', 'scoring_complete', 'finalized'].includes(sess.status);
  const showCheckIn = !isDone;
  const ci = checkIns || {};
  const ciLow = showCheckIn && ci.total > 0 && ci.checked < ci.total;
  const scored = sess.total_scores ?? 0;
  const total  = sess.player_count ?? 0;
  const pct    = total > 0 ? Math.round((scored / total) * 100) : 0;

  return (
    <div
      onClick={() => onClick(sess)}
      style={{
        display: 'flex', gap: 0, cursor: 'pointer',
        background: isLive ? 'var(--green-bg)' : '#fff',
        border: `1px solid ${isLive ? 'var(--green)' : 'var(--border)'}`,
        borderLeft: `5px solid ${sm.border}`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: isLive ? '0 2px 12px rgba(58,141,93,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      className="session-card"
    >
      {/* Time column */}
      <div style={{
        flexShrink: 0, width: 74, padding: '16px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        borderRight: `1px solid ${isLive ? 'rgba(58,141,93,0.2)' : 'var(--border)'}`,
        background: isLive ? 'rgba(58,141,93,0.06)' : 'var(--bg)',
      }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 26, fontWeight: 800, color: isLive ? 'var(--green-txt)' : 'var(--text)',
          lineHeight: 1, textAlign: 'center',
        }}>
          {fmt.time(sess.start_time)}
        </div>
        <div style={{
          marginTop: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 10,
          background: sess.session_type === 'game' ? 'var(--amber-bg)' : 'var(--blue-bg)',
          color: sess.session_type === 'game' ? 'var(--amber-txt)' : 'var(--blue-txt)',
          border: `1px solid ${sess.session_type === 'game' ? 'var(--amber)' : 'var(--blue)'}`,
        }}>
          {sess.session_type === 'game' ? 'Game' : 'Skills'}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, padding: '14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 18, fontWeight: 700, color: 'var(--text)',
              lineHeight: 1.2, marginBottom: 3,
            }}>
              {sess.name}
            </div>
            {sess.age_group && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: 'var(--maroon-bg)', color: 'var(--maroon)', border: '1px solid #D4A0AC',
              }}>
                {sess.age_group}
              </span>
            )}
          </div>
          <span style={{
            flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 10px',
            borderRadius: 20, background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}`,
            whiteSpace: 'nowrap',
          }}>
            {sm.label}
          </span>
        </div>

        {/* Coaches */}
        {scorers.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
            {scorers.map((sc) => (
              <div key={sc.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: 'var(--text2)', fontWeight: 500,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--maroon)', color: '#F0B429',
                  fontSize: 8, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {sc.first_name?.[0]}{sc.last_name?.[0]}
                </div>
                {sc.first_name} {sc.last_name}
              </div>
            ))}
          </div>
        )}
        {!scorers.length && (
          <div style={{ fontSize: 11, color: 'var(--red-txt)', fontWeight: 600, marginBottom: 6 }}>
            No scorer assigned
          </div>
        )}

        {/* Bottom row: check-in + scoring progress */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {showCheckIn && ci.total > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: ciLow ? 'var(--amber-txt)' : 'var(--blue-txt)',
            }}>
              👤 {ci.checked}/{ci.total} checked in{ciLow ? ' ⚠' : ''}
            </span>
          )}
          {!isDone && total > 0 && scored > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {scored}/{total} scored
            </span>
          )}
          {isDone && total > 0 && (
            <span style={{ fontSize: 11, color: pct === 100 ? 'var(--green-txt)' : 'var(--amber-txt)', fontWeight: 600 }}>
              {scored}/{total} scored · {pct}%
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>tap for detail →</span>
        </div>
      </div>
    </div>
  );
}

// ── Session drawer ────────────────────────────────────────────────────────────

function SessionDrawer({ sess, scorers, onClose, updateStatus, user }) {
  const [completion, setCompletion] = useState(null);
  const [players, setPlayers]       = useState(null);
  const [siblings, setSiblings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [movePlayer, setMovePlayer] = useState(null);
  const [moveTargetId, setMoveTargetId] = useState('');
  const [moving, setMoving]         = useState(false);
  const [checkingIn, setCheckingIn] = useState(null);

  const sm = STATUS_META[sess.status] || STATUS_META.pending;
  const isFinalized = sess.status === 'finalized';
  const canFinalize = user?.role === 'admin';
  const currentIdx  = STATUS_SEQUENCE.indexOf(sess.status);
  const nextStatus  = currentIdx >= 0 && currentIdx < STATUS_SEQUENCE.length - 1 ? STATUS_SEQUENCE[currentIdx + 1] : null;
  const canAdvance  = nextStatus && !(nextStatus === 'finalized' && !canFinalize);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, playersRes, siblingsRes] = await Promise.all([
        api.sessionCompletion(sess.id),
        api.sessionPlayers(sess.id),
        api.sessionSiblings(sess.id),
      ]);
      setCompletion(compRes);
      setPlayers(playersRes.players || []);
      setSiblings(siblingsRes.sessions || []);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [sess.id]);

  useEffect(() => { load(); }, [load]);

  const handleAdvance = async () => {
    if (!nextStatus || !updateStatus) return;
    if (nextStatus === 'finalized' && !window.confirm('Finalize this session? Scores and roster edits will be locked.')) return;
    await updateStatus(sess.id, nextStatus);
    onClose();
  };

  const handleCheckin = async (player, attendanceStatus) => {
    setCheckingIn(player.id);
    try {
      await api.checkin(sess.id, player.id, true, attendanceStatus);
      const r = await api.sessionPlayers(sess.id);
      setPlayers(r.players || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setCheckingIn(null);
    }
  };

  const handleMarkOut = async (player) => {
    setCheckingIn(player.id);
    try {
      await api.checkin(sess.id, player.id, false, 'no_show');
      const r = await api.sessionPlayers(sess.id);
      setPlayers(r.players || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setCheckingIn(null);
    }
  };

  const submitMove = async () => {
    if (!movePlayer || !moveTargetId) return;
    setMoving(true);
    try {
      await api.movePlayer({
        playerId: movePlayer.id,
        fromSessionId: sess.id,
        toSessionId: parseInt(moveTargetId, 10),
        keepCheckinStatus: false,
      });
      const r = await api.sessionPlayers(sess.id);
      setPlayers(r.players || []);
      setMovePlayer(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 200, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(480px, 100vw)',
        background: '#fff', zIndex: 201,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.22s ease',
      }}>
        {/* Drawer header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
                {sess.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                {fmt.time(sess.start_time)} · {sess.age_group}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}` }}>
                {sm.label}
              </span>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text3)', lineHeight: 1, padding: 4 }}>✕</button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading && <div style={{ fontSize: 13, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>Loading…</div>}

          {/* Scorer progress */}
          {!loading && (
            <section>
              <div style={dr.sectionLabel}>Scorer Progress</div>
              {completion?.perScorer?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {completion.perScorer.map((sc) => {
                    const done = sc.scores_submitted >= sc.total_players;
                    const pct  = sc.total_players > 0 ? Math.round((sc.scores_submitted / sc.total_players) * 100) : 0;
                    return (
                      <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: done ? 'var(--green)' : 'var(--maroon)',
                          color: '#fff', fontSize: 10, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {sc.first_name?.[0]}{sc.last_name?.[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                            <span style={{ fontWeight: 600 }}>{sc.first_name} {sc.last_name}</span>
                            <span style={{ fontWeight: 700, color: done ? 'var(--green-txt)' : 'var(--amber-txt)' }}>
                              {sc.scores_submitted}/{sc.total_players} {done ? '✓' : ''}
                            </span>
                          </div>
                          <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: 4, width: `${pct}%`, background: done ? 'var(--green)' : 'var(--amber)', borderRadius: 2, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No scorers assigned to this session.</div>
              )}
            </section>
          )}

          {/* Players + check-in */}
          {!loading && players !== null && (
            <section>
              <div style={dr.sectionLabel}>Players ({players.length})</div>
              {players.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No players in this session.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {players.map((p) => {
                  const isChecking = checkingIn === p.id;
                  const checkedIn = p.checked_in;
                  const attOpt = ATTENDANCE_OPTIONS.find((o) => o.value === p.attendance_status);
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 8,
                      background: movePlayer?.id === p.id ? 'var(--gold-bg)' : 'var(--bg)',
                      border: `1px solid ${movePlayer?.id === p.id ? 'var(--gold-dark)' : 'transparent'}`,
                    }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--maroon)', width: 34, flexShrink: 0 }}>
                        #{p.jersey_number}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                        {p.first_name} {p.last_name}
                      </span>
                      {p.scored && (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'var(--green-bg)', color: 'var(--green-txt)', border: '1px solid var(--green)', flexShrink: 0 }}>✓</span>
                      )}

                      {/* Check-in quick toggle */}
                      {!isFinalized && (
                        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                          {checkedIn ? (
                            <>
                              <span style={{ fontSize: 11, color: attOpt?.color || 'var(--green-txt)', fontWeight: 600 }}>
                                {attOpt?.label || 'In'}
                              </span>
                              <button
                                onClick={() => handleMarkOut(p)}
                                disabled={isChecking}
                                style={{ ...dr.miniBtn, color: 'var(--text3)', border: '1px solid var(--border)' }}
                                title="Mark no-show"
                              >
                                ✗
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleCheckin(p, 'checked_in')} disabled={isChecking} style={{ ...dr.miniBtn, background: 'var(--green-bg)', color: 'var(--green-txt)', border: '1px solid var(--green)' }}>In</button>
                              <button onClick={() => handleCheckin(p, 'late_arrival')} disabled={isChecking} style={{ ...dr.miniBtn, background: 'var(--amber-bg)', color: 'var(--amber-txt)', border: '1px solid var(--amber)' }}>Late</button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Move button */}
                      {!isFinalized && (
                        <button
                          onClick={() => setMovePlayer(movePlayer?.id === p.id ? null : p)}
                          style={{ ...dr.miniBtn, color: 'var(--text3)', border: '1px solid var(--border)' }}
                          title="Move to another session"
                        >
                          ↗
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Move dialog */}
              {movePlayer && (
                <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--gold-bg)', border: '1px solid var(--gold-dark)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    Move #{movePlayer.jersey_number} {movePlayer.first_name} {movePlayer.last_name}
                  </div>
                  <select value={moveTargetId} onChange={(e) => setMoveTargetId(e.target.value)} style={{ marginBottom: 8, fontSize: 13 }}>
                    <option value="">Choose destination session…</option>
                    {siblings.filter((s) => s.id !== sess.id).map((s) => (
                      <option key={s.id} value={s.id}>{s.name} · {STATUS_META[s.status]?.label || s.status}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={submitMove} disabled={!moveTargetId || moving} style={A.saveBtn}>{moving ? 'Moving…' : 'Move player'}</button>
                    <button onClick={() => setMovePlayer(null)} style={A.ghostBtn}>Cancel</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Drawer footer — status advance */}
        {canAdvance && updateStatus && (
          <div style={{
            flexShrink: 0, padding: '14px 20px',
            borderTop: '1px solid var(--border)', background: 'var(--bg)',
          }}>
            <button onClick={handleAdvance} style={{ ...A.saveBtn, width: '100%', fontSize: 14, padding: '12px' }}>
              Mark {STATUS_META[nextStatus]?.label} →
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .session-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.10) !important;
        }
      `}</style>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OverviewView({
  ageGroups,
  todayDate,
  setTodayDate,
  todayLoading,
  todaySessions,
  todayScorers = {},
  todayCheckIns = {},
  activeEvent,
  updateStatus,
  user,
  openCheckIn,
  openSessions,
  openTryoutSetup,
}) {
  const [selectedSession, setSelectedSession] = useState(null);

  // Build attention items
  const missingScorers  = todaySessions.filter((s) => !(todayScorers[s.id] || []).length);
  const stuckOffIce     = todaySessions.filter((s) => s.status === 'complete');
  const attentionItems  = [];

  if (!activeEvent && openTryoutSetup) {
    attentionItems.push({ title: 'No active tryout', body: 'Create a tryout window before adding sessions.', color: 'var(--red)', action: openTryoutSetup });
  }
  if (missingScorers.length) {
    attentionItems.push({ title: `${missingScorers.length} session${missingScorers.length > 1 ? 's' : ''} missing scorers`, body: 'Assign scorers before players arrive.', color: 'var(--amber)' });
  }
  if (stuckOffIce.length) {
    attentionItems.push({ title: `${stuckOffIce.length} session${stuckOffIce.length > 1 ? 's' : ''} Off Ice`, body: 'Review scorer progress and advance when ready.', color: 'var(--blue)' });
  }

  // Group sessions
  const groups = { active: [], pending: [], done: [] };
  todaySessions
    .slice()
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    .forEach((s) => groups[sessionKey(s)].push(s));

  const openSession = (sess) => setSelectedSession(sess);
  const closeSession = () => setSelectedSession(null);

  const handleStatusUpdate = async (sessionId, status) => {
    if (updateStatus) await updateStatus(sessionId, status);
    closeSession();
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <SlimHeader
        activeEvent={activeEvent}
        todayDate={todayDate}
        setTodayDate={setTodayDate}
        attentionCount={attentionItems.length}
        attentionItems={attentionItems}
      />

      {todayLoading && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0', fontSize: 13 }}>Loading sessions…</div>
      )}

      {!todayLoading && todaySessions.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏒</div>
          <div style={{ fontWeight: 600, color: 'var(--text2)' }}>No sessions scheduled for this date.</div>
          {openSessions && (
            <button onClick={openSessions} style={{ ...A.ghostBtn, marginTop: 12 }}>Open Session Planning →</button>
          )}
        </div>
      )}

      {!todayLoading && [
        { key: 'active',  sessions: groups.active  },
        { key: 'pending', sessions: groups.pending },
        { key: 'done',    sessions: groups.done    },
      ].map(({ key, sessions }) => sessions.length === 0 ? null : (
        <div key={key} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: GROUP_META[key].color }}>
              {GROUP_META[key].label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map((sess) => (
              <SessionCard
                key={sess.id}
                sess={sess}
                scorers={todayScorers[sess.id] || []}
                checkIns={todayCheckIns[sess.id]}
                onClick={openSession}
              />
            ))}
          </div>
        </div>
      ))}

      {selectedSession && (
        <SessionDrawer
          sess={selectedSession}
          scorers={todayScorers[selectedSession.id] || []}
          onClose={closeSession}
          updateStatus={handleStatusUpdate}
          user={user}
        />
      )}
    </div>
  );
}

// ── Drawer local styles ───────────────────────────────────────────────────────

const dr = {
  sectionLabel: {
    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.1em', color: 'var(--maroon)', marginBottom: 10,
  },
  miniBtn: {
    padding: '3px 7px', borderRadius: 6, fontSize: 11, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', background: '#fff', border: '1px solid var(--border)',
    lineHeight: 1.4,
  },
};
