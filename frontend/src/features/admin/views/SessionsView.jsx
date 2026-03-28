import { useState } from 'react';
import { A } from '../styles';
import { BlockWizardPanel, STATUS_META, fmt } from '../shared';

const TYPE_STYLE = {
  game:   { bg: 'var(--amber-bg)', color: 'var(--amber-txt)', border: 'var(--amber)', label: '🥅 Game' },
  skills: { bg: 'var(--blue-bg)',  color: 'var(--blue-txt)',  border: 'var(--blue)',  label: '🏒 Skills' },
};

function SessionTile({
  sess, scorers, users,
  editingSessionId, editSession, setEditSession,
  startEditSession, saveSessionEdit, cancelEdit,
  updateStatus, removeSession,
  assigningTo, setAssigningTo, assignUserId, setAssignUserId,
  assignScorer, unassignScorer, onChangeAssignment,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAssignmentEdit, setShowAssignmentEdit] = useState(false);
  const [changingAssignment, setChangingAssignment] = useState(false);
  const sm = STATUS_META[sess.status] || STATUS_META.pending;
  const typeStyle = TYPE_STYLE[sess.session_type] || TYPE_STYLE.skills;
  const isEditing = editingSessionId === sess.id;
  const isAssigning = assigningTo === sess.id;
  const assignable = users.filter((u) => !scorers.find((sc) => sc.id === u.id));

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

      {/* Scorers summary */}
      {scorers.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
          Scorers: {scorers.map((u) => `${u.first_name} ${u.last_name}`).join(', ')}
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ marginTop: 10, background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text3)', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {expanded ? 'Less ▲' : 'Manage ▼'}
      </button>

      {/* Expanded controls */}
      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {isEditing ? (
            <div>
              <div style={A.formRow}>
                <div style={{ flex: 2 }}>
                  <label style={A.fieldLabel}>Name</label>
                  <input value={editSession.name} onChange={(e) => setEditSession((n) => ({ ...n, name: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={A.fieldLabel}>Date</label>
                  <input type="date" value={editSession.date} onChange={(e) => setEditSession((n) => ({ ...n, date: e.target.value }))} />
                </div>
                <div style={{ width: 110 }}>
                  <label style={A.fieldLabel}>Time</label>
                  <input type="time" value={editSession.time} onChange={(e) => setEditSession((n) => ({ ...n, time: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={saveSessionEdit} style={A.saveBtn}>Save</button>
                <button onClick={cancelEdit} style={A.ghostBtn}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={sess.status}
                onChange={(e) => updateStatus(sess.id, e.target.value)}
                style={{ ...A.statusSelect, background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}` }}
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="complete">Complete</option>
              </select>
              <button onClick={() => startEditSession(sess)} style={A.ghostBtn}>Edit</button>
              <button onClick={() => removeSession(sess.id)} style={{ ...A.ghostBtn, color: 'var(--red-txt)', borderColor: 'var(--red-txt)' }}>Delete</button>
            </div>
          )}

          {/* Scorer assignment */}
          <div style={{ marginTop: 10 }}>
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

          {/* Player assignment edit */}
          {sess.block_id && onChangeAssignment && (
            <div style={{ marginTop: 10 }}>
              {!showAssignmentEdit ? (
                <button onClick={() => setShowAssignmentEdit(true)} style={{ ...A.addScorerBtn, borderColor: 'var(--blue)', color: 'var(--blue-txt)' }}>
                  Edit Player Assignment
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Reassign:</span>
                  {sess.session_type === 'skills' ? (
                    ['last_name', 'jersey_range', 'none', 'manual'].map((method) => (
                      <button key={method} disabled={changingAssignment}
                        style={{ ...A.splitBtn, fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer' }}
                        onClick={async () => {
                          setChangingAssignment(true);
                          try { await onChangeAssignment(sess.block_id, { splitMethod: method }); }
                          finally { setChangingAssignment(false); setShowAssignmentEdit(false); }
                        }}>
                        {method === 'last_name' ? 'By Last Name' : method === 'jersey_range' ? 'By Jersey #' : method === 'none' ? 'All Together' : 'Manual'}
                      </button>
                    ))
                  ) : (
                    ['random', 'manual'].map((method) => (
                      <button key={method} disabled={changingAssignment}
                        style={{ ...A.splitBtn, fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer' }}
                        onClick={async () => {
                          setChangingAssignment(true);
                          try { await onChangeAssignment(sess.block_id, { playerAssignment: method }); }
                          finally { setChangingAssignment(false); setShowAssignmentEdit(false); }
                        }}>
                        {method === 'random' ? 'Random' : 'Manual'}
                      </button>
                    ))
                  )}
                  <button onClick={() => setShowAssignmentEdit(false)} style={{ ...A.ghostBtn, fontSize: 11, padding: '4px 10px' }}>Cancel</button>
                  {changingAssignment && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Updating…</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SessionsView({
  showBlockWizard, setShowBlockWizard,
  blockWizard, setBlockWizard,
  updateSlot, addSlot, removeSlot, updateTeam, updateGame,
  createBlock, creatingBlock, blockMsg,
  sessDateFilter, setSessDateFilter, uniqueDates,
  sessGroupFilter, setSessGroupFilter, uniqueGroups,
  sessLoading, filteredSessions, sessionScorers, users,
  editingSessionId, editSession, setEditSession,
  startEditSession, saveSessionEdit, cancelEdit,
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
        <button onClick={() => setSessGroupFilter('all')} style={{ ...A.dateChip, ...(sessGroupFilter === 'all' ? A.dateChipActive : {}) }}>
          All Groups
        </button>
        {uniqueGroups.map((g) => (
          <button key={g} onClick={() => setSessGroupFilter(g)} style={{ ...A.dateChip, ...(sessGroupFilter === g ? A.dateChipActive : {}) }}>
            {g}
          </button>
        ))}
      </div>

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
        <div style={A.emptyCard}>No sessions found. Use <strong>+ Session Block</strong> to create sessions.</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {!sessLoading && filteredSessions.map((sess) => (
          <SessionTile
            key={sess.id} sess={sess}
            scorers={sessionScorers[sess.id] || []} users={users}
            editingSessionId={editingSessionId} editSession={editSession} setEditSession={setEditSession}
            startEditSession={startEditSession} saveSessionEdit={saveSessionEdit} cancelEdit={cancelEdit}
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
