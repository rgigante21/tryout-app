import { A } from '../styles';

export default function ResultsView({ ageGroups, activeEvent, groupStats }) {
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

      <div style={A.emptyCard}>
        Select an age group from the sidebar to view rankings.
      </div>
    </div>
  );
}
