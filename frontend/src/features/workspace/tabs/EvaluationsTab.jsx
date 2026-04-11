import { useState } from 'react';
import { A } from '../../admin/styles';
import { BlockWizardPanel, defaultBlock, fmt } from '../../admin/shared';
import { SessionMiniCard } from '../../admin/views/GroupsView';
import { api } from '../../../utils/api';

export default function EvaluationsTab({
  sessions,
  eventId,
  ageGroupId,
  onUpdateStatus,
  onRemoveSession,
  onSaveSession,
  onBlockCreated,
}) {
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSession, setNewSession] = useState({ name: '', date: '', time: '' });
  const [addingSession, setAddingSession] = useState(false);

  const [showBlockWizard, setShowBlockWizard] = useState(false);
  const [blockWizard, setBlockWizard] = useState(defaultBlock());
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [blockMsg, setBlockMsg] = useState('');

  const updateSlot = (i, field, val) => {
    setBlockWizard((w) => ({ ...w, slots: w.slots.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)) }));
  };
  const addSlot = () => {
    setBlockWizard((w) => ({ ...w, slots: [...w.slots, { time: '', lastNameStart: 'A', lastNameEnd: 'Z', jerseyMin: '', jerseyMax: '' }] }));
  };
  const removeSlot = (i) => {
    setBlockWizard((w) => ({ ...w, slots: w.slots.filter((_, idx) => idx !== i) }));
  };
  const updateTeam = (i, field, val) => {
    setBlockWizard((w) => ({ ...w, teams: w.teams.map((t, idx) => (idx === i ? { ...t, [field]: val } : t)) }));
  };
  const updateGame = (i, field, val) => {
    setBlockWizard((w) => ({ ...w, games: w.games.map((g, idx) => (idx === i ? { ...g, [field]: val } : g)) }));
  };

  const createBlock = async () => {
    if (!blockWizard.date || !eventId || !ageGroupId) return;
    setCreatingBlock(true);
    setBlockMsg('');
    try {
      const payload = {
        eventId: parseInt(eventId, 10),
        ageGroupId: parseInt(ageGroupId, 10),
        blockType: blockWizard.blockType,
        splitMethod: blockWizard.splitMethod,
        label: blockWizard.label || null,
        sessionDate: blockWizard.date,
        scoringMode: blockWizard.scoringMode,
      };
      if (blockWizard.blockType === 'skills') {
        payload.slots = blockWizard.slots.map((s) => ({
          time: s.time || null,
          lastNameStart: s.lastNameStart || null,
          lastNameEnd: s.lastNameEnd || null,
          jerseyMin: s.jerseyMin ? parseInt(s.jerseyMin, 10) : null,
          jerseyMax: s.jerseyMax ? parseInt(s.jerseyMax, 10) : null,
        }));
      } else {
        payload.teamCount = blockWizard.teams.length;
        payload.teams = blockWizard.teams;
        payload.games = blockWizard.games.map((g) => ({
          ...g,
          homeTeam: parseInt(g.homeTeam, 10),
          awayTeam: parseInt(g.awayTeam, 10),
        }));
        payload.playerAssignment = blockWizard.playerAssignment;
      }
      await api.createSessionBlock(payload);
      setShowBlockWizard(false);
      setBlockMsg('');
      setBlockWizard(defaultBlock());
      onBlockCreated();
    } catch (err) {
      setBlockMsg(err.message || 'Failed to create block');
    } finally {
      setCreatingBlock(false);
    }
  };

  const handleAddSession = async () => {
    if (!newSession.name || !newSession.date || !newSession.time) return;
    setAddingSession(true);
    try {
      const r = await api.createSession({
        eventId: parseInt(eventId, 10),
        ageGroupId: parseInt(ageGroupId, 10),
        name: newSession.name,
        sessionDate: newSession.date,
        startTime: newSession.time,
      });
      setNewSession({ name: '', date: '', time: '' });
      setShowAddSession(false);
      onBlockCreated(); // refresh sessions list
      return r;
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingSession(false);
    }
  };

  return (
    <div>
      <div style={{ ...A.sectionHdr, marginBottom: 12 }}>
        <div>
          <div style={A.sectionLabel}>Sessions ({sessions.length})</div>
        </div>
        <div style={A.actionRow}>
          <button
            onClick={() => { setShowAddSession((v) => !v); setShowBlockWizard(false); }}
            style={A.ghostBtn}
          >
            {showAddSession ? 'Cancel' : '+ Single Session'}
          </button>
          <button
            onClick={() => { setShowBlockWizard((v) => !v); setShowAddSession(false); }}
            style={showBlockWizard ? A.ghostBtn : A.primaryBtn}
          >
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
                onKeyDown={(e) => e.key === 'Enter' && handleAddSession()}
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
            <button
              onClick={handleAddSession}
              disabled={addingSession || !newSession.name || !newSession.date || !newSession.time}
              style={A.saveBtn}
            >
              {addingSession ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 && !showAddSession && !showBlockWizard && (
        <div style={A.emptyCard}>
          No sessions yet. Use <strong>+ Session Block</strong> to create sessions with automatic player splits.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sessions.map((sess) => (
          <SessionMiniCard
            key={sess.id}
            sess={sess}
            updateStatus={onUpdateStatus}
            removeSession={onRemoveSession}
            onSaveSession={onSaveSession}
          />
        ))}
      </div>
    </div>
  );
}
