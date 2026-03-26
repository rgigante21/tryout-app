import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';

export default function Admin() {
  const { user, logout } = useAuth();

  // Core reference data
  const [ageGroups, setAgeGroups] = useState([]);
  const [events, setEvents]       = useState([]);
  const [users, setUsers]         = useState([]);
  const [dashboard, setDashboard] = useState([]);
  const [loading, setLoading]     = useState(true);

  // Navigation
  const [view, setView]             = useState('overview'); // overview | group | rankings | coaches
  const [activeGroup, setActiveGroup] = useState(null);

  // Coaches view — create
  const [newCoach, setNewCoach]         = useState({ firstName: '', lastName: '', email: '', password: '', role: 'scorer', sessions: new Set() });
  const [addingCoach, setAddingCoach]   = useState(false);
  const [coachError, setCoachError]     = useState('');
  const [coachSuccess, setCoachSuccess] = useState('');
  const [coachViewSessions, setCoachViewSessions] = useState([]);

  // Coaches view — edit
  const [editingCoachId, setEditingCoachId]       = useState(null);
  const [editCoach, setEditCoach]                 = useState({});
  const [editCoachSessions, setEditCoachSessions] = useState([]);
  const [allSessionsList, setAllSessionsList]     = useState([]);
  const [assigningSessionId, setAssigningSessionId] = useState('');
  const [savingCoach, setSavingCoach]             = useState(false);
  const [editCoachMsg, setEditCoachMsg]           = useState({ type: '', text: '' });

  // Overview — sessions by date
  const [todayDate, setTodayDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [todaySessions, setTodaySessions] = useState([]);
  const [todayLoading, setTodayLoading] = useState(false);

  // Session inline editing
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editSession, setEditSession]           = useState({ name: '', date: '', time: '', sessionType: 'skills' });

  // Events view
  const [newEvent, setNewEvent]         = useState({ name: '', season: '', startDate: '', endDate: '' });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [eventStats, setEventStats]     = useState(null);
  const [viewingEventId, setViewingEventId] = useState(null);
  const [eventMsg, setEventMsg]         = useState({ type: '', text: '' });

  // Group view — bulk player upload
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkText, setBulkText]             = useState('');
  const [bulkPreview, setBulkPreview]       = useState([]);
  const [bulkResult, setBulkResult]         = useState(null);
  const [bulkUploading, setBulkUploading]   = useState(false);

  // Group-view data
  const [sessions, setSessions]           = useState([]);
  const [players, setPlayers]             = useState([]);
  const [sessionScorers, setSessionScorers] = useState({}); // { [sessionId]: scorer[] }

  // Add-session form
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSession, setNewSession]         = useState({ name: '', date: '', time: '' });
  const [addingSession, setAddingSession]   = useState(false);

  // Add-player form
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayer, setNewPlayer]         = useState({ firstName: '', lastName: '', jersey: '' });
  const [addingPlayer, setAddingPlayer]   = useState(false);

  // Scorer assignment UI
  const [assigningTo, setAssigningTo]   = useState(null); // sessionId
  const [assignUserId, setAssignUserId] = useState('');

  // Session Block wizard
  const [showBlockWizard, setShowBlockWizard] = useState(false);
  const [blockWizard, setBlockWizard] = useState({
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
  });
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [blockMsg, setBlockMsg] = useState('');

  // Import wizard (replaces old bulk upload)
  const [importFile, setImportFile] = useState(null);
  const [importCsvText, setImportCsvText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importRunning, setImportRunning] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importMsg, setImportMsg] = useState('');

  // Rankings
  const [rankings, setRankings] = useState([]);

  const activeEvent = events.find(e => !e.archived) || null;

  // ── Initial load ────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.ageGroups(),
      api.events(),
      api.users(),
      api.dashboard(),
    ])
      .then(([ag, ev, us, dash]) => {
        setAgeGroups(ag.ageGroups);
        setEvents(ev.events);
        setUsers(us.users);
        setDashboard(dash.dashboard);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Sessions by date (overview panel) ───────────────────────────
  useEffect(() => {
    if (loading) return;
    setTodayLoading(true);
    api.allSessions(null, null, todayDate)
      .then(r => setTodaySessions(r.sessions || []))
      .catch(() => setTodaySessions([]))
      .finally(() => setTodayLoading(false));
  }, [todayDate, loading]);

  // ── Load group data ──────────────────────────────────────────────
  const loadGroupData = useCallback(async (group, eventId) => {
    const [sessRes, playRes] = await Promise.all([
      api.allSessions(group.id, eventId),
      api.players(group.id, eventId),
    ]);
    const sessionList = sessRes.sessions;
    setSessions(sessionList);
    setPlayers(playRes.players);

    // Pre-load scorers for all sessions in parallel
    if (sessionList.length > 0) {
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
    setSessions([]);
    setPlayers([]);
    setSessionScorers({});
    setShowAddSession(false);
    setShowAddPlayer(false);
    setAssigningTo(null);
    if (activeEvent) await loadGroupData(group, activeEvent.id);
  };

  const openRankings = async (group) => {
    setActiveGroup(group);
    setView('rankings');
    setRankings([]);
    if (activeEvent) {
      const data = await api.rankings(group.id, activeEvent.id);
      setRankings(data.rankings || []);
    }
  };

  // ── Session actions ──────────────────────────────────────────────
  const refreshEvents = async () => {
    const ev = await api.events();
    setEvents(ev.events);
  };

  const addSession = async () => {
    if (!newSession.name || !newSession.date || !newSession.time || !activeEvent) return;
    setAddingSession(true);
    try {
      const r = await api.createSession({
        eventId:     activeEvent.id,
        ageGroupId:  activeGroup.id,
        name:        newSession.name,
        sessionDate: newSession.date,
        startTime:   newSession.time,
      });
      setSessions(s => [...s, r.session]);
      setSessionScorers(ss => ({ ...ss, [r.session.id]: [] }));
      setNewSession({ name: '', date: '', time: '' });
      setShowAddSession(false);
      refreshEvents();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingSession(false);
    }
  };

  const updateStatus = async (sessionId, status) => {
    try {
      const r = await api.updateSession(sessionId, { status });
      setSessions(s => s.map(x => x.id === sessionId ? { ...x, status: r.session.status } : x));
    } catch (err) {
      alert(err.message);
    }
  };

  const removeSession = async (sessionId) => {
    if (!window.confirm('Delete this session and all its scores?')) return;
    try {
      await api.deleteSession(sessionId);
      setSessions(s => s.filter(x => x.id !== sessionId));
      refreshEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Scorer actions ───────────────────────────────────────────────
  const assignScorer = async (sessionId) => {
    if (!assignUserId) return;
    try {
      await api.assignScorer(sessionId, parseInt(assignUserId));
      const r = await api.sessionScorers(sessionId);
      setSessionScorers(ss => ({ ...ss, [sessionId]: r.scorers }));
      setAssigningTo(null);
      setAssignUserId('');
    } catch (err) {
      alert(err.message);
    }
  };

  const unassignScorer = async (sessionId, userId) => {
    try {
      await api.unassignScorer(sessionId, userId);
      setSessionScorers(ss => ({
        ...ss,
        [sessionId]: (ss[sessionId] || []).filter(u => u.id !== userId),
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Player actions ───────────────────────────────────────────────
  const addPlayer = async () => {
    if (!newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey || !activeEvent) return;
    setAddingPlayer(true);
    try {
      const r = await api.addPlayer({
        firstName:    newPlayer.firstName,
        lastName:     newPlayer.lastName,
        jerseyNumber: parseInt(newPlayer.jersey),
        ageGroupId:   activeGroup.id,
        eventId:      activeEvent.id,
      });
      setPlayers(p => [...p, r.player].sort((a, b) => a.jersey_number - b.jersey_number));
      setNewPlayer({ firstName: '', lastName: '', jersey: '' });
      setShowAddPlayer(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingPlayer(false);
    }
  };

  const removePlayer = async (playerId) => {
    if (!window.confirm('Remove this player?')) return;
    try {
      await api.deletePlayer(playerId);
      setPlayers(p => p.filter(x => x.id !== playerId));
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Session edit actions ─────────────────────────────────────────
  const startEditSession = (sess) => {
    setEditingSessionId(sess.id);
    setEditSession({
      name: sess.name,
      date: sess.session_date ? sess.session_date.slice(0, 10) : '',
      time: sess.start_time   ? sess.start_time.slice(0, 5)    : '',
      sessionType: sess.session_type || 'skills',
    });
  };

  const saveSessionEdit = async () => {
    if (!editSession.name || !editSession.date) return;
    try {
      const r = await api.updateSession(editingSessionId, {
        name:        editSession.name,
        sessionDate: editSession.date,
        startTime:   editSession.time || null,
        sessionType: editSession.sessionType,
      });
      setSessions(s => s.map(x => x.id === editingSessionId ? { ...x, ...r.session } : x));
      setEditingSessionId(null);
      refreshEvents();
    } catch (err) { alert(err.message); }
  };

  // ── Event actions ────────────────────────────────────────────────
  const createEvent = async () => {
    const { name, season, startDate, endDate } = newEvent;
    if (!name || !season || !startDate || !endDate) return;
    setCreatingEvent(true);
    setEventMsg({ type: '', text: '' });
    try {
      const r = await api.createEvent({ name, season, startDate, endDate });
      const ev = await api.events();
      setEvents(ev.events);
      setNewEvent({ name: '', season: '', startDate: '', endDate: '' });
      setShowCreateEvent(false);
      setEventMsg({ type: 'success', text: `"${r.event.name}" created.` });
    } catch (err) {
      setEventMsg({ type: 'error', text: err.message });
    } finally { setCreatingEvent(false); }
  };

  const archiveEvent = async (id) => {
    if (!window.confirm('Archive this event? All data is preserved. A new active event can then be created.')) return;
    try {
      await api.archiveEvent(id, true);
      const ev = await api.events();
      setEvents(ev.events);
      setEventMsg({ type: 'success', text: 'Event archived.' });
    } catch (err) {
      setEventMsg({ type: 'error', text: err.message });
    }
  };

  const loadEventStats = async (id) => {
    if (viewingEventId === id) { setViewingEventId(null); setEventStats(null); return; }
    setViewingEventId(id);
    setEventStats(null);
    const data = await api.eventStats(id);
    setEventStats(data);
  };

  // ── Coach actions ────────────────────────────────────────────────
  const addCoach = async () => {
    const { firstName, lastName, email, password, role, sessions } = newCoach;
    if (!firstName || !lastName || !email || !password) return;
    setAddingCoach(true);
    setCoachError('');
    setCoachSuccess('');
    try {
      const created = await api.register({ firstName, lastName, email, password, role });
      const newUserId = created.user.id;
      // Assign any pre-selected sessions
      if (sessions.size > 0) {
        await Promise.all([...sessions].map(sid => api.assignScorer(sid, newUserId)));
      }
      const updated = await api.users();
      setUsers(updated.users);
      const sessionLabel = sessions.size > 0 ? ` · assigned to ${sessions.size} session${sessions.size !== 1 ? 's' : ''}` : '';
      setNewCoach({ firstName: '', lastName: '', email: '', password: '', role: 'scorer', sessions: new Set() });
      setCoachSuccess(`Account created for ${firstName} ${lastName}${sessionLabel}.`);
    } catch (err) {
      setCoachError(err.message);
    } finally {
      setAddingCoach(false);
    }
  };

  // ── Coach edit actions ────────────────────────────────────────────
  const openEditCoach = async (u) => {
    if (editingCoachId === u.id) { setEditingCoachId(null); return; }
    setEditingCoachId(u.id);
    setEditCoach({ firstName: u.first_name, lastName: u.last_name, email: u.email, role: u.role, password: '' });
    setEditCoachMsg({ type: '', text: '' });
    setEditCoachSessions([]);
    setAssigningSessionId('');
    const [assigned, all] = await Promise.all([
      api.userSessions(u.id),
      activeEvent ? api.allSessions(null, activeEvent.id) : Promise.resolve({ sessions: [] }),
    ]);
    setEditCoachSessions(assigned.sessions || []);
    setAllSessionsList(all.sessions || []);
  };

  const assignSessionToCoach = async () => {
    if (!assigningSessionId) return;
    try {
      await api.assignScorer(parseInt(assigningSessionId), editingCoachId);
      const r = await api.userSessions(editingCoachId);
      setEditCoachSessions(r.sessions || []);
      setAssigningSessionId('');
    } catch (err) {
      setEditCoachMsg({ type: 'error', text: err.message });
    }
  };

  const saveCoach = async () => {
    setSavingCoach(true);
    setEditCoachMsg({ type: '', text: '' });
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
    } catch (err) {
      setEditCoachMsg({ type: 'error', text: err.message });
    } finally {
      setSavingCoach(false);
    }
  };

  const unassignCoachFromSession = async (sessionId) => {
    await api.unassignScorer(sessionId, editingCoachId);
    setEditCoachSessions(s => s.filter(x => x.id !== sessionId));
  };

  // ── Bulk upload actions ───────────────────────────────────────────
  const parseBulkText = (text) => {
    setBulkText(text);
    setBulkResult(null);
    const lines = text.trim().split('\n').filter(l => l.trim());
    const preview = [];
    for (const line of lines) {
      if (/first\s*name/i.test(line)) continue; // skip header
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        preview.push({ firstName: parts[0], lastName: parts[1], jerseyNumber: parts[2] });
      }
    }
    setBulkPreview(preview);
  };

  const submitBulk = async () => {
    if (!bulkPreview.length || !activeEvent) return;
    setBulkUploading(true);
    try {
      const r = await api.bulkPlayers({ players: bulkPreview, ageGroupId: activeGroup.id, eventId: activeEvent.id });
      setBulkResult(r);
      if (r.added.length) {
        setPlayers(p => [...p, ...r.added].sort((a, b) => a.jersey_number - b.jersey_number));
      }
      setBulkText('');
      setBulkPreview([]);
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkUploading(false);
    }
  };

  // ── Session Block wizard handlers ─────────────────────────────────────────────
  const openBlockWizard = () => {
    setBlockWizard({
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
    });
    setBlockMsg('');
    setShowBlockWizard(true);
    setShowAddSession(false);
  };

  const updateSlot = (i, field, val) =>
    setBlockWizard(w => ({ ...w, slots: w.slots.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }));

  const addSlot = () =>
    setBlockWizard(w => ({ ...w, slots: [...w.slots, { time: '', lastNameStart: 'A', lastNameEnd: 'Z', jerseyMin: '', jerseyMax: '' }] }));

  const removeSlot = (i) =>
    setBlockWizard(w => ({ ...w, slots: w.slots.filter((_, idx) => idx !== i) }));

  const updateTeam = (i, field, val) =>
    setBlockWizard(w => ({ ...w, teams: w.teams.map((t, idx) => idx === i ? { ...t, [field]: val } : t) }));

  const addTeam = () =>
    setBlockWizard(w => {
      const next = w.teams.length + 1;
      return { ...w, teams: [...w.teams, { teamNumber: next, jerseyColor: 'white', label: `Team ${next}` }] };
    });

  const removeTeam = (i) =>
    setBlockWizard(w => ({ ...w, teams: w.teams.filter((_, idx) => idx !== i) }));

  const updateGame = (i, field, val) =>
    setBlockWizard(w => ({ ...w, games: w.games.map((g, idx) => idx === i ? { ...g, [field]: val } : g) }));

  const addGame = () =>
    setBlockWizard(w => ({ ...w, games: [...w.games, { time: '', homeTeam: 1, awayTeam: 2 }] }));

  const removeGame = (i) =>
    setBlockWizard(w => ({ ...w, games: w.games.filter((_, idx) => idx !== i) }));

  const handleSuggestRanges = async () => {
    if (!sessions.length && !activeEvent) return;
    // We don't have a block id yet — suggest based on player count
    const slotCount = blockWizard.slots.length;
    const total = players.length;
    if (!total) { setBlockMsg('Add players first to get range suggestions.'); return; }
    // Simple even split across A-Z
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const chunkSize = Math.ceil(26 / slotCount);
    const suggested = [];
    for (let i = 0; i < slotCount; i++) {
      const start = letters[i * chunkSize] || letters[letters.length - 1];
      const end   = letters[Math.min((i + 1) * chunkSize - 1, 25)];
      suggested.push({ ...blockWizard.slots[i] || {}, lastNameStart: start, lastNameEnd: end });
    }
    setBlockWizard(w => ({ ...w, slots: suggested }));
    setBlockMsg(`Suggested ${slotCount} ranges across A–Z. Adjust as needed.`);
  };

  const createBlock = async () => {
    if (!blockWizard.date || !activeEvent) return;
    setCreatingBlock(true);
    setBlockMsg('');
    try {
      const payload = {
        eventId:      activeEvent.id,
        ageGroupId:   activeGroup.id,
        blockType:    blockWizard.blockType,
        splitMethod:  blockWizard.splitMethod,
        label:        blockWizard.label || null,
        sessionDate:  blockWizard.date,
        scoringMode:  blockWizard.scoringMode,
      };

      if (blockWizard.blockType === 'skills') {
        payload.slots = blockWizard.slots.map(slot => ({
          time:           slot.time || null,
          lastNameStart:  slot.lastNameStart || null,
          lastNameEnd:    slot.lastNameEnd || null,
          jerseyMin:      slot.jerseyMin ? parseInt(slot.jerseyMin) : null,
          jerseyMax:      slot.jerseyMax ? parseInt(slot.jerseyMax) : null,
        }));
      } else {
        payload.teamCount        = blockWizard.teams.length;
        payload.teams            = blockWizard.teams;
        payload.games            = blockWizard.games.map(g => ({
          ...g, homeTeam: parseInt(g.homeTeam), awayTeam: parseInt(g.awayTeam),
        }));
        payload.playerAssignment = blockWizard.playerAssignment;
      }

      const r = await api.createSessionBlock(payload);
      setSessions(prev => [...prev, ...r.sessions]);
      setShowBlockWizard(false);
      setBlockMsg('');
      refreshEvents();
    } catch (err) {
      setBlockMsg(err.message || 'Failed to create block');
    } finally {
      setCreatingBlock(false);
    }
  };

  // ── CSV Import handlers ──────────────────────────────────────────
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    setImportMsg('');
    const text = await file.text();
    setImportCsvText(text);
    // Auto-preview
    try {
      setImportRunning(true);
      const r = await api.importPreview({ csvText: text, eventId: activeEvent.id, ageGroupId: activeGroup.id });
      setImportPreview(r.preview);
      setImportSummary(r.summary);
    } catch (err) {
      setImportMsg(err.message || 'Failed to parse CSV');
    } finally {
      setImportRunning(false);
    }
  };

  const commitImport = async () => {
    if (!importCsvText || !activeEvent) return;
    setImportRunning(true);
    setImportResult(null);
    try {
      const r = await api.importCommit({ csvText: importCsvText, eventId: activeEvent.id, ageGroupId: activeGroup.id });
      setImportResult(r);
      if (r.added?.length) {
        setPlayers(p => [...p, ...r.added].sort((a, b) => a.jersey_number - b.jersey_number));
      }
      setImportFile(null);
      setImportCsvText('');
      setImportPreview(null);
      setImportSummary(null);
    } catch (err) {
      setImportMsg(err.message || 'Import failed');
    } finally {
      setImportRunning(false);
    }
  };

  const clearImport = () => {
    setImportFile(null);
    setImportCsvText('');
    setImportPreview(null);
    setImportSummary(null);
    setImportResult(null);
    setImportMsg('');
  };

  // ── Helpers ──────────────────────────────────────────────────────
  const groupStats = (code) =>
    dashboard.find(d => d.age_group_code === code) ||
    { total_sessions: 0, complete_sessions: 0, total_players: 0, total_scores: 0 };

  const fmt = {
    date: (d) => {
      if (!d) return '';
      const s = String(d).slice(0, 10);
      const [y, m, day] = s.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
    },
    time: (t) => {
      if (!t) return '';
      const [h, m] = String(t).slice(0, 5).split(':');
      const hr = parseInt(h, 10);
      return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
    },
  };

  const STATUS_STYLE = {
    pending:  { background: 'var(--bg3)',      color: 'var(--text2)',     border: '1px solid var(--border)' },
    active:   { background: 'var(--amber-bg)', color: 'var(--amber-txt)', border: '1px solid var(--amber)' },
    complete: { background: 'var(--green-bg)', color: 'var(--green-txt)', border: '1px solid var(--green)' },
  };

  // ════════════════════════════════════════════════════════════════
  // OVERVIEW
  // ════════════════════════════════════════════════════════════════
  if (view === 'overview') return (
    <div style={s.page}>
      <div style={s.brandBar} />
      <div style={s.topbar}>
        <div style={s.topbarLeft}>
          <img src="/wyh-logo.jpeg" alt="WYH" style={s.logoImg} />
          <div>
            <h1 style={s.h1}>Admin Dashboard</h1>
            <p style={s.sub}>{user?.firstName} {user?.lastName} · {user?.role}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setView('events'); setEventMsg({ type:'', text:'' }); }} style={s.navBtn}>Events</button>
          <button onClick={async () => {
            setView('coaches');
            if (activeEvent) {
              const r = await api.allSessions(null, activeEvent.id);
              setCoachViewSessions(r.sessions || []);
            }
          }} style={s.navBtn}>Coaches</button>
          <button onClick={logout} style={s.signOutBtn}>Sign out</button>
        </div>
      </div>

      {loading && <p style={s.muted}>Loading...</p>}

      {!loading && activeEvent && (
        <div style={s.eventBadge}>{activeEvent.name}</div>
      )}

      {!loading && (
        <>
          {/* ── Sessions by date panel ── */}
          <div style={{ ...s.sectionHeader, marginBottom: 10 }}>
            <div style={s.label}>Sessions by Date</div>
            <input
              type="date"
              value={todayDate}
              onChange={e => setTodayDate(e.target.value)}
              style={{ ...s.select, fontSize: 12, padding: '4px 8px' }}
            />
          </div>
          {todayLoading && <p style={s.muted}>Loading...</p>}
          {!todayLoading && todaySessions.length === 0 && (
            <div style={{ ...s.emptyCard, marginBottom: 20 }}>No sessions scheduled for this date.</div>
          )}
          {!todayLoading && todaySessions.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              {todaySessions.map(sess => {
                const sc = STATUS_STYLE[sess.status] || STATUS_STYLE.pending;
                return (
                  <div key={sess.id} style={s.sessionCard}>
                    <div style={s.sessionTop}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--blue-txt)', fontWeight: 600, marginBottom: 3 }}>
                          {sess.age_group}
                        </div>
                        <div style={s.sessionName}>{sess.name}</div>
                        <div style={s.sessionMeta}>
                          {fmt.date(sess.session_date)}
                          {sess.start_time ? ' · ' + fmt.time(sess.start_time) : ''}
                          {' · '}{sess.player_count} players
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ ...s.statusSelect, ...sc, padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                          {sess.status}
                        </span>
                        <button
                          onClick={() => openGroup(ageGroups.find(g => g.id === sess.age_group_id) || { id: sess.age_group_id, name: sess.age_group })}
                          style={s.ghostBtn}
                        >
                          Manage →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={s.label}>Age Groups — click to manage</div>
          <div style={s.groupGrid}>
            {ageGroups.map(g => {
              const stats = groupStats(g.code);
              const pct = stats.total_sessions > 0
                ? Math.round(stats.complete_sessions / stats.total_sessions * 100)
                : 0;
              return (
                <div
                  key={g.id}
                  style={s.groupCard}
                  onClick={() => openGroup(g)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={s.groupName}>{g.name}</div>

                  <div style={s.statRow}>
                    <div style={s.stat}>
                      <div style={s.statNum}>{stats.total_players}</div>
                      <div style={s.statLabel}>Players</div>
                    </div>
                    <div style={s.stat}>
                      <div style={s.statNum}>{stats.total_sessions}</div>
                      <div style={s.statLabel}>Sessions</div>
                    </div>
                    <div style={s.stat}>
                      <div style={s.statNum}>{stats.total_scores}</div>
                      <div style={s.statLabel}>Scores</div>
                    </div>
                  </div>

                  <div style={s.progressTrack}>
                    <div style={{ ...s.progressFill, width: pct + '%' }} />
                  </div>

                  <div style={s.groupFooter}>
                    <span style={s.manageLink}>Manage sessions & players →</span>
                    <span
                      style={s.rankLink}
                      onClick={e => { e.stopPropagation(); openRankings(g); }}
                    >
                      Rankings
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // GROUP SETUP
  // ════════════════════════════════════════════════════════════════
  if (view === 'group') return (
    <div style={s.page}>
      <div style={s.brandBar} />
      <button onClick={() => setView('overview')} style={s.backBtn}>← Overview</button>

      <div style={s.topbar}>
        <div style={s.topbarLeft}>
          <img src="/wyh-logo.jpeg" alt="WYH" style={s.logoImg} />
          <div>
            <h1 style={s.h1}>{activeGroup?.name}</h1>
            <p style={s.sub}>{activeEvent?.name}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => openRankings(activeGroup)} style={s.navBtn}>Rankings</button>
          <button onClick={logout} style={s.signOutBtn}>Sign out</button>
        </div>
      </div>

      {/* ── Sessions section ── */}
      <div style={s.sectionHeader}>
        <div style={s.label}>Sessions ({sessions.length})</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setShowAddSession(v => !v); setShowBlockWizard(false); }}
            style={showAddSession ? s.ghostBtn : s.ghostBtn}
          >
            {showAddSession ? 'Cancel' : '+ Single Session'}
          </button>
          <button
            onClick={() => showBlockWizard ? setShowBlockWizard(false) : openBlockWizard()}
            style={showBlockWizard ? s.ghostBtn : s.primaryBtn}
          >
            {showBlockWizard ? 'Cancel' : '+ Session Block'}
          </button>
        </div>
      </div>

      {/* ── Single session form (legacy) ── */}
      {showAddSession && (
        <div style={s.formCard}>
          <div style={{ ...s.fieldLabel, marginBottom: 10, color: 'var(--text2)' }}>
            Single session — no automatic player split. Use <strong>Session Block</strong> for last-name or team splits.
          </div>
          <div style={s.formRow}>
            <div style={{ flex: 2 }}>
              <label style={s.fieldLabel}>Session name</label>
              <input
                placeholder="e.g. Day 1 Session 1"
                value={newSession.name}
                onChange={e => setNewSession(n => ({ ...n, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addSession()}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.fieldLabel}>Date</label>
              <input
                type="date"
                value={newSession.date}
                onChange={e => setNewSession(n => ({ ...n, date: e.target.value }))}
              />
            </div>
            <div style={{ width: 110 }}>
              <label style={s.fieldLabel}>Start time <span style={{ color: 'var(--red-txt)' }}>*</span></label>
              <input
                type="time"
                value={newSession.time}
                onChange={e => setNewSession(n => ({ ...n, time: e.target.value }))}
                required
              />
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
            ⏱ Sessions auto-activate 10 minutes before start time.
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              onClick={addSession}
              disabled={addingSession || !newSession.name || !newSession.date || !newSession.time}
              style={s.saveBtn}
            >
              {addingSession ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </div>
      )}

      {/* ── Session Block wizard ── */}
      {showBlockWizard && (
        <div style={{ ...s.formCard, borderColor: 'var(--blue)', borderWidth: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
            Session Block Setup
          </div>

          {/* Label + Date row */}
          <div style={s.formRow}>
            <div style={{ flex: 2 }}>
              <label style={s.fieldLabel}>Block label <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
              <input
                placeholder="e.g. Mites Skills — Monday"
                value={blockWizard.label}
                onChange={e => setBlockWizard(w => ({ ...w, label: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.fieldLabel}>Date <span style={{ color: 'var(--red-txt)' }}>*</span></label>
              <input
                type="date"
                value={blockWizard.date}
                onChange={e => setBlockWizard(w => ({ ...w, date: e.target.value }))}
              />
            </div>
          </div>

          {/* Block type toggle */}
          <div style={{ marginTop: 14 }}>
            <div style={s.fieldLabel}>Block type</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {[
                { val: 'skills', label: '🏒 Skills Session', desc: 'Individual player evaluation' },
                { val: 'game',   label: '🥅 Game Session',   desc: 'Team-based game play' },
              ].map(opt => (
                <div
                  key={opt.val}
                  onClick={() => setBlockWizard(w => ({ ...w, blockType: opt.val }))}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    border: `2px solid ${blockWizard.blockType === opt.val ? 'var(--blue)' : 'var(--border)'}`,
                    background: blockWizard.blockType === opt.val ? 'var(--blue-bg)' : 'var(--bg3)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SKILLS config ── */}
          {blockWizard.blockType === 'skills' && (
            <>
              {/* Split method */}
              <div style={{ marginTop: 14 }}>
                <div style={s.fieldLabel}>Player split method</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {[
                    { val: 'last_name',    label: 'By Last Name' },
                    { val: 'jersey_range', label: 'By Jersey #' },
                    { val: 'none',         label: 'All Together' },
                    { val: 'manual',       label: 'Manual' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setBlockWizard(w => ({ ...w, splitMethod: opt.val }))}
                      style={{
                        padding: '6px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13,
                        border: `2px solid ${blockWizard.splitMethod === opt.val ? 'var(--blue)' : 'var(--border)'}`,
                        background: blockWizard.splitMethod === opt.val ? 'var(--blue-bg)' : 'var(--bg3)',
                        color: 'var(--text)', fontWeight: blockWizard.splitMethod === opt.val ? 600 : 400,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scoring mode */}
              <div style={{ marginTop: 12 }}>
                <label style={s.fieldLabel}>Scoring mode</label>
                <select
                  value={blockWizard.scoringMode}
                  onChange={e => setBlockWizard(w => ({ ...w, scoringMode: e.target.value }))}
                  style={{ ...s.select, marginTop: 4 }}
                >
                  <option value="full">Full — every player scored on every criterion</option>
                  <option value="observe">Observe — flag standout players only</option>
                </select>
              </div>

              {/* Time slots */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={s.fieldLabel}>
                    {blockWizard.splitMethod === 'last_name'    && 'Time slots — Last Name ranges'}
                    {blockWizard.splitMethod === 'jersey_range' && 'Time slots — Jersey # ranges'}
                    {blockWizard.splitMethod === 'none'         && 'Time slot'}
                    {blockWizard.splitMethod === 'manual'       && 'Time slots'}
                  </div>
                  {blockWizard.splitMethod === 'last_name' && (
                    <button onClick={handleSuggestRanges} style={{ ...s.ghostBtn, fontSize: 11 }}>
                      ✦ Suggest ranges
                    </button>
                  )}
                </div>

                {blockWizard.slots.map((slot, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                    <div style={{ width: 110 }}>
                      {i === 0 && <label style={s.fieldLabel}>Start time</label>}
                      <input
                        type="time"
                        value={slot.time}
                        onChange={e => updateSlot(i, 'time', e.target.value)}
                      />
                    </div>

                    {blockWizard.splitMethod === 'last_name' && (
                      <>
                        <div style={{ width: 70 }}>
                          {i === 0 && <label style={s.fieldLabel}>From</label>}
                          <input
                            placeholder="A"
                            maxLength={3}
                            value={slot.lastNameStart}
                            onChange={e => updateSlot(i, 'lastNameStart', e.target.value.toUpperCase())}
                            style={{ textAlign: 'center', fontWeight: 600 }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 8, color: 'var(--text3)', fontSize: 16 }}>—</div>
                        <div style={{ width: 70 }}>
                          {i === 0 && <label style={s.fieldLabel}>To</label>}
                          <input
                            placeholder="Z"
                            maxLength={3}
                            value={slot.lastNameEnd}
                            onChange={e => updateSlot(i, 'lastNameEnd', e.target.value.toUpperCase())}
                            style={{ textAlign: 'center', fontWeight: 600 }}
                          />
                        </div>
                      </>
                    )}

                    {blockWizard.splitMethod === 'jersey_range' && (
                      <>
                        <div style={{ width: 80 }}>
                          {i === 0 && <label style={s.fieldLabel}>Jersey min</label>}
                          <input
                            type="number" min="1" placeholder="1"
                            value={slot.jerseyMin}
                            onChange={e => updateSlot(i, 'jerseyMin', e.target.value)}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 8, color: 'var(--text3)', fontSize: 16 }}>—</div>
                        <div style={{ width: 80 }}>
                          {i === 0 && <label style={s.fieldLabel}>Jersey max</label>}
                          <input
                            type="number" min="1" placeholder="99"
                            value={slot.jerseyMax}
                            onChange={e => updateSlot(i, 'jerseyMax', e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    {blockWizard.slots.length > 1 && (
                      <button
                        onClick={() => removeSlot(i)}
                        style={{ ...s.deleteBtn, marginBottom: 2 }}
                        title="Remove slot"
                      >×</button>
                    )}
                  </div>
                ))}

                {blockWizard.splitMethod !== 'none' && (
                  <button onClick={addSlot} style={{ ...s.ghostBtn, fontSize: 12, marginTop: 4 }}>
                    + Add slot
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── GAME config ── */}
          {blockWizard.blockType === 'game' && (
            <>
              {/* Teams */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={s.fieldLabel}>Teams</div>
                  <button onClick={addTeam} style={{ ...s.ghostBtn, fontSize: 11 }}>+ Add team</button>
                </div>
                {blockWizard.teams.map((team, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                    <div style={{ width: 90 }}>
                      {i === 0 && <label style={s.fieldLabel}>Label</label>}
                      <input
                        placeholder={`Team ${team.teamNumber}`}
                        value={team.label}
                        onChange={e => updateTeam(i, 'label', e.target.value)}
                      />
                    </div>
                    <div style={{ width: 120 }}>
                      {i === 0 && <label style={s.fieldLabel}>Jersey color</label>}
                      <select
                        value={team.jerseyColor}
                        onChange={e => updateTeam(i, 'jerseyColor', e.target.value)}
                        style={s.select}
                      >
                        <option value="white">White</option>
                        <option value="maroon">Maroon</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="green">Green</option>
                        <option value="black">Black</option>
                        <option value="red">Red</option>
                        <option value="blue">Blue</option>
                      </select>
                    </div>
                    {blockWizard.teams.length > 2 && (
                      <button onClick={() => removeTeam(i)} style={s.deleteBtn} title="Remove team">×</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Player assignment */}
              <div style={{ marginTop: 12 }}>
                <div style={s.fieldLabel}>Player assignment to teams</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {[
                    { val: 'random', label: '🎲 Random',  desc: 'Auto-shuffle players to teams' },
                    { val: 'manual', label: '✋ Manual',   desc: 'Assign players yourself later' },
                  ].map(opt => (
                    <div
                      key={opt.val}
                      onClick={() => setBlockWizard(w => ({ ...w, playerAssignment: opt.val }))}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        border: `2px solid ${blockWizard.playerAssignment === opt.val ? 'var(--blue)' : 'var(--border)'}`,
                        background: blockWizard.playerAssignment === opt.val ? 'var(--blue-bg)' : 'var(--bg3)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scoring mode */}
              <div style={{ marginTop: 12 }}>
                <label style={s.fieldLabel}>Scoring mode</label>
                <select
                  value={blockWizard.scoringMode}
                  onChange={e => setBlockWizard(w => ({ ...w, scoringMode: e.target.value }))}
                  style={{ ...s.select, marginTop: 4 }}
                >
                  <option value="full">Full — every player scored every game</option>
                  <option value="observe">Observe — flag standout players only</option>
                </select>
              </div>

              {/* Game matchups */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={s.fieldLabel}>Game matchups</div>
                  <button onClick={addGame} style={{ ...s.ghostBtn, fontSize: 11 }}>+ Add game</button>
                </div>
                {blockWizard.games.map((game, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                    <div style={{ width: 110 }}>
                      {i === 0 && <label style={s.fieldLabel}>Start time</label>}
                      <input
                        type="time"
                        value={game.time}
                        onChange={e => updateGame(i, 'time', e.target.value)}
                      />
                    </div>
                    <div style={{ width: 80 }}>
                      {i === 0 && <label style={s.fieldLabel}>Home team</label>}
                      <select
                        value={game.homeTeam}
                        onChange={e => updateGame(i, 'homeTeam', e.target.value)}
                        style={s.select}
                      >
                        {blockWizard.teams.map(t => (
                          <option key={t.teamNumber} value={t.teamNumber}>{t.label || `Team ${t.teamNumber}`}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 8, color: 'var(--text3)', fontSize: 12, fontWeight: 600 }}>vs</div>
                    <div style={{ width: 80 }}>
                      {i === 0 && <label style={s.fieldLabel}>Away team</label>}
                      <select
                        value={game.awayTeam}
                        onChange={e => updateGame(i, 'awayTeam', e.target.value)}
                        style={s.select}
                      >
                        {blockWizard.teams.map(t => (
                          <option key={t.teamNumber} value={t.teamNumber}>{t.label || `Team ${t.teamNumber}`}</option>
                        ))}
                      </select>
                    </div>
                    {blockWizard.games.length > 1 && (
                      <button onClick={() => removeGame(i)} style={s.deleteBtn} title="Remove game">×</button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {blockMsg && (
            <div style={{ ...s.errorBox, marginTop: 10 }}>{blockMsg}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={createBlock}
              disabled={creatingBlock || !blockWizard.date}
              style={s.saveBtn}
            >
              {creatingBlock ? 'Creating...' : `Create ${blockWizard.blockType === 'game' ? 'Game' : 'Skills'} Block`}
            </button>
            <button onClick={() => setShowBlockWizard(false)} style={s.ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {sessions.length === 0 && !showAddSession && !showBlockWizard && (
        <div style={s.emptyCard}>
          No sessions yet. Use <strong>+ Session Block</strong> to create a skills or game session with automatic player splits.
        </div>
      )}

      {sessions.map(sess => {
        const sc = STATUS_STYLE[sess.status] || STATUS_STYLE.pending;
        const scorers = sessionScorers[sess.id] || [];
        const isAssigning = assigningTo === sess.id;
        const assignable = users.filter(u => !scorers.find(sc => sc.id === u.id));

        const isEditing = editingSessionId === sess.id;
        return (
          <div key={sess.id} style={s.sessionCard}>
            {isEditing ? (
              <div style={{ marginBottom: 10 }}>
                <div style={s.formRow}>
                  <div style={{ flex: 2 }}>
                    <label style={s.fieldLabel}>Session name</label>
                    <input
                      value={editSession.name}
                      onChange={e => setEditSession(n => ({ ...n, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && saveSessionEdit()}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={s.fieldLabel}>Date</label>
                    <input type="date" value={editSession.date} onChange={e => setEditSession(n => ({ ...n, date: e.target.value }))} />
                  </div>
                  <div style={{ width: 110 }}>
                    <label style={s.fieldLabel}>Start time</label>
                    <input type="time" value={editSession.time} onChange={e => setEditSession(n => ({ ...n, time: e.target.value }))} />
                  </div>
                  <div style={{ width: 120 }}>
                    <label style={s.fieldLabel}>Session type</label>
                    <select value={editSession.sessionType} onChange={e => setEditSession(n => ({ ...n, sessionType: e.target.value }))}>
                      <option value="skills">Skills</option>
                      <option value="game">Game</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={saveSessionEdit} style={s.saveBtn}>Save</button>
                  <button onClick={() => setEditingSessionId(null)} style={s.ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={s.sessionTop}>
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      background: sess.session_type === 'game' ? 'var(--amber-bg)' : 'var(--blue-bg)',
                      color: sess.session_type === 'game' ? 'var(--amber-txt)' : 'var(--blue-txt)',
                      border: `1px solid ${sess.session_type === 'game' ? 'var(--amber)' : 'var(--blue)'}`,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {sess.session_type === 'game' ? '🥅 Game' : '🏒 Skills'}
                    </span>
                    {sess.last_name_start && sess.last_name_end && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)',
                      }}>
                        {sess.last_name_start}–{sess.last_name_end}
                      </span>
                    )}
                    {sess.home_team && sess.away_team && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)',
                      }}>
                        T{sess.home_team} vs T{sess.away_team}
                      </span>
                    )}
                  </div>
                  <div style={s.sessionName}>{sess.name}</div>
                  <div style={s.sessionMeta}>
                    {fmt.date(sess.session_date)}
                    {sess.start_time ? ' · ' + fmt.time(sess.start_time) : ''}
                    {' · '}{sess.player_count} players
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select
                    value={sess.status}
                    onChange={e => updateStatus(sess.id, e.target.value)}
                    style={{ ...s.statusSelect, ...sc }}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="complete">Complete</option>
                  </select>
                  <button onClick={() => startEditSession(sess)} style={{ ...s.ghostBtn, fontSize: 11 }} title="Edit">✎</button>
                  <button onClick={() => removeSession(sess.id)} style={s.deleteBtn} title="Delete session">×</button>
                </div>
              </div>
            )}

            {/* Scorers row */}
            <div style={s.scorersWrap}>
              <span style={s.scorersLabel}>Scorers:</span>
              {scorers.length === 0 && !isAssigning && (
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>None assigned</span>
              )}
              {scorers.map(u => (
                <span key={u.id} style={s.scorerChip}>
                  {u.first_name} {u.last_name}
                  <button
                    onClick={() => unassignScorer(sess.id, u.id)}
                    style={s.chipX}
                    title="Remove scorer"
                  >×</button>
                </span>
              ))}
              {isAssigning ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, width: '100%' }}>
                  <select
                    value={assignUserId}
                    onChange={e => setAssignUserId(e.target.value)}
                    style={{ ...s.select, flex: 1 }}
                  >
                    <option value="">Select scorer...</option>
                    {assignable.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.role})
                      </option>
                    ))}
                  </select>
                  <button onClick={() => assignScorer(sess.id)} style={s.primaryBtn}>Assign</button>
                  <button onClick={() => { setAssigningTo(null); setAssignUserId(''); }} style={s.ghostBtn}>Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => { setAssigningTo(sess.id); setAssignUserId(''); }}
                  style={s.addScorerBtn}
                >
                  + Add scorer
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Players section ── */}
      <div style={{ ...s.sectionHeader, marginTop: 32 }}>
        <div style={s.label}>Players ({players.length})</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setShowBulkUpload(v => !v); setShowAddPlayer(false); clearImport(); setBulkResult(null); }}
            style={showBulkUpload ? s.ghostBtn : s.ghostBtn}
          >
            {showBulkUpload ? 'Cancel Import' : '↑ Import CSV'}
          </button>
          <button
            onClick={() => { setShowAddPlayer(v => !v); setShowBulkUpload(false); }}
            style={showAddPlayer ? s.ghostBtn : s.primaryBtn}
          >
            {showAddPlayer ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </div>

      {/* ── CSV Import panel ── */}
      {showBulkUpload && (
        <div style={s.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Import Players from CSV</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Supports SportEngine exports. Players auto-assign to sessions based on last name.
              </div>
            </div>
            <a
              href={api.csvTemplate()}
              style={{ ...s.ghostBtn, fontSize: 11, textDecoration: 'none', display: 'inline-block' }}
            >
              ↓ Template
            </a>
          </div>

          {!importResult && (
            <div>
              <label style={s.fieldLabel}>Select CSV file</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFile}
                style={{ display: 'block', marginTop: 6, fontSize: 13, color: 'var(--text)' }}
              />
            </div>
          )}

          {importRunning && (
            <div style={{ marginTop: 12, color: 'var(--text2)', fontSize: 13 }}>Parsing CSV...</div>
          )}

          {importMsg && (
            <div style={{ ...s.errorBox, marginTop: 10 }}>{importMsg}</div>
          )}

          {/* Preview table */}
          {importPreview && importSummary && !importResult && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                {[
                  { label: 'Valid',   val: importSummary.valid,   color: 'var(--green-txt)' },
                  { label: 'Skip',    val: importSummary.skipped, color: 'var(--amber-txt)' },
                  { label: 'Errors',  val: importSummary.errors,  color: 'var(--red-txt)'   },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ ...s.playerTable, maxHeight: 260, overflowY: 'auto' }}>
                <div style={{ ...s.playerTableHeader, display: 'grid', gridTemplateColumns: '44px 1fr 55px 90px 64px' }}>
                  <span>#</span><span>Name</span><span>Pos</span><span>Session</span><span>Status</span>
                </div>
                {importPreview.map((row, i) => (
                  <div key={i} style={{
                    ...s.playerRow,
                    display: 'grid', gridTemplateColumns: '44px 1fr 55px 90px 64px',
                    background: row.status === 'error' ? 'rgba(220,50,50,0.06)' : row.status === 'skip' ? 'rgba(200,140,0,0.06)' : 'transparent',
                  }}>
                    <span style={s.jersey}>#{row.jerseyNumber ?? '—'}</span>
                    <span style={s.playerName}>{row.firstName} {row.lastName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{row.position || '—'}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {row.assignedSession ? fmt.time(row.assignedSession.startTime) : '—'}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: row.status === 'ok' ? 'var(--green-txt)' : row.status === 'skip' ? 'var(--amber-txt)' : 'var(--red-txt)',
                    }}>
                      {row.status === 'ok' ? '✓' : row.status === 'skip' ? '↷ Skip' : '✕ Err'}
                    </span>
                  </div>
                ))}
              </div>

              {importSummary.errors > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--red-txt)' }}>
                  {importSummary.errors} row{importSummary.errors !== 1 ? 's' : ''} with errors will be skipped.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={commitImport}
                  disabled={importRunning || importSummary.valid === 0}
                  style={s.saveBtn}
                >
                  {importRunning ? 'Importing...' : `Import ${importSummary.valid} Player${importSummary.valid !== 1 ? 's' : ''}`}
                </button>
                <button onClick={clearImport} style={s.ghostBtn}>Clear</button>
              </div>
            </div>
          )}

          {importResult && (
            <div style={{ marginTop: 12 }}>
              <div style={s.successBox}>
                ✓ Imported {importResult.summary.added} player{importResult.summary.added !== 1 ? 's' : ''}.
                {importResult.summary.skipped > 0 && ` Skipped ${importResult.summary.skipped} duplicate${importResult.summary.skipped !== 1 ? 's' : ''}.`}
                {importResult.summary.errors > 0 && ` ${importResult.summary.errors} error(s).`}
              </div>
              <button onClick={() => { clearImport(); setShowBulkUpload(false); }} style={{ ...s.ghostBtn, marginTop: 8 }}>
                Done
              </button>
            </div>
          )}
        </div>
      )}

      {showAddPlayer && (
        <div style={s.formCard}>
          <div style={s.formRow}>
            <div style={{ flex: 1 }}>
              <label style={s.fieldLabel}>First name</label>
              <input
                placeholder="First"
                value={newPlayer.firstName}
                onChange={e => setNewPlayer(n => ({ ...n, firstName: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.fieldLabel}>Last name</label>
              <input
                placeholder="Last"
                value={newPlayer.lastName}
                onChange={e => setNewPlayer(n => ({ ...n, lastName: e.target.value }))}
              />
            </div>
            <div style={{ width: 90 }}>
              <label style={s.fieldLabel}>Jersey #</label>
              <input
                type="number"
                min="1"
                max="99"
                placeholder="#"
                value={newPlayer.jersey}
                onChange={e => setNewPlayer(n => ({ ...n, jersey: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={addPlayer}
              disabled={addingPlayer || !newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey}
              style={s.saveBtn}
            >
              {addingPlayer ? 'Adding...' : 'Add Player'}
            </button>
          </div>
        </div>
      )}

      {players.length === 0 && !showAddPlayer && (
        <div style={s.emptyCard}>
          No players yet. Click <strong>+ Add Player</strong> to add players to this age group.
        </div>
      )}

      {players.length > 0 && (
        <div style={s.playerTable}>
          <div style={s.playerTableHeader}>
            <span style={{ width: 50 }}>#</span>
            <span style={{ flex: 1 }}>Name</span>
            <span style={{ width: 32 }}></span>
          </div>
          {players.map(p => (
            <div key={p.id} style={s.playerRow}>
              <span style={s.jersey}>#{p.jersey_number}</span>
              <span style={s.playerName}>{p.first_name} {p.last_name}</span>
              <button onClick={() => removePlayer(p.id)} style={s.deleteBtn} title="Remove player">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // EVENTS (archive + history)
  // ════════════════════════════════════════════════════════════════
  if (view === 'events') return (
    <div style={s.page}>
      <div style={s.brandBar} />
      <button onClick={() => setView('overview')} style={s.backBtn}>← Overview</button>
      <div style={s.topbar}>
        <div style={s.topbarLeft}>
          <img src="/wyh-logo.jpeg" alt="WYH" style={s.logoImg} />
          <div>
            <h1 style={s.h1}>Tryout Events</h1>
            <p style={s.sub}>Manage seasons &amp; historical data</p>
          </div>
        </div>
        <button onClick={logout} style={s.signOutBtn}>Sign out</button>
      </div>

      {eventMsg.text && (
        <div style={eventMsg.type === 'success' ? s.successBox : s.errorBox}>{eventMsg.text}</div>
      )}

      {/* Active event */}
      {activeEvent && (
        <>
          <div style={{ ...s.label, marginTop: 8 }}>Active Event</div>
          <div style={{ ...s.formCard, borderColor: 'var(--gold-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{activeEvent.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                {activeEvent.season} &nbsp;·&nbsp; {fmt.date(activeEvent.start_date)} → {fmt.date(activeEvent.end_date)}
              </div>
            </div>
            <button
              onClick={() => archiveEvent(activeEvent.id)}
              style={{ ...s.ghostBtn, borderColor: 'var(--red)', color: 'var(--red-txt)' }}
            >
              Archive
            </button>
          </div>
        </>
      )}

      {/* Create new event */}
      <div style={{ ...s.sectionHeader, marginTop: 20 }}>
        <div style={s.label}>Create New Event</div>
        <button onClick={() => setShowCreateEvent(v => !v)} style={showCreateEvent ? s.ghostBtn : s.primaryBtn}>
          {showCreateEvent ? 'Cancel' : '+ New Event'}
        </button>
      </div>
      {showCreateEvent && (
        <div style={s.formCard}>
          <div style={s.formRow}>
            <div style={{ flex: 2 }}>
              <label style={s.fieldLabel}>Event name</label>
              <input placeholder="e.g. Fall Tryouts 2027" value={newEvent.name} onChange={e => setNewEvent(n => ({ ...n, name: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.fieldLabel}>Season</label>
              <input placeholder="2026-2027" value={newEvent.season} onChange={e => setNewEvent(n => ({ ...n, season: e.target.value }))} />
            </div>
          </div>
          <div style={{ ...s.formRow, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={s.fieldLabel}>Start date</label>
              <input type="date" value={newEvent.startDate} onChange={e => setNewEvent(n => ({ ...n, startDate: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.fieldLabel}>End date</label>
              <input type="date" value={newEvent.endDate} onChange={e => setNewEvent(n => ({ ...n, endDate: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={createEvent}
              disabled={creatingEvent || !newEvent.name || !newEvent.season || !newEvent.startDate || !newEvent.endDate}
              style={s.saveBtn}
            >
              {creatingEvent ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </div>
      )}

      {/* Archived events */}
      {events.filter(e => e.archived).length > 0 && (
        <>
          <div style={{ ...s.label, marginTop: 24 }}>Archived Events</div>
          {events.filter(e => e.archived).map(ev => {
            const isOpen = viewingEventId === ev.id;
            return (
              <div key={ev.id} style={{ ...s.sessionCard, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{ev.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {ev.season} &nbsp;·&nbsp; Archived {fmt.date(ev.archived_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => loadEventStats(ev.id)} style={s.primaryBtn}>
                      {isOpen ? 'Hide Stats' : 'View Stats'}
                    </button>
                    <button
                      onClick={async () => { await api.archiveEvent(ev.id, false); const r = await api.events(); setEvents(r.events); }}
                      style={s.ghostBtn}
                    >
                      Restore
                    </button>
                  </div>
                </div>

                {isOpen && eventStats && eventStats.event.id === ev.id && (
                  <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
                      {[
                        { label: 'Players',  val: eventStats.totalPlayers },
                        { label: 'Sessions', val: eventStats.totalSessions },
                        { label: 'Scores',   val: eventStats.totalScores },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>{val}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={s.playerTable}>
                      <div style={s.playerTableHeader}>
                        <span style={{ flex: 2 }}>Age Group</span>
                        <span style={{ width: 60, textAlign: 'center' }}>Players</span>
                        <span style={{ width: 60, textAlign: 'center' }}>Sessions</span>
                        <span style={{ width: 70, textAlign: 'center' }}>Moved Up</span>
                        <span style={{ width: 70, textAlign: 'center' }}>Retained</span>
                        <span style={{ width: 60, textAlign: 'center' }}>Left</span>
                      </div>
                      {eventStats.byAgeGroup.map(ag => (
                        <div key={ag.code} style={s.playerRow}>
                          <span style={{ flex: 2, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{ag.name}</span>
                          <span style={{ width: 60, textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>{ag.players}</span>
                          <span style={{ width: 60, textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>{ag.sessions}</span>
                          <span style={{ width: 70, textAlign: 'center', fontSize: 13, color: ag.moved_up > 0 ? 'var(--green-txt)' : 'var(--text3)' }}>{ag.moved_up}</span>
                          <span style={{ width: 70, textAlign: 'center', fontSize: 13, color: ag.retained > 0 ? 'var(--gold)' : 'var(--text3)' }}>{ag.retained}</span>
                          <span style={{ width: 60, textAlign: 'center', fontSize: 13, color: ag.left_program > 0 ? 'var(--red-txt)' : 'var(--text3)' }}>{ag.left_program}</span>
                        </div>
                      ))}
                    </div>
                    <p style={{ ...s.muted, marginTop: 10, fontSize: 11 }}>
                      Outcomes (moved up / retained / left) are set per-player in the player roster.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // COACHES
  // ════════════════════════════════════════════════════════════════
  if (view === 'coaches') return (
    <div style={s.page}>
      <div style={s.brandBar} />
      <button onClick={() => setView('overview')} style={s.backBtn}>← Overview</button>

      <div style={s.topbar}>
        <div style={s.topbarLeft}>
          <img src="/wyh-logo.jpeg" alt="WYH" style={s.logoImg} />
          <div>
            <h1 style={s.h1}>Coaches & Scorers</h1>
            <p style={s.sub}>{users.length} accounts registered</p>
          </div>
        </div>
        <button onClick={logout} style={s.signOutBtn}>Sign out</button>
      </div>

      {/* Create account form */}
      <div style={s.label}>Create Account</div>
      <div style={s.formCard}>
        <div style={s.formRow}>
          <div style={{ flex: 1 }}>
            <label style={s.fieldLabel}>First name</label>
            <input
              placeholder="First"
              value={newCoach.firstName}
              onChange={e => setNewCoach(n => ({ ...n, firstName: e.target.value }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.fieldLabel}>Last name</label>
            <input
              placeholder="Last"
              value={newCoach.lastName}
              onChange={e => setNewCoach(n => ({ ...n, lastName: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ ...s.formRow, marginTop: 12 }}>
          <div style={{ flex: 2 }}>
            <label style={s.fieldLabel}>Email</label>
            <input
              type="email"
              placeholder="coach@example.com"
              value={newCoach.email}
              onChange={e => setNewCoach(n => ({ ...n, email: e.target.value }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.fieldLabel}>Role</label>
            <select
              value={newCoach.role}
              onChange={e => setNewCoach(n => ({ ...n, role: e.target.value }))}
              style={s.select}
            >
              <option value="scorer">Scorer (coach)</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div style={{ ...s.formRow, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={s.fieldLabel}>Temporary password</label>
            <input
              type="text"
              placeholder="They can change it later"
              value={newCoach.password}
              onChange={e => setNewCoach(n => ({ ...n, password: e.target.value }))}
            />
          </div>
        </div>

        {/* Session assignment at creation */}
        {coachViewSessions.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <label style={s.fieldLabel}>Assign to sessions (optional)</label>
            <div style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              maxHeight: 180,
              overflowY: 'auto',
              padding: '6px 0',
            }}>
              {coachViewSessions.map(sess => {
                const checked = newCoach.sessions.has(sess.id);
                return (
                  <label
                    key={sess.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 12px',
                      cursor: 'pointer',
                      background: checked ? 'var(--gold-bg)' : 'transparent',
                      borderLeft: checked ? '3px solid var(--gold)' : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      style={{ width: 'auto', accentColor: 'var(--gold)', cursor: 'pointer' }}
                      onChange={() => {
                        setNewCoach(n => {
                          const next = new Set(n.sessions);
                          checked ? next.delete(sess.id) : next.add(sess.id);
                          return { ...n, sessions: next };
                        });
                      }}
                    />
                    <div>
                      <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600 }}>{sess.age_group}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)', marginLeft: 8 }}>{sess.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>
                        {fmt.date(sess.session_date)}{sess.start_time ? ' · ' + fmt.time(sess.start_time) : ''}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            {newCoach.sessions.size > 0 && (
              <p style={{ fontSize: 11, color: 'var(--gold-dark)', marginTop: 5 }}>
                {newCoach.sessions.size} session{newCoach.sessions.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {coachError && (
          <div style={s.errorBox}>{coachError}</div>
        )}
        {coachSuccess && (
          <div style={s.successBox}>{coachSuccess}</div>
        )}

        <div style={{ marginTop: 14 }}>
          <button
            onClick={addCoach}
            disabled={addingCoach || !newCoach.firstName || !newCoach.lastName || !newCoach.email || !newCoach.password}
            style={s.saveBtn}
          >
            {addingCoach ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </div>

      {/* User list with inline editing */}
      <div style={{ ...s.label, marginTop: 24 }}>All Accounts — click to edit</div>
      <div style={s.playerTable}>
        <div style={s.playerTableHeader}>
          <span style={{ flex: 1 }}>Name</span>
          <span style={{ flex: 1 }}>Email</span>
          <span style={{ width: 110 }}>Role</span>
        </div>
        {users.map(u => {
          const roleStyle =
            u.role === 'admin'       ? { background: 'var(--red-bg)',   color: 'var(--red-txt)',   border: '1px solid var(--red)' } :
            u.role === 'coordinator' ? { background: 'var(--blue-bg)',  color: 'var(--blue-txt)',  border: '1px solid var(--blue)' } :
                                       { background: 'var(--bg3)',      color: 'var(--text2)',     border: '1px solid var(--border)' };
          const isEditing = editingCoachId === u.id;
          return (
            <div key={u.id}>
              {/* Row */}
              <div
                style={{ ...s.playerRow, cursor: 'pointer', background: isEditing ? 'var(--blue-bg)' : undefined }}
                onClick={() => openEditCoach(u)}
              >
                <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
                  {u.first_name} {u.last_name}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text3)' }}>{u.email}</span>
                <span style={{ width: 110 }}>
                  <span style={{ ...s.roleBadge, ...roleStyle }}>{u.role}</span>
                </span>
              </div>

              {/* Inline edit panel */}
              {isEditing && (
                <div style={{ padding: '16px', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
                  <div style={s.formRow}>
                    <div style={{ flex: 1 }}>
                      <label style={s.fieldLabel}>First name</label>
                      <input value={editCoach.firstName || ''} onChange={e => setEditCoach(c => ({ ...c, firstName: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={s.fieldLabel}>Last name</label>
                      <input value={editCoach.lastName || ''} onChange={e => setEditCoach(c => ({ ...c, lastName: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ ...s.formRow, marginTop: 10 }}>
                    <div style={{ flex: 2 }}>
                      <label style={s.fieldLabel}>Email</label>
                      <input type="email" value={editCoach.email || ''} onChange={e => setEditCoach(c => ({ ...c, email: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={s.fieldLabel}>Role</label>
                      <select value={editCoach.role || 'scorer'} onChange={e => setEditCoach(c => ({ ...c, role: e.target.value }))} style={s.select}>
                        <option value="scorer">Scorer</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ ...s.formRow, marginTop: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={s.fieldLabel}>New password (leave blank to keep)</label>
                      <input type="text" placeholder="Enter new password..." value={editCoach.password || ''} onChange={e => setEditCoach(c => ({ ...c, password: e.target.value }))} />
                    </div>
                  </div>

                  {editCoachMsg.text && (
                    <div style={editCoachMsg.type === 'success' ? s.successBox : s.errorBox}>{editCoachMsg.text}</div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <button onClick={saveCoach} disabled={savingCoach} style={s.saveBtn}>
                      {savingCoach ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>

                  {/* Assigned sessions */}
                  <div style={{ marginTop: 18 }}>
                    <div style={{ ...s.label, marginBottom: 8 }}>Assigned Sessions</div>

                    {/* Assign new session */}
                    {(() => {
                      const assignedIds = new Set(editCoachSessions.map(s => s.id));
                      const available = allSessionsList.filter(s => !assignedIds.has(s.id));
                      return available.length > 0 ? (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          <select
                            value={assigningSessionId}
                            onChange={e => setAssigningSessionId(e.target.value)}
                            style={{ ...s.select, flex: 1 }}
                          >
                            <option value="">Add to session...</option>
                            {available.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.age_group} — {s.name} ({s.session_date})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={assignSessionToCoach}
                            disabled={!assigningSessionId}
                            style={s.primaryBtn}
                          >
                            Assign
                          </button>
                        </div>
                      ) : null;
                    })()}

                    {editCoachSessions.length === 0 ? (
                      <p style={s.muted}>No sessions assigned.</p>
                    ) : (
                      editCoachSessions.map(sess => (
                        <div key={sess.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{sess.name}</span>
                            <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{sess.age_group_name} · {sess.session_date}</span>
                          </div>
                          <button onClick={() => unassignCoachFromSession(sess.id)} style={s.deleteBtn} title="Remove">×</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // RANKINGS
  // ════════════════════════════════════════════════════════════════
  if (view === 'rankings') return (
    <div style={s.page}>
      <div style={s.brandBar} />
      <button onClick={() => setView(activeGroup ? 'group' : 'overview')} style={s.backBtn}>
        ← {activeGroup ? activeGroup.name : 'Overview'}
      </button>

      <div style={s.topbar}>
        <div style={s.topbarLeft}>
          <img src="/wyh-logo.jpeg" alt="WYH" style={s.logoImg} />
          <div>
            <h1 style={s.h1}>{activeGroup?.name} Rankings</h1>
            <p style={s.sub}>Combined average · all sessions</p>
          </div>
        </div>
        <button onClick={logout} style={s.signOutBtn}>Sign out</button>
      </div>

      <div style={s.label}>Player Rankings</div>

      {rankings.length === 0 && (
        <div style={s.emptyCard}>No scores submitted yet.</div>
      )}

      {rankings.map((p, i) => {
        const pct = p.avg_overall ? Math.round(p.avg_overall / 5 * 100) : 0;
        const medal =
          i === 0 ? { background: '#2d1f00', border: '1px solid #d29922', color: '#e3b341' } :
          i === 1 ? { background: '#1c1c1c', border: '1px solid #8b949e', color: '#c9d1d9' } :
          i === 2 ? { background: '#1a1008', border: '1px solid #ad6528', color: '#d18b47' } :
          { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)' };

        return (
          <div key={p.id} style={s.rankRow}>
            <div style={{ ...s.rankBadge, ...medal }}>{i + 1}</div>
            <span style={s.jersey}>#{p.jersey_number}</span>
            <span style={{ flex: 1, fontSize: 14, color: 'var(--text2)' }}>
              {p.first_name} {p.last_name}
            </span>
            <div style={s.rankRight}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
                <span>Skate {p.avg_skating ?? '—'}</span>
                <span>Puck {p.avg_puck ?? '—'}</span>
                <span>Sense {p.avg_sense ?? '—'}</span>
              </div>
              <div style={s.barTrack}>
                <div style={{ ...s.barFill, width: pct + '%' }} />
              </div>
              <span style={s.rankScore}>
                {p.avg_overall ? Number(p.avg_overall).toFixed(1) : '—'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const s = {
  page:  { maxWidth: 780, margin: '0 auto', padding: '16px 16px 60px' },

  /* ── Brand header bar ── */
  brandBar: {
    position: 'fixed', top: 0, left: 0, right: 0, height: 4, zIndex: 100,
    background: 'linear-gradient(90deg, var(--maroon) 0%, var(--gold) 50%, var(--maroon) 100%)',
  },

  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 12 },
  topbarLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logoImg:    { width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', flexShrink: 0 },
  h1:         { fontSize: 20, fontWeight: 700, color: 'var(--text)' },
  sub:        { fontSize: 13, color: 'var(--text2)', marginTop: 1 },
  muted:      { fontSize: 13, color: 'var(--text3)', padding: '8px 0' },

  backBtn:    { background: 'none', border: 'none', color: 'var(--gold)', fontSize: 13, padding: '0 0 14px', display: 'block', cursor: 'pointer' },
  ghostBtn:    { background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text2)', fontSize: 12, padding: '6px 12px', cursor: 'pointer' },
  primaryBtn:  { background: 'var(--gold-bg)', border: '1px solid var(--gold-dark)', borderRadius: 'var(--radius-sm)', color: 'var(--gold-txt)', fontSize: 12, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 },
  navBtn:      { background: 'var(--maroon)', border: '1px solid var(--maroon-light)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 14px', cursor: 'pointer', letterSpacing: '0.03em' },
  signOutBtn:  { background: 'none', border: '1px solid var(--maroon)', borderRadius: 'var(--radius-sm)', color: 'var(--maroon-txt)', fontSize: 12, padding: '6px 12px', cursor: 'pointer' },
  saveBtn:    { padding: '9px 20px', background: 'var(--maroon)', border: '1px solid var(--maroon-light)', borderRadius: 'var(--radius-sm)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: '0.03em' },
  deleteBtn:  { background: 'none', border: 'none', color: 'var(--text3)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px' },

  label:      { fontSize: 11, fontWeight: 700, color: 'var(--gold-dark)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 },
  eventBadge: { display: 'inline-block', fontSize: 12, color: 'var(--gold-txt)', background: 'var(--gold-bg)', border: '1px solid var(--gold-dark)', borderRadius: 20, padding: '4px 14px', marginBottom: 20 },

  // Overview
  groupGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 },
  groupCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 18, cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' },
  groupName: { fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14 },
  statRow:   { display: 'flex', gap: 8, marginBottom: 14 },
  stat:      { flex: 1, textAlign: 'center' },
  statNum:   { fontSize: 22, fontWeight: 700, color: 'var(--gold)', display: 'block' },
  statLabel: { fontSize: 11, color: 'var(--text3)' },
  progressTrack: { height: 3, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', marginBottom: 14 },
  progressFill:  { height: 3, background: 'var(--maroon-light)', borderRadius: 2, transition: 'width 0.4s' },
  groupFooter:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  manageLink:    { fontSize: 13, color: 'var(--gold)' },
  rankLink:      { fontSize: 12, color: 'var(--text3)' },

  // Section header
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },

  // Forms
  formCard:   { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 },
  formRow:    { display: 'flex', gap: 12, flexWrap: 'wrap' },
  fieldLabel: { display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 },

  emptyCard: { background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '20px 16px', color: 'var(--text3)', fontSize: 13, textAlign: 'center', marginBottom: 8 },

  // Session cards
  sessionCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 8 },
  sessionTop:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  sessionName: { fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 3 },
  sessionMeta: { fontSize: 12, color: 'var(--text3)' },
  statusSelect:{ fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' },
  select:      { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'inherit' },

  // Scorer chips
  scorersWrap:  { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  scorersLabel: { fontSize: 12, color: 'var(--text3)', marginRight: 2 },
  scorerChip:   { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gold-txt)', background: 'var(--gold-bg)', border: '1px solid var(--gold-dark)', borderRadius: 20, padding: '2px 10px' },
  chipX:        { background: 'none', border: 'none', color: 'var(--gold-txt)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 },
  addScorerBtn: { background: 'none', border: '1px dashed var(--gold-dark)', borderRadius: 20, color: 'var(--gold-dark)', fontSize: 11, padding: '2px 10px', cursor: 'pointer' },

  // Players
  playerTable:       { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' },
  playerTableHeader: { display: 'flex', alignItems: 'center', padding: '8px 14px', background: 'var(--maroon-dark)', fontSize: 11, fontWeight: 700, color: 'var(--gold-light)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  playerRow:    { display: 'flex', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border)' },
  jersey:       { fontSize: 14, fontWeight: 700, color: 'var(--gold)', width: 50 },
  playerName:   { fontSize: 14, color: 'var(--text)', flex: 1 },

  errorBox:   { marginTop: 12, padding: '9px 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', color: 'var(--red-txt)', fontSize: 13 },
  successBox: { marginTop: 12, padding: '9px 14px', background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)', color: 'var(--green-txt)', fontSize: 13 },
  roleBadge:  { display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 20 },

  // Rankings
  rankRow:   { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 6 },
  rankBadge: { width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rankRight:  { display: 'flex', alignItems: 'center', gap: 10 },
  barTrack:   { width: 70, height: 5, background: 'var(--bg3)', borderRadius: 3 },
  barFill:    { height: 5, borderRadius: 3, background: 'var(--maroon-light)' },
  rankScore:  { fontSize: 15, fontWeight: 700, color: 'var(--text)', minWidth: 32, textAlign: 'right' },
};
