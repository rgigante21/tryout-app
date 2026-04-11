import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { A } from '../admin/styles';
import { api } from '../../utils/api';
import { useWorkspaceData } from './useWorkspaceData';
import CheckInTab from './tabs/CheckInTab';
import RostersTab from './tabs/RostersTab';
import EvaluationsTab from './tabs/EvaluationsTab';
import ResultsTab from './tabs/ResultsTab';

const TABS = [
  { id: 'checkin', label: 'Check-In' },
  { id: 'rosters', label: 'Rosters' },
  { id: 'evaluations', label: 'Evaluations' },
  { id: 'results', label: 'Results' },
];

export default function WorkspacePage({ eventId, ageGroupId, ageGroups, events }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'checkin';

  const ageGroup = ageGroups.find((g) => String(g.id) === String(ageGroupId)) || null;
  const event = events.find((e) => String(e.id) === String(eventId)) || null;

  const {
    sessions,
    players,
    checkInPlayers,
    rankings,
    loading,
    toggling,
    handleToggleCheckIn,
    handleAddPlayer,
    handleRemovePlayer,
    handleUpdateSessionStatus,
    handleRemoveSession,
    handleSaveSession,
    refreshAll,
  } = useWorkspaceData(eventId, ageGroupId);

  // Import state lives here, managed by RostersTab callbacks
  const [importCsvText, setImportCsvText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importRunning, setImportRunning] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importMsg, setImportMsg] = useState('');

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImportMsg('');
    const text = await file.text();
    setImportCsvText(text);
    try {
      setImportRunning(true);
      const r = await api.importPreview({ csvText: text, eventId: parseInt(eventId, 10), ageGroupId: parseInt(ageGroupId, 10) });
      setImportPreview(r.preview);
      setImportSummary(r.summary);
    } catch (err) {
      setImportMsg(err.message || 'Failed to parse CSV');
    } finally {
      setImportRunning(false);
    }
  };

  const commitImport = async () => {
    if (!importCsvText) return;
    setImportRunning(true);
    setImportResult(null);
    try {
      const r = await api.importCommit({ csvText: importCsvText, eventId: parseInt(eventId, 10), ageGroupId: parseInt(ageGroupId, 10) });
      setImportResult(r);
      setImportCsvText('');
      setImportPreview(null);
      setImportSummary(null);
      refreshAll();
    } catch (err) {
      setImportMsg(err.message || 'Import failed');
    } finally {
      setImportRunning(false);
    }
  };

  const clearImport = () => {
    setImportCsvText('');
    setImportPreview(null);
    setImportSummary(null);
    setImportResult(null);
    setImportMsg('');
  };

  const switchTab = (tabId) => {
    navigate({ search: `?tab=${tabId}` }, { replace: true });
  };

  // Stats
  const totalCheckedIn = Object.values(checkInPlayers).reduce(
    (sum, list) => sum + list.filter((p) => p.checked_in).length,
    0
  );
  const totalCheckInSlots = Object.values(checkInPlayers).reduce((sum, list) => sum + list.length, 0);

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
        <span
          onClick={() => navigate('/admin/groups')}
          style={{ cursor: 'pointer', color: 'var(--maroon)', fontWeight: 600 }}
        >
          Age Groups
        </span>
        {event && (
          <>
            <span style={{ margin: '0 6px' }}>›</span>
            <span>{event.name}</span>
          </>
        )}
        {ageGroup && (
          <>
            <span style={{ margin: '0 6px' }}>›</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{ageGroup.name}</span>
          </>
        )}
      </div>

      {/* Stats row */}
      {!loading && (
        <div style={{ ...A.statStrip, marginBottom: 20 }}>
          {[
            { label: 'Players', value: players.length },
            { label: 'Sessions', value: sessions.length },
            { label: 'Checked In', value: `${totalCheckedIn}/${totalCheckInSlots}` },
          ].map(({ label, value }) => (
            <div key={label} style={A.statTile}>
              <div style={A.statTileValue}>{value}</div>
              <div style={A.statTileLabel}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            style={{
              padding: '7px 18px',
              borderRadius: 20,
              border: '1px solid',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === tab.id ? 'var(--maroon)' : 'var(--bg2)',
              color: activeTab === tab.id ? '#FFFFFF' : 'var(--text2)',
              borderColor: activeTab === tab.id ? 'var(--maroon)' : 'var(--border)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — use display:none to preserve state on switch */}
      <div style={{ display: activeTab === 'checkin' ? 'block' : 'none' }}>
        <CheckInTab
          sessions={sessions}
          playersBySessionId={checkInPlayers}
          loading={loading}
          onToggle={handleToggleCheckIn}
          toggling={toggling}
        />
      </div>

      <div style={{ display: activeTab === 'rosters' ? 'block' : 'none' }}>
        <RostersTab
          players={players}
          onAddPlayer={handleAddPlayer}
          onRemovePlayer={handleRemovePlayer}
          onImportFile={handleImportFile}
          importPreview={importPreview}
          importSummary={importSummary}
          importRunning={importRunning}
          importResult={importResult}
          importMsg={importMsg}
          onCommitImport={commitImport}
          onClearImport={clearImport}
        />
      </div>

      <div style={{ display: activeTab === 'evaluations' ? 'block' : 'none' }}>
        <EvaluationsTab
          sessions={sessions}
          eventId={eventId}
          ageGroupId={ageGroupId}
          onUpdateStatus={handleUpdateSessionStatus}
          onRemoveSession={handleRemoveSession}
          onSaveSession={handleSaveSession}
          onBlockCreated={refreshAll}
        />
      </div>

      <div style={{ display: activeTab === 'results' ? 'block' : 'none' }}>
        <ResultsTab rankings={rankings} ageGroup={ageGroup} />
      </div>
    </div>
  );
}
