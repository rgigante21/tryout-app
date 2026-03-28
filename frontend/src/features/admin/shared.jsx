import { useEffect, useRef, useState } from 'react';
import { A, SB } from './styles';

export const fmt = {
  date: (d) => {
    if (!d) return '';
    const [y, m, day] = String(d).slice(0, 10).split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
  },
  time: (t) => {
    if (!t) return '';
    const [h, m] = String(t).slice(0, 5).split(':');
    const hr = parseInt(h, 10);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  },
  dateMed: (d) => {
    if (!d) return '';
    return new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  },
};

export const STATUS_META = {
  pending: { dot: '#aaa', label: 'Pending', textColor: 'var(--text3)', bg: 'var(--bg3)', border: 'var(--border)' },
  active: { dot: 'var(--gold)', label: 'Active', textColor: 'var(--amber-txt)', bg: 'var(--amber-bg)', border: 'var(--amber)' },
  complete: { dot: 'var(--green)', label: 'Complete', textColor: 'var(--green-txt)', bg: 'var(--green-bg)', border: 'var(--green)' },
};

export const NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: '◆', section: 'overview', path: '/admin/overview' },
  { id: 'events', label: 'Events', icon: '◷', section: 'tryouts', path: '/admin/events' },
  { id: 'sessions', label: 'Sessions', icon: '≡', section: 'tryouts', path: '/admin/sessions' },
  { id: 'groups', label: 'Age Groups', icon: '▤', section: 'tryouts', path: '/admin/groups' },
  { id: 'results', label: 'Results', icon: '★', section: 'tryouts', path: '/admin/results' },
  { id: 'coaches', label: 'Coaches', icon: '◯', section: 'people', path: '/admin/coaches' },
];

export function defaultBlock() {
  return {
    label: '',
    date: '',
    blockType: 'skills',
    splitMethod: 'last_name',
    scoringMode: 'full',
    playerAssignment: 'random',
    slots: [{ time: '', lastNameStart: 'A', lastNameEnd: 'Z', jerseyMin: '', jerseyMax: '' }],
    teams: [
      { teamNumber: 1, jerseyColor: 'white', label: 'Team 1' },
      { teamNumber: 2, jerseyColor: 'maroon', label: 'Team 2' },
      { teamNumber: 3, jerseyColor: 'white', label: 'Team 3' },
      { teamNumber: 4, jerseyColor: 'maroon', label: 'Team 4' },
    ],
    games: [
      { time: '', homeTeam: 1, awayTeam: 2 },
      { time: '', homeTeam: 3, awayTeam: 4 },
    ],
  };
}

export function CountUp({ end, duration = 800, prefix = '', suffix = '' }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current && end === 0) return;
    startedRef.current = true;
    if (end === 0) {
      setValue(0);
      return;
    }
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(end * eased));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [end, duration]);

  return <>{prefix}{value.toLocaleString()}{suffix}</>;
}

