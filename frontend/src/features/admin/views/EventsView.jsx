import { useEffect, useRef, useState } from 'react';
import { A } from '../styles';
import { fmt, STATUS_META } from '../shared';

const TODAY = new Date().toISOString().slice(0, 10);

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function inclusiveDaySpan(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${String(startDate).slice(0, 10)}T12:00:00`);
  const end = new Date(`${String(endDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff >= 0 ? diff + 1 : null;
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

function EventMetric({ label, value, accent = 'gold' }) {
  return (
    <div style={{ ...A.eventMetricCard, borderColor: accent === 'blue' ? 'rgba(90,141,238,0.3)' : 'rgba(240,180,41,0.25)' }}>
      <div style={A.eventMetricLabel}>{label}</div>
      <div style={A.eventMetricValue}>{value}</div>
    </div>
  );
}

function EventArchiveMenu({ archivedEvents, onSelectArchivedEvent }) {
  const menuRef = useRef(null);

  if (!archivedEvents.length) return null;

  return (
    <details ref={menuRef} className="events-archive-menu">
      <summary style={A.eventMenuTrigger}>Archived Tryouts</summary>
      <div style={A.eventMenuPanel}>
        <div style={A.eventMenuTitle}>Past tryouts</div>
        <div style={A.eventMenuHint}>Open an archived tryout in read-only mode.</div>
        <div style={A.eventMenuList}>
          {archivedEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => {
                onSelectArchivedEvent(event.id);
                if (menuRef.current) menuRef.current.open = false;
              }}
              style={A.eventMenuItem}
            >
              <span>
                <span style={A.eventMenuItemTitle}>{event.name}</span>
                <span style={A.eventMenuItemMeta}>
                  {event.season} · Archived {fmt.date(event.archived_at)}
                </span>
              </span>
              <span style={A.eventMenuItemArrow}>↗</span>
            </button>
          ))}
        </div>
      </div>
    </details>
  );
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
    if (calMonth === 0) {
      setCalYear((year) => year - 1);
      setCalMonth(11);
    } else {
      setCalMonth((month) => month - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalYear((year) => year + 1);
      setCalMonth(0);
    } else {
      setCalMonth((month) => month + 1);
    }
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
        {DAY_HEADERS.map((header) => (
          <div key={header} style={A.eventCalendarHeadCell}>
            {header}
          </div>
        ))}
      </div>

      <div className="events-calendar-grid" style={A.eventCalendarGrid}>
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={idx} style={A.eventCalendarBlankCell} />;
          }

          const dateStr = toDateStr(calYear, calMonth, day);
          const daySessions = sessionsByDate[dateStr] || [];
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === TODAY;
          const inRange = eventStart && eventEnd ? (dateStr >= eventStart && dateStr <= eventEnd) : true;
          const skillsCount = daySessions.filter((session) => session.session_type !== 'game').length;
          const gamesCount = daySessions.filter((session) => session.session_type === 'game').length;

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
              <div style={{
                ...A.eventCalendarDayNumber,
                color: isSelected ? 'var(--maroon)' : isToday ? 'var(--blue-txt)' : 'var(--text)',
              }}>
                {day}
              </div>
              <div style={A.eventCalendarBadges}>
                {skillsCount > 0 && (
                  <span style={{ ...A.eventCalendarBadge, background: 'var(--blue-bg)', color: 'var(--blue-txt)', borderColor: 'rgba(90,141,238,0.28)' }}>
                    Skills {skillsCount > 1 ? `×${skillsCount}` : ''}
                  </span>
                )}
                {gamesCount > 0 && (
                  <span style={{ ...A.eventCalendarBadge, background: 'var(--amber-bg)', color: 'var(--amber-txt)', borderColor: 'rgba(231,180,76,0.38)' }}>
                    Games {gamesCount > 1 ? `×${gamesCount}` : ''}
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

function DayDetail({ selectedDate, allSessions, readOnly }) {
  if (!selectedDate) {
    return (
      <div style={A.eventDetailEmpty}>
        <div style={A.eventEmptyIcon}>◌</div>
        <div style={A.eventEmptyTitle}>Pick a day</div>
        <div style={A.eventEmptyCopy}>
          Select a date from the calendar to review the session plan{readOnly ? ' for this archived tryout.' : ' or add a new block.'}
        </div>
      </div>
    );
  }

  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const daySessions = allSessions.filter((session) => String(session.session_date).slice(0, 10) === selectedDate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={A.eventDetailHeader}>
        <div>
          <div style={A.eventMiniLabel}>Day Plan</div>
          <div style={A.eventDetailTitle}>{dateLabel}</div>
          <div style={A.eventDetailMeta}>
            {daySessions.length === 0 ? 'No sessions scheduled' : `${daySessions.length} session${daySessions.length > 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {daySessions.length === 0 ? (
        <div style={A.eventDetailEmptyState}>
          {readOnly ? 'No sessions were scheduled on this date.' : 'No sessions on this date yet.'}
        </div>
      ) : (
        <div style={A.eventDaySessionList}>
          {daySessions.map((session) => {
            const statusMeta = STATUS_META[session.status] || STATUS_META.pending;
            const isGame = session.session_type === 'game';
            return (
              <div key={session.id} style={A.eventDaySessionCard}>
                <div style={A.eventDaySessionBadges}>
                  <span
                    style={{
                      ...A.eventDaySessionBadge,
                      background: isGame ? 'var(--amber-bg)' : 'var(--blue-bg)',
                      color: isGame ? 'var(--amber-txt)' : 'var(--blue-txt)',
                      borderColor: isGame ? 'rgba(231,180,76,0.34)' : 'rgba(90,141,238,0.28)',
                    }}
                  >
                    {isGame ? 'Game' : 'Skills'}
                  </span>
                  {session.age_group && <span style={A.eventDaySessionBadgeMuted}>{session.age_group}</span>}
                  <span
                    style={{
                      ...A.eventDaySessionBadge,
                      marginLeft: 'auto',
                      background: statusMeta.bg,
                      color: statusMeta.textColor,
                      borderColor: statusMeta.border,
                    }}
                  >
                    {statusMeta.label}
                  </span>
                </div>
                <div style={A.eventDaySessionTitle}>{session.name}</div>
                <div style={A.eventDaySessionMeta}>
                  {session.start_time ? fmt.time(session.start_time) : 'No time set'}
                  {' · '}<strong>{session.player_count || 0}</strong> players
                  {session.last_name_start && session.last_name_end ? ` · ${session.last_name_start}–${session.last_name_end}` : ''}
                  {session.home_team && session.away_team ? ` · T${session.home_team} vs T${session.away_team}` : ''}
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
  currentEvents = [],
  archivedEvents = [],
  activeEvent,
  viewedEvent,
  isArchivedView,
  newEvent,
  setNewEvent,
  showCreateEvent,
  createEvent,
  creatingEvent,
  archiveEvent,
  eventMsg,
  selectCurrentEvent,
  selectArchivedEvent,
  returnToCurrentEvent,
  restoreEvent,
  allSessions = [],
  sessLoading,
}) {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  const hasAnything = currentEvents.length > 0 || archivedEvents.length > 0;
  const uniqueSessionDates = [...new Set(allSessions.map((session) => String(session.session_date).slice(0, 10)))];
  const skillsCount = allSessions.filter((session) => session.session_type !== 'game').length;
  const gamesCount = allSessions.filter((session) => session.session_type === 'game').length;
  const spanDays = inclusiveDaySpan(viewedEvent?.start_date, viewedEvent?.end_date);

  useEffect(() => {
    setSelectedDate(null);
    if (!viewedEvent?.start_date) return;
    const start = new Date(`${String(viewedEvent.start_date).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(start.getTime())) return;
    setCalYear(start.getFullYear());
    setCalMonth(start.getMonth());
  }, [viewedEvent]);

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
          <div style={A.eventsPanelEyebrow}>Build a New Tryout Window</div>
          <div style={A.eventsCreateTitle}>New Tryout</div>
          <div style={A.eventsCreateCopy}>Set the season frame first. The planner will use these dates to anchor the calendar immediately.</div>
          <div style={A.formRow}>
            <div style={{ flex: 2 }}>
              <label style={A.fieldLabel}>Tryout name</label>
              <input
                placeholder="e.g. Fall Tryouts 2027"
                value={newEvent.name}
                onChange={(e) => setNewEvent((event) => ({ ...event, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Season</label>
              <input
                placeholder="2026-2027"
                value={newEvent.season}
                onChange={(e) => setNewEvent((event) => ({ ...event, season: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ ...A.formRow, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Start date</label>
              <input
                type="date"
                value={newEvent.startDate}
                onChange={(e) => setNewEvent((event) => ({ ...event, startDate: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>End date</label>
              <input
                type="date"
                value={newEvent.endDate}
                onChange={(e) => setNewEvent((event) => ({ ...event, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              onClick={createEvent}
              disabled={creatingEvent || !newEvent.name || !newEvent.season || !newEvent.startDate || !newEvent.endDate}
              style={A.saveBtn}
            >
              {creatingEvent ? 'Creating…' : 'Create Tryout'}
            </button>
          </div>
        </div>
      )}

      {viewedEvent && (
        <>
          <section style={A.eventsHero}>
            <div style={A.eventsHeroBackdrop} />
            <div style={A.eventsHeroMain}>
              <div style={A.eventsHeroHeaderRow}>
                <div>
                  <div style={A.eventsHeroEyebrow}>{isArchivedView ? 'Archived Tryout Review' : 'Current Tryout Window'}</div>
                  <div style={A.eventsHeroTitleRow}>
                    <h3 style={A.eventsHeroTitle}>{viewedEvent.name}</h3>
                  </div>
                  <div style={A.eventsHeroMeta}>
                    <span>{viewedEvent.season}</span>
                    <span>·</span>
                    <span>{fmt.date(viewedEvent.start_date)} to {fmt.date(viewedEvent.end_date)}</span>
                    {isArchivedView && viewedEvent.archived_at && (
                      <>
                        <span>·</span>
                        <span>Archived {fmt.date(viewedEvent.archived_at)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={A.eventsHeroControls}>
                  {currentEvents.length > 1 && (
                    <label style={A.eventsControlGroup}>
                      <span style={A.eventsControlLabel}>Current tryout</span>
                      <select
                        value={activeEvent ? String(activeEvent.id) : ''}
                        onChange={(e) => selectCurrentEvent(e.target.value)}
                        style={{ ...A.toolbarSelect, minWidth: 220 }}
                      >
                        {currentEvents.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.name} ({event.season})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <EventArchiveMenu archivedEvents={archivedEvents} onSelectArchivedEvent={selectArchivedEvent} />

                  {isArchivedView && activeEvent && (
                    <button onClick={returnToCurrentEvent} style={A.ghostBtn}>
                      Return to Current
                    </button>
                  )}

                  {isArchivedView ? (
                    <button onClick={() => restoreEvent(viewedEvent.id)} style={A.primaryBtn}>
                      Restore Tryout
                    </button>
                  ) : (
                    <button onClick={() => archiveEvent(viewedEvent.id)} style={{ ...A.ghostBtn, borderColor: 'var(--red)', color: 'var(--red-txt)' }}>
                      Archive Tryout
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {isArchivedView && (
            <div style={A.eventsReadOnlyBanner}>
              You are reviewing an archived tryout. Calendar and day plans are visible, but schedule editing and new block creation are disabled until the tryout is restored.
            </div>
          )}

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
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>Loading sessions…</div>
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
              <DayDetail
                selectedDate={selectedDate}
                allSessions={allSessions}
                readOnly={isArchivedView}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
