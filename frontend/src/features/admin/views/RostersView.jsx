import { useState } from 'react';
import RosterTable from '../RosterTable';
import { A } from '../styles';

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - 5 - i);

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: 'rgba(26,18,18,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
};
const cardStyle = {
  background: '#fff', borderRadius: 18, border: '1px solid var(--border)',
  boxShadow: '0 20px 48px rgba(0,0,0,0.18)',
  width: '100%', maxWidth: 440, padding: '28px 28px 24px',
};
const fieldGroupStyle = { marginBottom: 16 };
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  height: 40, padding: '0 12px',
  border: '1px solid var(--border)', borderRadius: 10,
  fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
  background: '#fff', outline: 'none',
};
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const modalTitle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 22, fontWeight: 700, color: '#4A1320',
  letterSpacing: '0.02em', marginBottom: 20,
};
const footerRow = { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 };

function PlayerModal({ player, onSave, onClose, saving }) {
  const isEdit = !!player;
  const [form, setForm] = useState({
    firstName:    player?.first_name   ?? '',
    lastName:     player?.last_name    ?? '',
    jerseyNumber: player?.jersey_number != null ? String(player.jersey_number) : '',
    position:     player?.position     ?? '',
    shot:         player?.shot         ?? '',
    birthYear:    player?.birth_year   ?? (player?.date_of_birth ? new Date(player.date_of_birth + 'T12:00:00').getFullYear() : ''),
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.jerseyNumber) return;
    onSave({
      firstName:    form.firstName.trim(),
      lastName:     form.lastName.trim(),
      jerseyNumber: Number(form.jerseyNumber),
      position:     form.position || null,
      shot:         form.shot || null,
      birthYear:    form.birthYear ? Number(form.birthYear) : null,
    });
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={e => e.stopPropagation()}>
        <div style={modalTitle}>{isEdit ? 'Edit Player' : 'Add Player'}</div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={A.fieldLabel}>First Name</label>
              <input
                style={inputStyle}
                value={form.firstName}
                onChange={e => set('firstName', e.target.value)}
                required
                autoFocus
              />
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={A.fieldLabel}>Last Name</label>
              <input
                style={inputStyle}
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...fieldGroupStyle, width: 100, flexShrink: 0 }}>
              <label style={A.fieldLabel}>Jersey #</label>
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={99}
                value={form.jerseyNumber}
                onChange={e => set('jerseyNumber', e.target.value)}
                required
              />
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={A.fieldLabel}>Position</label>
              <select style={selectStyle} value={form.position} onChange={e => set('position', e.target.value)}>
                <option value="">— Select —</option>
                <option value="skater">Skater</option>
                <option value="goalie">Goalie</option>
                <option value="defense">Defense</option>
                <option value="forward">Forward</option>
              </select>
            </div>
            <div style={{ ...fieldGroupStyle, width: 90, flexShrink: 0 }}>
              <label style={A.fieldLabel}>Shot</label>
              <select style={selectStyle} value={form.shot} onChange={e => set('shot', e.target.value)}>
                <option value="">—</option>
                <option value="L">Left</option>
                <option value="R">Right</option>
              </select>
            </div>
          </div>

          <div style={{ ...fieldGroupStyle, maxWidth: 160 }}>
            <label style={A.fieldLabel}>Birth Year</label>
            <select style={selectStyle} value={form.birthYear} onChange={e => set('birthYear', e.target.value)}>
              <option value="">— Select —</option>
              {BIRTH_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={footerRow}>
            <button type="button" style={A.ghostBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" style={A.primaryBtn} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Update Player' : 'Add Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RemoveMoveDialog({ player, ageGroups, onRemove, onMove, onClose, saving }) {
  const [targetGroupId, setTargetGroupId] = useState('');

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...cardStyle, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={modalTitle}>
          {player.first_name} {player.last_name} #{player.jersey_number}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ ...A.sectionLabel, marginBottom: 8 }}>Move to another age group</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              style={{ ...selectStyle, flex: 1 }}
              value={targetGroupId}
              onChange={e => setTargetGroupId(e.target.value)}
            >
              <option value="">Select age group…</option>
              {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button
              style={A.primaryBtn}
              onClick={() => targetGroupId && onMove(targetGroupId)}
              disabled={!targetGroupId || saving}
            >
              Move
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
            Removes from current sessions and auto-assigns to the new group.
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <div style={{ ...A.sectionLabel, marginBottom: 8, color: 'var(--red-txt)' }}>Remove from roster</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            Removes this player from the current age group and all its sessions. Scores will be deleted.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={A.ghostBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button
              style={{ ...A.primaryBtn, background: 'var(--red)', border: '1px solid var(--red)', boxShadow: 'none' }}
              onClick={onRemove}
              disabled={saving}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RostersView({
  activeEvent,
  activeGroup,
  players = [],
  loading = false,
  ageGroups = [],
  onAddPlayer,
  onEditPlayer,
  onRemovePlayer,
  onMovePlayer,
  isAdmin = false,
}) {
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [removingPlayer, setRemovingPlayer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const otherGroups = ageGroups.filter(g => g.id !== activeGroup?.id);

  async function handleSave(data) {
    setError(null);
    setSaving(true);
    try {
      if (editingPlayer) {
        await onEditPlayer(editingPlayer.id, data);
        setEditingPlayer(null);
      } else {
        await onAddPlayer(data);
        setAddingPlayer(false);
      }
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setSaving(true);
    try {
      await onRemovePlayer(removingPlayer.id);
      setRemovingPlayer(null);
    } catch (err) {
      setError(err.message || 'Remove failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(targetGroupId) {
    setError(null);
    setSaving(true);
    try {
      await onMovePlayer(removingPlayer.id, targetGroupId);
      setRemovingPlayer(null);
    } catch (err) {
      setError(err.message || 'Move failed');
    } finally {
      setSaving(false);
    }
  }

  if (!activeEvent) {
    return <div style={A.emptyCard}>No active event. Create an event first.</div>;
  }

  if (!activeGroup) {
    return (
      <div style={A.emptyCard}>
        Select an age group from the sidebar to view the roster.
      </div>
    );
  }

  if (loading) {
    return <div style={A.emptyCard}>Loading roster…</div>;
  }

  return (
    <>
      {(addingPlayer || editingPlayer) && (
        <PlayerModal
          player={editingPlayer}
          onSave={handleSave}
          onClose={() => { setEditingPlayer(null); setAddingPlayer(false); setError(null); }}
          saving={saving}
        />
      )}

      {removingPlayer && (
        <RemoveMoveDialog
          player={removingPlayer}
          ageGroups={otherGroups}
          onRemove={handleRemove}
          onMove={handleMove}
          onClose={() => { setRemovingPlayer(null); setError(null); }}
          saving={saving}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>
          {players.length} player{players.length !== 1 ? 's' : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {error && <span style={{ fontSize: 12, color: 'var(--red-txt)' }}>{error}</span>}
          {isAdmin && onAddPlayer && (
            <button style={A.primaryBtn} onClick={() => { setError(null); setAddingPlayer(true); }}>
              + Add Player
            </button>
          )}
        </div>
      </div>

      {players.length === 0 ? (
        <div style={A.emptyCard}>
          No players registered for {activeGroup.name}.
          {isAdmin && onAddPlayer && (
            <div style={{ marginTop: 10 }}>
              <button style={A.primaryBtn} onClick={() => setAddingPlayer(true)}>+ Add Player</button>
            </div>
          )}
        </div>
      ) : (
        <RosterTable
          players={players}
          onEditPlayer={isAdmin && onEditPlayer ? setEditingPlayer : undefined}
          onRemovePlayer={isAdmin && onRemovePlayer ? setRemovingPlayer : undefined}
        />
      )}
    </>
  );
}
