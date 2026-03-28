import { A } from '../styles';

export default function CoachesView({
  users,
  newCoach,
  setNewCoach,
  addCoach,
  addingCoach,
  coachError,
  coachSuccess,
  editingCoachId,
  editCoach,
  setEditCoach,
  openEditCoach,
  editCoachSessions,
  allSessionsList,
  assigningSessionId,
  setAssigningSessionId,
  assignSessionToCoach,
  unassignCoachSession,
  saveCoach,
  savingCoach,
  editCoachMsg,
}) {
  const roleStyle = (role) =>
    role === 'admin' ? { background: 'var(--red-bg)', color: 'var(--red-txt)', border: '1px solid var(--red)' } :
    role === 'coordinator' ? { background: 'var(--blue-bg)', color: 'var(--blue-txt)', border: '1px solid var(--blue)' } :
    { background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' };

  return (
    <div>
      <div style={A.sectionLabel}>Create Account</div>
      <div style={A.card}>
        <div style={A.formRow}>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>First name</label>
            <input placeholder="First" value={newCoach.firstName} onChange={(e) => setNewCoach((n) => ({ ...n, firstName: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>Last name</label>
            <input placeholder="Last" value={newCoach.lastName} onChange={(e) => setNewCoach((n) => ({ ...n, lastName: e.target.value }))} />
          </div>
        </div>
        <div style={{ ...A.formRow, marginTop: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={A.fieldLabel}>Email</label>
            <input type="email" placeholder="coach@example.com" value={newCoach.email} onChange={(e) => setNewCoach((n) => ({ ...n, email: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>Role</label>
            <select value={newCoach.role} onChange={(e) => setNewCoach((n) => ({ ...n, role: e.target.value }))} style={A.selectInput}>
              <option value="scorer">Scorer (coach)</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div style={{ ...A.formRow, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>Temporary password</label>
            <input type="text" placeholder="They can change it later" value={newCoach.password} onChange={(e) => setNewCoach((n) => ({ ...n, password: e.target.value }))} />
          </div>
        </div>
        {coachError && <div style={A.errorBox}>{coachError}</div>}
        {coachSuccess && <div style={A.successBox}>{coachSuccess}</div>}
        <div style={{ marginTop: 12 }}>
          <button onClick={addCoach} disabled={addingCoach || !newCoach.firstName || !newCoach.lastName || !newCoach.email || !newCoach.password} style={A.saveBtn}>
            {addingCoach ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </div>

      <div style={{ ...A.sectionLabel, marginTop: 20 }}>All Accounts — click to edit</div>
      <div style={A.playerTable}>
        <div style={A.playerTableHdr}>
          <span style={{ flex: 1 }}>Name</span>
          <span style={{ flex: 1 }}>Email</span>
          <span style={{ width: 110 }}>Role</span>
        </div>
        {users.map((u) => {
          const isEditing = editingCoachId === u.id;
          return (
            <div key={u.id}>
              <div style={{ ...A.playerRow, cursor: 'pointer', background: isEditing ? 'var(--blue-bg)' : undefined }} onClick={() => openEditCoach(u)}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{u.first_name} {u.last_name}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text3)' }}>{u.email}</span>
                <span style={{ width: 110 }}>
                  <span style={{ ...A.roleBadge, ...roleStyle(u.role) }}>{u.role}</span>
                </span>
              </div>
              {isEditing && (
                <div style={{ padding: '16px', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
                  <div style={A.formRow}>
                    <div style={{ flex: 1 }}>
                      <label style={A.fieldLabel}>First name</label>
                      <input value={editCoach.firstName || ''} onChange={(e) => setEditCoach((c) => ({ ...c, firstName: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={A.fieldLabel}>Last name</label>
                      <input value={editCoach.lastName || ''} onChange={(e) => setEditCoach((c) => ({ ...c, lastName: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={A.fieldLabel}>Role</label>
                      <select value={editCoach.role || 'scorer'} onChange={(e) => setEditCoach((c) => ({ ...c, role: e.target.value }))} style={A.selectInput}>
                        <option value="scorer">Scorer</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ ...A.formRow, marginTop: 10 }}>
                    <div style={{ flex: 2 }}>
                      <label style={A.fieldLabel}>Email</label>
                      <input type="email" value={editCoach.email || ''} onChange={(e) => setEditCoach((c) => ({ ...c, email: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={A.fieldLabel}>New password</label>
                      <input type="text" placeholder="Leave blank to keep" value={editCoach.password || ''} onChange={(e) => setEditCoach((c) => ({ ...c, password: e.target.value }))} />
                    </div>
                  </div>
                  {editCoachMsg.text && (
                    <div style={editCoachMsg.type === 'success' ? A.successBox : A.errorBox}>{editCoachMsg.text}</div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <button onClick={saveCoach} disabled={savingCoach} style={A.saveBtn}>
                      {savingCoach ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ ...A.sectionLabel, marginBottom: 8 }}>Assigned Sessions</div>
                    {(() => {
                      const assignedIds = new Set(editCoachSessions.map((s) => s.id));
                      const available = allSessionsList.filter((s) => !assignedIds.has(s.id));
                      return available.length > 0 ? (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          <select value={assigningSessionId} onChange={(e) => setAssigningSessionId(e.target.value)} style={{ flex: 1, ...A.selectInput }}>
                            <option value="">Add to session…</option>
                            {available.map((s) => (
                              <option key={s.id} value={s.id}>{s.age_group} — {s.name} ({s.session_date})</option>
                            ))}
                          </select>
                          <button onClick={assignSessionToCoach} disabled={!assigningSessionId} style={A.primaryBtn}>Assign</button>
                        </div>
                      ) : null;
                    })()}
                    {editCoachSessions.length === 0 ? (
                      <p style={A.muted}>No sessions assigned.</p>
                    ) : editCoachSessions.map((sess) => (
                      <div key={sess.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{sess.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{sess.age_group_name} · {sess.session_date}</span>
                        </div>
                        <button onClick={() => unassignCoachSession(sess.id)} style={{ ...A.iconBtn, color: 'var(--red-txt)' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
