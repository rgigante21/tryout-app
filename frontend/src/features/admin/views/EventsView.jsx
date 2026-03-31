import { A } from '../styles';
import { fmt } from '../shared';

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
  restoreEvent,
}) {
  const hasAnything = activeEvent || events.filter((e) => e.archived).length > 0;

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

      {activeEvent && (
        <>
          <div style={A.sectionLabel}>Active Event</div>
          <div style={{ ...A.card, borderColor: 'var(--gold-dark)', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{activeEvent.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                  {activeEvent.season} · {fmt.date(activeEvent.start_date)} → {fmt.date(activeEvent.end_date)}
                </div>
              </div>
              <button onClick={() => archiveEvent(activeEvent.id)} style={{ ...A.ghostBtn, borderColor: 'var(--red)', color: 'var(--red-txt)' }}>
                Archive
              </button>
            </div>
          </div>
        </>
      )}

      {showCreateEvent && (
        <div style={A.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>New Event</div>
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

      {events.filter((e) => e.archived).length > 0 && (
        <>
          <div style={{ ...A.sectionLabel, marginTop: 20 }}>Archived Events</div>
          {events.filter((e) => e.archived).map((ev) => (
            <div key={ev.id} style={{ ...A.card, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{ev.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
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
