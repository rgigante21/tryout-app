import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';

const CRITERIA = [
  { key: 'skating',     label: 'Skating',      desc: 'Speed, edges, agility' },
  { key: 'puckSkills',  label: 'Puck Skills',   desc: 'Handling, passing, shooting' },
  { key: 'hockeySense', label: 'Hockey Sense',  desc: 'Reading plays, positioning' },
];

// Format "HH:MM:SS" → "h:MM AM/PM"
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Format "YYYY-MM-DD" → "Mon, Mar 24"
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Score() {
  const { user, logout, handleAuthError } = useAuth();
  const [sessions, setSessions]   = useState([]);
  const [session, setSession]     = useState(null);
  const [pendingErr, setPendingErr] = useState(null); // { opensAt, sessionDate }
  const [players, setPlayers]     = useState([]);
  const [player, setPlayer]       = useState(null);
  const [draft, setDraft]         = useState({});
  const [drafts, setDrafts]       = useState({}); // persists partial work per player
  const [saved, setSaved]         = useState({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  const loadSessions = useCallback(() => {
    api.mySessions()
      .then(setSessions)
      .catch((err) => {
        handleAuthError(err);
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [handleAuthError]);

  useEffect(() => {
    loadSessions();
    // Re-poll every 30 s so pending → active flips automatically
    const t = setInterval(loadSessions, 30_000);
    return () => clearInterval(t);
  }, [loadSessions]);

  const openSession = async (s) => {
    // Optimistically block tap on pending before even hitting the server
    if (s.status === 'pending') {
      setSession(s);
      setPendingErr({ opensAt: s.start_time, sessionDate: s.session_date });
      return;
    }
    setSession(s);
    setPendingErr(null);
    setPlayer(null);
    setDraft({});
    setDrafts({});
    try {
      const data = await api.sessionPlayers(s.id);
      const list = data.players || [];
      setPlayers(list);
      // build saved map from previously submitted scores
      const savedMap = {};
      list.forEach(p => {
        if (p.scored) {
          savedMap[p.id] = {
            skating:     p.skating,
            puckSkills:  p.puck_skills,
            hockeySense: p.hockey_sense,
            complete:    true,
          };
        }
      });
      setSaved(savedMap);
    } catch (err) {
      // Handle race-condition where session flipped back or is still pending
      if (err.code === 'PENDING' || err.message?.includes('not yet open')) {
        setPendingErr({ opensAt: err.opensAt, sessionDate: err.sessionDate });
      }
    }
  };

  const openPlayer = (p) => {
    setPlayer(p);
    const prev      = saved[p.id]  || {};
    const prevDraft = drafts[p.id] || {};
    setDraft({
      skating:     prev.skating     ?? prevDraft.skating     ?? null,
      puckSkills:  prev.puckSkills  ?? prevDraft.puckSkills  ?? null,
      hockeySense: prev.hockeySense ?? prevDraft.hockeySense ?? null,
    });
  };

  // Save current draft and go back to roster
  const goBack = () => {
    setDrafts(prev => ({ ...prev, [player.id]: { ...draft } }));
    setPlayer(null);
  };

  const setPill = (key, val) => setDraft(d => ({ ...d, [key]: val }));

  const allScored = CRITERIA.every(c => draft[c.key] != null);

  const saveScore = async () => {
    if (!allScored) return;
    setSaving(true);
    try {
      await api.submitScore({
        sessionId:   session.id,
        playerId:    player.id,
        skating:     draft.skating,
        puckSkills:  draft.puckSkills,
        hockeySense: draft.hockeySense,
      });
      setSaved(s => ({ ...s, [player.id]: { ...draft, complete: true } }));
      setDrafts(prev => { const n = { ...prev }; delete n[player.id]; return n; });
      setPlayer(null);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const btnState = (p) => {
    if (saved[p.id]?.complete) return 'complete';
    const d = drafts[p.id];
    if (d && CRITERIA.some(c => d[c.key] != null)) return 'partial';
    return 'default';
  };

  const btnStyle = (state) => ({
    ...styles.numBtn,
    ...(state === 'complete' ? styles.numComplete : {}),
    ...(state === 'partial'  ? styles.numPartial  : {}),
  });

  const scored  = Object.values(saved).filter(s => s.complete).length;
  const partial = players.filter(p => {
    if (saved[p.id]?.complete) return false;
    const d = drafts[p.id];
    return d && CRITERIA.some(c => d[c.key] != null);
  }).length;
  const total = players.length;
  const pct   = total ? Math.round(scored / total * 100) : 0;

  // ── Session list view ─────────────────
  if (!session) return (
    <div style={styles.page}>
      <div style={styles.brandBar} />
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <img src="/wyh-logo.jpeg" alt="WYH" style={styles.logoImg} />
          <div>
            <h1 style={styles.h1}>My Sessions</h1>
            <p style={styles.sub}>Welcome, {user?.firstName} {user?.lastName}</p>
          </div>
        </div>
        <button onClick={logout} style={styles.logoutBtn}>Sign out</button>
      </div>

      {loading && <p style={styles.muted}>Loading sessions...</p>}

      {!loading && sessions.length === 0 && (
        <div style={styles.emptyCard}>
          <p style={styles.emptyText}>No sessions assigned yet.</p>
          <p style={styles.muted}>Ask your coordinator to assign you to a session.</p>
        </div>
      )}

      {sessions.map(s => {
        const isPending  = s.status === 'pending';
        const isActive   = s.status === 'active';
        const isComplete = s.status === 'complete';
        const badgeStyle = isComplete ? styles.badgeGreen : isPending ? styles.badgePending : styles.badgeActive;
        const cardExtra  = isActive
          ? { borderColor: 'var(--gold)', borderLeftWidth: 3, background: 'var(--bg2)' }
          : isPending
            ? { opacity: 0.7 }
            : {};
        return (
          <button key={s.id} onClick={() => openSession(s)}
            style={{ ...styles.sessionCard, ...cardExtra }}>
            <div style={styles.sessionTop}>
              <span style={styles.sessionAge}>{s.age_group}</span>
              <span style={{ ...styles.badge, ...badgeStyle }}>
                {isPending ? '🔒 Pending' : isActive ? '● Active' : 'Complete'}
              </span>
            </div>
            <div style={styles.sessionName}>{s.name}</div>
            <div style={styles.sessionMeta}>
              {fmtDate(s.session_date)} · {fmtTime(s.start_time)}
              {isPending
                ? <span style={{ color: 'var(--gold-dark)', marginLeft: 6 }}>Opens 10 min before start</span>
                : <span>{' · '}{s.score_count}/{s.player_count} scored</span>
              }
            </div>
          </button>
        );
      })}
    </div>
  );

  // ── Pending lock screen ───────────────
  if (session && pendingErr) return (
    <div style={styles.page}>
      <div style={styles.brandBar} />
      <button onClick={() => { setSession(null); setPendingErr(null); }} style={styles.backBtn}>
        ← My sessions
      </button>
      <div style={styles.lockCard}>
        <div style={styles.lockIcon}>🔒</div>
        <h2 style={styles.lockTitle}>Session Not Yet Open</h2>
        <p style={styles.lockSub}>{session.name}</p>
        <p style={styles.lockSub}>{session.age_group}</p>
        <div style={styles.lockDetail}>
          <div style={styles.lockRow}>
            <span style={styles.lockLabel}>Date</span>
            <span style={styles.lockValue}>{fmtDate(pendingErr.sessionDate)}</span>
          </div>
          <div style={styles.lockRow}>
            <span style={styles.lockLabel}>Start time</span>
            <span style={styles.lockValue}>{fmtTime(pendingErr.opensAt)}</span>
          </div>
          <div style={styles.lockRow}>
            <span style={styles.lockLabel}>Access opens</span>
            <span style={{ ...styles.lockValue, color: 'var(--gold)' }}>
              10 min before start
            </span>
          </div>
        </div>
        <p style={styles.lockNote}>
          This page refreshes automatically — you'll be notified when scoring opens.
        </p>
      </div>
    </div>
  );

  // ── Player score view ─────────────────
  if (player) {
    const scoredCount = CRITERIA.filter(c => draft[c.key] != null).length;
    const remaining   = CRITERIA.length - scoredCount;
    return (
    <div style={styles.page}>
      <button onClick={goBack} style={styles.backBtn}>
        ← Back to roster
      </button>

      <div style={styles.playerBadge}>
        <div style={styles.playerNum}>#{player.jersey_number}</div>
        <div>
          <div style={styles.playerName}>{player.first_name} {player.last_name}</div>
          <div style={styles.playerMeta}>{session.age_group} · {session.name}</div>
        </div>
      </div>

      <div style={styles.criteriaCard}>
        {CRITERIA.map(c => {
          const isScored = draft[c.key] != null;
          return (
            <div key={c.key} style={{ ...styles.criteriaRow, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <div style={styles.criteriaName}>{c.label}</div>
                {!isScored && (
                  <span style={styles.missingDot}>needed</span>
                )}
              </div>
              <div style={styles.criteriaDesc}>{c.desc}</div>
              <div style={styles.pills}>
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    onClick={() => setPill(c.key, v)}
                    style={{
                      ...styles.pill,
                      ...(draft[c.key] === v ? styles.pillSelected : {})
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!allScored && scoredCount > 0 && (
        <div style={styles.incompleteNote}>
          {remaining} criterion{remaining !== 1 ? 'a' : ''} still needed to save
        </div>
      )}

      <button
        onClick={saveScore}
        disabled={!allScored || saving}
        style={{ ...styles.saveBtn, ...(!allScored ? styles.saveBtnDisabled : {}) }}
      >
        {saving ? 'Saving...' : 'Save Score'}
      </button>
    </div>
  );
  }

  // ── Number grid view ──────────────────
  return (
    <div style={styles.page}>
      <button onClick={() => setSession(null)} style={styles.backBtn}>
        ← My sessions
      </button>
      <div style={styles.sessionHeader}>
        <div>
          <h2 style={styles.h2}>{session.age_group}</h2>
          <p style={styles.sub}>{session.name}</p>
        </div>
      </div>

      <div style={styles.legend}>
        <div style={styles.legendItem}><div style={{ ...styles.dot, background: 'var(--bg3)',     border: '1px solid var(--border)' }} />Not scored</div>
        <div style={styles.legendItem}><div style={{ ...styles.dot, background: 'var(--amber-bg)', border: '1px solid var(--amber)' }} />Incomplete</div>
        <div style={styles.legendItem}><div style={{ ...styles.dot, background: 'var(--green-bg)', border: '1px solid var(--green)' }} />Complete</div>
      </div>

      <div style={styles.progressWrap}>
        <div style={styles.progressLabels}>
          <span>
            {scored} of {total} complete
            {partial > 0 && <span style={{ color: 'var(--amber-txt)', marginLeft: 8 }}>· {partial} incomplete</span>}
          </span>
          <span>{pct}%</span>
        </div>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: pct + '%' }}></div>
        </div>
      </div>

      <div style={styles.grid}>
        {(() => {
          const jerseyCount = {};
          players.forEach(p => {
            jerseyCount[p.jersey_number] = (jerseyCount[p.jersey_number] || 0) + 1;
          });
          const dupeJerseys = new Set(
            Object.entries(jerseyCount)
              .filter(([, count]) => count > 1)
              .map(([num]) => Number(num))
          );

          return players.map(p => {
            const isDupe = dupeJerseys.has(p.jersey_number);
            return (
              <button
                key={p.id}
                onClick={() => openPlayer(p)}
                style={{
                  ...btnStyle(btnState(p)),
                  ...(isDupe ? styles.numBtnDupe : {}),
                }}
              >
                {isDupe ? (
                  <>
                    <span style={styles.numBtnJersey}>{p.jersey_number}</span>
                    <span style={styles.numBtnName}>{p.last_name.slice(0, 4)}</span>
                  </>
                ) : (
                  p.jersey_number
                )}
              </button>
            );
          });
        })()}
      </div>
    </div>
  );
}

const styles = {
  page:      { maxWidth: 480, margin: '0 auto', padding: '16px' },
  brandBar:  { position: 'fixed', top: 0, left: 0, right: 0, height: 4, zIndex: 100, background: 'linear-gradient(90deg, var(--maroon) 0%, var(--gold) 50%, var(--maroon) 100%)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: 10 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  logoImg:   { width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', flexShrink: 0 },
  h1:        { fontSize: '20px', fontWeight: 700, color: 'var(--text)' },
  h2:        { fontSize: '18px', fontWeight: 700, color: 'var(--text)' },
  sub:       { fontSize: '13px', color: 'var(--text2)', marginTop: '2px' },
  muted:     { fontSize: '13px', color: 'var(--text3)', padding: '12px 0' },
  logoutBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text2)', fontSize: '12px', padding: '6px 12px' },
  backBtn:   { background: 'none', border: 'none', color: 'var(--gold)', fontSize: '13px', padding: '0 0 16px 0', display: 'block' },
  emptyCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '32px', textAlign: 'center' },
  emptyText: { fontSize: '15px', color: 'var(--text)', marginBottom: '8px' },

  sessionCard: {
    width: '100%', textAlign: 'left', background: 'var(--bg2)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '14px 16px', marginBottom: '10px', cursor: 'pointer',
  },
  sessionTop:  { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  sessionAge:  { fontSize: '13px', fontWeight: 700, color: 'var(--gold)' },
  sessionName: { fontSize: '15px', fontWeight: 500, color: 'var(--text)', marginBottom: '4px' },
  sessionMeta: { fontSize: '12px', color: 'var(--text3)' },

  badge:      { fontSize: '11px', padding: '2px 8px', borderRadius: '20px' },
  badgeGreen: { background: 'var(--green-bg)', color: 'var(--green-txt)', border: '1px solid var(--green)' },
  badgeBlue:  { background: 'var(--gold-bg)',  color: 'var(--gold-txt)',  border: '1px solid var(--gold-dark)' },

  sessionHeader: { marginBottom: '14px' },
  legend:    { display: 'flex', gap: '16px', marginBottom: '10px' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text2)' },
  dot:       { width: 12, height: 12, borderRadius: 3, flexShrink: 0 },

  progressWrap:   { marginBottom: '14px' },
  progressLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text3)', marginBottom: '5px' },
  progressTrack:  { height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' },
  progressFill:   { height: 4, background: 'var(--maroon-light)', borderRadius: 2, transition: 'width 0.3s' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' },

  numBtn: {
    aspectRatio: '1', minHeight: 54, borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', background: 'var(--bg3)',
    color: 'var(--text)', fontSize: '18px', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  numComplete: { background: 'var(--green-bg)',  border: '1px solid var(--green)',  color: 'var(--green-txt)'  },
  numPartial:  { background: 'var(--amber-bg)',  border: '1px solid var(--amber)',  color: 'var(--amber-txt)'  },
  numBtnDupe:   { flexDirection: 'column', gap: 1 },
  numBtnJersey: { fontSize: '15px', fontWeight: 700, lineHeight: 1 },
  numBtnName:   { fontSize: '9px', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', opacity: 0.8, lineHeight: 1 },

  playerBadge: { background: 'var(--gold-bg)', border: '1px solid var(--gold-dark)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '14px' },
  playerNum:   { fontSize: '40px', fontWeight: 700, color: 'var(--gold)', lineHeight: 1, minWidth: 60 },
  playerName:  { fontSize: '16px', fontWeight: 600, color: 'var(--gold-light)' },
  playerMeta:  { fontSize: '12px', color: 'var(--gold-dark)', marginTop: '2px' },

  criteriaCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '14px' },
  criteriaRow:  { marginBottom: '18px' },
  criteriaName: { fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' },
  criteriaDesc: { fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' },

  pills:       { display: 'flex', gap: '7px' },
  pill:        { flex: 1, padding: '11px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: '16px', fontWeight: 600 },
  pillSelected: { background: 'var(--maroon-bg)', border: '1px solid var(--maroon)', color: '#fff' },

  saveBtn:         { width: '100%', padding: '13px', borderRadius: 'var(--radius)', border: '1px solid var(--maroon-light)', background: 'var(--maroon)', color: '#fff', fontSize: '15px', fontWeight: 700 },
  saveBtnDisabled: { border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text3)', cursor: 'default' },

  badgePending: { background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)' },
  badgeActive:  { background: 'var(--gold-bg)', color: 'var(--gold-txt)', border: '1px solid var(--gold-dark)' },

  // Pending lock screen
  lockCard:   { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '36px 28px', textAlign: 'center', marginTop: 16 },
  lockIcon:   { fontSize: 48, marginBottom: 12 },
  lockTitle:  { fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 },
  lockSub:    { fontSize: 13, color: 'var(--text2)', marginBottom: 2 },
  lockDetail: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', margin: '20px 0', textAlign: 'left' },
  lockRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' },
  lockLabel:  { fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  lockValue:  { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  lockNote:   { fontSize: 12, color: 'var(--text3)', marginTop: 8, lineHeight: 1.6 },

  missingDot:     { fontSize: 10, fontWeight: 700, color: 'var(--amber-txt)', background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: 20, padding: '1px 7px', letterSpacing: '0.03em' },
  incompleteNote: { fontSize: 12, color: 'var(--amber-txt)', background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 10, textAlign: 'center' },
};
