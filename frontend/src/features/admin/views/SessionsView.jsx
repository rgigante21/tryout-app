import { useState } from 'react';
import { A } from '../styles';
import { BlockWizardPanel, STATUS_META, fmt } from '../shared';

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

  const sm = STATUS_META[sess.status] || STATUS_META.pending;
  const typeStyle = TYPE_STYLE[sess.session_type] || TYPE_STYLE.skills;
  const isAssigning = assigningTo === sess.id;
  const assignable = users.filter((u) => !scorers.find((sc) => sc.id === u.id));

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
    try { await onChangeAssignment(sess.block_id, payload); }
    catch (err) { alert(err.message); }
    finally { setChangingAssignment(false); }
  };

  return (
    <div style={{ background: '#fff', border: `1px solid ${expanded ? 'var(--gold-dark)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'border-color 0.15s' }} className="ag-card">

      {/* Tile header — always visible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: typeStyle.bg, color: typeStyle.color, border: `1px solid ${typeStyle.border}` }}>
              {typeStyle.label}
            </span>
            {sess.age_group && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F5E8EB', color: '#6B1E2E', border: '1px solid #D4A0AC' }}>
                {sess.age_group}
              </span>
            )}
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, marginBottom: 4 }}>{sess.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {fmt.date(sess.session_date)}{sess.start_time ? ` · ${fmt.time(sess.start_time)}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}` }}>
            {sm.label}
          </span>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--maroon)' }}>
            {sess.player_count} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>players</span>
          </div>
        </div>
      </div>

      {/* Scorers summary (collapsed only) */}
      {!expanded && scorers.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
          Scorers: {scorers.map((u) => `${u.first_name} ${u.last_name}`).join(', ')}
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => { setExpanded((v) => !v); if (expanded) setDraft(null); }}
        style={{ marginTop: 10, background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text3)', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {expanded ? 'Less ▲' : 'Manage ▼'}
      </button>

      {/* Expanded controls */}
      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>

          {/* Status + quick actions row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <select
              value={sess.status}
              onChange={(e) => updateStatus(sess.id, e.target.value)}
              style={{ ...A.statusSelect, background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}` }}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="complete">Complete</option>
            </select>
            {!draft && (
              <button onClick={openEdit} style={A.ghostBtn}>Edit Details</button>
            )}
            <button
              onClick={() => removeSession(sess.id)}
              style={{ ...A.ghostBtn, color: 'var(--red-txt)', borderColor: 'var(--red-txt)' }}
            >
              Delete
            </button>
          </div>

          {/* Edit details form */}
          {draft && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={A.formRow}>
                <div style={{ flex: 2 }}>
                  <label style={A.fieldLabel}>Name</label>
                  <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={A.fieldLabel}>Date</label>
                  <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
                </div>
                <div style={{ width: 110 }}>
                  <label style={A.fieldLabel}>Time</label>
                  <input type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={saveEdit} disabled={saving || !draft.name || !draft.date} style={A.saveBtn}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={cancelEdit} style={A.ghostBtn}>Cancel</button>
              </div>
            </div>
          )}

          {/* Player assignment — always shown for block sessions */}
          {sess.block_id && onChangeAssignment && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                Player Assignment
                {changingAssignment && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>Updating…</span>}
              </div>
              {sess.session_type === 'skills' ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SPLIT_METHODS.map(({ method, label }) => (
                    <button
                      key={method}
                      disabled={changingAssignment}
                      style={{ ...A.splitBtn, fontSize: 11, padding: '4px 12px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', cursor: 'pointer' }}
                      onClick={() => doAssignment({ splitMethod: method })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {GAME_ASSIGNMENTS.map(({ method, label }) => (
                    <button
                      key={method}
                      disabled={changingAssignment}
                      style={{ ...A.splitBtn, fontSize: 11, padding: '4px 12px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', cursor: 'pointer' }}
                      onClick={() => doAssignment({ playerAssignment: method })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scorer assignment */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Scorers</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {scorers.map((u) => (
                <span key={u.id} style={A.scorerChip}>
                  {u.first_name} {u.last_name}
                  <button onClick={() => unassignScorer(sess.id, u.id)} style={A.chipX}>×</button>
                </span>
              ))}
              {isAssigning ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', marginTop: 4 }}>
                  <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} style={{ flex: 1, ...A.selectInput }}>
                    <option value="">Select scorer…</option>
                    {assignable.map((u) => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>
                    ))}
                  </select>
                  <button onClick={() => assignScorer(sess.id)} style={A.primaryBtn}>Assign</button>
                  <button onClick={() => { setAssigningTo(null); setAssignUserId(''); }} style={A.ghostBtn}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => { setAssigningTo(sess.id); setAssignUserId(''); }} style={A.addScorerBtn}>+ Add scorer</button>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export function SessionsIndexView({ ageGroups, groupStats, openSessionGroup }) {
  return (
    <>
      <div style={A.sectionHdr}>
        <span style={A.sectionLabel}>Select an Age Group</span>
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
                <span style={A.agLink}>View Sessions →</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function SessionsView({
  showBlockWizard, setShowBlockWizard,
  blockWizard, setBlockWizard,
  updateSlot, addSlot, removeSlot, updateTeam, updateGame,
  createBlock, creatingBlock, blockMsg,
  sessDateFilter, setSessDateFilter, uniqueDates,
  sessLoading, filteredSessions, sessionScorers, users,
  onSaveSession,
  updateStatus, removeSession,
  assigningTo, setAssigningTo, assignUserId, setAssignUserId,
  assignScorer, unassignScorer, onChangeAssignment,
}) {
  return (
    <>
      {showBlockWizard && (
        <BlockWizardPanel
          blockWizard={blockWizard} setBlockWizard={setBlockWizard}
          updateSlot={updateSlot} addSlot={addSlot} removeSlot={removeSlot}
          updateTeam={updateTeam} updateGame={updateGame}
          createBlock={createBlock} creatingBlock={creatingBlock} blockMsg={blockMsg}
          onCancel={() => setShowBlockWizard(false)}
        />
      )}

      <div style={A.dateFilterRow}>
        <button onClick={() => setSessDateFilter('all')} style={{ ...A.dateChip, ...(sessDateFilter === 'all' ? A.dateChipActive : {}) }}>
          All Dates
        </button>
        {uniqueDates.map((d) => (
          <button key={d} onClick={() => setSessDateFilter(d)} style={{ ...A.dateChip, ...(sessDateFilter === d ? A.dateChipActive : {}) }}>
            {fmt.dateMed(d)}
          </button>
        ))}
      </div>

      {sessLoading && <p style={A.muted}>Loading sessions…</p>}
      {!sessLoading && filteredSessions.length === 0 && (
        <div style={A.emptyCard}>No sessions yet. Use <strong>+ Session Block</strong> to create sessions.</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
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
    </>
  );
}
