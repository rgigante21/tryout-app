import { A } from '../../admin/styles';
import { fmt } from '../../admin/shared';

const ATTENDANCE_OPTIONS = [
  { value: 'checked_in', label: 'Checked in' },
  { value: 'late_arrival', label: 'Late arrival' },
  { value: 'no_show', label: 'No show' },
  { value: 'excused', label: 'Excused' },
];

export default function CheckInTab({ sessions, playersBySessionId, loading, onToggle, toggling }) {
  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 14, fontWeight: 600 }}>
        Loading check-in data…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={{ ...A.emptyCard, padding: '36px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>📋</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text2)' }}>No sessions yet</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
          Create sessions in the Evaluations tab to enable check-in.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sessions.map((sess) => {
        const sessionPlayers = playersBySessionId[sess.id] || [];
        const checkedCount = sessionPlayers.filter((p) => p.checked_in).length;
        const totalCount = sessionPlayers.length;
        const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

        return (
          <div key={sess.id} style={A.card}>
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
                {sess.session_date && (
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {fmt.date(sess.session_date)}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                background: 'var(--green-bg)', color: 'var(--green-txt)', border: '1px solid var(--green)',
              }}>
                {checkedCount} / {totalCount} checked in
              </span>
            </div>

            {totalCount > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: 6, width: `${pct}%`,
                    background: pct === 100 ? 'var(--green)' : 'var(--maroon)',
                    borderRadius: 4, transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            )}

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
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', borderRadius: 8,
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
                          onClick={() => onToggle(sess.id, player)}
                          disabled={isToggling}
                          style={player.checked_in ? {
                            ...A.primaryBtn,
                            background: 'var(--green)', borderColor: 'var(--green)', color: '#FFFFFF',
                            fontSize: 12, padding: '5px 14px',
                            opacity: isToggling ? 0.6 : 1,
                            cursor: isToggling ? 'not-allowed' : 'pointer',
                            minWidth: 110,
                          } : {
                            ...A.ghostBtn,
                            fontSize: 12, padding: '5px 14px',
                            opacity: isToggling ? 0.6 : 1,
                            cursor: isToggling ? 'not-allowed' : 'pointer',
                            minWidth: 110,
                          }}
                        >
                          {isToggling ? '…' : player.checked_in ? '✓ Checked In' : 'Check In'}
                        </button>
                        <select
                          value={player.attendance_status || (player.checked_in ? 'checked_in' : '')}
                          onChange={(e) => onToggle(sess.id, player, e.target.value)}
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
  );
}
