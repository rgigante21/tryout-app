import { useState } from 'react';
import { A } from '../styles';
import { BlockWizardPanel, STATUS_META, fmt } from '../shared';
import { api } from '../../../utils/api';

const TYPE_STYLE = {
  game:   { bg: 'var(--amber-bg)', color: 'var(--amber-txt)', border: 'var(--amber)', label: '🥅 Game' },
  skills: { bg: 'var(--blue-bg)',  color: 'var(--blue-txt)',  border: 'var(--blue)',  label: '🏒 Skills' },
};

const SPLIT_METHODS = [
  { method: 'last_name',    label: 'By Last Name' },
  { method: 'jersey_range', label: 'By Jersey #' },
  { method: 'none',         label: 'All Together' },
  { method: 'manual',       label: 'Manual' },
];

const GAME_ASSIGNMENTS = [
  { method: 'random', label: 'Random' },
  { method: 'manual', label: 'Manual' },
];

const ATTENDANCE_LABEL = {
  checked_in: 'Checked in',
  late_arrival: 'Late arrival',
  no_show: 'No show',
  excused: 'Excused',
};

function SessionTile({
  sess, scorers, users,
  onSaveSession,
  updateStatus, removeSession,
  assigningTo, setAssigningTo, assignUserId, setAssignUserId,
  assignScorer, unassignScorer, onChangeAssignment,
  user,
  planningContext,
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [changingAssignment, setChangingAssignment] = useState(false);
  const [sessionPlayers, setSessionPlayers] = useState(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [completion, setCompletion] = useState(null);
  const [movePlayer, setMovePlayer] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [moveTargetId, setMoveTargetId] = useState('');
  const [preserveCheckin, setPreserveCheckin] = useState(true);
  const [moving, setMoving] = useState(false);

  const sm = STATUS_META[sess.status] || STATUS_META.pending;
  const typeStyle = TYPE_STYLE[sess.session_type] || TYPE_STYLE.skills;
  const isAssigning = assigningTo === sess.id;
  const assignable = users.filter((u) => !scorers.find((sc) => sc.id === u.id));
  const isFinalized = sess.status === 'finalized';
  const canFinalize = user?.role === 'admin';

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (!next) { setDraft(null); setMovePlayer(null); return; }
    setLoadingPlayers(true);
    try {
      const [playersRes, completionRes] = await Promise.all([
        api.sessionPlayers(sess.id),
        api.sessionCompletion(sess.id),
      ]);
      setSessionPlayers(playersRes.players || []);
      setCompletion(completionRes);
    } catch {
      setSessionPlayers([]);
      setCompletion(null);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const openEdit = () => {
    if (isFinalized) return;
    setDraft({
    name: sess.name,
    date: sess.session_date ? sess.session_date.slice(0, 10) : '',
    time: sess.start_time ? sess.start_time.slice(0, 5) : '',
    });
  };
  const cancelEdit = () => setDraft(null);
  const saveEdit = async () => {
    if (!draft.name || !draft.date) return;
    setSaving(true);
    try {
      await onSaveSession(sess.id, { name: draft.name, sessionDate: draft.date, startTime: draft.time || null });
      setDraft(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const doAssignment = async (payload) => {
    if (isFinalized) return;
    setChangingAssignment(true);
    try {
      await onChangeAssignment(sess.block_id, payload);
      const r = await api.sessionPlayers(sess.id);
      setSessionPlayers(r.players || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setChangingAssignment(false);
    }
  };

  const refreshExpandedData = async () => {
    const [playersRes, completionRes] = await Promise.all([
      api.sessionPlayers(sess.id),
      api.sessionCompletion(sess.id),
    ]);
    setSessionPlayers(playersRes.players || []);
    setCompletion(completionRes);
  };

  const openMove = async (player) => {
    if (isFinalized) return;
    setMovePlayer(player);
    setMoveTargetId('');
    setPreserveCheckin(Boolean(player.checked_in));
    try {
      const r = await api.sessionSiblings(sess.id);
      setSiblings(r.sessions || []);
    } catch (err) {
      alert(err.message);
      setSiblings([]);
    }
  };

  const submitMove = async () => {
    if (!movePlayer || !moveTargetId) return;
    if (movePlayer.checked_in && !window.confirm('Move this checked-in player?')) return;
    setMoving(true);
    try {
      await api.movePlayer({
        playerId: movePlayer.id,
        fromSessionId: sess.id,
        toSessionId: parseInt(moveTargetId, 10),
        keepCheckinStatus: preserveCheckin,
      });
      await refreshExpandedData();
      setMovePlayer(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setMoving(false);
    }
  };

  const handleStatusChange = (nextStatus) => {
    if (nextStatus === 'finalized' && !canFinalize) return;
    if (nextStatus === 'finalized' && !window.confirm('Finalize this session? Scores and roster edits will be locked for normal users.')) return;
    updateStatus(sess.id, nextStatus);
  };

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${expanded ? 'var(--gold-dark)' : 'var(--border)'}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'border-color 0.15s',
    }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>

        {/* Left: badges + name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: typeStyle.bg, color: typeStyle.color, border: `1px solid ${typeStyle.border}` }}>
              {typeStyle.label}
            </span>
            {sess.age_group && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F5E8EB', color: '#6B1E2E', border: '1px solid #D4A0AC' }}>
                {sess.age_group}
              </span>
            )}
            {(sess.last_name_start && sess.last_name_end) && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                {sess.last_name_start}–{sess.last_name_end}
              </span>
            )}
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{sess.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
            {fmt.date(sess.session_date)}{sess.start_time ? ` · ${fmt.time(sess.start_time)}` : ''}
            {!expanded && scorers.length > 0 && (
              <span style={{ marginLeft: 10, color: 'var(--text3)' }}>· {scorers.map((u) => u.first_name).join(', ')}</span>
            )}
          </div>
        </div>

        {/* Right: count + status + manage */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: 'var(--maroon)', lineHeight: 1 }}>{sess.player_count}</div>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>players</div>
          </div>
          <select
            value={sess.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            style={{ ...A.statusSelect, background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}` }}
          >
            <option value="pending">Pending</option>
            <option value="active">On Ice</option>
            <option value="complete">Off Ice</option>
            <option value="scoring_complete">Scores In</option>
            {canFinalize && <option value="finalized">Finalized</option>}
          </select>
          <button
            onClick={toggle}
            style={{
              background: expanded ? 'var(--maroon)' : '#fff',
              border: `1px solid ${expanded ? 'var(--maroon)' : 'var(--border)'}`,
              borderRadius: 8, fontSize: 12, color: expanded ? '#fff' : 'var(--text2)',
              padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            {expanded ? 'Close ▲' : 'Manage ▼'}
          </button>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div style={{ borderTop: '2px solid var(--bg3)', background: 'var(--bg)' }}>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Session Details */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--maroon)' }}>Session Details</div>
                {!draft && <button onClick={openEdit} disabled={isFinalized} style={{ ...A.ghostBtn, opacity: isFinalized ? 0.5 : 1 }}>Edit</button>}
                {draft && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveEdit} disabled={saving || !draft.name || !draft.date} style={A.saveBtn}>{saving ? 'Saving…' : 'Save'}</button>
                    <button onClick={cancelEdit} style={A.ghostBtn}>Cancel</button>
                  </div>
                )}
              </div>
              {!draft ? (
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 13, color: 'var(--text2)' }}>
                  <div><span style={{ fontWeight: 700, color: 'var(--text)' }}>Name</span><br />{sess.name}</div>
                  <div><span style={{ fontWeight: 700, color: 'var(--text)' }}>Date</span><br />{fmt.date(sess.session_date)}</div>
                  <div><span style={{ fontWeight: 700, color: 'var(--text)' }}>Time</span><br />{sess.start_time ? fmt.time(sess.start_time) : '—'}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '2 1 200px', minWidth: 150 }}>
                    <label style={A.fieldLabel}>Name</label>
                    <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                  </div>
                  <div style={{ flex: '1 1 140px', minWidth: 130 }}>
                    <label style={A.fieldLabel}>Date</label>
                    <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
                  </div>
                  <div style={{ flex: '0 0 130px', minWidth: 110 }}>
                    <label style={A.fieldLabel}>Time</label>
                    <input type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} />
                  </div>
                </div>
              )}
            </section>

            {isFinalized && (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--maroon-bg)', border: '1px solid var(--maroon)', color: 'var(--maroon)', fontSize: 13, fontWeight: 700 }}>
                Finalized session. Normal score and roster edits are locked.
              </div>
            )}

            {completion?.totals && (
              <section>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--maroon)', marginBottom: 10 }}>
                  Operations
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 8 }}>
                  {[
                    ['Scorers', scorers.length],
                    ['Checked in', `${completion.totals.checked_in_count || 0}/${completion.totals.total_players || 0}`],
                    ['With scores', completion.totals.players_with_any_score || 0],
                    ['Missing scores', completion.totals.players_missing_scores || 0],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: label === 'Missing scores' && value > 0 ? 'var(--red-txt)' : 'var(--text)' }}>{value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>{label}</div>
                    </div>
                  ))}
                </div>
                {completion.perScorer?.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {completion.perScorer.map((scorer) => (
                      <div key={scorer.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)' }}>
                        <span>{scorer.first_name} {scorer.last_name}</span>
                        <strong>{scorer.scores_submitted}/{scorer.total_players}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Players + Assignment + Scorers in columns */}
            <div style={{ display: 'grid', gridTemplateColumns: `1fr${sess.block_id && onChangeAssignment ? ' 200px' : ''} 220px`, gap: 20, alignItems: 'start' }}>

              {/* Players */}
              <section>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--maroon)', marginBottom: 10 }}>
                  Players{sessionPlayers ? ` (${sessionPlayers.length})` : ''}
                </div>
                {loadingPlayers && <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Loading…</div>}
                {!loadingPlayers && sessionPlayers?.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>No players assigned to this session.</div>
                )}
                {!loadingPlayers && sessionPlayers && sessionPlayers.length > 0 && (
                  <div style={{ maxHeight: 220, overflowY: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {sessionPlayers.map((p, i) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: i < sessionPlayers.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--maroon)', width: 36, flexShrink: 0 }}>
                          #{p.jersey_number}
                        </span>
                        <span style={{ flex: 1, color: 'var(--text)', fontWeight: 500 }}>{p.first_name} {p.last_name}</span>
                        {p.scored && (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'var(--green-bg)', color: 'var(--green-txt)', border: '1px solid var(--green)', flexShrink: 0 }}>✓</span>
                        )}
                        <span style={{ fontSize: 11, color: p.checked_in ? 'var(--green-txt)' : 'var(--text3)', flexShrink: 0 }}>
                          {ATTENDANCE_LABEL[p.attendance_status] || (p.checked_in ? 'Checked in' : 'Not in')}
                        </span>
                        <button
                          type="button"
                          onClick={() => openMove(p)}
                          disabled={isFinalized}
                          style={{ ...A.ghostBtn, fontSize: 11, padding: '3px 8px', opacity: isFinalized ? 0.45 : 1 }}
                        >
                          Move
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {movePlayer && (
                  <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                      Move #{movePlayer.jersey_number} {movePlayer.first_name} {movePlayer.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                      Current check-in: {ATTENDANCE_LABEL[movePlayer.attendance_status] || (movePlayer.checked_in ? 'Checked in' : 'Not checked in')}
                    </div>
                    <select value={moveTargetId} onChange={(e) => setMoveTargetId(e.target.value)} style={{ marginBottom: 8 }}>
                      <option value="">Destination session...</option>
                      {siblings.map((sibling) => (
                        <option key={sibling.id} value={sibling.id}>{sibling.name} ({STATUS_META[sibling.status]?.label || sibling.status})</option>
                      ))}
                    </select>
                    {movePlayer.checked_in && (
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginBottom: 8 }}>
                        <input type="checkbox" checked={preserveCheckin} onChange={(e) => setPreserveCheckin(e.target.checked)} style={{ width: 'auto', minHeight: 'auto' }} />
                        Preserve check-in state
                      </label>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={submitMove} disabled={!moveTargetId || moving} style={A.saveBtn}>{moving ? 'Moving...' : 'Move player'}</button>
                      <button onClick={() => setMovePlayer(null)} style={A.ghostBtn}>Cancel</button>
                    </div>
                  </div>
                )}
              </section>

              {/* Player Re-assignment (block sessions only) */}
              {sess.block_id && onChangeAssignment && (
                <section>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--maroon)', marginBottom: 4 }}>
                    Re-assign
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.4 }}>
                    Reassign all players in this block using a different split.
                    {changingAssignment && <span style={{ marginLeft: 4, color: 'var(--amber-txt)' }}>Updating…</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(sess.session_type === 'skills' ? SPLIT_METHODS : GAME_ASSIGNMENTS).map(({ method, label }) => (
                      <button
                        key={method}
                        disabled={changingAssignment || isFinalized}
                        onClick={() => doAssignment(sess.session_type === 'skills' ? { splitMethod: method } : { playerAssignment: method })}
                        style={{ ...A.ghostBtn, fontSize: 12, padding: '6px 10px', textAlign: 'left', opacity: changingAssignment || isFinalized ? 0.5 : 1 }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Scorers */}
              <section>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--maroon)', marginBottom: 10 }}>Scorers</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
                  {scorers.map((u) => (
                    <span key={u.id} style={A.scorerChip}>
                      {u.first_name} {u.last_name}
                      <button onClick={() => unassignScorer(sess.id, u.id)} disabled={isFinalized} style={A.chipX}>×</button>
                    </span>
                  ))}
                  {isAssigning ? (
                    <div style={{ width: '100%', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} style={{ ...A.selectInput }}>
                        <option value="">Select scorer…</option>
                        {assignable.map((u) => (
                          <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => assignScorer(sess.id)} style={A.primaryBtn}>Assign</button>
                        <button onClick={() => { setAssigningTo(null); setAssignUserId(''); }} style={A.ghostBtn}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button disabled={isFinalized} onClick={() => { setAssigningTo(sess.id); setAssignUserId(''); }} style={{ ...A.addScorerBtn, opacity: isFinalized ? 0.5 : 1 }}>+ Add scorer</button>
                  )}
                </div>
              </section>

            </div>

            {/* Delete */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => removeSession(sess.id)} style={{ ...A.ghostBtn, color: 'var(--red-txt)', borderColor: 'var(--red-txt)', fontSize: 12 }}>
                Delete Session
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export function SessionsIndexView({ ageGroups, groupStats, openSessionGroup }) {
  return (
    <div style={A.stackedSection}>
      <div>
        <div style={A.sectionLabel}>Session Planning</div>
        <div style={A.sectionIntro}>
          Pick an age group to manage its session blocks, scorer assignments, and day-by-day tryout flow.
        </div>
      </div>

      <div style={A.statStrip}>
        {[
          {
            label: 'Age Groups',
            value: ageGroups.length,
          },
          {
            label: 'Total Sessions',
            value: ageGroups.reduce((sum, g) => sum + (groupStats(g.code).total_sessions || 0), 0),
          },
          {
            label: 'Completed',
            value: ageGroups.reduce((sum, g) => sum + (groupStats(g.code).complete_sessions || 0), 0),
          },
          {
            label: 'Scores',
            value: ageGroups.reduce((sum, g) => sum + (groupStats(g.code).total_scores || 0), 0),
          },
        ].map(({ label, value }) => (
          <div key={label} style={A.statTile}>
            <div style={A.statTileValue}>{value}</div>
            <div style={A.statTileLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div style={A.ageGroupGrid}>
        {ageGroups.map((g) => {
          const stats = groupStats(g.code);
          const pct = stats.total_sessions > 0 ? Math.round((stats.complete_sessions / stats.total_sessions) * 100) : 0;
          return (
            <div key={g.id} style={A.agCard} className="ag-card" onClick={() => openSessionGroup(g)}>
              <div style={A.agName}>{g.name}</div>
              <div style={A.agStats}>
                {[
                  { val: stats.total_sessions, label: 'Sessions' },
                  { val: stats.complete_sessions, label: 'Complete' },
                  { val: stats.total_scores, label: 'Scores' },
                ].map(({ val, label }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={A.agStatVal}>{val}</div>
                    <div style={A.agStatLabel}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={A.progressTrack}>
                <div style={{ ...A.progressFill, width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--maroon)' }} />
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={A.agLink}>Open session board →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const chip = (active) => ({
  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  border: `1px solid ${active ? 'var(--gold-dark)' : 'var(--border)'}`,
  background: active ? 'var(--gold-bg)' : '#fff',
  color: active ? 'var(--text)' : 'var(--text2)',
});

export default function SessionsView({
  showBlockWizard, setShowBlockWizard,
  blockWizard, setBlockWizard,
  updateSlot, addSlot, removeSlot, updateTeam, updateGame,
  createBlock, creatingBlock, blockMsg,
  sessDateFilter, setSessDateFilter, uniqueDates,
  ageGroups, ageGroupFilter, setAgeGroupFilter,
  wizardAgeGroupId, setWizardAgeGroupId,
  sessLoading, filteredSessions, sessionScorers, users,
  onSaveSession,
  updateStatus, removeSession,
  assigningTo, setAssigningTo, assignUserId, setAssignUserId,
  assignScorer, unassignScorer, onChangeAssignment,
  user,
  planningContext,
}) {
  // Group sessions by date for the planning view
  const sessionsByDate = {};
  filteredSessions.forEach((sess) => {
    const d = sess.session_date?.slice(0, 10) || 'unscheduled';
    if (!sessionsByDate[d]) sessionsByDate[d] = [];
    sessionsByDate[d].push(sess);
  });
  const groupedDates = Object.keys(sessionsByDate).sort();

  return (
    <div style={A.stackedSection}>
      <div>
        <div style={A.sectionLabel}>Session Planning</div>
        <div style={A.sectionIntro}>
          Build and manage session blocks, assign scorers, and review rosters before tryout day.
        </div>
      </div>

      {showBlockWizard && (
        <BlockWizardPanel
          blockWizard={blockWizard} setBlockWizard={setBlockWizard}
          updateSlot={updateSlot} addSlot={addSlot} removeSlot={removeSlot}
          updateTeam={updateTeam} updateGame={updateGame}
          createBlock={createBlock} creatingBlock={creatingBlock} blockMsg={blockMsg}
          onCancel={() => setShowBlockWizard(false)}
          ageGroups={ageGroups}
          wizardAgeGroupId={wizardAgeGroupId}
          setWizardAgeGroupId={setWizardAgeGroupId}
          planningContext={planningContext}
        />
      )}

      {/* ── Compact filter chips ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {uniqueDates.map((d) => (
          <button key={d} onClick={() => setSessDateFilter(sessDateFilter === d ? 'all' : d)} style={chip(sessDateFilter === d)}>
            {fmt.dateMed(d)}
          </button>
        ))}
        {uniqueDates.length > 0 && ageGroups?.length > 0 && (
          <span style={{ color: 'var(--border)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>|</span>
        )}
        {ageGroups?.map((g) => (
          <button key={g.id} onClick={() => setAgeGroupFilter(ageGroupFilter === String(g.id) ? 'all' : String(g.id))} style={chip(ageGroupFilter === String(g.id))}>
            {g.name}
          </button>
        ))}
      </div>

      {/* ── Session list grouped by date ── */}
      {sessLoading && <p style={A.muted}>Loading sessions…</p>}

      {!sessLoading && filteredSessions.length === 0 && (
        <div style={A.emptyCard}>
          No sessions match these filters yet. Use <strong>+ Session Block</strong> to add sessions.
        </div>
      )}

      {!sessLoading && groupedDates.map((d) => (
        <div key={d}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            paddingBottom: 8, marginBottom: 10,
            borderBottom: '2px solid var(--bg3)',
          }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--maroon)' }}>
              {fmt.dateMed(d)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
              {sessionsByDate[d].length} session{sessionsByDate[d].length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {sessionsByDate[d].map((sess) => (
              <SessionTile
                key={sess.id} sess={sess}
                scorers={sessionScorers[sess.id] || []} users={users}
                onSaveSession={onSaveSession}
                updateStatus={updateStatus} removeSession={removeSession}
                assigningTo={assigningTo} setAssigningTo={setAssigningTo}
                assignUserId={assignUserId} setAssignUserId={setAssignUserId}
                assignScorer={assignScorer} unassignScorer={unassignScorer}
                onChangeAssignment={onChangeAssignment}
                user={user}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