export function Sidebar({ currentNav, user, logout, onNavigate }) {
  return (
    <div style={SB.sidebar}>
      <div style={SB.logoBlock}>
        <img src="/wyh-logo.jpeg" alt="WYH" style={SB.logoImg} />
        <div>
          <div style={SB.logoName}>WYH Admin</div>
          <div style={SB.logoSub}>Weymouth Youth Hockey</div>
        </div>
      </div>

      {['overview', 'tryouts', 'people'].map((section) => {
        const items = NAV_ITEMS.filter((n) => n.section === section);
        return (
          <div key={section}>
            {section !== 'overview' && (
              <div style={SB.sectionLabel}>{section === 'tryouts' ? 'Tryouts' : 'People'}</div>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.path)}
                style={{
                  ...SB.navBtn,
                  ...(currentNav === item.id ? SB.navBtnActive : {}),
                }}
              >
                <span style={SB.navIcon}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        );
      })}

      <div style={{ flex: 1 }} />

      <div style={SB.userBlock}>
        <div style={SB.avatar}>
          {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={SB.userName}>{user?.firstName} {user?.lastName}</div>
          <div style={SB.userRole}>{user?.role}</div>
        </div>
        <button onClick={logout} style={SB.signOutBtn} title="Sign out">↩</button>
      </div>
    </div>
  );
}

export function SessionCard({
  sess,
  scorers,
  users,
  editingSessionId,
  editSession,
  setEditSession,
  startEditSession,
  saveSessionEdit,
  cancelEdit,
  updateStatus,
  removeSession,
  assigningTo,
  setAssigningTo,
  assignUserId,
  setAssignUserId,
  assignScorer,
  unassignScorer,
  onChangeAssignment,
}) {
  const [showAssignmentEdit, setShowAssignmentEdit] = useState(false);
  const [changingAssignment, setChangingAssignment] = useState(false);
  const sm = STATUS_META[sess.status] || STATUS_META.pending;
  const isEditing = editingSessionId === sess.id;
  const isAssigning = assigningTo === sess.id;
  const assignable = users.filter((u) => !scorers.find((sc) => sc.id === u.id));

  return (
    <div style={A.sessCard} className="sess-card">
      <div style={A.sessTagRow}>
        <span
          style={{
            ...A.typeTag,
            background: sess.session_type === 'game' ? 'var(--amber-bg)' : 'var(--blue-bg)',
            color: sess.session_type === 'game' ? 'var(--amber-txt)' : 'var(--blue-txt)',
            border: `1px solid ${sess.session_type === 'game' ? 'var(--amber)' : 'var(--blue)'}`,
          }}
        >
          {sess.session_type === 'game' ? '🥅 Game' : '🏒 Skills'}
        </span>
        {sess.last_name_start && sess.last_name_end && (
          <span style={A.rangeTag}>{sess.last_name_start}–{sess.last_name_end}</span>
        )}
        {sess.home_team && sess.away_team && (
          <span style={A.rangeTag}>T{sess.home_team} vs T{sess.away_team}</span>
        )}
        {sess.age_group && <span style={A.ageTag}>{sess.age_group}</span>}
      </div>

      {isEditing ? (
        <div style={{ marginBottom: 10 }}>
          <div style={A.formRow}>
            <div style={{ flex: 2 }}>
              <label style={A.fieldLabel}>Session name</label>
              <input value={editSession.name} onChange={(e) => setEditSession((n) => ({ ...n, name: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Date</label>
              <input type="date" value={editSession.date} onChange={(e) => setEditSession((n) => ({ ...n, date: e.target.value }))} />
            </div>
            <div style={{ width: 110 }}>
              <label style={A.fieldLabel}>Start time</label>
              <input type="time" value={editSession.time} onChange={(e) => setEditSession((n) => ({ ...n, time: e.target.value }))} />
            </div>
            <div style={{ width: 110 }}>
              <label style={A.fieldLabel}>Type</label>
              <select value={editSession.sessionType} onChange={(e) => setEditSession((n) => ({ ...n, sessionType: e.target.value }))}>
                <option value="skills">Skills</option>
                <option value="game">Game</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={saveSessionEdit} style={A.saveBtn}>Save</button>
            <button onClick={cancelEdit} style={A.ghostBtn}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={A.sessMain}>
          <div style={{ flex: 1 }}>
            <div style={A.sessName}>{sess.name}</div>
            <div style={A.sessMeta}>
              {fmt.date(sess.session_date)}
              {sess.start_time ? ` · ${fmt.time(sess.start_time)}` : ''}
              {' · '}<strong>{sess.player_count}</strong> players
            </div>
          </div>
          <div style={A.sessActions}>
            <select
              value={sess.status}
              onChange={(e) => updateStatus(sess.id, e.target.value)}
              style={{ ...A.statusSelect, background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}` }}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="complete">Complete</option>
            </select>
            <button onClick={() => startEditSession(sess)} style={A.iconBtn} title="Edit">✎</button>
            <button onClick={() => removeSession(sess.id)} style={{ ...A.iconBtn, color: 'var(--red-txt)' }} title="Delete">×</button>
          </div>
        </div>
      )}

      <div style={A.scorerRow}>
        <span style={A.scorerRowLabel}>Scorers:</span>
        {scorers.length === 0 && !isAssigning && (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>None assigned</span>
        )}
        {scorers.map((u) => (
          <span key={u.id} style={A.scorerChip}>
            {u.first_name} {u.last_name}
            <button onClick={() => unassignScorer(sess.id, u.id)} style={A.chipX}>×</button>
          </span>
        ))}
        {isAssigning ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, width: '100%' }}>
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
          <button onClick={() => { setAssigningTo(sess.id); setAssignUserId(''); }} style={A.addScorerBtn}>
            + Add scorer
          </button>
        )}
      </div>

      {sess.block_id && onChangeAssignment && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {!showAssignmentEdit ? (
            <button onClick={() => setShowAssignmentEdit(true)} style={{ ...A.addScorerBtn, borderColor: 'var(--blue)', color: 'var(--blue-txt)' }}>
              Edit Player Assignment
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Reassign players:</span>
              {sess.session_type === 'skills' ? (
                ['last_name', 'jersey_range', 'none', 'manual'].map((method) => (
                  <button key={method} disabled={changingAssignment} style={{ ...A.splitBtn, fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer' }}
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
                  <button key={method} disabled={changingAssignment} style={{ ...A.splitBtn, fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer' }}
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
  );
}

export function BlockWizardPanel({
  blockWizard,
  setBlockWizard,
  updateSlot,
  addSlot,
  removeSlot,
  updateTeam,
  updateGame,
  createBlock,
  creatingBlock,
  blockMsg,
  onCancel,
}) {
  const bw = blockWizard;

  return (
    <div style={{ ...A.card, borderColor: 'var(--blue)', borderWidth: 2, marginBottom: 16 }}>
      <div style={A.wizardTitle}>⚙ Session Block Setup</div>

      <div style={A.formRow}>
        <div style={{ flex: 2 }}>
          <label style={A.fieldLabel}>Block label <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
          <input placeholder="e.g. Mites Skills — Monday" value={bw.label} onChange={(e) => setBlockWizard((w) => ({ ...w, label: e.target.value }))} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={A.fieldLabel}>Date <span style={{ color: 'var(--red-txt)' }}>*</span></label>
          <input type="date" value={bw.date} onChange={(e) => setBlockWizard((w) => ({ ...w, date: e.target.value }))} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={A.fieldLabel}>Block type</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {[
            { val: 'skills', icon: '🏒', label: 'Skills Session', desc: 'Individual evaluation' },
            { val: 'game', icon: '🥅', label: 'Game Session', desc: 'Team-based play' },
          ].map((opt) => (
            <div
              key={opt.val}
              onClick={() => setBlockWizard((w) => ({ ...w, blockType: opt.val }))}
              style={{
                ...A.typeCard,
                border: `2px solid ${bw.blockType === opt.val ? 'var(--blue)' : 'var(--border)'}`,
                background: bw.blockType === opt.val ? 'var(--blue-bg)' : 'var(--bg3)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.icon} {opt.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {bw.blockType === 'skills' && (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={A.fieldLabel}>Player split method</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {[
                { val: 'last_name', label: 'By Last Name' },
                { val: 'jersey_range', label: 'By Jersey #' },
                { val: 'none', label: 'All Together' },
                { val: 'manual', label: 'Manual' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setBlockWizard((w) => ({ ...w, splitMethod: opt.val }))}
                  style={{
                    ...A.splitBtn,
                    border: `2px solid ${bw.splitMethod === opt.val ? 'var(--blue)' : 'var(--border)'}`,
                    background: bw.splitMethod === opt.val ? 'var(--blue-bg)' : 'var(--bg3)',
                    fontWeight: bw.splitMethod === opt.val ? 700 : 400,
                    color: bw.splitMethod === opt.val ? 'var(--blue-txt)' : 'var(--text)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={A.fieldLabel}>Scoring mode</label>
            <select value={bw.scoringMode} onChange={(e) => setBlockWizard((w) => ({ ...w, scoringMode: e.target.value }))} style={A.selectInput}>
              <option value="full">Full — every player scored on every criterion</option>
              <option value="observe">Observe — flag standout players only</option>
            </select>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={A.fieldLabel}>Time slots</div>
              {bw.splitMethod !== 'none' && (
                <button onClick={addSlot} style={{ ...A.ghostBtn, fontSize: 11 }}>+ Add slot</button>
              )}
            </div>
            {bw.slots.map((slot, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                <div style={{ width: 110 }}>
                  {i === 0 && <label style={A.fieldLabel}>Start time</label>}
                  <input type="time" value={slot.time} onChange={(e) => updateSlot(i, 'time', e.target.value)} />
                </div>
                {bw.splitMethod === 'last_name' && (
                  <>
                    <div style={{ width: 70 }}>
                      {i === 0 && <label style={A.fieldLabel}>From</label>}
                      <input maxLength={3} value={slot.lastNameStart} onChange={(e) => updateSlot(i, 'lastNameStart', e.target.value.toUpperCase())} style={{ textAlign: 'center', fontWeight: 700 }} />
                    </div>
                    <span style={{ paddingBottom: 8, color: 'var(--text3)' }}>—</span>
                    <div style={{ width: 70 }}>
                      {i === 0 && <label style={A.fieldLabel}>To</label>}
                      <input maxLength={3} value={slot.lastNameEnd} onChange={(e) => updateSlot(i, 'lastNameEnd', e.target.value.toUpperCase())} style={{ textAlign: 'center', fontWeight: 700 }} />
                    </div>
                  </>
                )}
                {bw.splitMethod === 'jersey_range' && (
                  <>
                    <div style={{ width: 80 }}>
                      {i === 0 && <label style={A.fieldLabel}>Jersey min</label>}
                      <input type="number" min="1" placeholder="1" value={slot.jerseyMin} onChange={(e) => updateSlot(i, 'jerseyMin', e.target.value)} />
                    </div>
                    <span style={{ paddingBottom: 8, color: 'var(--text3)' }}>—</span>
                    <div style={{ width: 80 }}>
                      {i === 0 && <label style={A.fieldLabel}>Jersey max</label>}
                      <input type="number" min="1" placeholder="99" value={slot.jerseyMax} onChange={(e) => updateSlot(i, 'jerseyMax', e.target.value)} />
                    </div>
                  </>
                )}
                {bw.slots.length > 1 && (
                  <button onClick={() => removeSlot(i)} style={{ ...A.iconBtn, color: 'var(--red-txt)', paddingBottom: 8 }}>×</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {bw.blockType === 'game' && (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={A.fieldLabel}>Teams</div>
              <button
                onClick={() => setBlockWizard((w) => {
                  const n = w.teams.length + 1;
                  return { ...w, teams: [...w.teams, { teamNumber: n, jerseyColor: 'white', label: `Team ${n}` }] };
                })}
                style={{ ...A.ghostBtn, fontSize: 11 }}
              >
                + Add team
              </button>
            </div>
            {bw.teams.map((team, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  {i === 0 && <label style={A.fieldLabel}>Label</label>}
                  <input value={team.label} onChange={(e) => updateTeam(i, 'label', e.target.value)} />
                </div>
                <div style={{ width: 130 }}>
                  {i === 0 && <label style={A.fieldLabel}>Jersey color</label>}
                  <select value={team.jerseyColor} onChange={(e) => updateTeam(i, 'jerseyColor', e.target.value)} style={A.selectInput}>
                    {['white', 'maroon', 'light', 'dark', 'green', 'black', 'red', 'blue'].map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={A.fieldLabel}>Player assignment</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {[
                { val: 'random', label: '🎲 Random', desc: 'Auto-shuffle players to teams' },
                { val: 'manual', label: '✋ Manual', desc: 'Assign players yourself later' },
              ].map((opt) => (
                <div
                  key={opt.val}
                  onClick={() => setBlockWizard((w) => ({ ...w, playerAssignment: opt.val }))}
                  style={{
                    ...A.typeCard,
                    border: `2px solid ${bw.playerAssignment === opt.val ? 'var(--blue)' : 'var(--border)'}`,
                    background: bw.playerAssignment === opt.val ? 'var(--blue-bg)' : 'var(--bg3)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={A.fieldLabel}>Game matchups</div>
              <button onClick={() => setBlockWizard((w) => ({ ...w, games: [...w.games, { time: '', homeTeam: 1, awayTeam: 2 }] }))} style={{ ...A.ghostBtn, fontSize: 11 }}>
                + Add game
              </button>
            </div>
            {bw.games.map((game, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                <div style={{ width: 110 }}>
                  {i === 0 && <label style={A.fieldLabel}>Start time</label>}
                  <input type="time" value={game.time} onChange={(e) => updateGame(i, 'time', e.target.value)} />
                </div>
                <div style={{ width: 100 }}>
                  {i === 0 && <label style={A.fieldLabel}>Home</label>}
                  <select value={game.homeTeam} onChange={(e) => updateGame(i, 'homeTeam', e.target.value)} style={A.selectInput}>
                    {bw.teams.map((t) => <option key={t.teamNumber} value={t.teamNumber}>{t.label || `Team ${t.teamNumber}`}</option>)}
                  </select>
                </div>
                <span style={{ paddingBottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>vs</span>
                <div style={{ width: 100 }}>
                  {i === 0 && <label style={A.fieldLabel}>Away</label>}
                  <select value={game.awayTeam} onChange={(e) => updateGame(i, 'awayTeam', e.target.value)} style={A.selectInput}>
                    {bw.teams.map((t) => <option key={t.teamNumber} value={t.teamNumber}>{t.label || `Team ${t.teamNumber}`}</option>)}
                  </select>
                </div>
                {bw.games.length > 1 && (
                  <button onClick={() => setBlockWizard((w) => ({ ...w, games: w.games.filter((_, idx) => idx !== i) }))} style={{ ...A.iconBtn, color: 'var(--red-txt)', paddingBottom: 8 }}>×</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {blockMsg && <div style={A.errorBox}>{blockMsg}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={createBlock} disabled={creatingBlock || !bw.date} style={A.saveBtn}>
          {creatingBlock ? 'Creating…' : `Create ${bw.blockType === 'game' ? 'Game' : 'Skills'} Block`}
        </button>
        <button onClick={onCancel} style={A.ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}
