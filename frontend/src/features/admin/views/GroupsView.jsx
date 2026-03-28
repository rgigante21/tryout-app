import { A } from '../styles';
import { BlockWizardPanel, SessionCard } from '../shared';

export function GroupsIndexView({ ageGroups, groupStats, openGroup }) {
  return (
    <>
      <div style={A.sectionHdr}>
        <span style={A.sectionLabel}>Select an Age Group</span>
      </div>
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
            </div>
          );
        })}
      </div>
    </>
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
    <div>
      <div style={A.sectionHdr}>
        <span style={A.sectionLabel}>Sessions ({sessions.length})</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowAddSession((v) => !v); setShowBlockWizard(false); }} style={A.ghostBtn}>
            {showAddSession ? 'Cancel' : '+ Single Session'}
          </button>
          <button onClick={() => { setShowBlockWizard((v) => !v); setShowAddSession(false); }} style={showBlockWizard ? A.ghostBtn : A.primaryBtn}>
            {showBlockWizard ? 'Cancel' : '+ Session Block'}
          </button>
        </div>
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

      {sessions.map((sess) => (
        <SessionCard
          key={sess.id}
          sess={sess}
          scorers={sessionScorers[sess.id] || []}
          users={users}
          editingSessionId={editingSessionId}
          editSession={editSession}
          setEditSession={setEditSession}
          startEditSession={startEditSession}
          saveSessionEdit={saveSessionEdit}
          cancelEdit={cancelEdit}
          updateStatus={updateStatus}
          removeSession={removeSession}
          assigningTo={assigningTo}
          setAssigningTo={setAssigningTo}
          assignUserId={assignUserId}
          setAssignUserId={setAssignUserId}
          assignScorer={assignScorer}
          unassignScorer={unassignScorer}
        />
      ))}

      <div style={{ ...A.sectionHdr, marginTop: 28 }}>
        <span style={A.sectionLabel}>Players ({players.length})</span>
        <div style={{ display: 'flex', gap: 8 }}>
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
                  { label: 'Skip', val: importSummary.skipped, color: 'var(--amber-txt)' },
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
          <div style={{ marginTop: 10 }}>
            <button onClick={addPlayer} disabled={addingPlayer || !newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey} style={A.saveBtn}>
              {addingPlayer ? 'Adding…' : 'Add Player'}
            </button>
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
            <span style={{ width: 32 }} />
          </div>
          {players.map((p) => (
            <div key={p.id} style={A.playerRow}>
              <span style={A.pJersey}>#{p.jersey_number}</span>
              <span style={A.pName}>{p.first_name} {p.last_name}</span>
              <button onClick={() => removePlayer(p.id)} style={{ ...A.iconBtn, color: 'var(--red-txt)' }} title="Remove">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
