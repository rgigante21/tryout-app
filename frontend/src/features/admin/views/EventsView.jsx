import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { A } from '../styles';
import { fmt, STATUS_META, BlockWizardPanel } from '../shared';
import { api } from '../../../utils/api';

const TODAY = new Date().toISOString().slice(0, 10);

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const COLOR_PALETTE = [
  { label: 'Maroon', color: '#6B1E2E' },
  { label: 'Navy', color: '#1E3A5F' },
  { label: 'Forest', color: '#1A4D2E' },
  { label: 'Slate', color: '#3D4F6B' },
  { label: 'Burnt Orange', color: '#B5451B' },
  { label: 'Purple', color: '#4A1D6E' },
];

function buildCalendarCells(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(42).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells[firstDay + d - 1] = d;
  }
  return cells;
}

function EventCalendar({
  viewedEvent,
  allSessions,
  selectedDate,
  setSelectedDate,
  calYear,
  calMonth,
  setCalYear,
  setCalMonth,
}) {
  const cells = buildCalendarCells(calYear, calMonth);

  const sessionsByDate = {};
  allSessions.forEach((session) => {
    const date = String(session.session_date).slice(0, 10);
    if (!sessionsByDate[date]) sessionsByDate[date] = [];
    sessionsByDate[date].push(session);
  });

  const eventStart = viewedEvent?.start_date ? String(viewedEvent.start_date).slice(0, 10) : null;
  const eventEnd = viewedEvent?.end_date ? String(viewedEvent.end_date).slice(0, 10) : null;

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else { setCalMonth((m) => m - 1); }
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else { setCalMonth((m) => m + 1); }
  };

  return (
    <div>
      <div style={A.eventCalendarToolbar}>
        <button onClick={prevMonth} style={{ ...A.ghostBtn, minWidth: 42, padding: 0, fontSize: 14 }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={A.eventMiniLabel}>Calendar</div>
          <div style={A.eventCalendarMonth}>{MONTH_NAMES[calMonth]} {calYear}</div>
        </div>
        <button onClick={nextMonth} style={{ ...A.ghostBtn, minWidth: 42, padding: 0, fontSize: 14 }}>›</button>
      </div>

      <div className="events-calendar-grid events-calendar-head">
        {DAY_HEADERS.map((h) => (
          <div key={h} style={A.eventCalendarHeadCell}>{h}</div>
        ))}
      </div>

      <div className="events-calendar-grid" style={A.eventCalendarGrid}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} style={A.eventCalendarBlankCell} />;
          const dateStr = toDateStr(calYear, calMonth, day);
          const daySessions = sessionsByDate[dateStr] || [];
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === TODAY;
          const inRange = eventStart && eventEnd ? (dateStr >= eventStart && dateStr <= eventEnd) : true;
          const skillsCount = daySessions.filter((s) => s.session_type !== 'game').length;
          const gamesCount = daySessions.filter((s) => s.session_type === 'game').length;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              style={{
                ...A.eventCalendarCell,
                background: isSelected ? 'rgba(107,30,46,0.12)' : isToday ? 'rgba(90,141,238,0.12)' : 'rgba(255,255,255,0.88)',
                borderColor: isSelected ? 'var(--maroon)' : isToday ? 'rgba(90,141,238,0.45)' : 'rgba(213,206,196,0.7)',
                opacity: inRange ? 1 : 0.38,
                boxShadow: isSelected ? '0 14px 26px rgba(107,30,46,0.16)' : 'none',
              }}
            >
              <div style={{ ...A.eventCalendarDayNumber, color: isSelected ? 'var(--maroon)' : isToday ? 'var(--blue-txt)' : 'var(--text)' }}>
                {day}
              </div>
              <div style={A.eventCalendarBadges}>
                {skillsCount > 0 && (
                  <span style={{ ...A.eventCalendarBadge, background: 'var(--blue-bg)', color: 'var(--blue-txt)', borderColor: 'rgba(90,141,238,0.28)' }}>
                    Skills{skillsCount > 1 ? ` ×${skillsCount}` : ''}
                  </span>
                )}
                {gamesCount > 0 && (
                  <span style={{ ...A.eventCalendarBadge, background: 'var(--amber-bg)', color: 'var(--amber-txt)', borderColor: 'rgba(231,180,76,0.38)' }}>
                    Games{gamesCount > 1 ? ` ×${gamesCount}` : ''}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayPanel({
  selectedDate,
  allSessions,
  isArchivedView,
  showBlockWizard,
  setShowBlockWizard,
  setBlockWizardDate,
  removeSession,
  updateStatus,
}) {
  if (!selectedDate) {
    return (
      <div style={A.eventDetailEmpty}>
        <div style={A.eventEmptyIcon}>◌</div>
        <div style={A.eventEmptyTitle}>Pick a day</div>
        <div style={A.eventEmptyCopy}>
          Select a date from the calendar to review the session plan
          {isArchivedView ? ' for this archived tryout.' : ' or add a new block.'}
        </div>
      </div>
    );
  }

  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const daySessions = allSessions.filter((s) => String(s.session_date).slice(0, 10) === selectedDate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ ...A.eventDetailHeader, alignItems: 'center' }}>
        <div>
          <div style={A.eventMiniLabel}>Day Plan</div>
          <div style={A.eventDetailTitle}>{dateLabel}</div>
          <div style={A.eventDetailMeta}>
            {daySessions.length === 0 ? 'No sessions scheduled' : `${daySessions.length} session${daySessions.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        {!isArchivedView && (
          <button
            onClick={() => {
              setBlockWizardDate(selectedDate);
              setShowBlockWizard(true);
            }}
            style={{ ...A.primaryBtn, fontSize: 12, minHeight: 36, padding: '0 14px' }}
          >
            + Add Block
          </button>
        )}
      </div>

      {daySessions.length === 0 ? (
        <div style={A.eventDetailEmptyState}>
          {isArchivedView ? 'No sessions were scheduled on this date.' : 'No sessions on this date yet. Click "+ Add Block" to schedule one.'}
        </div>
      ) : (
        <div style={A.eventDaySessionList}>
          {daySessions.map((session) => {
            const sm = STATUS_META[session.status] || STATUS_META.pending;
            const isGame = session.session_type === 'game';
            return (
              <div key={session.id} style={A.eventDaySessionCard}>
                <div style={A.eventDaySessionBadges}>
                  <span style={{
                    ...A.eventDaySessionBadge,
                    background: isGame ? 'var(--amber-bg)' : 'var(--blue-bg)',
                    color: isGame ? 'var(--amber-txt)' : 'var(--blue-txt)',
                    borderColor: isGame ? 'rgba(231,180,76,0.34)' : 'rgba(90,141,238,0.28)',
                  }}>
                    {isGame ? 'Game' : 'Skills'}
                  </span>
                  {session.age_group && <span style={A.eventDaySessionBadgeMuted}>{session.age_group}</span>}
                  <span style={{
                    ...A.eventDaySessionBadge,
                    marginLeft: 'auto',
                    background: sm.bg,
                    color: sm.textColor,
                    borderColor: sm.border,
                  }}>
                    {sm.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={A.eventDaySessionTitle}>{session.name}</div>
                    <div style={A.eventDaySessionMeta}>
                      {session.start_time ? fmt.time(session.start_time) : 'No time set'}
                      {' · '}<strong>{session.player_count || 0}</strong> players
                      {session.last_name_start && session.last_name_end ? ` · ${session.last_name_start}–${session.last_name_end}` : ''}
                      {session.home_team && session.away_team ? ` · T${session.home_team} vs T${session.away_team}` : ''}
                    </div>
                  </div>
                  {!isArchivedView && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <select
                        value={session.status}
                        onChange={(e) => updateStatus(session.id, e.target.value)}
                        style={{ ...A.statusSelect, fontSize: 11, minHeight: 30, padding: '0 24px 0 8px', background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}` }}
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="complete">Complete</option>
                        <option value="scoring_complete">Scoring Complete</option>
                        <option value="finalized">Finalized</option>
                      </select>
                      <button
                        onClick={() => removeSession(session.id)}
                        style={{ ...A.iconBtn, width: 28, height: 28, color: 'var(--red-txt)', fontSize: 14, flexShrink: 0 }}
                        title="Delete session"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ viewedEvent, isArchivedView, orgAccentColor, onUpdateOrgColor, archiveEvent, restoreEvent }) {
  const [customColor, setCustomColor] = useState(orgAccentColor || '#6B1E2E');
  const [savingColor, setSavingColor] = useState(false);
  const [colorMsg, setColorMsg] = useState('');

  const handleSwatch = async (color) => {
    setSavingColor(true);
    setColorMsg('');
    try {
      await onUpdateOrgColor(color);
      setCustomColor(color);
      setColorMsg('Color updated.');
      setTimeout(() => setColorMsg(''), 2000);
    } catch {
      setColorMsg('Failed to save color.');
    } finally {
      setSavingColor(false);
    }
  };

  const handleCustomColor = async () => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
      setColorMsg('Enter a valid hex color (e.g. #3A1D6E)');
      return;
    }
    await handleSwatch(customColor);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Event details card */}
      <div style={A.setupCard}>
        <div style={A.setupSectionHead}>Event Details</div>
        <div style={A.setupSectionSub}>Core metadata for this tryout window.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ ...A.eventMiniLabel, marginBottom: 4 }}>Name</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{viewedEvent.name}</div>
          </div>
          <div>
            <div style={{ ...A.eventMiniLabel, marginBottom: 4 }}>Season</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{viewedEvent.season}</div>
          </div>
          <div>
            <div style={{ ...A.eventMiniLabel, marginBottom: 4 }}>Start Date</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{fmt.date(viewedEvent.start_date)}</div>
          </div>
          <div>
            <div style={{ ...A.eventMiniLabel, marginBottom: 4 }}>End Date</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{fmt.date(viewedEvent.end_date)}</div>
          </div>
        </div>
      </div>

      {/* Color palette card */}
      {!isArchivedView && (
        <div style={A.setupCard}>
          <div style={A.setupSectionHead}>Organization Color</div>
          <div style={A.setupSectionSub}>
            Choose your primary accent color. This updates the sidebar, topbar, and all highlighted UI elements across the admin panel.
          </div>
          <div style={A.paletteRow}>
            {COLOR_PALETTE.map(({ label, color }) => (
              <button
                key={color}
                title={label}
                disabled={savingColor}
                className={`color-swatch${(orgAccentColor || '#6B1E2E').toLowerCase() === color.toLowerCase() ? ' selected' : ''}`}
                style={{ background: color, color }}
                onClick={() => handleSwatch(color)}
              />
            ))}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
              <div style={{ ...A.eventMiniLabel, marginBottom: 0, whiteSpace: 'nowrap' }}>Custom:</div>
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                style={{ width: 40, height: 34, padding: 2, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: '#fff' }}
              />
              <input
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#6B1E2E"
                style={{ width: 90, fontFamily: 'monospace', fontSize: 13 }}
              />
              <button onClick={handleCustomColor} disabled={savingColor} style={{ ...A.ghostBtn, minHeight: 34, fontSize: 12 }}>
                {savingColor ? 'Saving…' : 'Apply'}
              </button>
            </div>
          </div>
          {colorMsg && (
            <div style={{ marginTop: 10, fontSize: 12, color: colorMsg.startsWith('F') || colorMsg.startsWith('E') ? 'var(--red-txt)' : 'var(--green-txt)', fontWeight: 600 }}>
              {colorMsg}
            </div>
          )}
        </div>
      )}

      {/* Archive controls */}
      {!isArchivedView && (
        <div style={{ ...A.setupCard, borderColor: 'rgba(209,107,91,0.3)' }}>
          <div style={A.setupSectionHead}>Archive Tryout</div>
          <div style={A.setupSectionSub}>
            Archiving preserves all data — scores, sessions, and rosters — in read-only mode. You can restore at any time.
          </div>
          <button
            onClick={() => archiveEvent(viewedEvent.id)}
            style={{ ...A.ghostBtn, borderColor: 'var(--red)', color: 'var(--red-txt)' }}
          >
            Archive This Tryout
          </button>
        </div>
      )}

      {isArchivedView && (
        <div style={{ ...A.setupCard, borderColor: 'var(--green)', background: 'var(--green-bg)' }}>
          <div style={{ ...A.setupSectionHead, color: 'var(--green-txt)' }}>Archived Tryout</div>
          <div style={{ ...A.setupSectionSub, color: 'var(--green-txt)' }}>
            This tryout is archived and in read-only mode. Restore it to re-enable editing.
          </div>
          <button onClick={() => restoreEvent(viewedEvent.id)} style={A.primaryBtn}>
            Restore Tryout
          </button>
        </div>
      )}
    </div>
  );
}

