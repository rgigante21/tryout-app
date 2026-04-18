import { useCallback, useState, useEffect } from 'react';
import { api } from '../../../utils/api';
import { A } from '../styles';
import { fmt } from '../shared';

const ATTENDANCE_OPTIONS = [
  { value: 'checked_in', label: 'Checked in' },
  { value: 'late_arrival', label: 'Late arrival' },
  { value: 'no_show', label: 'No show' },
  { value: 'excused', label: 'Excused' },
];

export default function CheckInView({ activeEvent, ageGroups }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessions, setSessions] = useState([]);
  const [players, setPlayers] = useState({});
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = useCallback((silent = false) => {
    if (!activeEvent) return;
    if (!silent) setLoading(true);
    api.allSessions(null, activeEvent.id, date)
      .then(async (r) => {
        const list = (r.sessions || []).filter(
          (s) => String(s.session_date).slice(0, 10) === date
        );
        setSessions(list);
        if (list.length) {
          const pairs = await Promise.all(
            list.map((s) =>
              api.sessionPlayers(s.id)
                .then((resp) => [s.id, resp.players || []])
                .catch(() => [s.id, []])
            )
          );
          setPlayers(Object.fromEntries(pairs));
        } else {
          setPlayers({});
        }
        setLastRefresh(new Date());
      })
      .catch(() => { setSessions([]); setPlayers({}); })
      .finally(() => { if (!silent) setLoading(false); });
  }, [activeEvent, date]);

  useEffect(() => {
    loadData(false);
    const timer = setInterval(() => loadData(true), 15_000);
    return () => clearInterval(timer);
  }, [loadData]);

  const updateAttendance = async (sessionId, player, attendanceStatus) => {
    const key = `${sessionId}-${player.id}`;
    setToggling((prev) => new Set([...prev, key]));
    try {
      const checkedIn = attendanceStatus === 'checked_in' || attendanceStatus === 'late_arrival';
      await api.checkin(sessionId, player.id, checkedIn, attendanceStatus || null);
      setPlayers((prev) => ({
        ...prev,
        [sessionId]: (prev[sessionId] || []).map((p) =>
          p.id === player.id ? { ...p, checked_in: checkedIn, attendance_status: attendanceStatus || null } : p
        ),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleToggle = (sessionId, player) => updateAttendance(sessionId, player, player.checked_in ? '' : 'checked_in');

  const tabs = [{ id: 'all', label: 'All' }, ...ageGroups.map((g) => ({ id: String(g.id), label: g.name }))];

  const visibleSessions = activeTab === 'all'
    ? sessions
    : sessions.filter((s) => String(s.age_group_id) === activeTab);

  if (!activeEvent) {
    return (
      <div style={{ ...A.emptyCard, padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text2)' }}>No active event</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>Create or activate an event to use check-in.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Date + filter row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: '1px solid',
                fontSize: 12,
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
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, width: 'auto' }}
        />
        {lastRefresh && (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            Updated {lastRefresh.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 14, fontWeight: 600 }}>
          Loading check-in data…
        </div>
      )}

      {!loading && visibleSessions.length === 0 && (
        <div style={{ ...A.emptyCard, padding: '36px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text2)' }}>No sessions for this date</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
            Try selecting a different date or age group filter.
          </div>
        </div>
      )}

      {!loading && visibleSessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visibleSessions.map((sess) => {
            const sessionPlayers = players[sess.id] || [];
            const checkedCount = sessionPlayers.filter((p) => p.checked_in).length;
            const totalCount = sessionPlayers.length;
            const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

            return (
              <div key={sess.id} style={A.card}>
                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                      {sess.name}
                    </div>
                    {sess.start_time && (
                      <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                        {fmt.time(sess.start_time)}
                      </span>
                    )}
                    {sess.age_group && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                        background: 'var(--maroon-bg)', color: 'var(--maroon)',
                        border: '1px solid #D4A0AC',
                      }}>
                        {sess.age_group}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                    background: checkedCount === totalCount && totalCount > 0 ? 'var(--green-bg)' : 'var(--green-bg)',
                    color: 'var(--green-txt)',
                    border: '1px solid var(--green)',
                  }}>
                    {checkedCount} / {totalCount} checked in
                  </span>
                </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: 6,
                        width: `${pct}%`,
                        background: pct === 100 ? 'var(--green)' : 'var(--maroon)',
                        borderRadius: 4,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                )}

                {/* Player list */}
                {sessionPlayers.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', padding: '8px 0' }}>
                    No players assigned to this session.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sessionPlayers
                      .slice()
                      .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999))
                      .map((player) => {
                        const key = `${sess.id}-${player.id}`;
                        const isToggling = toggling.has(key);
                        return (
                          <div
                            key={player.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: player.checked_in ? 'var(--green-bg)' : 'var(--bg)',
                              border: `1px solid ${player.checked_in ? 'var(--green)' : 'var(--border)'}`,
                              transition: 'background 0.2s, border-color 0.2s',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: player.checked_in ? 'var(--green)' : 'var(--bg3)',
                                color: player.checked_in ? '#FFFFFF' : 'var(--text3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 800, flexShrink: 0,
                              }}>
                                #{player.jersey_number ?? '—'}
                              </span>
                              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                                {player.first_name} {player.last_name}
                              </span>
                            </div>
                            <button
                              onClick={() => handleToggle(sess.id, player)}
                              disabled={isToggling}
                              style={player.checked_in ? {
                                ...A.primaryBtn,
                                background: 'var(--green)',
                                borderColor: 'var(--green)',
                                color: '#FFFFFF',
                                fontSize: 12,
                                padding: '5px 14px',
                                opacity: isToggling ? 0.6 : 1,
                                cursor: isToggling ? 'not-allowed' : 'pointer',
                                minWidth: 110,
                              } : {
                                ...A.ghostBtn,
                                fontSize: 12,
                                padding: '5px 14px',
                                opacity: isToggling ? 0.6 : 1,
                                cursor: isToggling ? 'not-allowed' : 'pointer',
                                minWidth: 110,
                              }}
                            >
                              {isToggling ? '…' : player.checked_in ? '✓ Checked In' : 'Check In'}
                            </button>
                            <select
                              value={player.attendance_status || (player.checked_in ? 'checked_in' : '')}
                              onChange={(e) => updateAttendance(sess.id, player, e.target.value)}
                              disabled={isToggling}
                              style={{ width: 140, minHeight: 30, fontSize: 12 }}
                            >
                              <option value="">Not checked in</option>
                              {ATTENDANCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
