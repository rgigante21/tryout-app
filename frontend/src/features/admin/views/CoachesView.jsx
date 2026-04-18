import { useState } from 'react';
import { A } from '../styles';

const ROLE_META = {
  admin:       { label: 'Admin',       bg: 'var(--red-bg)',   color: 'var(--red-txt)',   border: 'var(--red)'   },
  coordinator: { label: 'Coordinator', bg: 'var(--blue-bg)',  color: 'var(--blue-txt)',  border: 'var(--blue)'  },
  scorer:      { label: 'Coach',       bg: 'var(--bg3)',      color: 'var(--text2)',     border: 'var(--border)' },
};

function RoleBadge({ role }) {
  const m = ROLE_META[role] || ROLE_META.scorer;
  return (
    <span style={{ ...A.roleBadge, background: m.bg, color: m.color, border: `1px solid ${m.border}`, fontWeight: 700, fontSize: 11 }}>
      {m.label}
    </span>
  );
}

function UserRow({
  u,
  isEditing,
  editCoach, setEditCoach,
  editCoachSessions, allSessionsList,
  assigningSessionId, setAssigningSessionId,
  assignSessionToCoach, unassignCoachSession,
  saveCoach, savingCoach, editCoachMsg,
  openEditCoach,
}) {
  const [pwField, setPwField]       = useState('');
  const [pwConfirm, setPwConfirm]   = useState('');
  const [pwVisible, setPwVisible]   = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [pwMsg, setPwMsg]           = useState({ type: '', text: '' });

  const pwMismatch  = pwField && pwConfirm && pwField !== pwConfirm;
  const pwTooShort  = pwField && pwField.length < 6;
  const pwReady     = pwField && pwConfirm && pwField === pwConfirm && !pwTooShort;

  const handleResetPw = async () => {
    if (!pwReady) return;
    setResetting(true);
    setPwMsg({ type: '', text: '' });
    setEditCoach((c) => ({ ...c, password: pwField }));
    // Directly call saveCoach after state update won't work synchronously —
    // instead call saveCoach with the merged payload via the parent
    try {
      await saveCoach(pwField);
      setPwMsg({ type: 'success', text: 'Password updated successfully.' });
      setPwField('');
      setPwConfirm('');
    } catch {
      setPwMsg({ type: 'error', text: 'Failed to update password.' });
    } finally {
      setResetting(false);
    }
  };

  const assignedIds = new Set(editCoachSessions.map((s) => s.id));
  const available   = allSessionsList.filter((s) => !assignedIds.has(s.id));

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Collapsed row */}
      <div
        onClick={() => openEditCoach(u)}
        style={{
          display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12,
          cursor: 'pointer', background: isEditing ? '#F5F0FA' : undefined,
          borderLeft: isEditing ? '3px solid #6B1E2E' : '3px solid transparent',
          transition: 'background 0.1s',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: '#4A1320', color: '#F0B429',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700,
        }}>
          {u.first_name?.[0]}{u.last_name?.[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {u.first_name} {u.last_name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {u.email}
          </div>
        </div>
        <RoleBadge role={u.role} />
        <span style={{ fontSize: 16, color: 'var(--text3)', marginLeft: 4 }}>
          {isEditing ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded edit panel */}
      {isEditing && (
        <div style={{ background: '#FAFAF9', borderTop: '1px solid var(--border)', padding: '20px 20px 20px 24px' }}>

          {/* Section: Account Details */}
          <div style={panelSectionHdr}>Account Details</div>
          <div style={A.formRow}>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>First name</label>
              <input value={editCoach.firstName || ''} onChange={(e) => setEditCoach((c) => ({ ...c, firstName: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Last name</label>
              <input value={editCoach.lastName || ''} onChange={(e) => setEditCoach((c) => ({ ...c, lastName: e.target.value }))} />
            </div>
          </div>
          <div style={{ ...A.formRow, marginTop: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={A.fieldLabel}>Login email</label>
              <input
                type="email"
                value={editCoach.email || ''}
                onChange={(e) => setEditCoach((c) => ({ ...c, email: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                This is the email used to sign in
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Role</label>
              <select value={editCoach.role || 'scorer'} onChange={(e) => setEditCoach((c) => ({ ...c, role: e.target.value }))} style={A.selectInput}>
                <option value="scorer">Coach (Scorer)</option>
                <option value="coordinator">Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {editCoachMsg.type === 'success' && editCoachMsg.text === 'Saved successfully.' && (
            <div style={A.successBox}>{editCoachMsg.text}</div>
          )}
          {editCoachMsg.type === 'error' && (
            <div style={A.errorBox}>{editCoachMsg.text}</div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => saveCoach(null)}
              disabled={savingCoach}
              style={A.saveBtn}
            >
              {savingCoach ? 'Saving…' : 'Save Details'}
            </button>
          </div>

          <div style={panelDivider} />

          {/* Section: Reset Password */}
          <div style={panelSectionHdr}>Reset Password</div>
          <div style={{ ...A.formRow }}>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={pwVisible ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={pwField}
                  onChange={(e) => setPwField(e.target.value)}
                  style={pwTooShort ? { borderColor: 'var(--red)' } : {}}
                />
                <button
                  onClick={() => setPwVisible((v) => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 13, color: 'var(--text3)', cursor: 'pointer', padding: 0 }}
                  tabIndex={-1}
                >
                  {pwVisible ? 'Hide' : 'Show'}
                </button>
              </div>
              {pwTooShort && <div style={{ fontSize: 11, color: 'var(--red-txt)', marginTop: 3 }}>Minimum 6 characters</div>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Confirm password</label>
              <input
                type={pwVisible ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                style={pwMismatch ? { borderColor: 'var(--red)' } : {}}
              />
              {pwMismatch && <div style={{ fontSize: 11, color: 'var(--red-txt)', marginTop: 3 }}>Passwords don't match</div>}
            </div>
          </div>
          {pwMsg.text && (
            <div style={pwMsg.type === 'success' ? A.successBox : A.errorBox}>{pwMsg.text}</div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={handleResetPw}
              disabled={!pwReady || resetting}
              style={{ ...A.saveBtn, opacity: (!pwReady || resetting) ? 0.55 : 1, cursor: (!pwReady || resetting) ? 'default' : 'pointer' }}
            >
              {resetting ? 'Updating…' : 'Reset Password'}
            </button>
          </div>

          <div style={panelDivider} />

          {/* Section: Assigned Sessions */}
          <div style={panelSectionHdr}>Assigned Sessions</div>
          {available.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select value={assigningSessionId} onChange={(e) => setAssigningSessionId(e.target.value)} style={{ flex: 1, ...A.selectInput }}>
                <option value="">Add to session…</option>
                {available.map((s) => (
                  <option key={s.id} value={s.id}>{s.age_group} — {s.name} ({String(s.session_date).slice(0, 10)})</option>
                ))}
              </select>
              <button onClick={assignSessionToCoach} disabled={!assigningSessionId} style={A.primaryBtn}>Assign</button>
            </div>
          )}
          {editCoachSessions.length === 0 ? (
            <p style={A.muted}>No sessions assigned.</p>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {editCoachSessions.map((sess, i) => (
                <div key={sess.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px',
                  borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                  background: '#FFFFFF',
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{sess.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
                      {sess.age_group_name} · {String(sess.session_date).slice(0, 10)}
                    </span>
                  </div>
                  <button onClick={() => unassignCoachSession(sess.id)} style={{ ...A.iconBtn, color: 'var(--red-txt)', fontSize: 18 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoachesView({
  users,
  newCoach, setNewCoach,
  addCoach, addingCoach,
  coachError, coachSuccess,
  editingCoachId, editCoach, setEditCoach,
  openEditCoach,
  editCoachSessions, allSessionsList,
  assigningSessionId, setAssigningSessionId,
  assignSessionToCoach, unassignCoachSession,
  saveCoach, savingCoach, editCoachMsg,
}) {
  const [pwVisible, setPwVisible] = useState(false);
  const [pwConfirm, setPwConfirm] = useState('');

  const minPwLen   = (newCoach.role === 'admin' || newCoach.role === 'coordinator') ? 12 : 8;
  const pwMismatch = newCoach.password && pwConfirm && newCoach.password !== pwConfirm;
  const pwTooShort = newCoach.password && newCoach.password.length < minPwLen;
  const canCreate  = newCoach.firstName && newCoach.lastName && newCoach.email &&
                     newCoach.password && newCoach.password.length >= minPwLen &&
                     newCoach.password === pwConfirm && !addingCoach;

  const handleCreate = () => {
    if (!canCreate) return;
    addCoach();
    setPwConfirm('');
  };

  // Group users by role
  const admins       = users.filter((u) => u.role === 'admin');
  const coordinators = users.filter((u) => u.role === 'coordinator');
  const scorers      = users.filter((u) => u.role === 'scorer');

  const RoleSection = ({ title, list, role }) => {
    if (!list.length) return null;
    const m = ROLE_META[role] || ROLE_META.scorer;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ ...A.sectionLabel }}>{title}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
            {list.length}
          </span>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          {list.map((u) => (
            <UserRow
              key={u.id}
              u={u}
              isEditing={editingCoachId === u.id}
              editCoach={editCoach}
              setEditCoach={setEditCoach}
              editCoachSessions={editCoachSessions}
              allSessionsList={allSessionsList}
              assigningSessionId={assigningSessionId}
              setAssigningSessionId={setAssigningSessionId}
              assignSessionToCoach={assignSessionToCoach}
              unassignCoachSession={unassignCoachSession}
              saveCoach={saveCoach}
              savingCoach={savingCoach}
              editCoachMsg={editCoachMsg}
              openEditCoach={openEditCoach}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Create account card */}
      <div style={{ ...A.sectionHdr, marginBottom: 8 }}>
        <span style={A.sectionLabel}>Create Account</span>
      </div>
      <div style={{ ...A.card, marginBottom: 28 }}>
        <div style={A.formRow}>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>First name</label>
            <input
              placeholder="First"
              value={newCoach.firstName}
              onChange={(e) => setNewCoach((n) => ({ ...n, firstName: e.target.value }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>Last name</label>
            <input
              placeholder="Last"
              value={newCoach.lastName}
              onChange={(e) => setNewCoach((n) => ({ ...n, lastName: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ ...A.formRow, marginTop: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={A.fieldLabel}>Login email</label>
            <input
              type="email"
              placeholder="coach@example.com"
              value={newCoach.email}
              onChange={(e) => setNewCoach((n) => ({ ...n, email: e.target.value }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>Role</label>
            <select value={newCoach.role} onChange={(e) => setNewCoach((n) => ({ ...n, role: e.target.value }))} style={A.selectInput}>
              <option value="scorer">Coach (Scorer)</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div style={{ ...A.formRow, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={pwVisible ? 'text' : 'password'}
                placeholder={`Min ${minPwLen} characters`}
                value={newCoach.password}
                onChange={(e) => setNewCoach((n) => ({ ...n, password: e.target.value }))}
                style={pwTooShort ? { borderColor: 'var(--red)' } : {}}
              />
              <button
                onClick={() => setPwVisible((v) => !v)}
                tabIndex={-1}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', padding: 0 }}
              >
                {pwVisible ? 'Hide' : 'Show'}
              </button>
            </div>
            {pwTooShort && <div style={{ fontSize: 11, color: 'var(--red-txt)', marginTop: 3 }}>Minimum {minPwLen} characters</div>}
          </div>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>Confirm password</label>
            <input
              type={pwVisible ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              style={pwMismatch ? { borderColor: 'var(--red)' } : {}}
            />
            {pwMismatch && <div style={{ fontSize: 11, color: 'var(--red-txt)', marginTop: 3 }}>Passwords don't match</div>}
          </div>
        </div>
        {coachError   && <div style={A.errorBox}>{coachError}</div>}
        {coachSuccess && <div style={A.successBox}>{coachSuccess}</div>}
        <div style={{ marginTop: 14 }}>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            style={{ ...A.saveBtn, opacity: canCreate ? 1 : 0.55, cursor: canCreate ? 'pointer' : 'default' }}
          >
            {addingCoach ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </div>

      {/* Users grouped by role */}
      <RoleSection title="Admins"       list={admins}       role="admin"       />
      <RoleSection title="Coordinators" list={coordinators} role="coordinator" />
      <RoleSection title="Coaches"      list={scorers}      role="scorer"      />

      {users.length === 0 && (
        <div style={A.emptyCard}>No accounts yet.</div>
      )}
    </div>
  );
}

const panelSectionHdr = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#6B1E2E',
  marginBottom: 10,
};

const panelDivider = {
  borderTop: '1px solid var(--border)',
  margin: '20px 0',
};
