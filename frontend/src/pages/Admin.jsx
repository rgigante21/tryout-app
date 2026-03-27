import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';

/* ═══════════════════════════════════════════════════════
   COUNT-UP ANIMATION
═══════════════════════════════════════════════════════ */
function CountUp({ end, duration = 800, prefix = '', suffix = '' }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current && end === 0) return;
    startedRef.current = true;
    if (end === 0) { setValue(0); return; }
    const start = 0;
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (end - start) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [end, duration]);

  return <>{prefix}{value.toLocaleString()}{suffix}</>;
}

/* ═══════════════════════════════════════════════════════
   SHARED HELPERS
═══════════════════════════════════════════════════════ */
const fmt = {
  date: (d) => {
    if (!d) return '';
    const [y, m, day] = String(d).slice(0, 10).split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m) - 1]} ${parseInt(day)}, ${y}`;
  },
  time: (t) => {
    if (!t) return '';
    const [h, m] = String(t).slice(0, 5).split(':');
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  },
  dateMed: (d) => {
    if (!d) return '';
    return new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  },
};

const STATUS_META = {
  pending:  { dot: '#aaa',            label: 'Pending',  textColor: 'var(--text3)',     bg: 'var(--bg3)',      border: 'var(--border)' },
  active:   { dot: 'var(--gold)',     label: 'Active',   textColor: 'var(--amber-txt)', bg: 'var(--amber-bg)', border: 'var(--amber)' },
  complete: { dot: 'var(--green)',    label: 'Complete', textColor: 'var(--green-txt)', bg: 'var(--green-bg)', border: 'var(--green)' },
};

/* ═══════════════════════════════════════════════════════
   SIDEBAR NAV
═══════════════════════════════════════════════════════ */
const NAV_ITEMS = [
  { id: 'overview',  label: 'Dashboard',   icon: '◆', section: 'overview' },
  { id: 'events',    label: 'Events',      icon: '◷', section: 'tryouts' },
  { id: 'sessions',  label: 'Sessions',    icon: '≡', section: 'tryouts' },
  { id: 'group',     label: 'Age Groups',  icon: '▤', section: 'tryouts' },
  { id: 'results',   label: 'Results',     icon: '★', section: 'tryouts' },
  { id: 'coaches',   label: 'Coaches',     icon: '◯', section: 'people' },
];

function Sidebar({ view, setView, user, logout }) {
  return (
    <div style={SB.sidebar}>
      {/* Logo */}
      <div style={SB.logoBlock}>
        <img src="/wyh-logo.jpeg" alt="WYH" style={SB.logoImg} />
        <div>
          <div style={SB.logoName}>WYH Admin</div>
          <div style={SB.logoSub}>Weymouth Youth Hockey</div>
        </div>
      </div>

      {/* Nav sections */}
      {['overview', 'tryouts', 'people'].map(section => {
        const items = NAV_ITEMS.filter(n => n.section === section);
        return (
          <div key={section}>
            {section !== 'overview' && (
              <div style={SB.sectionLabel}>
                {section === 'tryouts' ? 'Tryouts' : 'People'}
              </div>
            )}
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                style={{
                  ...SB.navBtn,
                  ...(view === item.id || (view === 'group' && item.id === 'group')
                    ? SB.navBtnActive : {}),
                }}
              >
                <span style={SB.navIcon}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* User footer */}
      <div style={SB.userBlock}>
        <div style={SB.avatar}>
          {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={SB.userName}>{user?.firstName} {user?.lastName}</div>
          <div style={SB.userRole}>{user?.role}</div>
        </div>
        <button onClick={logout} style={SB.signOutBtn} title="Sign out">↩</button>
      </div>
    </div>
  );
}

const SB = {
  sidebar: {
    width: 230,
    flexShrink: 0,
    background: '#4A1320',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  },
  logoBlock: {
    padding: '20px 16px 18px',
    display: 'flex', alignItems: 'center', gap: 12,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  logoImg:   { width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', flexShrink: 0 },
  logoName:  { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: '#F0B429', letterSpacing: '0.05em' },
  logoSub:   { fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', marginTop: 2 },
  sectionLabel: {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em',
    color: 'rgba(255,255,255,0.3)', padding: '16px 16px 6px',
  },
  navBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: 'calc(100% - 20px)', margin: '2px 10px',
    padding: '10px 12px',
    background: 'none', border: 'none', borderRadius: 8,
    color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer', textAlign: 'left',
    transition: 'background 0.12s, color 0.12s',
  },
  navBtnActive: {
    background: 'rgba(240,180,41,0.15)', color: '#F0B429',
  },
  navIcon: { width: 18, textAlign: 'center', fontSize: 14, flexShrink: 0, color: '#F0B429' },
  userBlock: {
    padding: '14px 14px 18px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', alignItems: 'center', gap: 8,
    marginTop: 8,
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    background: '#F0B429', color: '#4A1320',
    fontSize: 11, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  userName:  { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole:  { fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize' },
  signOutBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 },
};

/* ═══════════════════════════════════════════════════════
   MAIN ADMIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function Admin() {
  const { user, logout } = useAuth();

  const [ageGroups, setAgeGroups] = useState([]);
  const [events,    setEvents]    = useState([]);
  const [users,     setUsers]     = useState([]);
  const [dashboard, setDashboard] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const [view,        setView]        = useState('overview');
  const [activeGroup, setActiveGroup] = useState(null);

  /* Today's sessions (dashboard) */
  const [todayDate, setTodayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [todaySessions, setTodaySessions] = useState([]);
  const [todayLoading, setTodayLoading] = useState(false);

  /* Sessions view state */
  const [allSessions,     setAllSessions]     = useState([]);
  const [sessDateFilter,  setSessDateFilter]  = useState('all');
  const [sessLoading,     setSessLoading]     = useState(false);
  const [sessionScorers,  setSessionScorers]  = useState({});
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editSession,     setEditSession]     = useState({});
  const [assigningTo,     setAssigningTo]     = useState(null);
  const [assignUserId,    setAssignUserId]    = useState('');
  const [showBlockWizard, setShowBlockWizard] = useState(false);

  /* Block wizard state */
  const [blockWizard, setBlockWizard] = useState(defaultBlock());
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [blockMsg, setBlockMsg] = useState('');

  /* Group view state */
  const [sessions,    setSessions]    = useState([]);
  const [players,     setPlayers]     = useState([]);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAddPlayer,  setShowAddPlayer]  = useState(false);
  const [newSession, setNewSession] = useState({ name: '', date: '', time: '' });
  const [addingSession, setAddingSession] = useState(false);
  const [newPlayer,  setNewPlayer]  = useState({ firstName: '', lastName: '', jersey: '' });
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile]  = useState(null);
  const [importCsvText, setImportCsvText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importRunning, setImportRunning] = useState(false);
  const [importResult,  setImportResult]  = useState(null);
  const [importMsg,     setImportMsg]     = useState('');

  /* Coaches state */
  const [newCoach, setNewCoach]       = useState({ firstName: '', lastName: '', email: '', password: '', role: 'scorer', sessions: new Set() });
  const [addingCoach, setAddingCoach] = useState(false);
  const [coachError,  setCoachError]  = useState('');
  const [coachSuccess,setCoachSuccess]= useState('');
  const [editingCoachId, setEditingCoachId] = useState(null);
  const [editCoach,   setEditCoach]   = useState({});
  const [editCoachSessions, setEditCoachSessions] = useState([]);
  const [allSessionsList,   setAllSessionsList]   = useState([]);
  const [assigningSessionId, setAssigningSessionId] = useState('');
  const [savingCoach, setSavingCoach] = useState(false);
  const [editCoachMsg,setEditCoachMsg]= useState({ type: '', text: '' });
  const [coachViewSessions, setCoachViewSessions] = useState([]);

  /* Events state */
  const [newEvent, setNewEvent] = useState({ name: '', season: '', startDate: '', endDate: '' });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [eventStats, setEventStats] = useState(null);
  const [viewingEventId, setViewingEventId] = useState(null);
  const [eventMsg, setEventMsg] = useState({ type: '', text: '' });

  /* Rankings */
  const [rankings, setRankings] = useState([]);

  /* Age group creation */
  const [showAddAgeGroup, setShowAddAgeGroup] = useState(false);
  const [newAgeGroup, setNewAgeGroup] = useState({ name: '', code: '', sortOrder: '0' });
  const [creatingAgeGroup, setCreatingAgeGroup] = useState(false);

  /* Bulk upload */
  const [bulkText, setBulkText]     = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkResult, setBulkResult]   = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);

  const activeEvent = events.find(e => !e.archived) || null;

  function defaultBlock() {
    return {
      label: '', date: '', blockType: 'skills', splitMethod: 'last_name',
      scoringMode: 'full', playerAssignment: 'random',
      slots: [{ time: '', lastNameStart: 'A', lastNameEnd: 'Z', jerseyMin: '', jerseyMax: '' }],
      teams: [
        { teamNumber: 1, jerseyColor: 'white',  label: 'Team 1' },
        { teamNumber: 2, jerseyColor: 'maroon', label: 'Team 2' },
        { teamNumber: 3, jerseyColor: 'white',  label: 'Team 3' },
        { teamNumber: 4, jerseyColor: 'maroon', label: 'Team 4' },
      ],
      games: [
        { time: '', homeTeam: 1, awayTeam: 2 },
        { time: '', homeTeam: 3, awayTeam: 4 },
      ],
    };
  }

  /* ── Initial load ── */
  useEffect(() => {
    Promise.all([api.ageGroups(), api.events(), api.users(), api.dashboard()])
      .then(([ag, ev, us, dash]) => {
        setAgeGroups(ag.ageGroups);
        setEvents(ev.events);
        setUsers(us.users);
        setDashboard(dash.dashboard);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* ── Load today's sessions (dashboard) ── */
  useEffect(() => {
    if (!activeEvent || view !== 'overview') return;
    setTodayLoading(true);
    api.allSessions(null, activeEvent.id, todayDate)
      .then(r => {
        const list = r.sessions || [];
        setTodaySessions(list.filter(s => String(s.session_date).slice(0, 10) === todayDate));
      })
      .catch(() => setTodaySessions([]))
      .finally(() => setTodayLoading(false));
  }, [activeEvent, todayDate, view]);

  /* ── Load all sessions (sessions panel) ── */
  const loadAllSessions = useCallback(async () => {
    if (!activeEvent) return;
    setSessLoading(true);
    try {
      const r = await api.allSessions(null, activeEvent.id);
      const list = r.sessions || [];
      setAllSessions(list);
      if (list.length) {
        const pairs = await Promise.all(
          list.map(s => api.sessionScorers(s.id).then(r => [s.id, r.scorers]))
        );
        setSessionScorers(Object.fromEntries(pairs));
      }
    } catch (e) { console.error(e); }
    finally { setSessLoading(false); }
  }, [activeEvent]);

  useEffect(() => {
    if (view === 'sessions') loadAllSessions();
  }, [view, loadAllSessions]);

  /* ── Group data ── */
  const loadGroupData = useCallback(async (group, eventId) => {
    const [sessRes, playRes] = await Promise.all([
      api.allSessions(group.id, eventId),
      api.players(group.id, eventId),
    ]);
    const sessionList = sessRes.sessions;
    setSessions(sessionList);
    setPlayers(playRes.players);
    if (sessionList.length) {
      const pairs = await Promise.all(
        sessionList.map(s => api.sessionScorers(s.id).then(r => [s.id, r.scorers]))
      );
      setSessionScorers(Object.fromEntries(pairs));
    } else {
      setSessionScorers({});
    }
  }, []);

  const openGroup = async (group) => {
    setActiveGroup(group);
    setView('group');
    setSessions([]); setPlayers([]); setSessionScorers({});
    setShowAddSession(false); setShowAddPlayer(false); setAssigningTo(null);
    if (activeEvent) await loadGroupData(group, activeEvent.id);
  };

  const openRankings = async (group) => {
    setActiveGroup(group); setView('rankings'); setRankings([]);
    if (activeEvent) {
      const data = await api.rankings(group.id, activeEvent.id);
      setRankings(data.rankings || []);
    }
  };

  const refreshEvents = async () => {
    const ev = await api.events(); setEvents(ev.events);
  };

  /* ── Session CRUD ── */
  const addSession = async () => {
    if (!newSession.name || !newSession.date || !newSession.time || !activeEvent) return;
    setAddingSession(true);
    try {
      const r = await api.createSession({
        eventId: activeEvent.id, ageGroupId: activeGroup.id,
        name: newSession.name, sessionDate: newSession.date, startTime: newSession.time,
      });
      setSessions(s => [...s, r.session]);
      setSessionScorers(ss => ({ ...ss, [r.session.id]: [] }));
      setNewSession({ name: '', date: '', time: '' });
      setShowAddSession(false);
      refreshEvents();
    } catch (err) { alert(err.message); }
    finally { setAddingSession(false); }
  };

  const updateStatus = async (sessionId, status) => {
    try {
      const r = await api.updateSession(sessionId, { status });
      const updater = s => s.map(x => x.id === sessionId ? { ...x, status: r.session.status } : x);
      setSessions(updater);
      setAllSessions(updater);
    } catch (err) { alert(err.message); }
  };

  const removeSession = async (sessionId) => {
    if (!window.confirm('Delete this session and all its scores?')) return;
    try {
      await api.deleteSession(sessionId);
      setSessions(s => s.filter(x => x.id !== sessionId));
      setAllSessions(s => s.filter(x => x.id !== sessionId));
      refreshEvents();
    } catch (err) { alert(err.message); }
  };

  const startEditSession = (sess) => {
    setEditingSessionId(sess.id);
    setEditSession({
      name: sess.name,
      date: sess.session_date ? sess.session_date.slice(0, 10) : '',
      time: sess.start_time ? sess.start_time.slice(0, 5) : '',
      sessionType: sess.session_type || 'skills',
    });
  };

  const saveSessionEdit = async () => {
    if (!editSession.name || !editSession.date) return;
    try {
      const r = await api.updateSession(editingSessionId, {
        name: editSession.name, sessionDate: editSession.date,
        startTime: editSession.time || null, sessionType: editSession.sessionType,
      });
      const updater = s => s.map(x => x.id === editingSessionId ? { ...x, ...r.session } : x);
      setSessions(updater); setAllSessions(updater);
      setEditingSessionId(null); refreshEvents();
    } catch (err) { alert(err.message); }
  };

  /* ── Scorer CRUD ── */
  const assignScorer = async (sessionId) => {
    if (!assignUserId) return;
    try {
      await api.assignScorer(sessionId, parseInt(assignUserId));
      const r = await api.sessionScorers(sessionId);
      setSessionScorers(ss => ({ ...ss, [sessionId]: r.scorers }));
      setAssigningTo(null); setAssignUserId('');
    } catch (err) { alert(err.message); }
  };

  const unassignScorer = async (sessionId, userId) => {
    try {
      await api.unassignScorer(sessionId, userId);
      setSessionScorers(ss => ({ ...ss, [sessionId]: (ss[sessionId] || []).filter(u => u.id !== userId) }));
    } catch (err) { alert(err.message); }
  };

  /* ── Player CRUD ── */
  const addPlayer = async () => {
    if (!newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey || !activeEvent) return;
    setAddingPlayer(true);
    try {
      const r = await api.addPlayer({
        firstName: newPlayer.firstName, lastName: newPlayer.lastName,
        jerseyNumber: parseInt(newPlayer.jersey), ageGroupId: activeGroup.id, eventId: activeEvent.id,
      });
      setPlayers(p => [...p, r.player].sort((a, b) => a.jersey_number - b.jersey_number));
      setNewPlayer({ firstName: '', lastName: '', jersey: '' }); setShowAddPlayer(false);
    } catch (err) { alert(err.message); }
    finally { setAddingPlayer(false); }
  };

  const removePlayer = async (playerId) => {
    if (!window.confirm('Remove this player?')) return;
    try {
      await api.deletePlayer(playerId);
      setPlayers(p => p.filter(x => x.id !== playerId));
    } catch (err) { alert(err.message); }
  };

  /* ── Block wizard ── */
  const updateSlot = (i, field, val) =>
    setBlockWizard(w => ({ ...w, slots: w.slots.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }));
  const addSlot = () =>
    setBlockWizard(w => ({ ...w, slots: [...w.slots, { time: '', lastNameStart: 'A', lastNameEnd: 'Z', jerseyMin: '', jerseyMax: '' }] }));
  const removeSlot = (i) =>
    setBlockWizard(w => ({ ...w, slots: w.slots.filter((_, idx) => idx !== i) }));
  const updateTeam = (i, field, val) =>
    setBlockWizard(w => ({ ...w, teams: w.teams.map((t, idx) => idx === i ? { ...t, [field]: val } : t) }));
  const updateGame = (i, field, val) =>
    setBlockWizard(w => ({ ...w, games: w.games.map((g, idx) => idx === i ? { ...g, [field]: val } : g) }));

  const createBlock = async () => {
    if (!blockWizard.date || !activeEvent) return;
    setCreatingBlock(true); setBlockMsg('');
    try {
      const payload = {
        eventId: activeEvent.id, ageGroupId: activeGroup?.id,
        blockType: blockWizard.blockType, splitMethod: blockWizard.splitMethod,
        label: blockWizard.label || null, sessionDate: blockWizard.date,
        scoringMode: blockWizard.scoringMode,
      };
      if (blockWizard.blockType === 'skills') {
        payload.slots = blockWizard.slots.map(s => ({
          time: s.time || null, lastNameStart: s.lastNameStart || null,
          lastNameEnd: s.lastNameEnd || null,
          jerseyMin: s.jerseyMin ? parseInt(s.jerseyMin) : null,
          jerseyMax: s.jerseyMax ? parseInt(s.jerseyMax) : null,
        }));
      } else {
        payload.teamCount = blockWizard.teams.length;
        payload.teams = blockWizard.teams;
        payload.games = blockWizard.games.map(g => ({ ...g, homeTeam: parseInt(g.homeTeam), awayTeam: parseInt(g.awayTeam) }));
        payload.playerAssignment = blockWizard.playerAssignment;
      }
      const r = await api.createSessionBlock(payload);
      const newSessions = r.sessions || [];
      setSessions(prev => [...prev, ...newSessions]);
      setAllSessions(prev => [...prev, ...newSessions]);
      setShowBlockWizard(false); setBlockMsg(''); setBlockWizard(defaultBlock()); refreshEvents();
    } catch (err) { setBlockMsg(err.message || 'Failed to create block'); }
    finally { setCreatingBlock(false); }
  };

  /* ── Coaches CRUD ── */
  const addCoach = async () => {
    const { firstName, lastName, email, password, role, sessions } = newCoach;
    if (!firstName || !lastName || !email || !password) return;
    setAddingCoach(true); setCoachError(''); setCoachSuccess('');
    try {
      const created = await api.register({ firstName, lastName, email, password, role });
      if (sessions.size > 0)
        await Promise.all([...sessions].map(sid => api.assignScorer(sid, created.user.id)));
      const updated = await api.users(); setUsers(updated.users);
      setNewCoach({ firstName: '', lastName: '', email: '', password: '', role: 'scorer', sessions: new Set() });
      setCoachSuccess(`Account created for ${firstName} ${lastName}.`);
    } catch (err) { setCoachError(err.message); }
    finally { setAddingCoach(false); }
  };

  const openEditCoach = async (u) => {
    if (editingCoachId === u.id) { setEditingCoachId(null); return; }
    setEditingCoachId(u.id);
    setEditCoach({ firstName: u.first_name, lastName: u.last_name, email: u.email, role: u.role, password: '' });
    setEditCoachMsg({ type: '', text: '' });
    const [assigned, all] = await Promise.all([
      api.userSessions(u.id),
      activeEvent ? api.allSessions(null, activeEvent.id) : Promise.resolve({ sessions: [] }),
    ]);
    setEditCoachSessions(assigned.sessions || []);
    setAllSessionsList(all.sessions || []);
    setAssigningSessionId('');
  };

  const saveCoach = async () => {
    setSavingCoach(true); setEditCoachMsg({ type: '', text: '' });
    const payload = {};
    if (editCoach.firstName) payload.firstName = editCoach.firstName;
    if (editCoach.lastName)  payload.lastName  = editCoach.lastName;
    if (editCoach.email)     payload.email     = editCoach.email;
    if (editCoach.role)      payload.role      = editCoach.role;
    if (editCoach.password)  payload.password  = editCoach.password;
    try {
      const r = await api.updateUser(editingCoachId, payload);
      setUsers(us => us.map(u => u.id === editingCoachId ? r.user : u));
      setEditCoach(c => ({ ...c, password: '' }));
      setEditCoachMsg({ type: 'success', text: 'Saved successfully.' });
    } catch (err) { setEditCoachMsg({ type: 'error', text: err.message }); }
    finally { setSavingCoach(false); }
  };

  const unassignCoachSession = async (sessionId) => {
    await api.unassignScorer(sessionId, editingCoachId);
    setEditCoachSessions(s => s.filter(x => x.id !== sessionId));
  };

  const assignSessionToCoach = async () => {
    if (!assigningSessionId) return;
    try {
      await api.assignScorer(parseInt(assigningSessionId), editingCoachId);
      const r = await api.userSessions(editingCoachId);
      setEditCoachSessions(r.sessions || []);
      setAssigningSessionId('');
    } catch (err) { setEditCoachMsg({ type: 'error', text: err.message }); }
  };

  /* ── Events CRUD ── */
  const createEvent = async () => {
    const { name, season, startDate, endDate } = newEvent;
    if (!name || !season || !startDate || !endDate) return;
    setCreatingEvent(true); setEventMsg({ type: '', text: '' });
    try {
      const r = await api.createEvent({ name, season, startDate, endDate });
      const ev = await api.events(); setEvents(ev.events);
      setNewEvent({ name: '', season: '', startDate: '', endDate: '' });
      setShowCreateEvent(false);
      setEventMsg({ type: 'success', text: `"${r.event.name}" created.` });
    } catch (err) { setEventMsg({ type: 'error', text: err.message }); }
    finally { setCreatingEvent(false); }
  };

  const archiveEvent = async (id) => {
    if (!window.confirm('Archive this event? All data is preserved.')) return;
    try {
      await api.archiveEvent(id, true);
      const ev = await api.events(); setEvents(ev.events);
      setEventMsg({ type: 'success', text: 'Event archived.' });
    } catch (err) { setEventMsg({ type: 'error', text: err.message }); }
  };

  const loadEventStats = async (id) => {
    if (viewingEventId === id) { setViewingEventId(null); setEventStats(null); return; }
    setViewingEventId(id); setEventStats(null);
    const data = await api.eventStats(id); setEventStats(data);
  };

  /* ── Block assignment change ── */
  const changeBlockAssignment = async (blockId, data) => {
    await api.updateSessionBlock(blockId, data);
    // Reload sessions to reflect new player counts
    if (activeGroup && activeEvent) {
      await loadGroupData(activeGroup, activeEvent.id);
    }
    if (view === 'sessions') {
      await loadAllSessions();
    }
  };

  /* ── Age group CRUD ── */
  const addAgeGroup = async () => {
    if (!newAgeGroup.name || !newAgeGroup.code) return;
    setCreatingAgeGroup(true);
    try {
      const r = await api.createAgeGroup({
        name: newAgeGroup.name, code: newAgeGroup.code,
        sortOrder: parseInt(newAgeGroup.sortOrder) || 0,
      });
      setAgeGroups(ag => [...ag, r.ageGroup].sort((a, b) => a.sort_order - b.sort_order));
      setNewAgeGroup({ name: '', code: '', sortOrder: '0' });
      setShowAddAgeGroup(false);
    } catch (err) { alert(err.message); }
    finally { setCreatingAgeGroup(false); }
  };

  /* ── CSV import ── */
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file); setImportResult(null); setImportMsg('');
    const text = await file.text(); setImportCsvText(text);
    try {
      setImportRunning(true);
      const r = await api.importPreview({ csvText: text, eventId: activeEvent.id, ageGroupId: activeGroup.id });
      setImportPreview(r.preview); setImportSummary(r.summary);
    } catch (err) { setImportMsg(err.message || 'Failed to parse CSV'); }
    finally { setImportRunning(false); }
  };

  const commitImport = async () => {
    if (!importCsvText || !activeEvent) return;
    setImportRunning(true); setImportResult(null);
    try {
      const r = await api.importCommit({ csvText: importCsvText, eventId: activeEvent.id, ageGroupId: activeGroup.id });
      setImportResult(r);
      if (r.added?.length) setPlayers(p => [...p, ...r.added].sort((a, b) => a.jersey_number - b.jersey_number));
      setImportFile(null); setImportCsvText(''); setImportPreview(null); setImportSummary(null);
    } catch (err) { setImportMsg(err.message || 'Import failed'); }
    finally { setImportRunning(false); }
  };

  const clearImport = () => {
    setImportFile(null); setImportCsvText(''); setImportPreview(null);
    setImportSummary(null); setImportResult(null); setImportMsg('');
  };

  /* ── Bulk upload ── */
  const parseBulkText = (text) => {
    setBulkText(text); setBulkResult(null);
    const lines = text.trim().split('\n').filter(l => l.trim());
    const preview = [];
    for (const line of lines) {
      if (/first\s*name/i.test(line)) continue;
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 3) preview.push({ firstName: parts[0], lastName: parts[1], jerseyNumber: parts[2] });
    }
    setBulkPreview(preview);
  };

  const submitBulk = async () => {
    if (!bulkPreview.length || !activeEvent) return;
    setBulkUploading(true);
    try {
      const r = await api.bulkPlayers({ players: bulkPreview, ageGroupId: activeGroup.id, eventId: activeEvent.id });
      setBulkResult(r);
      if (r.added.length) setPlayers(p => [...p, ...r.added].sort((a, b) => a.jersey_number - b.jersey_number));
      setBulkText(''); setBulkPreview([]);
    } catch (err) { alert(err.message); }
    finally { setBulkUploading(false); }
  };

  /* ── Dashboard helpers ── */
  const groupStats = (code) =>
    dashboard.find(d => d.age_group_code === code) ||
    { total_sessions: 0, complete_sessions: 0, total_players: 0, total_scores: 0 };

  /* ── Filtered sessions (sessions panel) ── */
  const uniqueDates = [...new Set(allSessions.map(s => String(s.session_date).slice(0, 10)))].sort();
  const filteredSessions = sessDateFilter === 'all'
    ? allSessions
    : allSessions.filter(s => String(s.session_date).slice(0, 10) === sessDateFilter);

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="admin-shell" style={A.shell}>
      <style>{ADMIN_CSS}</style>

      <Sidebar view={view} setView={(v) => { setView(v); setShowBlockWizard(false); }} user={user} logout={logout} />

      <div style={A.main}>
        {/* ── Content area ── */}
        <div style={A.contentArea}>

          {loading && <p style={A.muted}>Loading…</p>}

          {/* ════════════════ OVERVIEW ════════════════ */}
          {!loading && view === 'overview' && (
            <>
              <div style={A.pageHdr}>
                <h2 style={A.pageTitle}>Dashboard</h2>
                {activeEvent && <span style={A.eventPill}>{activeEvent.name}</span>}
              </div>
              {/* Metric cards */}
              {(() => {
                const totalPlayers    = dashboard.reduce((s, d) => s + (d.total_players || 0), 0);
                const totalSessions   = dashboard.reduce((s, d) => s + (d.total_sessions || 0), 0);
                const completeSess    = dashboard.reduce((s, d) => s + (d.complete_sessions || 0), 0);
                const totalScores     = dashboard.reduce((s, d) => s + (d.total_scores || 0), 0);
                const activeCoaches   = users.filter(u => u.role === 'scorer' || u.role === 'coordinator').length;
                const pctComplete     = totalSessions > 0 ? Math.round(completeSess / totalSessions * 100) : 0;

                return (
                  <div style={A.metricGrid}>
                    {[
                      { label: 'Total Players',    val: totalPlayers,  accent: '#6B1E2E' },
                      { label: 'Sessions',         val: totalSessions, accent: '#1A4B8B' },
                      { label: 'Scores Entered',   val: totalScores,   accent: '#6B1E2E' },
                      { label: 'Coaches Active',   val: activeCoaches, accent: '#145A3C' },
                    ].map(({ label, val, accent }) => (
                      <div key={label} style={{ ...A.metricCard, borderTop: `3px solid ${accent}` }}>
                        <div style={{ ...A.metricVal, color: accent }}>
                          <CountUp end={val} />
                        </div>
                        <div style={A.metricLabel}>{label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Age group cards */}
              <div style={A.sectionHdr}>
                <span style={A.sectionLabel}>Age Groups</span>
              </div>
              <div style={A.ageGroupGrid}>
                {ageGroups.map(g => {
                  const stats = groupStats(g.code);
                  const pct = stats.total_sessions > 0
                    ? Math.round(stats.complete_sessions / stats.total_sessions * 100) : 0;
                  return (
                    <div key={g.id} style={A.agCard} className="ag-card" onClick={() => openGroup(g)}>
                      <div style={A.agName}>{g.name}</div>
                      <div style={A.agStats}>
                        {[
                          { val: stats.total_players, label: 'Players' },
                          { val: stats.total_sessions, label: 'Sessions' },
                          { val: stats.total_scores, label: 'Scores' },
                        ].map(({ val, label }) => (
                          <div key={label} style={{ textAlign: 'center' }}>
                            <div style={A.agStatVal}><CountUp end={val} duration={600} /></div>
                            <div style={A.agStatLabel}>{label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={A.progressTrack}>
                        <div style={{ ...A.progressFill, width: pct + '%', background: pct === 100 ? 'var(--green)' : 'var(--maroon)' }} />
                      </div>
                      <div style={A.agFooter}>
                        <span style={A.agLink}>Manage →</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: pct === 100 ? '#E3F3EA' : '#FDF6E3',
                          color: pct === 100 ? '#145A3C' : '#6B4D0A',
                          border: `1px solid ${pct === 100 ? 'var(--green)' : 'var(--gold-dark)'}`,
                        }}>
                          {pct === 100 ? 'Complete' : `${stats.complete_sessions}/${stats.total_sessions} Complete`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Today's Sessions */}
              <div style={A.sectionHdr}>
                <span style={A.sectionLabel}>
                  Today — {new Date(todayDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </span>
                <input
                  type="date"
                  value={todayDate}
                  onChange={e => setTodayDate(e.target.value)}
                  style={{ fontSize: 12, padding: '4px 8px', width: 'auto', borderRadius: 6 }}
                />
              </div>
              {todayLoading && <p style={A.muted}>Loading sessions…</p>}
              {!todayLoading && todaySessions.length === 0 && (
                <div style={A.emptyCard}>No sessions scheduled for this date.</div>
              )}
              {!todayLoading && todaySessions.length > 0 && (
                <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: '#4A1320', fontSize: 10, fontWeight: 700, color: '#F7CC6A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: 16 }}>
                    <span style={{ flex: 1 }}>Session</span>
                    <span style={{ width: 90 }}>Group</span>
                    <span style={{ width: 80 }}>Time</span>
                    <span style={{ width: 70 }}>Type</span>
                    <span style={{ width: 120 }}>Scorer</span>
                  </div>
                  {todaySessions.map(sess => (
                    <div key={sess.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--border)', gap: 16 }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sess.name}</span>
                      <span style={{ width: 90, fontSize: 12, color: 'var(--maroon)' }}>{sess.age_group}</span>
                      <span style={{ width: 80, fontSize: 12, color: 'var(--text2)' }}>{fmt.time(sess.start_time)}</span>
                      <span style={{ width: 70 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: sess.session_type === 'game' ? '#FEF6E0' : '#E8F0FE',
                          color: sess.session_type === 'game' ? '#8B6914' : '#1A4B8B',
                          border: `1px solid ${sess.session_type === 'game' ? 'var(--amber)' : 'var(--blue)'}`,
                        }}>
                          {sess.session_type === 'game' ? 'Game' : 'Skills'}
                        </span>
                      </span>
                      <span style={{ width: 120, fontSize: 12, color: 'var(--text3)' }}>—</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════════════════ SESSIONS PANEL ════════════════ */}
          {!loading && view === 'sessions' && (
            <>
              <div style={A.pageHdr}>
                <h2 style={A.pageTitle}>Sessions</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {activeEvent && <span style={A.eventPill}>{activeEvent.name}</span>}
                  <button
                    onClick={() => { setShowBlockWizard(v => !v); }}
                    style={showBlockWizard ? A.ghostBtn : A.primaryBtn}
                  >
                    {showBlockWizard ? 'Cancel' : '+ Session Block'}
                  </button>
                </div>
              </div>
              {/* Block Wizard */}
              {showBlockWizard && (
                <BlockWizardPanel
                  blockWizard={blockWizard}
                  setBlockWizard={setBlockWizard}
                  players={[]}
                  updateSlot={updateSlot} addSlot={addSlot} removeSlot={removeSlot}
                  updateTeam={updateTeam} updateGame={updateGame}
                  createBlock={createBlock} creatingBlock={creatingBlock}
                  blockMsg={blockMsg} onCancel={() => setShowBlockWizard(false)}
                  A={A}
                />
              )}

              {/* Date filter tabs */}
              <div style={A.dateFilterRow}>
                <button
                  onClick={() => setSessDateFilter('all')}
                  style={{ ...A.dateChip, ...(sessDateFilter === 'all' ? A.dateChipActive : {}) }}
                >
                  All Dates
                </button>
                {uniqueDates.map(d => (
                  <button
                    key={d}
                    onClick={() => setSessDateFilter(d)}
                    style={{ ...A.dateChip, ...(sessDateFilter === d ? A.dateChipActive : {}) }}
                  >
                    {fmt.dateMed(d)}
                  </button>
                ))}
              </div>

              {/* Sessions table */}
              {sessLoading && <p style={A.muted}>Loading sessions…</p>}
              {!sessLoading && filteredSessions.length === 0 && (
                <div style={A.emptyCard}>No sessions found. Use <strong>+ Session Block</strong> to create sessions.</div>
              )}
              {!sessLoading && filteredSessions.map(sess => (
                <SessionCard
                  key={sess.id}
                  sess={sess}
                  scorers={sessionScorers[sess.id] || []}
                  users={users}
                  editingSessionId={editingSessionId}
                  editSession={editSession}
                  setEditSession={setEditSession}
                  startEditSession={startEditSession}
                  saveSessionEdit={saveSessionEdit}
                  cancelEdit={() => setEditingSessionId(null)}
                  updateStatus={updateStatus}
                  removeSession={removeSession}
                  assigningTo={assigningTo}
                  setAssigningTo={setAssigningTo}
                  assignUserId={assignUserId}
                  setAssignUserId={setAssignUserId}
                  assignScorer={assignScorer}
                  unassignScorer={unassignScorer}
                  onChangeAssignment={changeBlockAssignment}
                  fmt={fmt}
                  A={A}
                />
              ))}
            </>
          )}

          {/* ════════════════ EVENTS ════════════════ */}
          {!loading && view === 'events' && (
            <>
              <div style={A.pageHdr}>
                <h2 style={A.pageTitle}>Events</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {activeEvent && <span style={A.eventPill}>{activeEvent.name}</span>}
                  <button onClick={() => setShowCreateEvent(v => !v)} style={showCreateEvent ? A.ghostBtn : A.primaryBtn}>
                    {showCreateEvent ? 'Cancel' : '+ New Event'}
                  </button>
                </div>
              </div>
              <EventsPanel
              events={events}
              activeEvent={activeEvent}
              newEvent={newEvent} setNewEvent={setNewEvent}
              showCreateEvent={showCreateEvent}
              createEvent={createEvent} creatingEvent={creatingEvent}
              archiveEvent={archiveEvent}
              eventStats={eventStats} viewingEventId={viewingEventId}
              loadEventStats={loadEventStats}
              eventMsg={eventMsg}
              restoreEvent={async (id) => { await api.archiveEvent(id, false); const r = await api.events(); setEvents(r.events); }}
              fmt={fmt} A={A}
            />
            </>
          )}

          {/* ════════════════ GROUP SETUP ════════════════ */}
          {!loading && view === 'group' && !activeGroup && (
            <>
              <div style={A.pageHdr}>
                <h2 style={A.pageTitle}>Age Groups</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {activeEvent && <span style={A.eventPill}>{activeEvent.name}</span>}
                  <button onClick={() => setShowAddAgeGroup(v => !v)} style={showAddAgeGroup ? A.ghostBtn : A.primaryBtn}>
                    {showAddAgeGroup ? 'Cancel' : '+ New Age Group'}
                  </button>
                </div>
              </div>
              {showAddAgeGroup && (
                <div style={{ ...A.card, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>New Age Group</div>
                  <div style={A.formRow}>
                    <div style={{ flex: 2 }}>
                      <label style={A.fieldLabel}>Name</label>
                      <input placeholder="e.g. Mites (8U)" value={newAgeGroup.name}
                        onChange={e => setNewAgeGroup(n => ({ ...n, name: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={A.fieldLabel}>Code</label>
                      <input placeholder="e.g. 8U" value={newAgeGroup.code}
                        onChange={e => setNewAgeGroup(n => ({ ...n, code: e.target.value }))} />
                    </div>
                    <div style={{ width: 90 }}>
                      <label style={A.fieldLabel}>Sort order</label>
                      <input type="number" min="0" value={newAgeGroup.sortOrder}
                        onChange={e => setNewAgeGroup(n => ({ ...n, sortOrder: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button onClick={addAgeGroup}
                      disabled={creatingAgeGroup || !newAgeGroup.name || !newAgeGroup.code}
                      style={A.saveBtn}>
                      {creatingAgeGroup ? 'Creating…' : 'Create Age Group'}
                    </button>
                  </div>
                </div>
              )}
              <div style={A.sectionHdr}>
                <span style={A.sectionLabel}>Select an Age Group</span>
              </div>
              <div style={A.ageGroupGrid}>
                {ageGroups.map(g => {
                  const stats = groupStats(g.code);
                  return (
                    <div key={g.id} style={A.agCard} className="ag-card" onClick={() => openGroup(g)}>
                      <div style={A.agName}>{g.name}</div>
                      <div style={A.agStats}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={A.agStatVal}>{stats.total_players}</div>
                          <div style={A.agStatLabel}>Players</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={A.agStatVal}>{stats.total_sessions}</div>
                          <div style={A.agStatLabel}>Sessions</div>
                        </div>
                      </div>
                      <span style={A.agLink}>Manage sessions & players →</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!loading && view === 'group' && activeGroup && (
            <>
              <div style={A.pageHdr}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => { setActiveGroup(null); }} style={A.backLink}>← Age Groups</button>
                  <h2 style={A.pageTitle}>{activeGroup.name}</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {activeEvent && <span style={A.eventPill}>{activeEvent.name}</span>}
                </div>
              </div>
              <GroupPanel
              activeGroup={activeGroup} activeEvent={activeEvent}
              sessions={sessions} players={players}
              sessionScorers={sessionScorers} users={users}
              showBlockWizard={showBlockWizard} setShowBlockWizard={setShowBlockWizard}
              blockWizard={blockWizard} setBlockWizard={setBlockWizard}
              updateSlot={updateSlot} addSlot={addSlot} removeSlot={removeSlot}
              updateTeam={updateTeam} updateGame={updateGame}
              createBlock={createBlock} creatingBlock={creatingBlock}
              blockMsg={blockMsg}
              showAddSession={showAddSession} setShowAddSession={setShowAddSession}
              newSession={newSession} setNewSession={setNewSession}
              addSession={addSession} addingSession={addingSession}
              showAddPlayer={showAddPlayer} setShowAddPlayer={setShowAddPlayer}
              newPlayer={newPlayer} setNewPlayer={setNewPlayer}
              addPlayer={addPlayer} addingPlayer={addingPlayer}
              removePlayer={removePlayer}
              editingSessionId={editingSessionId}
              editSession={editSession} setEditSession={setEditSession}
              startEditSession={startEditSession} saveSessionEdit={saveSessionEdit}
              cancelEdit={() => setEditingSessionId(null)}
              updateStatus={updateStatus} removeSession={removeSession}
              assigningTo={assigningTo} setAssigningTo={setAssigningTo}
              assignUserId={assignUserId} setAssignUserId={setAssignUserId}
              assignScorer={assignScorer} unassignScorer={unassignScorer}
              onChangeAssignment={changeBlockAssignment}
              showImport={showImport} setShowImport={setShowImport}
              importFile={importFile} importPreview={importPreview}
              importSummary={importSummary} importRunning={importRunning}
              importResult={importResult} importMsg={importMsg}
              handleImportFile={handleImportFile} commitImport={commitImport}
              clearImport={clearImport}
              bulkText={bulkText} bulkPreview={bulkPreview} bulkResult={bulkResult}
              bulkUploading={bulkUploading} parseBulkText={parseBulkText} submitBulk={submitBulk}
              fmt={fmt} A={A}
            />
            </>
          )}

          {/* ════════════════ RANKINGS ════════════════ */}
          {!loading && view === 'rankings' && (
            <>
              <div style={A.pageHdr}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setView('overview')} style={A.backLink}>← Overview</button>
                  <h2 style={A.pageTitle}>{activeGroup?.name} Rankings</h2>
                </div>
              </div>
              <RankingsPanel rankings={rankings} activeGroup={activeGroup} A={A} />
            </>
          )}

          {/* ════════════════ COACHES ════════════════ */}
          {!loading && view === 'coaches' && (
            <>
              <div style={A.pageHdr}>
                <h2 style={A.pageTitle}>Coaches & Scorers</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {activeEvent && <span style={A.eventPill}>{activeEvent.name}</span>}
                  <button onClick={async () => {
                    if (activeEvent) {
                      const r = await api.allSessions(null, activeEvent.id);
                      setCoachViewSessions(r.sessions || []);
                    }
                  }} style={A.ghostBtn}>Refresh Sessions</button>
                </div>
              </div>
              <CoachesPanel
              users={users}
              newCoach={newCoach} setNewCoach={setNewCoach}
              addCoach={addCoach} addingCoach={addingCoach}
              coachError={coachError} coachSuccess={coachSuccess}
              coachViewSessions={coachViewSessions}
              editingCoachId={editingCoachId}
              editCoach={editCoach} setEditCoach={setEditCoach}
              openEditCoach={openEditCoach}
              editCoachSessions={editCoachSessions}
              allSessionsList={allSessionsList}
              assigningSessionId={assigningSessionId}
              setAssigningSessionId={setAssigningSessionId}
              assignSessionToCoach={assignSessionToCoach}
              unassignCoachSession={unassignCoachSession}
              saveCoach={saveCoach} savingCoach={savingCoach}
              editCoachMsg={editCoachMsg}
              fmt={fmt} A={A}
            />
            </>
          )}

          {/* ════════════════ RESULTS ════════════════ */}
          {!loading && view === 'results' && (
            <>
              <div style={A.pageHdr}>
                <h2 style={A.pageTitle}>Results</h2>
                {activeEvent && <span style={A.eventPill}>{activeEvent.name}</span>}
              </div>
              <ResultsPanel
                ageGroups={ageGroups} activeEvent={activeEvent}
                openRankings={openRankings}
                dashboard={dashboard} groupStats={groupStats}
                A={A}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SESSION CARD (reused in both sessions & group views)
═══════════════════════════════════════════════════════ */
function SessionCard({
  sess, scorers, users, editingSessionId, editSession, setEditSession,
  startEditSession, saveSessionEdit, cancelEdit, updateStatus, removeSession,
  assigningTo, setAssigningTo, assignUserId, setAssignUserId, assignScorer, unassignScorer,
  onChangeAssignment,
  fmt, A,
}) {
  const [showAssignmentEdit, setShowAssignmentEdit] = useState(false);
  const [changingAssignment, setChangingAssignment] = useState(false);
  const sm = STATUS_META[sess.status] || STATUS_META.pending;
  const isEditing   = editingSessionId === sess.id;
  const isAssigning = assigningTo === sess.id;
  const assignable  = users.filter(u => !scorers.find(sc => sc.id === u.id));

  return (
    <div style={A.sessCard} className="sess-card">
      {/* Type + range tags */}
      <div style={A.sessTagRow}>
        <span style={{
          ...A.typeTag,
          background: sess.session_type === 'game' ? 'var(--amber-bg)' : 'var(--blue-bg)',
          color:      sess.session_type === 'game' ? 'var(--amber-txt)' : 'var(--blue-txt)',
          border:     `1px solid ${sess.session_type === 'game' ? 'var(--amber)' : 'var(--blue)'}`,
        }}>
          {sess.session_type === 'game' ? '🥅 Game' : '🏒 Skills'}
        </span>
        {sess.last_name_start && sess.last_name_end && (
          <span style={A.rangeTag}>{sess.last_name_start}–{sess.last_name_end}</span>
        )}
        {sess.home_team && sess.away_team && (
          <span style={A.rangeTag}>T{sess.home_team} vs T{sess.away_team}</span>
        )}
        {sess.age_group && <span style={A.ageTag}>{sess.age_group}</span>}
      </div>

      {isEditing ? (
        <div style={{ marginBottom: 10 }}>
          <div style={A.formRow}>
            <div style={{ flex: 2 }}>
              <label style={A.fieldLabel}>Session name</label>
              <input value={editSession.name} onChange={e => setEditSession(n => ({ ...n, name: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Date</label>
              <input type="date" value={editSession.date} onChange={e => setEditSession(n => ({ ...n, date: e.target.value }))} />
            </div>
            <div style={{ width: 110 }}>
              <label style={A.fieldLabel}>Start time</label>
              <input type="time" value={editSession.time} onChange={e => setEditSession(n => ({ ...n, time: e.target.value }))} />
            </div>
            <div style={{ width: 110 }}>
              <label style={A.fieldLabel}>Type</label>
              <select value={editSession.sessionType} onChange={e => setEditSession(n => ({ ...n, sessionType: e.target.value }))}>
                <option value="skills">Skills</option>
                <option value="game">Game</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={saveSessionEdit} style={A.saveBtn}>Save</button>
            <button onClick={cancelEdit} style={A.ghostBtn}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={A.sessMain}>
          <div style={{ flex: 1 }}>
            <div style={A.sessName}>{sess.name}</div>
            <div style={A.sessMeta}>
              {fmt.date(sess.session_date)}
              {sess.start_time ? ' · ' + fmt.time(sess.start_time) : ''}
              {' · '}<strong>{sess.player_count}</strong> players
            </div>
          </div>
          <div style={A.sessActions}>
            <select
              value={sess.status}
              onChange={e => updateStatus(sess.id, e.target.value)}
              style={{ ...A.statusSelect, background: sm.bg, color: sm.textColor, border: `1px solid ${sm.border}` }}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="complete">Complete</option>
            </select>
            <button onClick={() => startEditSession(sess)} style={A.iconBtn} title="Edit">✎</button>
            <button onClick={() => removeSession(sess.id)} style={{ ...A.iconBtn, color: 'var(--red-txt)' }} title="Delete">×</button>
          </div>
        </div>
      )}

      {/* Scorer chips */}
      <div style={A.scorerRow}>
        <span style={A.scorerRowLabel}>Scorers:</span>
        {scorers.length === 0 && !isAssigning && (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>None assigned</span>
        )}
        {scorers.map(u => (
          <span key={u.id} style={A.scorerChip}>
            {u.first_name} {u.last_name}
            <button onClick={() => unassignScorer(sess.id, u.id)} style={A.chipX}>×</button>
          </span>
        ))}
        {isAssigning ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, width: '100%' }}>
            <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} style={{ flex: 1, ...A.selectInput }}>
              <option value="">Select scorer…</option>
              {assignable.map(u => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>
              ))}
            </select>
            <button onClick={() => assignScorer(sess.id)} style={A.primaryBtn}>Assign</button>
            <button onClick={() => { setAssigningTo(null); setAssignUserId(''); }} style={A.ghostBtn}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => { setAssigningTo(sess.id); setAssignUserId(''); }} style={A.addScorerBtn}>
            + Add scorer
          </button>
        )}
      </div>

      {/* Player assignment editing */}
      {sess.block_id && onChangeAssignment && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {!showAssignmentEdit ? (
            <button onClick={() => setShowAssignmentEdit(true)} style={{ ...A.addScorerBtn, borderColor: 'var(--blue)', color: 'var(--blue-txt)' }}>
              Edit Player Assignment
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Reassign players:</span>
              {sess.session_type === 'skills' ? (
                <>
                  {['last_name', 'jersey_range', 'none', 'manual'].map(method => (
                    <button key={method} onClick={async () => {
                      setChangingAssignment(true);
                      try {
                        await onChangeAssignment(sess.block_id, { splitMethod: method });
                      } finally {
                        setChangingAssignment(false);
                        setShowAssignmentEdit(false);
                      }
                    }} disabled={changingAssignment}
                      style={{ ...A.splitBtn, fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer' }}>
                      {method === 'last_name' ? 'By Last Name' : method === 'jersey_range' ? 'By Jersey #' : method === 'none' ? 'All Together' : 'Manual'}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {['random', 'manual'].map(method => (
                    <button key={method} onClick={async () => {
                      setChangingAssignment(true);
                      try {
                        await onChangeAssignment(sess.block_id, { playerAssignment: method });
                      } finally {
                        setChangingAssignment(false);
                        setShowAssignmentEdit(false);
                      }
                    }} disabled={changingAssignment}
                      style={{ ...A.splitBtn, fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer' }}>
                      {method === 'random' ? 'Random' : 'Manual'}
                    </button>
                  ))}
                </>
              )}
              <button onClick={() => setShowAssignmentEdit(false)} style={{ ...A.ghostBtn, fontSize: 11, padding: '4px 10px' }}>Cancel</button>
              {changingAssignment && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Updating…</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   BLOCK WIZARD PANEL
═══════════════════════════════════════════════════════ */
function BlockWizardPanel({ blockWizard, setBlockWizard, players, updateSlot, addSlot, removeSlot,
  updateTeam, updateGame, createBlock, creatingBlock, blockMsg, onCancel, A }) {

  const bw = blockWizard;

  return (
    <div style={{ ...A.card, borderColor: 'var(--blue)', borderWidth: 2, marginBottom: 16 }}>
      <div style={A.wizardTitle}>⚙ Session Block Setup</div>

      {/* Label + Date */}
      <div style={A.formRow}>
        <div style={{ flex: 2 }}>
          <label style={A.fieldLabel}>Block label <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
          <input placeholder="e.g. Mites Skills — Monday" value={bw.label}
            onChange={e => setBlockWizard(w => ({ ...w, label: e.target.value }))} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={A.fieldLabel}>Date <span style={{ color: 'var(--red-txt)' }}>*</span></label>
          <input type="date" value={bw.date}
            onChange={e => setBlockWizard(w => ({ ...w, date: e.target.value }))} />
        </div>
      </div>

      {/* Block type */}
      <div style={{ marginTop: 14 }}>
        <div style={A.fieldLabel}>Block type</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {[
            { val: 'skills', icon: '🏒', label: 'Skills Session', desc: 'Individual evaluation' },
            { val: 'game',   icon: '🥅', label: 'Game Session',   desc: 'Team-based play' },
          ].map(opt => (
            <div key={opt.val} onClick={() => setBlockWizard(w => ({ ...w, blockType: opt.val }))}
              style={{
                ...A.typeCard,
                border: `2px solid ${bw.blockType === opt.val ? 'var(--blue)' : 'var(--border)'}`,
                background: bw.blockType === opt.val ? 'var(--blue-bg)' : 'var(--bg3)',
              }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.icon} {opt.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SKILLS config */}
      {bw.blockType === 'skills' && (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={A.fieldLabel}>Player split method</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {[
                { val: 'last_name', label: 'By Last Name' },
                { val: 'jersey_range', label: 'By Jersey #' },
                { val: 'none', label: 'All Together' },
                { val: 'manual', label: 'Manual' },
              ].map(opt => (
                <button key={opt.val} onClick={() => setBlockWizard(w => ({ ...w, splitMethod: opt.val }))}
                  style={{
                    ...A.splitBtn,
                    border: `2px solid ${bw.splitMethod === opt.val ? 'var(--blue)' : 'var(--border)'}`,
                    background: bw.splitMethod === opt.val ? 'var(--blue-bg)' : 'var(--bg3)',
                    fontWeight: bw.splitMethod === opt.val ? 700 : 400,
                    color: bw.splitMethod === opt.val ? 'var(--blue-txt)' : 'var(--text)',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={A.fieldLabel}>Scoring mode</label>
            <select value={bw.scoringMode} onChange={e => setBlockWizard(w => ({ ...w, scoringMode: e.target.value }))} style={A.selectInput}>
              <option value="full">Full — every player scored on every criterion</option>
              <option value="observe">Observe — flag standout players only</option>
            </select>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={A.fieldLabel}>Time slots</div>
              {bw.splitMethod !== 'none' && (
                <button onClick={addSlot} style={{ ...A.ghostBtn, fontSize: 11 }}>+ Add slot</button>
              )}
            </div>
            {bw.slots.map((slot, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                <div style={{ width: 110 }}>
                  {i === 0 && <label style={A.fieldLabel}>Start time</label>}
                  <input type="time" value={slot.time} onChange={e => updateSlot(i, 'time', e.target.value)} />
                </div>
                {bw.splitMethod === 'last_name' && (
                  <>
                    <div style={{ width: 70 }}>
                      {i === 0 && <label style={A.fieldLabel}>From</label>}
                      <input maxLength={3} value={slot.lastNameStart}
                        onChange={e => updateSlot(i, 'lastNameStart', e.target.value.toUpperCase())}
                        style={{ textAlign: 'center', fontWeight: 700 }} />
                    </div>
                    <span style={{ paddingBottom: 8, color: 'var(--text3)' }}>—</span>
                    <div style={{ width: 70 }}>
                      {i === 0 && <label style={A.fieldLabel}>To</label>}
                      <input maxLength={3} value={slot.lastNameEnd}
                        onChange={e => updateSlot(i, 'lastNameEnd', e.target.value.toUpperCase())}
                        style={{ textAlign: 'center', fontWeight: 700 }} />
                    </div>
                  </>
                )}
                {bw.splitMethod === 'jersey_range' && (
                  <>
                    <div style={{ width: 80 }}>
                      {i === 0 && <label style={A.fieldLabel}>Jersey min</label>}
                      <input type="number" min="1" placeholder="1" value={slot.jerseyMin}
                        onChange={e => updateSlot(i, 'jerseyMin', e.target.value)} />
                    </div>
                    <span style={{ paddingBottom: 8, color: 'var(--text3)' }}>—</span>
                    <div style={{ width: 80 }}>
                      {i === 0 && <label style={A.fieldLabel}>Jersey max</label>}
                      <input type="number" min="1" placeholder="99" value={slot.jerseyMax}
                        onChange={e => updateSlot(i, 'jerseyMax', e.target.value)} />
                    </div>
                  </>
                )}
                {bw.slots.length > 1 && (
                  <button onClick={() => removeSlot(i)} style={{ ...A.iconBtn, color: 'var(--red-txt)', paddingBottom: 8 }}>×</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* GAME config */}
      {bw.blockType === 'game' && (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={A.fieldLabel}>Teams</div>
              <button onClick={() => setBlockWizard(w => {
                const n = w.teams.length + 1;
                return { ...w, teams: [...w.teams, { teamNumber: n, jerseyColor: 'white', label: `Team ${n}` }] };
              })} style={{ ...A.ghostBtn, fontSize: 11 }}>+ Add team</button>
            </div>
            {bw.teams.map((team, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  {i === 0 && <label style={A.fieldLabel}>Label</label>}
                  <input value={team.label} onChange={e => updateTeam(i, 'label', e.target.value)} />
                </div>
                <div style={{ width: 130 }}>
                  {i === 0 && <label style={A.fieldLabel}>Jersey color</label>}
                  <select value={team.jerseyColor} onChange={e => updateTeam(i, 'jerseyColor', e.target.value)} style={A.selectInput}>
                    {['white','maroon','light','dark','green','black','red','blue'].map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={A.fieldLabel}>Player assignment</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {[
                { val: 'random', label: '🎲 Random', desc: 'Auto-shuffle players to teams' },
                { val: 'manual', label: '✋ Manual', desc: 'Assign players yourself later' },
              ].map(opt => (
                <div key={opt.val} onClick={() => setBlockWizard(w => ({ ...w, playerAssignment: opt.val }))}
                  style={{
                    ...A.typeCard,
                    border: `2px solid ${bw.playerAssignment === opt.val ? 'var(--blue)' : 'var(--border)'}`,
                    background: bw.playerAssignment === opt.val ? 'var(--blue-bg)' : 'var(--bg3)',
                  }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={A.fieldLabel}>Game matchups</div>
              <button onClick={() => setBlockWizard(w => ({ ...w, games: [...w.games, { time: '', homeTeam: 1, awayTeam: 2 }] }))}
                style={{ ...A.ghostBtn, fontSize: 11 }}>+ Add game</button>
            </div>
            {bw.games.map((game, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                <div style={{ width: 110 }}>
                  {i === 0 && <label style={A.fieldLabel}>Start time</label>}
                  <input type="time" value={game.time} onChange={e => updateGame(i, 'time', e.target.value)} />
                </div>
                <div style={{ width: 100 }}>
                  {i === 0 && <label style={A.fieldLabel}>Home</label>}
                  <select value={game.homeTeam} onChange={e => updateGame(i, 'homeTeam', e.target.value)} style={A.selectInput}>
                    {bw.teams.map(t => <option key={t.teamNumber} value={t.teamNumber}>{t.label || `Team ${t.teamNumber}`}</option>)}
                  </select>
                </div>
                <span style={{ paddingBottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>vs</span>
                <div style={{ width: 100 }}>
                  {i === 0 && <label style={A.fieldLabel}>Away</label>}
                  <select value={game.awayTeam} onChange={e => updateGame(i, 'awayTeam', e.target.value)} style={A.selectInput}>
                    {bw.teams.map(t => <option key={t.teamNumber} value={t.teamNumber}>{t.label || `Team ${t.teamNumber}`}</option>)}
                  </select>
                </div>
                {bw.games.length > 1 && (
                  <button onClick={() => setBlockWizard(w => ({ ...w, games: w.games.filter((_, idx) => idx !== i) }))}
                    style={{ ...A.iconBtn, color: 'var(--red-txt)', paddingBottom: 8 }}>×</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {blockMsg && <div style={A.errorBox}>{blockMsg}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={createBlock} disabled={creatingBlock || !bw.date} style={A.saveBtn}>
          {creatingBlock ? 'Creating…' : `Create ${bw.blockType === 'game' ? 'Game' : 'Skills'} Block`}
        </button>
        <button onClick={onCancel} style={A.ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   GROUP PANEL
═══════════════════════════════════════════════════════ */
function GroupPanel({
  activeGroup, activeEvent, sessions, players, sessionScorers, users,
  showBlockWizard, setShowBlockWizard, blockWizard, setBlockWizard,
  updateSlot, addSlot, removeSlot, updateTeam, updateGame,
  createBlock, creatingBlock, blockMsg,
  showAddSession, setShowAddSession, newSession, setNewSession, addSession, addingSession,
  showAddPlayer, setShowAddPlayer, newPlayer, setNewPlayer, addPlayer, addingPlayer, removePlayer,
  editingSessionId, editSession, setEditSession, startEditSession, saveSessionEdit, cancelEdit,
  updateStatus, removeSession, assigningTo, setAssigningTo, assignUserId, setAssignUserId,
  assignScorer, unassignScorer,
  onChangeAssignment,
  showImport, setShowImport, importFile, importPreview, importSummary, importRunning,
  importResult, importMsg, handleImportFile, commitImport, clearImport,
  fmt, A,
}) {
  return (
    <div>
      {/* Sessions section */}
      <div style={A.sectionHdr}>
        <span style={A.sectionLabel}>Sessions ({sessions.length})</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowAddSession(v => !v); setShowBlockWizard(false); }} style={A.ghostBtn}>
            {showAddSession ? 'Cancel' : '+ Single Session'}
          </button>
          <button onClick={() => { setShowBlockWizard(v => !v); setShowAddSession(false); }}
            style={showBlockWizard ? A.ghostBtn : A.primaryBtn}>
            {showBlockWizard ? 'Cancel' : '+ Session Block'}
          </button>
        </div>
      </div>

      {showBlockWizard && (
        <BlockWizardPanel
          blockWizard={blockWizard} setBlockWizard={setBlockWizard} players={players}
          updateSlot={updateSlot} addSlot={addSlot} removeSlot={removeSlot}
          updateTeam={updateTeam} updateGame={updateGame}
          createBlock={createBlock} creatingBlock={creatingBlock}
          blockMsg={blockMsg} onCancel={() => setShowBlockWizard(false)} A={A}
        />
      )}

      {showAddSession && (
        <div style={{ ...A.card, marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
            Single session — no automatic player split. Use <strong>Session Block</strong> for last-name or team splits.
          </p>
          <div style={A.formRow}>
            <div style={{ flex: 2 }}>
              <label style={A.fieldLabel}>Session name</label>
              <input placeholder="e.g. Day 1 Session 1" value={newSession.name}
                onChange={e => setNewSession(n => ({ ...n, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addSession()} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Date</label>
              <input type="date" value={newSession.date} onChange={e => setNewSession(n => ({ ...n, date: e.target.value }))} />
            </div>
            <div style={{ width: 110 }}>
              <label style={A.fieldLabel}>Start time</label>
              <input type="time" value={newSession.time} onChange={e => setNewSession(n => ({ ...n, time: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={addSession} disabled={addingSession || !newSession.name || !newSession.date || !newSession.time} style={A.saveBtn}>
              {addingSession ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 && !showAddSession && !showBlockWizard && (
        <div style={A.emptyCard}>No sessions yet. Use <strong>+ Session Block</strong> to create sessions with automatic player splits.</div>
      )}

      {sessions.map(sess => (
        <SessionCard
          key={sess.id} sess={sess}
          scorers={sessionScorers[sess.id] || []} users={users}
          editingSessionId={editingSessionId} editSession={editSession} setEditSession={setEditSession}
          startEditSession={startEditSession} saveSessionEdit={saveSessionEdit} cancelEdit={cancelEdit}
          updateStatus={updateStatus} removeSession={removeSession}
          assigningTo={assigningTo} setAssigningTo={setAssigningTo}
          assignUserId={assignUserId} setAssignUserId={setAssignUserId}
          assignScorer={assignScorer} unassignScorer={unassignScorer}
          onChangeAssignment={onChangeAssignment}
          fmt={fmt} A={A}
        />
      ))}

      {/* Players section */}
      <div style={{ ...A.sectionHdr, marginTop: 28 }}>
        <span style={A.sectionLabel}>Players ({players.length})</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowImport(v => !v); setShowAddPlayer(false); clearImport(); }} style={A.ghostBtn}>
            {showImport ? 'Cancel' : '↑ Import CSV'}
          </button>
          <button onClick={() => { setShowAddPlayer(v => !v); setShowImport(false); }}
            style={showAddPlayer ? A.ghostBtn : A.primaryBtn}>
            {showAddPlayer ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </div>

      {showImport && (
        <div style={{ ...A.card, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Import Players from CSV</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Supports SportEngine exports. Players auto-assign to sessions based on last name.</div>
          {!importResult && (
            <input type="file" accept=".csv,text/csv" onChange={handleImportFile}
              style={{ fontSize: 13, color: 'var(--text)' }} />
          )}
          {importRunning && <p style={A.muted}>Parsing CSV…</p>}
          {importMsg && <div style={A.errorBox}>{importMsg}</div>}
          {importPreview && importSummary && !importResult && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                {[
                  { label: 'Valid', val: importSummary.valid, color: 'var(--green-txt)' },
                  { label: 'Skip',  val: importSummary.skipped, color: 'var(--amber-txt)' },
                  { label: 'Errors', val: importSummary.errors, color: 'var(--red-txt)' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={commitImport} disabled={importRunning || importSummary.valid === 0} style={A.saveBtn}>
                  {importRunning ? 'Importing…' : `Import ${importSummary.valid} Player${importSummary.valid !== 1 ? 's' : ''}`}
                </button>
                <button onClick={clearImport} style={A.ghostBtn}>Clear</button>
              </div>
            </div>
          )}
          {importResult && (
            <div style={{ marginTop: 10 }}>
              <div style={A.successBox}>
                ✓ Imported {importResult.summary.added} player{importResult.summary.added !== 1 ? 's' : ''}.
              </div>
              <button onClick={() => { clearImport(); setShowImport(false); }} style={{ ...A.ghostBtn, marginTop: 8 }}>Done</button>
            </div>
          )}
        </div>
      )}

      {showAddPlayer && (
        <div style={{ ...A.card, marginBottom: 12 }}>
          <div style={A.formRow}>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>First name</label>
              <input placeholder="First" value={newPlayer.firstName}
                onChange={e => setNewPlayer(n => ({ ...n, firstName: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Last name</label>
              <input placeholder="Last" value={newPlayer.lastName}
                onChange={e => setNewPlayer(n => ({ ...n, lastName: e.target.value }))} />
            </div>
            <div style={{ width: 90 }}>
              <label style={A.fieldLabel}>Jersey #</label>
              <input type="number" min="1" max="99" placeholder="#"
                value={newPlayer.jersey}
                onChange={e => setNewPlayer(n => ({ ...n, jersey: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addPlayer()} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={addPlayer}
              disabled={addingPlayer || !newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey}
              style={A.saveBtn}>
              {addingPlayer ? 'Adding…' : 'Add Player'}
            </button>
          </div>
        </div>
      )}

      {players.length === 0 && !showAddPlayer && (
        <div style={A.emptyCard}>No players yet. Click <strong>+ Add Player</strong> or import a CSV.</div>
      )}

      {players.length > 0 && (
        <div style={A.playerTable}>
          <div style={A.playerTableHdr}>
            <span style={{ width: 50 }}>#</span>
            <span style={{ flex: 1 }}>Name</span>
            <span style={{ width: 32 }}></span>
          </div>
          {players.map(p => (
            <div key={p.id} style={A.playerRow}>
              <span style={A.pJersey}>#{p.jersey_number}</span>
              <span style={A.pName}>{p.first_name} {p.last_name}</span>
              <button onClick={() => removePlayer(p.id)} style={{ ...A.iconBtn, color: 'var(--red-txt)' }} title="Remove">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   EVENTS PANEL
═══════════════════════════════════════════════════════ */
function EventsPanel({ events, activeEvent, newEvent, setNewEvent, showCreateEvent,
  createEvent, creatingEvent, archiveEvent, eventStats, viewingEventId,
  loadEventStats, eventMsg, restoreEvent, fmt, A }) {

  return (
    <div>
      {eventMsg.text && (
        <div style={eventMsg.type === 'success' ? A.successBox : A.errorBox}>{eventMsg.text}</div>
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
              <button onClick={() => archiveEvent(activeEvent.id)}
                style={{ ...A.ghostBtn, borderColor: 'var(--red)', color: 'var(--red-txt)' }}>Archive</button>
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
              <input placeholder="e.g. Fall Tryouts 2027" value={newEvent.name}
                onChange={e => setNewEvent(n => ({ ...n, name: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Season</label>
              <input placeholder="2026-2027" value={newEvent.season}
                onChange={e => setNewEvent(n => ({ ...n, season: e.target.value }))} />
            </div>
          </div>
          <div style={{ ...A.formRow, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>Start date</label>
              <input type="date" value={newEvent.startDate} onChange={e => setNewEvent(n => ({ ...n, startDate: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={A.fieldLabel}>End date</label>
              <input type="date" value={newEvent.endDate} onChange={e => setNewEvent(n => ({ ...n, endDate: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={createEvent}
              disabled={creatingEvent || !newEvent.name || !newEvent.season || !newEvent.startDate || !newEvent.endDate}
              style={A.saveBtn}>
              {creatingEvent ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </div>
      )}

      {events.filter(e => e.archived).length > 0 && (
        <>
          <div style={{ ...A.sectionLabel, marginTop: 20 }}>Archived Events</div>
          {events.filter(e => e.archived).map(ev => (
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

/* ═══════════════════════════════════════════════════════
   RANKINGS PANEL
═══════════════════════════════════════════════════════ */
function RankingsPanel({ rankings, activeGroup, A }) {
  if (rankings.length === 0) return <div style={A.emptyCard}>No scores submitted yet for {activeGroup?.name}.</div>;
  return (
    <div>
      {rankings.map((p, i) => {
        const pct = p.avg_overall ? Math.round(p.avg_overall / 5 * 100) : 0;
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
                <div style={{ width: pct + '%', height: 5, background: 'var(--maroon)', borderRadius: 3 }} />
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

/* ═══════════════════════════════════════════════════════
   RESULTS PANEL
═══════════════════════════════════════════════════════ */
function ResultsPanel({ ageGroups, activeEvent, openRankings, dashboard, groupStats, A }) {
  if (!activeEvent) return <div style={A.emptyCard}>No active event. Create an event first.</div>;

  const allComplete = ageGroups.every(g => {
    const stats = groupStats(g.code);
    return stats.total_sessions > 0 && stats.complete_sessions === stats.total_sessions;
  });

  return (
    <div>
      {!allComplete && (
        <div style={{ ...A.card, borderColor: 'var(--amber)', background: 'var(--amber-bg)', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber-txt)', marginBottom: 4 }}>Tryouts In Progress</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            Not all age groups have completed their sessions. Results shown below reflect current scores.
          </div>
        </div>
      )}
      {allComplete && (
        <div style={{ ...A.card, borderColor: 'var(--green)', background: 'var(--green-bg)', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-txt)' }}>All Tryouts Complete</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
            All age groups have finished their sessions. Final results are shown below.
          </div>
        </div>
      )}
      <div style={A.ageGroupGrid}>
        {ageGroups.map(g => {
          const stats = groupStats(g.code);
          const pct = stats.total_sessions > 0
            ? Math.round(stats.complete_sessions / stats.total_sessions * 100) : 0;
          const isDone = stats.total_sessions > 0 && pct === 100;
          return (
            <div key={g.id} style={{ ...A.agCard, borderColor: isDone ? 'var(--green)' : 'var(--border)' }}
              className="ag-card" onClick={() => openRankings(g)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={A.agName}>{g.name}</div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: isDone ? '#E3F3EA' : '#FDF6E3',
                  color: isDone ? '#145A3C' : '#6B4D0A',
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
                <div style={{ ...A.progressFill, width: pct + '%', background: isDone ? 'var(--green)' : 'var(--maroon)' }} />
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

/* ═══════════════════════════════════════════════════════
   COACHES PANEL
═══════════════════════════════════════════════════════ */
function CoachesPanel({
  users, newCoach, setNewCoach, addCoach, addingCoach, coachError, coachSuccess, coachViewSessions,
  editingCoachId, editCoach, setEditCoach, openEditCoach, editCoachSessions, allSessionsList,
  assigningSessionId, setAssigningSessionId, assignSessionToCoach, unassignCoachSession,
  saveCoach, savingCoach, editCoachMsg, fmt, A,
}) {
  const roleStyle = (role) =>
    role === 'admin'       ? { background: 'var(--red-bg)',   color: 'var(--red-txt)',   border: '1px solid var(--red)' } :
    role === 'coordinator' ? { background: 'var(--blue-bg)',  color: 'var(--blue-txt)',  border: '1px solid var(--blue)' } :
                             { background: 'var(--bg3)',      color: 'var(--text2)',     border: '1px solid var(--border)' };
  return (
    <div>
      {/* Create form */}
      <div style={A.sectionLabel}>Create Account</div>
      <div style={A.card}>
        <div style={A.formRow}>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>First name</label>
            <input placeholder="First" value={newCoach.firstName}
              onChange={e => setNewCoach(n => ({ ...n, firstName: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>Last name</label>
            <input placeholder="Last" value={newCoach.lastName}
              onChange={e => setNewCoach(n => ({ ...n, lastName: e.target.value }))} />
          </div>
        </div>
        <div style={{ ...A.formRow, marginTop: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={A.fieldLabel}>Email</label>
            <input type="email" placeholder="coach@example.com" value={newCoach.email}
              onChange={e => setNewCoach(n => ({ ...n, email: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>Role</label>
            <select value={newCoach.role} onChange={e => setNewCoach(n => ({ ...n, role: e.target.value }))} style={A.selectInput}>
              <option value="scorer">Scorer (coach)</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div style={{ ...A.formRow, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={A.fieldLabel}>Temporary password</label>
            <input type="text" placeholder="They can change it later" value={newCoach.password}
              onChange={e => setNewCoach(n => ({ ...n, password: e.target.value }))} />
          </div>
        </div>
        {coachError   && <div style={A.errorBox}>{coachError}</div>}
        {coachSuccess && <div style={A.successBox}>{coachSuccess}</div>}
        <div style={{ marginTop: 12 }}>
          <button onClick={addCoach}
            disabled={addingCoach || !newCoach.firstName || !newCoach.lastName || !newCoach.email || !newCoach.password}
            style={A.saveBtn}>
            {addingCoach ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </div>

      {/* User list */}
      <div style={{ ...A.sectionLabel, marginTop: 20 }}>All Accounts — click to edit</div>
      <div style={A.playerTable}>
        <div style={A.playerTableHdr}>
          <span style={{ flex: 1 }}>Name</span>
          <span style={{ flex: 1 }}>Email</span>
          <span style={{ width: 110 }}>Role</span>
        </div>
        {users.map(u => {
          const isEditing = editingCoachId === u.id;
          return (
            <div key={u.id}>
              <div
                style={{ ...A.playerRow, cursor: 'pointer', background: isEditing ? 'var(--blue-bg)' : undefined }}
                onClick={() => openEditCoach(u)}
              >
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{u.first_name} {u.last_name}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text3)' }}>{u.email}</span>
                <span style={{ width: 110 }}>
                  <span style={{ ...A.roleBadge, ...roleStyle(u.role) }}>{u.role}</span>
                </span>
              </div>
              {isEditing && (
                <div style={{ padding: '16px', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
                  <div style={A.formRow}>
                    <div style={{ flex: 1 }}>
                      <label style={A.fieldLabel}>First name</label>
                      <input value={editCoach.firstName || ''} onChange={e => setEditCoach(c => ({ ...c, firstName: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={A.fieldLabel}>Last name</label>
                      <input value={editCoach.lastName || ''} onChange={e => setEditCoach(c => ({ ...c, lastName: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={A.fieldLabel}>Role</label>
                      <select value={editCoach.role || 'scorer'} onChange={e => setEditCoach(c => ({ ...c, role: e.target.value }))} style={A.selectInput}>
                        <option value="scorer">Scorer</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ ...A.formRow, marginTop: 10 }}>
                    <div style={{ flex: 2 }}>
                      <label style={A.fieldLabel}>Email</label>
                      <input type="email" value={editCoach.email || ''} onChange={e => setEditCoach(c => ({ ...c, email: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={A.fieldLabel}>New password</label>
                      <input type="text" placeholder="Leave blank to keep" value={editCoach.password || ''}
                        onChange={e => setEditCoach(c => ({ ...c, password: e.target.value }))} />
                    </div>
                  </div>
                  {editCoachMsg.text && (
                    <div style={editCoachMsg.type === 'success' ? A.successBox : A.errorBox}>{editCoachMsg.text}</div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <button onClick={saveCoach} disabled={savingCoach} style={A.saveBtn}>
                      {savingCoach ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                  {/* Assigned sessions */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ ...A.sectionLabel, marginBottom: 8 }}>Assigned Sessions</div>
                    {(() => {
                      const assignedIds = new Set(editCoachSessions.map(s => s.id));
                      const available = allSessionsList.filter(s => !assignedIds.has(s.id));
                      return available.length > 0 ? (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          <select value={assigningSessionId} onChange={e => setAssigningSessionId(e.target.value)} style={{ flex: 1, ...A.selectInput }}>
                            <option value="">Add to session…</option>
                            {available.map(s => (
                              <option key={s.id} value={s.id}>{s.age_group} — {s.name} ({s.session_date})</option>
                            ))}
                          </select>
                          <button onClick={assignSessionToCoach} disabled={!assigningSessionId} style={A.primaryBtn}>Assign</button>
                        </div>
                      ) : null;
                    })()}
                    {editCoachSessions.length === 0 ? (
                      <p style={A.muted}>No sessions assigned.</p>
                    ) : editCoachSessions.map(sess => (
                      <div key={sess.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{sess.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{sess.age_group_name} · {sess.session_date}</span>
                        </div>
                        <button onClick={() => unassignCoachSession(sess.id)} style={{ ...A.iconBtn, color: 'var(--red-txt)' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════ */
const ADMIN_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Nunito:wght@400;500;600;700&display=swap');

  .admin-shell {
    --bg:         #FAF8F5;
    --bg2:        #FFFFFF;
    --bg3:        #EDE8E1;
    --border:     #D5CEC4;
    --text:       #1A1212;
    --text2:      #4A3F3F;
    --text3:      #6B6060;

    --maroon-bg:     #F5E8EB;
    --maroon-txt:    #6B1E2E;

    --gold-bg:       #FDF6E3;
    --gold-txt:      #6B4D0A;

    --green-bg:   #E3F3EA;
    --green-txt:  #145A3C;

    --amber-bg:   #FEF6E0;
    --amber-txt:  #6B4D0A;

    --blue-bg:    #E5EDFC;
    --blue-txt:   #153D7A;

    --red-bg:     #FDECEB;
    --red-txt:    #8B2020;
  }

  .admin-shell input,
  .admin-shell select,
  .admin-shell textarea {
    background: #FFFFFF;
    border: 1px solid #D5CEC4;
    color: #1A1212;
    font-weight: 500;
  }
  .admin-shell input:focus,
  .admin-shell select:focus,
  .admin-shell textarea:focus {
    border-color: var(--gold);
    box-shadow: 0 0 0 3px rgba(240, 180, 41, 0.15);
  }
  .admin-shell input::placeholder { color: #B8ADA0; }

  .ag-card { transition: border-color 0.15s, box-shadow 0.15s; }
  .ag-card:hover { border-color: var(--gold) !important; box-shadow: 0 6px 20px rgba(107,30,46,0.08); }

  .sess-card { transition: border-color 0.15s; }
  .sess-card:hover { border-color: var(--gold-dark); }
`;

