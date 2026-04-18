import { useEffect, useRef, useState } from 'react';
import { api } from '../../../utils/api';
import { A } from '../styles';

// ─────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────

const STATUS_STYLE = {
  ok:      { bg: 'var(--green-bg)',  color: 'var(--green-txt)',  label: 'OK' },
  update:  { bg: 'var(--blue-bg)',   color: 'var(--blue-txt)',   label: 'Update' },
  warning: { bg: 'var(--amber-bg)',  color: 'var(--amber-txt)',  label: 'Warning' },
  error:   { bg: 'var(--red-bg)',    color: 'var(--red-txt)',    label: 'Error' },
  skipped: { bg: 'var(--bg3)',       color: 'var(--text3)',      label: 'Skipped' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.ok;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 700, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────
// DROP ZONE
// ─────────────────────────────────────────

function DropZone({ onUpload, loading, accept = '.csv,.xlsx' }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? 'var(--gold)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '36px 24px',
        textAlign: 'center',
        cursor: loading ? 'default' : 'pointer',
        background: dragging ? 'var(--gold-bg)' : 'var(--bg3)',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); }}
      />
      {loading ? (
        <div style={{ color: 'var(--text2)', fontSize: 14 }}>Processing file...</div>
      ) : (
        <>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Drop a CSV or XLSX file here
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>or click to browse</div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// SUMMARY CARDS
// ─────────────────────────────────────────

function SummaryCards({ summary }) {
  const cards = [
    { label: 'Total rows', value: summary.total ?? 0, color: 'var(--text)' },
    { label: 'Added', value: summary.added ?? summary.valid ?? 0, color: 'var(--green-txt)' },
    { label: 'Updated', value: summary.updated ?? summary.updates ?? 0, color: 'var(--blue-txt)' },
    { label: 'Skipped', value: summary.skipped ?? 0, color: 'var(--text3)' },
    { label: 'Errored', value: summary.errored ?? summary.errors ?? 0, color: 'var(--red-txt)' },
  ];
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      {cards.map(c => (
        <div key={c.label} style={{
          flex: '1 1 90px', minWidth: 90,
          padding: '12px 14px', borderRadius: 10,
          background: 'var(--bg2)', border: '1px solid var(--border)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// PREVIEW TABLE
// ─────────────────────────────────────────

function PreviewTable({ preview, batchId, eventId, onCommit, committing, importType }) {
  const errorCount  = preview.filter(r => r.status === 'error').length;
  const validCount  = preview.filter(r => r.status === 'ok' || r.status === 'update').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          <strong>{preview.length}</strong> rows — <strong style={{ color: 'var(--green-txt)' }}>{validCount}</strong> valid,{' '}
          <strong style={{ color: 'var(--red-txt)' }}>{errorCount}</strong> errors
        </div>
        {errorCount > 0 && (
          <a
            href={api.importBatchErrors(eventId, batchId)}
            style={{ ...A.ghostBtn, fontSize: 12, padding: '4px 10px' }}
          >
            Download error rows
          </a>
        )}
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', position: 'sticky', top: 0 }}>
              <th style={TH}>#</th>
              <th style={TH}>Status</th>
              {importType === 'evaluators'
                ? <><th style={TH}>Email</th><th style={TH}>Name</th></>
                : <><th style={TH}>Jersey</th><th style={TH}>Name</th></>
              }
              {importType === 'players' && <th style={TH}>Session</th>}
              <th style={TH}>Issues</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r, i) => (
              <tr
                key={i}
                style={{
                  background: r.status === 'error' ? 'var(--red-bg)'
                            : r.status === 'update' ? 'var(--blue-bg)'
                            : undefined,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <td style={TD}>{r.rowIndex + 2}</td>
                <td style={TD}><StatusBadge status={r.status} /></td>
                {importType === 'evaluators'
                  ? <>
                      <td style={TD}>{r.email || ''}</td>
                      <td style={TD}>{r.firstName} {r.lastName}</td>
                    </>
                  : <>
                      <td style={TD}>{r.jerseyNumber ?? '—'}</td>
                      <td style={TD}>{r.firstName} {r.lastName}</td>
                    </>
                }
                {importType === 'players' && (
                  <td style={TD}>{r.assignedSession?.name ?? <span style={{ color: 'var(--text3)' }}>No session</span>}</td>
                )}
                <td style={{ ...TD, color: r.errors?.length ? 'var(--red-txt)' : 'var(--amber-txt)', maxWidth: 280 }}>
                  {r.errors?.length
                    ? r.errors.join('; ')
                    : r.warnings?.length
                      ? r.warnings[0]
                      : null
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={onCommit}
        disabled={committing || validCount === 0}
        style={{
          ...A.primaryBtn,
          opacity: (committing || validCount === 0) ? 0.5 : 1,
          cursor: (committing || validCount === 0) ? 'default' : 'pointer',
        }}
      >
        {committing ? 'Committing...' : `Commit ${validCount} valid row${validCount !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

const TH = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const TD = { padding: '7px 12px', verticalAlign: 'middle' };

// ─────────────────────────────────────────
// RESULT BANNER
// ─────────────────────────────────────────

function ResultBanner({ result, onReset }) {
  return (
    <div style={{
      padding: '16px 20px', borderRadius: 10,
      background: result.errors > 0 ? 'var(--amber-bg)' : 'var(--green-bg)',
      border: `1px solid ${result.errors > 0 ? 'var(--amber)' : 'var(--green)'}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <div style={{ fontWeight: 700, color: result.errors > 0 ? 'var(--amber-txt)' : 'var(--green-txt)', marginBottom: 4 }}>
          Import complete
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {result.added} added · {result.updated} updated · {result.errors} errors
        </div>
      </div>
      <button onClick={onReset} style={{ ...A.ghostBtn, fontSize: 12 }}>
        Import another file
      </button>
    </div>
  );
}

// ─────────────────────────────────────────
// IMPORT TAB (reusable for players, evaluators, assignments)
// ─────────────────────────────────────────

function ImportTab({ eventId, importType, ageGroups, label, templateUrl }) {
  const [ageGroupId, setAgeGroupId] = useState('');
  const [uploading, setUploading]   = useState(false);
  const [batchId, setBatchId]       = useState(null);
  const [preview, setPreview]       = useState(null);
  const [summary, setSummary]       = useState(null);
  const [noSessions, setNoSessions] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);

  const needsAgeGroup = importType !== 'evaluators';
  const ready = !needsAgeGroup || ageGroupId;

  const handleUpload = async (file) => {
    if (!ready) { setError('Please select an age group first'); return; }
    setError(null);
    setUploading(true);
    setBatchId(null);
    setPreview(null);
    setSummary(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('importType', importType);
      if (ageGroupId) fd.append('ageGroupId', ageGroupId);

      const data = await api.importUpload(eventId, fd);
      setBatchId(data.batchId);
      setPreview(data.preview);
      setSummary(data.summary);
      setNoSessions(data.noSessionsWarning || null);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    setError(null);
    try {
      const data = await api.importBatchCommit(eventId, batchId);
      setResult(data.summary);
      setPreview(null);
      setBatchId(null);
    } catch (err) {
      setError(err.message || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  const handleReset = () => {
    setPreview(null);
    setSummary(null);
    setBatchId(null);
    setResult(null);
    setError(null);
    setNoSessions(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Import {label} from a CSV or XLSX file
        </div>
        {templateUrl && (
          <a href={templateUrl} style={{ ...A.ghostBtn, fontSize: 12, padding: '4px 10px' }}>
            Download template
          </a>
        )}
      </div>

      {/* Age group selector */}
      {needsAgeGroup && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Age Group
          </label>
          <select
            value={ageGroupId}
            onChange={e => { setAgeGroupId(e.target.value); handleReset(); }}
            style={{ maxWidth: 260 }}
          >
            <option value="">Select age group…</option>
            {ageGroups.map(ag => (
              <option key={ag.id} value={ag.id}>{ag.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red-txt)', borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* No-sessions warning */}
      {noSessions && (
        <div style={{ padding: '10px 14px', background: 'var(--amber-bg)', color: 'var(--amber-txt)', borderRadius: 8, fontSize: 13 }}>
          {noSessions}
        </div>
      )}

      {/* Result banner */}
      {result && <ResultBanner result={result} onReset={handleReset} />}

      {/* Drop zone */}
      {!preview && !result && (
        <DropZone onUpload={handleUpload} loading={uploading} />
      )}

      {/* Preview + summary */}
      {preview && summary && !result && (
        <>
          <SummaryCards summary={summary} />
          <PreviewTable
            preview={preview}
            batchId={batchId}
            eventId={eventId}
            onCommit={handleCommit}
            committing={committing}
            importType={importType}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// EXPORT TAB
// ─────────────────────────────────────────

function ExportTab({ eventId, ageGroups }) {
  const [ageGroupId, setAgeGroupId] = useState('');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [finalizedOnly, setFinalizedOnly] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [preview, setPreview] = useState({ team: null, sportsengine: null });
  const filters = { finalizedOnly, outcome };

  useEffect(() => {
    let ignore = false;
    setPreview({ team: null, sportsengine: null });
    Promise.all([
      api.exportPreview(eventId, 'team-recommendations', ageGroupId || null, filters).catch(() => ({ rowCount: null })),
      api.exportPreview(eventId, 'sportsengine', ageGroupId || null, filters).catch(() => ({ rowCount: null })),
    ]).then(([team, sportsengine]) => {
      if (!ignore) setPreview({ team: team.rowCount, sportsengine: sportsengine.rowCount });
    });
    return () => { ignore = true; };
  }, [eventId, ageGroupId, finalizedOnly, outcome]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Age group filter */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Filter by Age Group (optional)
        </label>
        <select value={ageGroupId} onChange={e => setAgeGroupId(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">All age groups</option>
          {ageGroups.map(ag => (
            <option key={ag.id} value={ag.id}>{ag.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={finalizedOnly}
            onChange={e => setFinalizedOnly(e.target.checked)}
            style={{ width: 'auto', minHeight: 'auto' }}
          />
          Finalized sessions only
        </label>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Outcome
          </label>
          <select value={outcome} onChange={e => setOutcome(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Any outcome</option>
            <option value="moved_up">Moved up</option>
            <option value="retained">Retained</option>
            <option value="left_program">Left program</option>
          </select>
        </div>
      </div>

      {/* Export: Team Recommendations */}
      <div style={{
        padding: '20px', borderRadius: 12,
        border: '1px solid var(--border)', background: 'var(--bg2)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Team Recommendations</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
          Tryout results with scores, averages, and outcomes. {preview.team === null ? 'Counting rows...' : `${preview.team} rows match these filters.`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={e => setIncludeNotes(e.target.checked)}
              style={{ width: 'auto', minHeight: 'auto' }}
            />
            Include scorer notes
          </label>
          <a
            href={api.exportTeamRecs(eventId, ageGroupId || null, includeNotes, filters)}
            style={A.primaryBtn}
          >
            Download CSV
          </a>
        </div>
      </div>

      {/* Export: SportsEngine */}
      <div style={{
        padding: '20px', borderRadius: 12,
        border: '1px solid var(--border)', background: 'var(--bg2)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>SportsEngine Roster</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
          SportsEngine roster exchange with profile ID, player details, jersey, position, and shot hand. {preview.sportsengine === null ? 'Counting rows...' : `${preview.sportsengine} rows match these filters.`}
        </div>
        <a
          href={api.exportSportsEngine(eventId, ageGroupId || null, filters)}
          style={A.primaryBtn}
        >
          Download CSV
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// IMPORT HISTORY PANEL
// ─────────────────────────────────────────

function ImportHistoryPanel({ eventId }) {
  const [open, setOpen]       = useState(false);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (history) return;
    setLoading(true);
    try {
      const data = await api.importHistory(eventId);
      setHistory(data.history || []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const TYPE_LABEL = { players: 'Players', evaluators: 'Evaluators', session_assignments: 'Assignments' };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
      <button
        onClick={handleOpen}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text2)', padding: 0 }}
      >
        <span style={{ fontSize: 10, display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
        Import History
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {loading && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading...</div>}
          {history && history.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>No imports yet for this tryout.</div>
          )}
          {history && history.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg3)' }}>
                    {['Date', 'Type', 'File', 'Added', 'Updated', 'Errors', 'By', 'Status', ''].map(h => (
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={TD}>{new Date(row.created_at).toLocaleDateString()}</td>
                      <td style={TD}>{TYPE_LABEL[row.import_type] || row.import_type}</td>
                      <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.file_name || '—'}</td>
                      <td style={{ ...TD, color: 'var(--green-txt)' }}>{row.added_count}</td>
                      <td style={{ ...TD, color: 'var(--blue-txt)'  }}>{row.updated_count}</td>
                      <td style={{ ...TD, color: row.error_count > 0 ? 'var(--red-txt)' : undefined }}>{row.error_count}</td>
                      <td style={TD}>{row.first_name ? `${row.first_name} ${row.last_name}` : '—'}</td>
                      <td style={TD}>
                        <StatusBadge status={row.status === 'committed' ? 'ok' : row.status === 'preview' ? 'warning' : 'error'} />
                      </td>
                      <td style={TD}>
                        {row.error_count > 0 && row.status === 'committed' && (
                          <a href={api.importBatchErrors(row.event_id, row.id)} style={{ fontSize: 11, color: 'var(--maroon)', textDecoration: 'underline' }}>
                            Errors CSV
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN VIEW
// ─────────────────────────────────────────

const TABS = [
  { id: 'players',     label: 'Import Players' },
  { id: 'evaluators',  label: 'Import Evaluators' },
  { id: 'assignments', label: 'Import Assignments' },
  { id: 'export',      label: 'Export' },
];

export default function ImportExportView({ activeEvent, ageGroups }) {
  const [activeTab, setActiveTab] = useState('players');

  if (!activeEvent) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⇅</div>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Select a tryout to import or export</div>
        <div style={{ fontSize: 13 }}>Use Tryout Setup to create or activate a tryout first.</div>
      </div>
    );
  }

  const eventId = activeEvent.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--maroon)' : '2px solid transparent',
              marginBottom: -2,
              padding: '8px 16px',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--maroon)' : 'var(--text3)',
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'inherit',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: 'var(--bg2)', borderRadius: 14, border: '1px solid var(--border)', padding: 24 }}>
        {activeTab === 'players' && (
          <ImportTab
            key={`players-${eventId}`}
            eventId={eventId}
            importType="players"
            ageGroups={ageGroups}
            label="players"
            templateUrl={api.importPlayersTemplate(eventId)}
          />
        )}
        {activeTab === 'evaluators' && (
          <ImportTab
            key={`evaluators-${eventId}`}
            eventId={eventId}
            importType="evaluators"
            ageGroups={ageGroups}
            label="evaluators"
            templateUrl={api.importEvaluatorsTemplate(eventId)}
          />
        )}
        {activeTab === 'assignments' && (
          <ImportTab
            key={`assignments-${eventId}`}
            eventId={eventId}
            importType="session_assignments"
            ageGroups={ageGroups}
            label="session assignments"
            templateUrl={api.importAssignmentsTemplate(eventId)}
          />
        )}
        {activeTab === 'export' && (
          <ExportTab eventId={eventId} ageGroups={ageGroups} />
        )}
      </div>

      {/* Import history (lazy, collapsible) */}
      {activeTab !== 'export' && (
        <div style={{ marginTop: 24 }}>
          <ImportHistoryPanel eventId={eventId} />
        </div>
      )}
    </div>
  );
}
