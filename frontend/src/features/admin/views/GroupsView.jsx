import { useState } from 'react';
import { A } from '../styles';
import { BlockWizardPanel, STATUS_META, fmt } from '../shared';
import { api } from '../../../utils/api';

export function SessionMiniCard({ sess, updateStatus, removeSession, onSaveSession }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sessionPlayers, setSessionPlayers] = useState(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const sm = STATUS_META[sess.status] || STATUS_META.pending;
  const isGame = sess.session_type === 'game';

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

  return (
    <div style={{ background: '#fff', border: `1px solid ${expanded ? 'var(--gold-dark)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: isGame ? 'var(--amber-bg)' : 'var(--blue-bg)', color: isGame ? 'var(--amber-txt)' : 'var(--blue-txt)', border: `1px solid ${isGame ? 'var(--amber)' : 'var(--blue)'}` }}>
              {isGame ? 'Game' : 'Skills'}
            </span>
            {(sess.last_name_start && sess.last_name_end) && (
              <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                {sess.last_name_start}–{sess.last_name_end}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sess.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {sess.start_time ? fmt.time(sess.start_time) : '—'} · <strong>{sess.player_count}</strong> players
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          <select
            value={sess.status}
            onChange={(e) => updateStatus(sess.id, e.target.value)}
            style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}`, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="complete">Complete</option>
          </select>
          <button
            onClick={toggle}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text3)', padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {expanded ? 'Close ▲' : 'Manage ▼'}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--bg3)', background: 'var(--bg)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Edit details */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--maroon)' }}>Session Details</div>
              {!draft && <button onClick={openEdit} style={{ ...A.ghostBtn, fontSize: 11, padding: '4px 10px' }}>Edit</button>}
              {draft && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={saveEdit} disabled={saving || !draft.name || !draft.date} style={{ ...A.saveBtn, fontSize: 14, padding: '5px 14px' }}>{saving ? 'Saving…' : 'Save'}</button>
                  <button onClick={cancelEdit} style={{ ...A.ghostBtn, fontSize: 11, padding: '4px 10px' }}>Cancel</button>
                </div>
              )}
            </div>
            {!draft ? (
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)' }}>
                <div><span style={{ fontWeight: 700, color: 'var(--text)' }}>Name:</span> {sess.name}</div>
                <div><span style={{ fontWeight: 700, color: 'var(--text)' }}>Date:</span> {fmt.date(sess.session_date)}</div>
                <div><span style={{ fontWeight: 700, color: 'var(--text)' }}>Time:</span> {sess.start_time ? fmt.time(sess.start_time) : '—'}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 160px', minWidth: 130 }}>
                  <label style={{ ...A.fieldLabel, fontSize: 11 }}>Name</label>
                  <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                </div>
                <div style={{ flex: '1 1 120px', minWidth: 110 }}>
                  <label style={{ ...A.fieldLabel, fontSize: 11 }}>Date</label>
                  <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
                </div>
                <div style={{ flex: '0 0 110px', minWidth: 100 }}>
                  <label style={{ ...A.fieldLabel, fontSize: 11 }}>Time</label>
                  <input type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} />
                </div>
              </div>
            )}
          </div>

          {/* Player list */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--maroon)', marginBottom: 6 }}>
              Players{sessionPlayers ? ` (${sessionPlayers.length})` : ''}
            </div>
            {loadingPlayers && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading…</div>}
            {!loadingPlayers && sessionPlayers?.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>No players assigned.</div>
            )}
            {!loadingPlayers && sessionPlayers && sessionPlayers.length > 0 && (
              <div style={{ maxHeight: 180, overflowY: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
                {sessionPlayers.map((p, i) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: i < sessionPlayers.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--maroon)', width: 30, flexShrink: 0 }}>
                      #{p.jersey_number}
                    </span>
                    <span style={{ flex: 1 }}>{p.first_name} {p.last_name}</span>
                    {p.scored && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: 'var(--green-bg)', color: 'var(--green-txt)' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
            <button onClick={() => removeSession(sess.id)} style={{ ...A.iconBtn, fontSize: 12, color: 'var(--red-txt)' }}>
              Delete session
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

export function GroupsIndexView({ ageGroups, groupStats, openGroup, openWorkspace, onAddAgeGroup }) {
  const [showAdd, setShowAdd] = useState(false);
  const nextSortOrder = ageGroups.length > 0 ? Math.max(...ageGroups.map((g) => g.sort_order)) + 1 : 1;
  const [newGroup, setNewGroup] = useState({ name: '', code: '', sortOrder: String(nextSortOrder) });
  const [creating, setCreating] = useState(false);

  const handleAdd = async () => {
    if (!newGroup.name || !newGroup.code) return;
    setCreating(true);
    try {
      await onAddAgeGroup({ name: newGroup.name, code: newGroup.code, sortOrder: parseInt(newGroup.sortOrder) || 0 });
      setNewGroup({ name: '', code: '', sortOrder: '0' });
      setShowAdd(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={A.stackedSection}>
      <div style={A.sectionHdr}>
        <div>
          <div style={A.sectionLabel}>Age Groups</div>
          <div style={A.sectionIntro}>
            Keep rosters and session planning organized by age group so coordinators can move quickly between levels during tryouts.
          </div>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} style={showAdd ? A.ghostBtn : A.primaryBtn}>
          {showAdd ? 'Cancel' : '+ New Age Group'}
        </button>
      </div>

      {showAdd && (
        <div style={{ ...A.card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>New Age Group</div>
          <div style={A.formRow}>
            <div style={{ flex: 2 }}>
              <label style={A.fieldLabel}>Name</label>
              <input placeholder="e.g. Mites (8U)" value={newGroup.name}
                onChange={(e) => setNewGroup((n) => ({ ...n, name: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Code</label>
              <input placeholder="e.g. 8U" value={newGroup.code}
                onChange={(e) => setNewGroup((n) => ({ ...n, code: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={handleAdd} disabled={creating || !newGroup.name || !newGroup.code} style={A.saveBtn}>
              {creating ? 'Creating…' : 'Create Age Group'}
            </button>
          </div>
        </div>
      )}

      <div style={A.ageGroupGrid}>
        {ageGroups.map((g) => {
          const stats = groupStats(g.code);
          return (
            <div key={g.id} style={A.agCard} className="ag-card" onClick={() => openGroup(g)}>
              <div style={A.agName}>{g.name}</div>
              <div style={A.agStats}>
                <div style={{ textAlign: 'center' }}>
                  <div style={A.agStatVal}>{stats.total_players}</div>
                  <div style={A.agStatLabel}>Players</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={A.agStatVal}>{stats.total_sessions}</div>
                  <div style={A.agStatLabel}>Sessions</div>
                </div>
              </div>
              <span style={A.agLink}>Manage sessions & players →</span>
              {openWorkspace && (
                <span
                  style={{ ...A.agLink, fontSize: 12, marginTop: 6, color: 'var(--maroon)', fontWeight: 700 }}
                  onClick={(e) => { e.stopPropagation(); openWorkspace(g); }}
                >
                  Open Workspace →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GroupDetailView({
  sessions,
  players,
  sessionScorers,
  users,
  showBlockWizard,
  setShowBlockWizard,
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
  showAddSession,
  setShowAddSession,
  newSession,
  setNewSession,
  addSession,
  addingSession,
  showAddPlayer,
  setShowAddPlayer,
  newPlayer,
  setNewPlayer,
  addPlayer,
  addingPlayer,
  removePlayer,
  onSaveSession,
  updateStatus,
  removeSession,
  assigningTo,
  setAssigningTo,
  assignUserId,
  setAssignUserId,
  assignScorer,
  unassignScorer,
  onChangeAssignment,
  showImport,
  setShowImport,
  importPreview,
  importSummary,
  importRunning,
  importResult,
  importMsg,
  handleImportFile,
  commitImport,
  clearImport,
}) {
  return (
    <div style={A.stackedSection}>
      <div style={A.sectionHdr}>
        <div>
          <div style={A.sectionLabel}>Group Workspace</div>
          <div style={A.sectionIntro}>
            Add players, edit rosters, and create sessions for this age group from one place.
          </div>
        </div>
        <div style={A.actionRow}>
          <button onClick={() => { setShowAddSession((v) => !v); setShowBlockWizard(false); }} style={A.ghostBtn}>
            {showAddSession ? 'Cancel' : '+ Single Session'}
          </button>
          <button onClick={() => { setShowBlockWizard((v) => !v); setShowAddSession(false); }} style={showBlockWizard ? A.ghostBtn : A.primaryBtn}>
            {showBlockWizard ? 'Cancel' : '+ Session Block'}
          </button>
        </div>
      </div>

      <div style={A.statStrip}>
        {[
          { label: 'Sessions', value: sessions.length },
          { label: 'Players', value: players.length },
          { label: 'Scorers', value: Object.values(sessionScorers).flat().length },
        ].map(({ label, value }) => (
          <div key={label} style={A.statTile}>
            <div style={A.statTileValue}>{value}</div>
            <div style={A.statTileLabel}>{label}</div>
          </div>
        ))}
      </div>

      {showBlockWizard && (
        <BlockWizardPanel
          blockWizard={blockWizard}
          setBlockWizard={setBlockWizard}
          updateSlot={updateSlot}
          addSlot={addSlot}
          removeSlot={removeSlot}
          updateTeam={updateTeam}
          updateGame={updateGame}
          createBlock={createBlock}
          creatingBlock={creatingBlock}
          blockMsg={blockMsg}
          onCancel={() => setShowBlockWizard(false)}
        />
      )}

      {showAddSession && (
        <div style={{ ...A.card, marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
            Single session — no automatic player split. Use <strong>Session Block</strong> for last-name or team splits.
          </p>
          <div style={A.formRow}>
            <div style={{ flex: 2 }}>
              <label style={A.fieldLabel}>Session name</label>
              <input
                placeholder="e.g. Day 1 Session 1"
                value={newSession.name}
                onChange={(e) => setNewSession((n) => ({ ...n, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addSession()}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Date</label>
              <input type="date" value={newSession.date} onChange={(e) => setNewSession((n) => ({ ...n, date: e.target.value }))} />
            </div>
            <div style={{ width: 110 }}>
              <label style={A.fieldLabel}>Start time</label>
              <input type="time" value={newSession.time} onChange={(e) => setNewSession((n) => ({ ...n, time: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={addSession} disabled={addingSession || !newSession.name || !newSession.date || !newSession.time} style={A.saveBtn}>
              {addingSession ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 && !showAddSession && !showBlockWizard && (
        <div style={A.emptyCard}>No sessions yet. Use <strong>+ Session Block</strong> to create sessions with automatic player splits.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
        {sessions.map((sess) => (
          <SessionMiniCard
            key={sess.id}
            sess={sess}
            updateStatus={updateStatus}
            removeSession={removeSession}
            onSaveSession={onSaveSession}
          />
        ))}
      </div>

      <div style={{ ...A.sectionHdr, marginTop: 8 }}>
        <span style={A.sectionLabel}>Players ({players.length})</span>
        <div style={A.actionRow}>
          <button onClick={() => { setShowImport((v) => !v); setShowAddPlayer(false); clearImport(); }} style={A.ghostBtn}>
            {showImport ? 'Cancel' : '↑ Import CSV'}
          </button>
          <button onClick={() => { setShowAddPlayer((v) => !v); setShowImport(false); }} style={showAddPlayer ? A.ghostBtn : A.primaryBtn}>
            {showAddPlayer ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </div>

      {showImport && (
        <div style={{ ...A.card, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Import Players from CSV</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Supports SportEngine exports. Players auto-assign to sessions based on last name.</div>
          {!importResult && (
            <input type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ fontSize: 13, color: 'var(--text)' }} />
          )}
          {importRunning && <p style={A.muted}>Parsing CSV…</p>}
          {importMsg && <div style={A.errorBox}>{importMsg}</div>}
          {importPreview && importSummary && !importResult && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                {[
                  { label: 'Valid', val: importSummary.valid, color: 'var(--green-txt)' },
                  { label: 'Warnings', val: importSummary.warnings, color: 'var(--amber-txt)' },
                  { label: 'Errors', val: importSummary.errors, color: 'var(--red-txt)' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={commitImport} disabled={importRunning || importSummary.valid === 0} style={A.saveBtn}>
                  {importRunning ? 'Importing…' : `Import ${importSummary.valid} Player${importSummary.valid !== 1 ? 's' : ''}`}
                </button>
                <button onClick={clearImport} style={A.ghostBtn}>Clear</button>
              </div>
            </div>
          )}
          {importResult && (
            <div style={{ marginTop: 10 }}>
              <div style={A.successBox}>
                ✓ Imported {importResult.summary.added} player{importResult.summary.added !== 1 ? 's' : ''}.
              </div>
              <button onClick={() => { clearImport(); setShowImport(false); }} style={{ ...A.ghostBtn, marginTop: 8 }}>Done</button>
            </div>
          )}
        </div>
      )}

      {showAddPlayer && (
        <div style={{ ...A.card, marginBottom: 12 }}>
          <div style={A.formRow}>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>First name</label>
              <input placeholder="First" value={newPlayer.firstName} onChange={(e) => setNewPlayer((n) => ({ ...n, firstName: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Last name</label>
              <input placeholder="Last" value={newPlayer.lastName} onChange={(e) => setNewPlayer((n) => ({ ...n, lastName: e.target.value }))} />
            </div>
            <div style={{ width: 90 }}>
              <label style={A.fieldLabel}>Jersey #</label>
              <input
                type="number"
                min="1"
                max="99"
                placeholder="#"
                value={newPlayer.jersey}
                onChange={(e) => setNewPlayer((n) => ({ ...n, jersey: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
              />
            </div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button onClick={addPlayer} disabled={addingPlayer || !newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey} style={A.saveBtn}>
              {addingPlayer ? 'Adding…' : 'Add Player'}
            </button>
            <button onClick={() => setShowAddPlayer(false)} style={A.ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {players.length === 0 && !showAddPlayer && (
        <div style={A.emptyCard}>No players yet. Click <strong>+ Add Player</strong> or import a CSV.</div>
      )}

      {players.length > 0 && (
        <div style={A.playerTable}>
          <div style={A.playerTableHdr}>
            <span style={{ width: 50 }}>#</span>
            <span style={{ flex: 1 }}>Name</span>
            <span style={{ width: 44, textAlign: 'right' }}>Born</span>
            <span style={{ width: 32 }} />
          </div>
          {players.map((p) => {
            const born = p.date_of_birth
              ? new Date(p.date_of_birth + 'T12:00:00').getFullYear()
              : (p.birth_year ?? null);
            return (
              <div key={p.id} style={A.playerRow}>
                <span style={A.pJersey}>#{p.jersey_number}</span>
                <span style={A.pName}>{p.first_name} {p.last_name}</span>
                <span style={{ width: 44, textAlign: 'right', fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {born ?? '—'}
                </span>
                <button onClick={() => removePlayer(p.id)} style={{ ...A.iconBtn, color: 'var(--red-txt)' }} title="Remove">×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
