import { useEffect, useState } from 'react';
import { A } from '../styles';
import { fmt, BlockWizardPanel, STATUS_META } from '../shared';

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

function buildCalendarCells(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(42).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells[firstDay + d - 1] = d;
  }
  return cells;
}

function EventCalendar({ activeEvent, allSessions, selectedDate, setSelectedDate, calYear, calMonth, setCalYear, setCalMonth }) {
  const cells = buildCalendarCells(calYear, calMonth);

  const sessionsByDate = {};
  allSessions.forEach((s) => {
    const d = String(s.session_date).slice(0, 10);
    if (!sessionsByDate[d]) sessionsByDate[d] = [];
    sessionsByDate[d].push(s);
  });

  const eventStart = activeEvent?.start_date ? String(activeEvent.start_date).slice(0, 10) : null;
  const eventEnd = activeEvent?.end_date ? String(activeEvent.end_date).slice(0, 10) : null;

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ ...A.ghostBtn, minWidth: 40, padding: 0, fontSize: 14 }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 2 }}>
            Calendar
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
          {MONTH_NAMES[calMonth]} {calYear}
          </div>
        </div>
        <button onClick={nextMonth} style={{ ...A.ghostBtn, minWidth: 40, padding: 0, fontSize: 14 }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
        {DAY_HEADERS.map((h) => (
          <div key={h} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', padding: '7px 0', background: 'var(--bg3)' }}>
            {h}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--border)' }}>
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={idx} style={{ background: 'var(--bg3)', minHeight: 72 }} />;
          }
          const dateStr = toDateStr(calYear, calMonth, day);
          const daySessions = sessionsByDate[dateStr] || [];
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === TODAY;
          const inRange = eventStart && eventEnd ? (dateStr >= eventStart && dateStr <= eventEnd) : true;

          const skillsCount = daySessions.filter((s) => s.session_type !== 'game').length;
          const gamesCount = daySessions.filter((s) => s.session_type === 'game').length;

          return (
            <div
              key={idx}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              style={{
                background: isSelected ? 'var(--maroon-bg)' : isToday ? 'var(--blue-bg)' : 'var(--bg)',
                minHeight: 78,
                padding: 8,
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--maroon)' : '2px solid transparent',
                position: 'relative',
                opacity: inRange ? 1 : 0.45,
              }}
            >
              <div style={{
                fontSize: 12,
                fontWeight: isToday ? 700 : 500,
                color: isSelected ? 'var(--maroon-txt)' : isToday ? 'var(--blue-txt)' : 'var(--text)',
                marginBottom: 4,
              }}>
                {day}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {skillsCount > 0 && (
                  <span style={{
                    fontSize: 10, borderRadius: 8, padding: '1px 5px',
                    background: 'var(--blue-bg)', color: 'var(--blue-txt)',
                    border: '1px solid var(--blue)', fontWeight: 600,
                  }}>
                    🏒{skillsCount > 1 ? ` ×${skillsCount}` : ''}
                  </span>
                )}
                {gamesCount > 0 && (
                  <span style={{
                    fontSize: 10, borderRadius: 8, padding: '1px 5px',
                    background: 'var(--amber-bg)', color: 'var(--amber-txt)',
                    border: '1px solid var(--amber)', fontWeight: 600,
                  }}>
                    🥅{gamesCount > 1 ? ` ×${gamesCount}` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayDetail({ selectedDate, allSessions, onAddBlock }) {
  if (!selectedDate) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '32px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>📅</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 200 }}>
          Select a date to view sessions
        </div>
      </div>
    );
  }

  const [y, m, d] = selectedDate.split('-');
  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const daySessions = allSessions.filter((s) => String(s.session_date).slice(0, 10) === selectedDate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>
            Day Plan
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{dateLabel}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {daySessions.length === 0 ? 'No sessions' : `${daySessions.length} session${daySessions.length > 1 ? 's' : ''}`}
          </div>
        </div>
        <button onClick={() => onAddBlock(selectedDate)} style={A.primaryBtn}>
          + Session Block
        </button>
      </div>

      {daySessions.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '16px 0' }}>
          No sessions on this date.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          {daySessions.map((sess) => {
            const sm = STATUS_META[sess.status] || STATUS_META.pending;
            const isGame = sess.session_type === 'game';
            return (
              <div key={sess.id} style={{ ...A.card, padding: '14px 16px', marginBottom: 0 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{
                    fontSize: 11, borderRadius: 6, padding: '2px 7px', fontWeight: 600,
                    background: isGame ? 'var(--amber-bg)' : 'var(--blue-bg)',
                    color: isGame ? 'var(--amber-txt)' : 'var(--blue-txt)',
                    border: `1px solid ${isGame ? 'var(--amber)' : 'var(--blue)'}`,
                  }}>
                    {isGame ? '🥅 Game' : '🏒 Skills'}
                  </span>
                  {sess.age_group && (
                    <span style={{ fontSize: 11, borderRadius: 6, padding: '2px 7px', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', fontWeight: 600 }}>
                      {sess.age_group}
                    </span>
                  )}
                  <span style={{ fontSize: 11, borderRadius: 6, padding: '2px 7px', background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}`, fontWeight: 600, marginLeft: 'auto' }}>
                    {sm.label}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{sess.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                  {sess.start_time ? fmt.time(sess.start_time) : 'No time set'}
                  {' · '}<strong>{sess.player_count || 0}</strong> players
                  {sess.last_name_start && sess.last_name_end ? ` · ${sess.last_name_start}–${sess.last_name_end}` : ''}
                  {sess.home_team && sess.away_team ? ` · T${sess.home_team} vs T${sess.away_team}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EventsView({
  events,
  activeEvent,
  newEvent,
  setNewEvent,
  showCreateEvent,
  createEvent,
  creatingEvent,
  archiveEvent,
  eventStats,
  viewingEventId,
  loadEventStats,
  eventMsg,
  setSelectedEventId,
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
}) {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  const currentEvents = events.filter((e) => !e.archived);
  const archivedEvents = events.filter((e) => e.archived);
  const hasAnything = currentEvents.length > 0 || archivedEvents.length > 0;

  const handleAddBlock = (date) => {
    setBlockWizard((w) => ({ ...w, date }));
    setShowBlockWizard(true);
  };

  useEffect(() => {
    setSelectedDate(null);
    if (!activeEvent?.start_date) return;
    const start = new Date(`${String(activeEvent.start_date).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(start.getTime())) return;
    setCalYear(start.getFullYear());
    setCalMonth(start.getMonth());
  }, [activeEvent]);

  return (
    <div>
      {eventMsg.text && (
        <div style={eventMsg.type === 'success' ? A.successBox : A.errorBox}>{eventMsg.text}</div>
      )}

      {!hasAnything && !showCreateEvent && (
        <div style={{ textAlign: 'center', padding: '64px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>No events yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 320, margin: '0 auto' }}>
            Events organize your tryout season. Create one to start adding age groups, sessions, and players.
          </div>
        </div>
      )}

      {showCreateEvent && (
        <div style={{ ...A.card, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, color: 'var(--text)' }}>New Event</div>
          <div style={A.formRow}>
            <div style={{ flex: 2 }}>
              <label style={A.fieldLabel}>Event name</label>
              <input placeholder="e.g. Fall Tryouts 2027" value={newEvent.name} onChange={(e) => setNewEvent((n) => ({ ...n, name: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Season</label>
              <input placeholder="2026-2027" value={newEvent.season} onChange={(e) => setNewEvent((n) => ({ ...n, season: e.target.value }))} />
            </div>
          </div>
          <div style={{ ...A.formRow, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Start date</label>
              <input type="date" value={newEvent.startDate} onChange={(e) => setNewEvent((n) => ({ ...n, startDate: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>End date</label>
              <input type="date" value={newEvent.endDate} onChange={(e) => setNewEvent((n) => ({ ...n, endDate: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={createEvent} disabled={creatingEvent || !newEvent.name || !newEvent.season || !newEvent.startDate || !newEvent.endDate} style={A.saveBtn}>
              {creatingEvent ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </div>
      )}

      {currentEvents.length > 0 && (
        <>
          <div style={{ ...A.sectionLabel, marginBottom: 10 }}>Current Events</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {currentEvents.map((ev) => {
              const isSelected = activeEvent?.id === ev.id;
              return (
                <div
                  key={ev.id}
                  style={{
                    ...A.card,
                    marginBottom: 0,
                    borderColor: isSelected ? 'var(--gold-dark)' : 'var(--border)',
                    background: isSelected ? 'var(--gold-bg)' : '#fff',
                    padding: '16px 18px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        {isSelected && (
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold-txt)' }}>
                            Selected
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{ev.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
                        {ev.season} · {fmt.date(ev.start_date)} → {fmt.date(ev.end_date)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
                      {!isSelected && (
                        <button onClick={() => setSelectedEventId(String(ev.id))} style={A.primaryBtn}>
                          Open
                        </button>
                      )}
                      <button onClick={() => archiveEvent(ev.id)} style={{ ...A.ghostBtn, borderColor: 'var(--red)', color: 'var(--red-txt)' }}>
                        Archive
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeEvent && (
        <>
          <div style={{ ...A.card, borderColor: 'var(--gold-dark)', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>Planning Calendar</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{activeEvent.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
                  {activeEvent.season} · {fmt.date(activeEvent.start_date)} → {fmt.date(activeEvent.end_date)}
                </div>
              </div>
              <button onClick={() => archiveEvent(activeEvent.id)} style={{ ...A.ghostBtn, borderColor: 'var(--red)', color: 'var(--red-txt)' }}>
                Archive
              </button>
            </div>
          </div>

          {/* Calendar + day detail */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
            <div style={{ ...A.card, marginBottom: 0, padding: 14 }}>
              <EventCalendar
                activeEvent={activeEvent}
                allSessions={allSessions}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                calYear={calYear}
                calMonth={calMonth}
                setCalYear={setCalYear}
                setCalMonth={setCalMonth}
              />
              {sessLoading && (
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Loading sessions…</div>
              )}
            </div>

            <div style={{ ...A.card, marginBottom: 0, minHeight: 340, padding: 16 }}>
              <DayDetail
                selectedDate={selectedDate}
                allSessions={allSessions}
                onAddBlock={handleAddBlock}
              />
            </div>
          </div>

          {/* Block wizard — opens below calendar when triggered */}
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
              ageGroups={ageGroups}
              wizardAgeGroupId={wizardAgeGroupId}
              setWizardAgeGroupId={setWizardAgeGroupId}
            />
          )}
        </>
      )}

      {archivedEvents.length > 0 && (
        <>
          <div style={{ ...A.sectionLabel, marginTop: 20 }}>Archived Events</div>
          {archivedEvents.map((ev) => (
            <div key={ev.id} style={{ ...A.card, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{ev.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>
                    {ev.season} · Archived {fmt.date(ev.archived_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => loadEventStats(ev.id)} style={A.primaryBtn}>
                    {viewingEventId === ev.id ? 'Hide Stats' : 'View Stats'}
                  </button>
                  <button onClick={() => restoreEvent(ev.id)} style={A.ghostBtn}>Restore</button>
                </div>
              </div>
              {viewingEventId === ev.id && eventStats && eventStats.event?.id === ev.id && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
                    {[
                      { label: 'Players', val: eventStats.totalPlayers },
                      { label: 'Sessions', val: eventStats.totalSessions },
                      { label: 'Scores', val: eventStats.totalScores },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>{val}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
