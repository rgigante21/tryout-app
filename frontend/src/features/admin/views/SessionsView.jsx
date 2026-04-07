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

function SessionTile({
  sess, scorers, users,
  onSaveSession,
  updateStatus, removeSession,
  assigningTo, setAssigningTo, assignUserId, setAssignUserId,
  assignScorer, unassignScorer, onChangeAssignment,
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [changingAssignment, setChangingAssignment] = useState(false);
  const [sessionPlayers, setSessionPlayers] = useState(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  const sm = STATUS_META[sess.status] || STATUS_META.pending;
  const typeStyle = TYPE_STYLE[sess.session_type] || TYPE_STYLE.skills;
  const isAssigning = assigningTo === sess.id;
  const assignable = users.filter((u) => !scorers.find((sc) => sc.id === u.id));

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (!next) { setDraft(null); return; }
    setLoadingPlayers(true);
    try {
      const r = await api.sessionPlayers(sess.id);
      setSessionPlayers(r.players || []);
    } catch {
      setSessionPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const openEdit = () => setDraft({
    name: sess.name,
    date: sess.session_date ? sess.session_date.slice(0, 10) : '',
    time: sess.start_time ? sess.start_time.slice(0, 5) : '',
  });
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
            onChange={(e) => updateStatus(sess.id, e.target.value)}
            style={{ ...A.statusSelect, background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}` }}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="complete">Complete</option>
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
                {!draft && <button onClick={openEdit} style={A.ghostBtn}>Edit</button>}
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
                      </div>
                    ))}
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
                        disabled={changingAssignment}
                        onClick={() => doAssignment(sess.session_type === 'skills' ? { splitMethod: method } : { playerAssignment: method })}
                        style={{ ...A.ghostBtn, fontSize: 12, padding: '6px 10px', textAlign: 'left', opacity: changingAssignment ? 0.5 : 1 }}
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
                      <button onClick={() => unassignScorer(sess.id, u.id)} style={A.chipX}>×</button>
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
                    <button onClick={() => { setAssigningTo(sess.id); setAssignUserId(''); }} style={A.addScorerBtn}>+ Add scorer</button>
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
}) {
  const allSessionCount = filteredSessions.length;

  return (
    <div style={A.stackedSection}>
      <div>
        <div style={A.sectionLabel}>Session Board</div>
        <div style={A.sectionIntro}>
          Filter by age group or date, then open a session to update status, assign scorers, and review players without leaving the page.
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
        />
      )}

      <div style={A.splitLayout}>
        <aside style={A.sidePanel}>
          <div style={A.sidePanelTitle}>Filters</div>
          <div style={A.sidePanelText}>
            Keep the board focused on one group or one tryout day at a time.
          </div>

          {ageGroups?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ ...A.fieldLabel, marginBottom: 8 }}>Age group</div>
              <div style={A.quickNavList}>
                <button onClick={() => setAgeGroupFilter('all')} style={{ ...A.quickNavBtn, ...(ageGroupFilter === 'all' ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-bg)' } : {}) }}>
                  <span>All age groups</span>
                  <span style={A.quickNavMeta}>{ageGroups.length}</span>
                </button>
                {ageGroups.map((g) => (
                  <button key={g.id} onClick={() => setAgeGroupFilter(String(g.id))} style={{ ...A.quickNavBtn, ...(ageGroupFilter === String(g.id) ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-bg)' } : {}) }}>
                    <span>{g.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <div style={{ ...A.fieldLabel, marginBottom: 8 }}>Session date</div>
            <div style={A.quickNavList}>
              <button onClick={() => setSessDateFilter('all')} style={{ ...A.quickNavBtn, ...(sessDateFilter === 'all' ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-bg)' } : {}) }}>
                <span>All dates</span>
                <span style={A.quickNavMeta}>{uniqueDates.length}</span>
              </button>
              {uniqueDates.map((d) => (
                <button key={d} onClick={() => setSessDateFilter(d)} style={{ ...A.quickNavBtn, ...(sessDateFilter === d ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-bg)' } : {}) }}>
                  <span>{fmt.dateMed(d)}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div style={A.contentStack}>
          <div style={A.statStrip}>
            {[
              { label: 'Showing', value: allSessionCount },
              { label: 'Age Groups', value: ageGroups?.length || 0 },
              { label: 'Dates', value: uniqueDates.length },
            ].map(({ label, value }) => (
              <div key={label} style={A.statTile}>
                <div style={A.statTileValue}>{value}</div>
                <div style={A.statTileLabel}>{label}</div>
              </div>
            ))}
          </div>

          {sessLoading && <p style={A.muted}>Loading sessions…</p>}
          {!sessLoading && filteredSessions.length === 0 && (
            <div style={A.emptyCard}>No sessions match these filters yet. Use <strong>+ Session Block</strong> to create sessions.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!sessLoading && filteredSessions.map((sess) => (
              <SessionTile
                key={sess.id} sess={sess}
                scorers={sessionScorers[sess.id] || []} users={users}
                onSaveSession={onSaveSession}
                updateStatus={updateStatus} removeSession={removeSession}
                assigningTo={assigningTo} setAssigningTo={setAssigningTo}
                assignUserId={assignUserId} setAssignUserId={setAssignUserId}
                assignScorer={assignScorer} unassignScorer={unassignScorer}
                onChangeAssignment={onChangeAssignment}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
