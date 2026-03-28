import { A } from '../styles';

export default function RankingsView({ rankings, activeGroup }) {
  if (rankings.length === 0) {
    return <div style={A.emptyCard}>No scores submitted yet for {activeGroup?.name}.</div>;
  }

  return (
    <div>
      {rankings.map((p, i) => {
        const pct = p.avg_overall ? Math.round((p.avg_overall / 5) * 100) : 0;
        const medalStyle =
          i === 0 ? { background: 'var(--gold-bg)', border: '1px solid var(--gold-dark)', color: 'var(--gold-dark)' } :
          i === 1 ? { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' } :
          i === 2 ? { background: 'var(--amber-bg)', border: '1px solid var(--amber)', color: 'var(--amber-txt)' } :
          { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)' };

        return (
          <div key={p.id} style={A.rankRow}>
            <div style={{ ...A.rankBadge, ...medalStyle }}>{i + 1}</div>
            <span style={A.pJersey}>#{p.jersey_number}</span>
            <span style={{ flex: 1, fontSize: 14, color: 'var(--text2)' }}>{p.first_name} {p.last_name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
                <div>Sk {p.avg_skating ?? '—'}</div>
                <div>Pk {p.avg_puck ?? '—'}</div>
                <div>Se {p.avg_sense ?? '—'}</div>
              </div>
              <div style={{ width: 70, height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: 5, background: 'var(--maroon)', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', minWidth: 32, textAlign: 'right' }}>
                {p.avg_overall ? Number(p.avg_overall).toFixed(1) : '—'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
