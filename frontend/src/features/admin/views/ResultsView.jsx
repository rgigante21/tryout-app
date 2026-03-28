import { A } from '../styles';
import { CountUp } from '../shared';

export default function ResultsView({ ageGroups, activeEvent, openRankings, groupStats }) {
  if (!activeEvent) {
    return <div style={A.emptyCard}>No active event. Create an event first.</div>;
  }

  const allComplete = ageGroups.every((g) => {
    const stats = groupStats(g.code);
    return stats.total_sessions > 0 && stats.complete_sessions === stats.total_sessions;
  });

  return (
    <div>
      {allComplete ? (
        <div style={{ ...A.card, borderColor: 'var(--green)', background: 'var(--green-bg)', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-txt)' }}>All Tryouts Complete</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
            All age groups have finished their sessions. Final results are shown below.
          </div>
        </div>
      ) : (
        <div style={{ ...A.card, borderColor: 'var(--amber)', background: 'var(--amber-bg)', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber-txt)', marginBottom: 4 }}>Tryouts In Progress</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            Not all age groups have completed their sessions. Results shown below reflect current scores.
          </div>
        </div>
      )}

      <div style={A.ageGroupGrid}>
        {ageGroups.map((g) => {
          const stats = groupStats(g.code);
          const pct = stats.total_sessions > 0
            ? Math.round((stats.complete_sessions / stats.total_sessions) * 100)
            : 0;
          const isDone = stats.total_sessions > 0 && pct === 100;

          return (
            <div
              key={g.id}
              style={{ ...A.agCard, borderColor: isDone ? 'var(--green)' : 'var(--border)' }}
              className="ag-card"
              onClick={() => openRankings(g)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={A.agName}>{g.name}</div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: isDone ? 'var(--green-bg)' : 'var(--gold-bg)',
                  color: isDone ? 'var(--green-txt)' : 'var(--gold-txt)',
                  border: `1px solid ${isDone ? 'var(--green)' : 'var(--gold-dark)'}`,
                }}>
                  {isDone ? 'Complete' : `${pct}%`}
                </span>
              </div>
              <div style={A.agStats}>
                {[
                  { val: stats.total_players, label: 'Players' },
                  { val: stats.total_scores, label: 'Scores' },
                  { val: stats.total_sessions, label: 'Sessions' },
                ].map(({ val, label }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={A.agStatVal}><CountUp end={val} duration={600} /></div>
                    <div style={A.agStatLabel}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={A.progressTrack}>
                <div style={{ ...A.progressFill, width: `${pct}%`, background: isDone ? 'var(--green)' : 'var(--maroon)' }} />
              </div>
              <div style={{ marginTop: 10, textAlign: 'center' }}>
                <span style={A.agLink}>View Rankings →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
