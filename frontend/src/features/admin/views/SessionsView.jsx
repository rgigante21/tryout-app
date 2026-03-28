import { A } from '../styles';
import { BlockWizardPanel, SessionCard, fmt } from '../shared';

export default function SessionsView({
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
  sessDateFilter,
  setSessDateFilter,
  uniqueDates,
  sessLoading,
  filteredSessions,
  sessionScorers,
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
}) {
  return (
    <>
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
      {!sessLoading && filteredSessions.map((sess) => (
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
    </>
  );
}
