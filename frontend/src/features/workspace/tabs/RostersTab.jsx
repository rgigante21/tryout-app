import { useState } from 'react';
import { A } from '../../admin/styles';

export default function RostersTab({
  players,
  onAddPlayer,
  onRemovePlayer,
  onImportFile,
  importPreview,
  importSummary,
  importRunning,
  importResult,
  importMsg,
  onCommitImport,
  onClearImport,
}) {
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ firstName: '', lastName: '', jersey: '' });
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey) return;
    setAdding(true);
    try {
      await onAddPlayer({
        firstName: newPlayer.firstName,
        lastName: newPlayer.lastName,
        jerseyNumber: parseInt(newPlayer.jersey, 10),
      });
      setNewPlayer({ firstName: '', lastName: '', jersey: '' });
      setShowAddPlayer(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <div style={{ ...A.sectionHdr, marginBottom: 12 }}>
        <span style={A.sectionLabel}>Players ({players.length})</span>
        <div style={A.actionRow}>
          <button
            onClick={() => { setShowImport((v) => !v); setShowAddPlayer(false); onClearImport(); }}
            style={A.ghostBtn}
          >
            {showImport ? 'Cancel' : '↑ Import CSV'}
          </button>
          <button
            onClick={() => { setShowAddPlayer((v) => !v); setShowImport(false); }}
            style={showAddPlayer ? A.ghostBtn : A.primaryBtn}
          >
            {showAddPlayer ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </div>

      {showImport && (
        <div style={{ ...A.card, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Import Players from CSV</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
            Supports SportEngine exports. Players auto-assign to sessions based on last name.
          </div>
          {!importResult && (
            <input type="file" accept=".csv,text/csv" onChange={onImportFile} style={{ fontSize: 13, color: 'var(--text)' }} />
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
                <button
                  onClick={onCommitImport}
                  disabled={importRunning || importSummary.valid === 0}
                  style={A.saveBtn}
                >
                  {importRunning ? 'Importing…' : `Import ${importSummary.valid} Player${importSummary.valid !== 1 ? 's' : ''}`}
                </button>
                <button onClick={onClearImport} style={A.ghostBtn}>Clear</button>
              </div>
            </div>
          )}
          {importResult && (
            <div style={{ marginTop: 10 }}>
              <div style={A.successBox}>
                ✓ Imported {importResult.summary.added} player{importResult.summary.added !== 1 ? 's' : ''}.
              </div>
              <button onClick={() => { onClearImport(); setShowImport(false); }} style={{ ...A.ghostBtn, marginTop: 8 }}>Done</button>
            </div>
          )}
        </div>
      )}

      {showAddPlayer && (
        <div style={{ ...A.card, marginBottom: 12 }}>
          <div style={A.formRow}>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>First name</label>
              <input
                placeholder="First"
                value={newPlayer.firstName}
                onChange={(e) => setNewPlayer((n) => ({ ...n, firstName: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Last name</label>
              <input
                placeholder="Last"
                value={newPlayer.lastName}
                onChange={(e) => setNewPlayer((n) => ({ ...n, lastName: e.target.value }))}
              />
            </div>
            <div style={{ width: 90 }}>
              <label style={A.fieldLabel}>Jersey #</label>
              <input
                type="number" min="1" max="99" placeholder="#"
                value={newPlayer.jersey}
                onChange={(e) => setNewPlayer((n) => ({ ...n, jersey: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button
              onClick={handleAdd}
              disabled={adding || !newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey}
              style={A.saveBtn}
            >
              {adding ? 'Adding…' : 'Add Player'}
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
                <button
                  onClick={() => onRemovePlayer(p.id)}
                  style={{ ...A.iconBtn, color: 'var(--red-txt)' }}
                  title="Remove"
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