/* ═══════════════════════════════════════════════════════
   ADMIN STYLE OBJECT
═══════════════════════════════════════════════════════ */
const A = {
  shell: { display: 'flex', minHeight: '100vh', fontFamily: "'Nunito', sans-serif", background: 'var(--bg)' },
  main:  { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },

  pageHdr:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle:   { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: '#2D1F1F', letterSpacing: '0.03em', margin: 0 },
  backLink:    { background: 'none', border: 'none', color: 'var(--maroon)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  eventPill:   { fontSize: 11, fontWeight: 700, background: '#FDF6E3', border: '1.5px solid var(--gold-dark)', borderRadius: 20, padding: '5px 14px', color: '#6B1E2E' },

  contentArea: { flex: 1, padding: '24px 28px 60px', overflowY: 'auto' },
  muted: { fontSize: 13, color: 'var(--text3)', padding: '8px 0', fontWeight: 500 },

  /* Buttons */
  primaryBtn: { background: 'var(--maroon)', border: '1px solid var(--maroon-light)', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em' },
  ghostBtn:   { background: '#fff', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 600, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn:    { padding: '9px 20px', background: 'var(--maroon)', border: '1px solid var(--maroon-light)', borderRadius: 8, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' },
  iconBtn:    { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: '0 4px', color: 'var(--text3)', lineHeight: 1, fontFamily: 'inherit' },

  /* Layout */
  sectionHdr:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6B1E2E' },

  /* Overview */
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 24 },
  metricCard: { background: '#FFFFFF', border: '1.5px dashed var(--gold)', borderRadius: 10, padding: '18px 18px 14px' },
  metricVal:  { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 700, lineHeight: 1.1, color: '#6B1E2E' },
  metricLabel:{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6, fontWeight: 600 },

  ageGroupGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 24 },
  agCard: { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 12, padding: '18px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  agName: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: '#2D1F1F', marginBottom: 14 },
  agStats:    { display: 'flex', gap: 20, marginBottom: 14 },
  agStatVal:  { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: '#6B1E2E' },
  agStatLabel:{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 },
  agFooter:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' },
  agLink:     { fontSize: 13, color: 'var(--maroon)', fontWeight: 600 },
  agRankBtn:  { background: 'none', border: 'none', fontSize: 13, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 },

  progressTrack: { height: 5, background: '#F0ECE6', borderRadius: 3, overflow: 'hidden', marginBottom: 2 },
  progressFill:  { height: 5, background: 'var(--maroon)', borderRadius: 3, transition: 'width 0.4s' },

  /* Sessions */
  dateFilterRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  dateChip:      { padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
  dateChipActive: { background: 'var(--maroon)', borderColor: 'var(--maroon)', color: '#fff' },

  sessCard:    { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  sessTagRow:  { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  typeTag:     { fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' },
  rangeTag:    { fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: '#F0ECE6', color: 'var(--text2)', border: '1px solid var(--border)' },
  ageTag:      { fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#F5E8EB', color: '#6B1E2E', border: '1px solid #D4A0AC' },

  sessMain:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  sessName:    { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 },
  sessMeta:    { fontSize: 13, color: 'var(--text2)', fontWeight: 500 },
  sessActions: { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  statusSelect: { fontSize: 12, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' },

  scorerRow:      { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  scorerRowLabel: { fontSize: 13, color: 'var(--text2)', marginRight: 2, fontWeight: 600 },
  scorerChip:     { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B5314', background: '#FDF6E3', border: '1px solid var(--gold-dark)', borderRadius: 20, padding: '2px 10px' },
  chipX:          { background: 'none', border: 'none', color: 'var(--gold-dark)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, fontFamily: 'inherit' },
  addScorerBtn:   { background: 'none', border: '1px dashed var(--gold-dark)', borderRadius: 20, color: 'var(--gold-dark)', fontSize: 11, padding: '2px 10px', cursor: 'pointer', fontFamily: 'inherit' },

  /* Block wizard */
  wizardTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14, letterSpacing: '0.03em' },
  typeCard:    { flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.12s, background 0.12s' },
  splitBtn:    { padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', transition: 'all 0.1s' },

  /* Forms */
  card:       { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, padding: '18px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  formRow:    { display: 'flex', gap: 12, flexWrap: 'wrap' },
  fieldLabel: { display: 'block', fontSize: 13, color: 'var(--text)', marginBottom: 6, fontWeight: 700 },
  selectInput:{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'inherit', width: '100%' },
  emptyCard:  { background: '#FFFFFF', border: '1.5px dashed var(--border)', borderRadius: 10, padding: '24px', color: 'var(--text2)', fontSize: 14, fontWeight: 500, textAlign: 'center', marginBottom: 8 },

  /* Players */
  playerTable:    { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  playerTableHdr: { display: 'flex', alignItems: 'center', padding: '10px 14px', background: '#4A1320', fontSize: 10, fontWeight: 700, color: '#F7CC6A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: 8 },
  playerRow:      { display: 'flex', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border)', gap: 8 },
  pJersey:        { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: '#6B1E2E', width: 50, flexShrink: 0 },
  pName:          { fontSize: 14, color: 'var(--text)', flex: 1, fontWeight: 500 },

  /* Alerts */
  errorBox:   { marginTop: 10, padding: '9px 14px', background: '#FDECEB', border: '1px solid var(--red)', borderRadius: 8, color: '#9B2C2C', fontSize: 13 },
  successBox: { marginTop: 10, padding: '9px 14px', background: '#E8F5EE', border: '1px solid var(--green)', borderRadius: 8, color: '#1A6B4A', fontSize: 13 },
  roleBadge:  { display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 20 },

  /* Rankings */
  rankRow:   { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  rankBadge: { width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
};