function RostersTab({ viewedEvent, ageGroups }) {
  const navigate = useNavigate();
  const [selectedGroupId, setSelectedGroupId] = useState(ageGroups[0]?.id ? String(ageGroups[0].id) : '');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ firstName: '', lastName: '', jersey: '', position: 'skater' });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!selectedGroupId || !viewedEvent) return;
    setLoading(true);
    setPlayers([]);
    api.players(parseInt(selectedGroupId, 10), viewedEvent.id)
      .then((r) => setPlayers(r.players || []))
      .catch(() => setMsg({ type: 'error', text: 'Failed to load players.' }))
      .finally(() => setLoading(false));
  }, [selectedGroupId, viewedEvent]);

  const addPlayer = async () => {
    if (!newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey) return;
    setAdding(true);
    setMsg({ type: '', text: '' });
    try {
      const r = await api.addPlayer({
        firstName: newPlayer.firstName,
        lastName: newPlayer.lastName,
        jerseyNumber: parseInt(newPlayer.jersey, 10),
        position: newPlayer.position,
        ageGroupId: parseInt(selectedGroupId, 10),
        eventId: viewedEvent.id,
      });
      setPlayers((prev) => [...prev, r.player].sort((a, b) => a.jersey_number - b.jersey_number));
      setNewPlayer({ firstName: '', lastName: '', jersey: '', position: 'skater' });
      setShowAdd(false);
      setMsg({ type: 'success', text: `${r.player.first_name} ${r.player.last_name} added.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to add player.' });
    } finally {
      setAdding(false);
    }
  };

  const removePlayer = async (playerId, name) => {
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return;
    try {
      await api.deletePlayer(playerId);
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to remove player.' });
    }
  };

  const selectedGroup = ageGroups.find((g) => String(g.id) === selectedGroupId);

  return (
    <div>
      {/* Age group tabs */}
      {ageGroups.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {ageGroups.map((g) => (
            <button
              key={g.id}
              onClick={() => { setSelectedGroupId(String(g.id)); setShowAdd(false); setMsg({ type: '', text: '' }); }}
              style={{
                padding: '7px 16px',
                borderRadius: 999,
                border: '1px solid',
                borderColor: String(g.id) === selectedGroupId ? 'var(--maroon)' : 'var(--border)',
                background: String(g.id) === selectedGroupId ? 'var(--maroon)' : '#fff',
                color: String(g.id) === selectedGroupId ? '#fff' : 'var(--text2)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {!selectedGroupId && (
        <div style={A.rosterEmpty}>Select an age group above to manage its roster.</div>
      )}

      {selectedGroupId && (
        <div style={A.rosterCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={A.setupSectionHead}>{selectedGroup?.name || 'Roster'}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                {loading ? 'Loading…' : `${players.length} player${players.length !== 1 ? 's' : ''}`}
              </div>
            </div>
            <div style={A.rosterActions}>
              <button
                onClick={() => { setShowAdd((v) => !v); setMsg({ type: '', text: '' }); }}
                style={showAdd ? A.ghostBtn : A.primaryBtn}
              >
                {showAdd ? 'Cancel' : '+ Add Player'}
              </button>
              <button
                onClick={() => navigate('/admin/import-export')}
                style={A.ghostBtn}
              >
                Import Players →
              </button>
            </div>
          </div>

          {msg.text && (
            <div style={msg.type === 'success' ? A.successBox : A.errorBox}>{msg.text}</div>
          )}

          {showAdd && (
            <div style={{ background: 'var(--bg3)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--text)' }}>New Player</div>
              <div style={{ ...A.formRow, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={A.fieldLabel}>First name</label>
                  <input
                    placeholder="First"
                    value={newPlayer.firstName}
                    onChange={(e) => setNewPlayer((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={A.fieldLabel}>Last name</label>
                  <input
                    placeholder="Last"
                    value={newPlayer.lastName}
                    onChange={(e) => setNewPlayer((p) => ({ ...p, lastName: e.target.value }))}
                  />
                </div>
                <div style={{ width: 90 }}>
                  <label style={A.fieldLabel}>Jersey #</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="00"
                    value={newPlayer.jersey}
                    onChange={(e) => setNewPlayer((p) => ({ ...p, jersey: e.target.value }))}
                  />
                </div>
                <div style={{ width: 130 }}>
                  <label style={A.fieldLabel}>Position</label>
                  <select
                    value={newPlayer.position}
                    onChange={(e) => setNewPlayer((p) => ({ ...p, position: e.target.value }))}
                    style={A.selectInput}
                  >
                    <option value="skater">Skater</option>
                    <option value="forward">Forward</option>
                    <option value="defense">Defense</option>
                    <option value="goalie">Goalie</option>
                  </select>
                </div>
              </div>
              <button
                onClick={addPlayer}
                disabled={adding || !newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey}
                style={A.saveBtn}
              >
                {adding ? 'Adding…' : 'Add Player'}
              </button>
            </div>
          )}

          {loading && <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text3)', fontSize: 13 }}>Loading players…</div>}

          {!loading && players.length === 0 && (
            <div style={A.rosterEmpty}>
              No players in this age group yet.
              <br />
              Add one above or use Import Players to bulk-upload from a CSV.
            </div>
          )}

          {!loading && players.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="roster-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>Name</th>
                    <th>Position</th>
                    <th>Shot</th>
                    <th style={{ width: 100 }}>Trying Out</th>
                    <th style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--maroon)' }}>
                          {p.jersey_number}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {p.first_name} {p.last_name}
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                        {p.position ? p.position.charAt(0).toUpperCase() + p.position.slice(1) : '—'}
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: 12 }}>{p.shot || '—'}</td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: p.will_tryout === false ? 'var(--red-bg)' : 'var(--green-bg)',
                          color: p.will_tryout === false ? 'var(--red-txt)' : 'var(--green-txt)',
                        }}>
                          {p.will_tryout === false ? 'No' : 'Yes'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => removePlayer(p.id, `${p.first_name} ${p.last_name}`)}
                          style={{ ...A.iconBtn, width: 28, height: 28, color: 'var(--red-txt)', fontSize: 14 }}
                          title="Remove player"
                        >
                          ×
                        </button>
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

export default function EventsView({
  currentEvents = [],
  archivedEvents = [],
  viewedEvent,
  isArchivedView,
  newEvent,
  setNewEvent,
  showCreateEvent,
  createEvent,
  creatingEvent,
  editingEventId,
  archiveEvent,
  eventMsg,
  restoreEvent,
  allSessions = [],
  sessLoading,
  ageGroups = [],
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
  wizardAgeGroupId,
  setWizardAgeGroupId,
  removeSession,
  updateStatus,
  orgAccentColor,
  onUpdateOrgColor,
}) {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule');

  const hasAnything = currentEvents.length > 0 || archivedEvents.length > 0;

  useEffect(() => {
    setSelectedDate(null);
    if (!viewedEvent?.start_date) return;
    const start = new Date(`${String(viewedEvent.start_date).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(start.getTime())) return;
    setCalYear(start.getFullYear());
    setCalMonth(start.getMonth());
  }, [viewedEvent]);

  const setBlockWizardDate = (date) => {
    setBlockWizard((w) => ({ ...w, date }));
  };

  return (
    <div className="events-view-shell">
      {eventMsg.text && (
        <div style={eventMsg.type === 'success' ? A.successBox : A.errorBox}>{eventMsg.text}</div>
      )}

      {!hasAnything && !showCreateEvent && (
        <div style={A.eventsEmptyState}>
          <div style={A.eventsHeroEyebrow}>Tryout Calendar</div>
          <div style={A.eventsEmptyHeadline}>No tryouts on the board yet</div>
          <div style={A.eventsEmptyCopy}>
            Create a tryout to start mapping dates, session blocks, players, and scoring windows.
          </div>
        </div>
      )}

      {showCreateEvent && (
        <div style={A.eventsCreateCard}>
          <div style={A.eventsPanelEyebrow}>
            {editingEventId ? 'Update Tryout Details' : 'Build a New Tryout Window'}
          </div>
          <div style={A.eventsCreateTitle}>
            {editingEventId ? 'Edit Tryout' : 'New Tryout'}
          </div>
          <div style={A.eventsCreateCopy}>
            {editingEventId
              ? 'Fix the tryout name, season, or date range here. Changes update the sticky banner and planning views immediately.'
              : 'Set the season frame first. The planner will use these dates to anchor the calendar immediately.'}
          </div>
          <div style={A.formRow}>
            <div style={{ flex: 2 }}>
              <label style={A.fieldLabel}>Tryout name</label>
              <input
                placeholder="e.g. Fall Tryouts 2027"
                value={newEvent.name}
                onChange={(e) => setNewEvent((ev) => ({ ...ev, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Season</label>
              <input
                placeholder="2026-2027"
                value={newEvent.season}
                onChange={(e) => setNewEvent((ev) => ({ ...ev, season: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ ...A.formRow, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Start date</label>
              <input type="date" value={newEvent.startDate} onChange={(e) => setNewEvent((ev) => ({ ...ev, startDate: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>End date</label>
              <input type="date" value={newEvent.endDate} onChange={(e) => setNewEvent((ev) => ({ ...ev, endDate: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              onClick={createEvent}
              disabled={creatingEvent || !newEvent.name || !newEvent.season || !newEvent.startDate || !newEvent.endDate}
              style={A.saveBtn}
            >
              {creatingEvent ? (editingEventId ? 'Saving…' : 'Creating…') : (editingEventId ? 'Save Changes' : 'Create Tryout')}
            </button>
          </div>
        </div>
      )}

      {viewedEvent && (
        <>
          {isArchivedView && (
            <div style={A.eventsReadOnlyBanner}>
              You are reviewing an archived tryout. Calendar and day plans are visible, but editing is disabled until the tryout is restored.
            </div>
          )}

          {/* ── Tab bar ── */}
          <div className="setup-tabs">
            {[
              { id: 'schedule', label: '◷ Schedule' },
              { id: 'rosters', label: '▤ Rosters' },
              { id: 'overview', label: '⚙ Overview' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`setup-tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Schedule tab ── */}
          {activeTab === 'schedule' && (
            <>
              <div className="events-planner-grid" style={A.eventsPlannerGrid}>
                <section style={A.eventsPlannerCard}>
                  <div style={A.eventsPanelEyebrow}>Master Schedule</div>
                  <div style={A.eventsPanelTitle}>Planning Calendar</div>
                  <div style={A.eventsPanelCopy}>
                    Scan the entire tryout window, then open a day to inspect its sessions.
                  </div>
                  <EventCalendar
                    viewedEvent={viewedEvent}
                    allSessions={allSessions}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    calYear={calYear}
                    calMonth={calMonth}
                    setCalYear={setCalYear}
                    setCalMonth={setCalMonth}
                  />
                  {sessLoading && (
                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
                      Loading sessions…
                    </div>
                  )}
                </section>

                <section style={{ ...A.eventsPlannerCard, minHeight: 420 }}>
                  <div style={A.eventsPanelEyebrow}>{isArchivedView ? 'Historical Detail' : 'Day Breakdown'}</div>
                  <div style={A.eventsPanelTitle}>{isArchivedView ? 'Archived Session Plan' : 'Session Board'}</div>
                  <div style={A.eventsPanelCopy}>
                    {isArchivedView
                      ? 'Review the schedule exactly as it was preserved when the tryout closed.'
                      : 'Open a date to add a block or inspect how the day is stacked.'}
                  </div>
                  <DayPanel
                    selectedDate={selectedDate}
                    allSessions={allSessions}
                    isArchivedView={isArchivedView}
                    showBlockWizard={showBlockWizard}
                    setShowBlockWizard={setShowBlockWizard}
                    setBlockWizardDate={setBlockWizardDate}
                    removeSession={removeSession}
                    updateStatus={updateStatus}
                  />
                </section>
              </div>

              {/* Block wizard — shown below planner when triggered from Day panel */}
              {showBlockWizard && !isArchivedView && (
                <div style={{ marginTop: 16 }}>
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
                    ageGroups={ageGroups}
                    wizardAgeGroupId={wizardAgeGroupId}
                    setWizardAgeGroupId={setWizardAgeGroupId}
                  />
                </div>
              )}
            </>
          )}

          {/* ── Rosters tab ── */}
          {activeTab === 'rosters' && (
            <RostersTab
              viewedEvent={viewedEvent}
              ageGroups={ageGroups}
            />
          )}

          {/* ── Overview tab ── */}
          {activeTab === 'overview' && (
            <OverviewTab
              viewedEvent={viewedEvent}
              isArchivedView={isArchivedView}
              orgAccentColor={orgAccentColor}
              onUpdateOrgColor={onUpdateOrgColor}
              archiveEvent={archiveEvent}
              restoreEvent={restoreEvent}
            />
          )}
        </>
      )}
    </div>
  );
}
