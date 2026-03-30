import { useCallback, useEffect, useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { A, ADMIN_CSS } from '../features/admin/styles';
import { Sidebar, defaultBlock } from '../features/admin/shared';
import OverviewView from '../features/admin/views/OverviewView';
import SessionsView, { SessionsIndexView } from '../features/admin/views/SessionsView';
import EventsView from '../features/admin/views/EventsView';
import { GroupDetailView, GroupsIndexView } from '../features/admin/views/GroupsView';
import RankingsView from '../features/admin/views/RankingsView';
import CoachesView from '../features/admin/views/CoachesView';
import ResultsView from '../features/admin/views/ResultsView';
import CheckInView from '../features/admin/views/CheckInView';

function getAdminRoute(pathname) {
  const resultsRankingsMatch = matchPath('/admin/results/:groupCode/rankings', pathname);
  if (resultsRankingsMatch) {
    return { view: 'rankings', groupCode: resultsRankingsMatch.params.groupCode, from: 'results' };
  }

  const groupMatch = matchPath('/admin/groups/:groupCode', pathname);
  if (groupMatch) {
    return { view: 'groupDetail', groupCode: groupMatch.params.groupCode };
  }

  const sessionGroupMatch = matchPath('/admin/sessions/:groupCode', pathname);
  if (sessionGroupMatch) {
    return { view: 'sessionGroup', groupCode: sessionGroupMatch.params.groupCode };
  }

  if (matchPath('/admin/groups', pathname)) return { view: 'groups' };
  if (matchPath('/admin/events', pathname)) return { view: 'events' };
  if (matchPath('/admin/sessions', pathname)) return { view: 'sessions' };
  if (matchPath('/admin/coaches', pathname)) return { view: 'coaches' };
  if (matchPath('/admin/results', pathname)) return { view: 'results' };
  if (matchPath('/admin/checkin', pathname)) return { view: 'checkin' };
  return { view: 'overview' };
}

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const route = getAdminRoute(location.pathname);

  const [ageGroups, setAgeGroups] = useState([]);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [dashboard, setDashboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const [todayDate, setTodayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [todaySessions, setTodaySessions] = useState([]);
  const [todayScorers, setTodayScorers] = useState({});
  const [todayCheckIns, setTodayCheckIns] = useState({}); // { [sessionId]: { checked: N, total: M } }
  const [todayLoading, setTodayLoading] = useState(false);

  const [allSessions, setAllSessions] = useState([]);
  const [sessDateFilter, setSessDateFilter] = useState('all');
  const [sessLoading, setSessLoading] = useState(false);
  const [sessionScorers, setSessionScorers] = useState({});
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editSession, setEditSession] = useState({});
  const [assigningTo, setAssigningTo] = useState(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [showBlockWizard, setShowBlockWizard] = useState(false);

  const [blockWizard, setBlockWizard] = useState(defaultBlock());
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [blockMsg, setBlockMsg] = useState('');

  const [sessions, setSessions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newSession, setNewSession] = useState({ name: '', date: '', time: '' });
  const [addingSession, setAddingSession] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ firstName: '', lastName: '', jersey: '' });
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importRunning, setImportRunning] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importMsg, setImportMsg] = useState('');

  const [newCoach, setNewCoach] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'scorer', sessions: new Set() });
  const [addingCoach, setAddingCoach] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [coachSuccess, setCoachSuccess] = useState('');
  const [editingCoachId, setEditingCoachId] = useState(null);
  const [editCoach, setEditCoach] = useState({});
  const [editCoachSessions, setEditCoachSessions] = useState([]);
  const [allSessionsList, setAllSessionsList] = useState([]);
  const [assigningSessionId, setAssigningSessionId] = useState('');
  const [savingCoach, setSavingCoach] = useState(false);
  const [editCoachMsg, setEditCoachMsg] = useState({ type: '', text: '' });

  const [newEvent, setNewEvent] = useState({ name: '', season: '', startDate: '', endDate: '' });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [eventStats, setEventStats] = useState(null);
  const [viewingEventId, setViewingEventId] = useState(null);
  const [eventMsg, setEventMsg] = useState({ type: '', text: '' });

  const [rankings, setRankings] = useState([]);

  const activeEvent = events.find((e) => !e.archived) || null;
  const activeGroup = ageGroups.find((group) => group.code.toLowerCase() === (route.groupCode || '').toLowerCase()) || null;

  useEffect(() => {
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      navigate('/admin/overview', { replace: true });
    }
  }, [location.pathname, navigate]);

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

  useEffect(() => {
    if (!activeEvent || route.view !== 'overview') return;
    setTodayLoading(true);
    api.allSessions(null, activeEvent.id, todayDate)
      .then(async (r) => {
        const list = (r.sessions || []).filter((s) => String(s.session_date).slice(0, 10) === todayDate);
        setTodaySessions(list);
        if (list.length) {
          const [scorerPairs, playerPairs] = await Promise.all([
            Promise.all(list.map((s) => api.sessionScorers(s.id).then((resp) => [s.id, resp.scorers || []]))),
            Promise.all(list.map((s) => api.sessionPlayers(s.id).then((resp) => {
              const players = resp.players || [];
              return [s.id, { checked: players.filter((p) => p.checked_in).length, total: players.length }];
            }).catch(() => [s.id, { checked: 0, total: s.player_count || 0 }]))),
          ]);
          setTodayScorers(Object.fromEntries(scorerPairs));
          setTodayCheckIns(Object.fromEntries(playerPairs));
        } else {
          setTodayScorers({});
          setTodayCheckIns({});
        }
      })
      .catch(() => { setTodaySessions([]); setTodayScorers({}); setTodayCheckIns({}); })
      .finally(() => setTodayLoading(false));
  }, [activeEvent, route.view, todayDate]);

  const loadAllSessions = useCallback(async (ageGroupId = null) => {
    if (!activeEvent) return;
    setSessLoading(true);
    try {
      const r = await api.allSessions(ageGroupId, activeEvent.id);
      const list = r.sessions || [];
      setAllSessions(list);
      if (list.length) {
        const pairs = await Promise.all(list.map((s) => api.sessionScorers(s.id).then((resp) => [s.id, resp.scorers])));
        setSessionScorers((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSessLoading(false);
    }
  }, [activeEvent]);

  useEffect(() => {
    if (route.view === 'sessions') loadAllSessions();
    else if (route.view === 'sessionGroup' && activeGroup) loadAllSessions(activeGroup.id);
  }, [route.view, activeGroup, loadAllSessions]);

  const loadGroupData = useCallback(async (group, eventId) => {
    const [sessRes, playRes] = await Promise.all([
      api.allSessions(group.id, eventId),
      api.players(group.id, eventId),
    ]);
    const sessionList = sessRes.sessions || [];
    setSessions(sessionList);
    setPlayers(playRes.players || []);
    if (sessionList.length) {
      const pairs = await Promise.all(sessionList.map((s) => api.sessionScorers(s.id).then((resp) => [s.id, resp.scorers])));
      setSessionScorers((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    } else {
      setSessionScorers({});
    }
  }, []);

  useEffect(() => {
    if (route.view !== 'groupDetail' || !activeGroup || !activeEvent) return;
    setSessions([]);
    setPlayers([]);
    setSessionScorers({});
    setShowAddSession(false);
    setShowAddPlayer(false);
    setAssigningTo(null);
    loadGroupData(activeGroup, activeEvent.id).catch(console.error);
  }, [activeEvent, activeGroup, loadGroupData, route.view]);

  useEffect(() => {
    if (route.view !== 'rankings' || !activeGroup || !activeEvent) return;
    api.rankings(activeGroup.id, activeEvent.id)
      .then((data) => setRankings(data.rankings || []))
      .catch(console.error);
  }, [activeEvent, activeGroup, route.view]);

  const goTo = useCallback((path) => {
    setShowBlockWizard(false);
    setShowCreateEvent(false);
    navigate(path);
  }, [navigate]);

  const openGroup = useCallback((group) => {
    setShowBlockWizard(false);
    navigate(`/admin/groups/${group.code.toLowerCase()}`);
  }, [navigate]);

  const openSessionGroup = useCallback((group) => {
    setShowBlockWizard(false);
    navigate(`/admin/sessions/${group.code.toLowerCase()}`);
  }, [navigate]);

  const openRankings = useCallback((group) => {
    navigate(`/admin/results/${group.code.toLowerCase()}/rankings`);
  }, [navigate]);

  const refreshEvents = async () => {
    const ev = await api.events();
    setEvents(ev.events);
  };

  const addSession = async () => {
    if (!newSession.name || !newSession.date || !newSession.time || !activeEvent || !activeGroup) return;
    setAddingSession(true);
    try {
      const r = await api.createSession({
        eventId: activeEvent.id,
        ageGroupId: activeGroup.id,
        name: newSession.name,
        sessionDate: newSession.date,
        startTime: newSession.time,
      });
      setSessions((s) => [...s, r.session]);
      setSessionScorers((ss) => ({ ...ss, [r.session.id]: [] }));
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
      const updater = (list) => list.map((item) => (item.id === sessionId ? { ...item, status: r.session.status } : item));
      setSessions(updater);
      setAllSessions(updater);
    } catch (err) {
      alert(err.message);
    }
  };

  const removeSession = async (sessionId) => {
    if (!window.confirm('Delete this session and all its scores?')) return;
    try {
      await api.deleteSession(sessionId);
      setSessions((s) => s.filter((x) => x.id !== sessionId));
      setAllSessions((s) => s.filter((x) => x.id !== sessionId));
      refreshEvents();
    } catch (err) {
      alert(err.message);
    }
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
        name: editSession.name,
        sessionDate: editSession.date,
        startTime: editSession.time || null,
        sessionType: editSession.sessionType,
      });
      const updater = (list) => list.map((item) => (item.id === editingSessionId ? { ...item, ...r.session } : item));
      setSessions(updater);
      setAllSessions(updater);
      setEditingSessionId(null);
      refreshEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  const patchSession = async (id, data) => {
    const r = await api.updateSession(id, data);
    const updater = (list) => list.map((item) => (item.id === id ? { ...item, ...r.session } : item));
    setSessions(updater);
    setAllSessions(updater);
    refreshEvents();
  };

  const assignScorer = async (sessionId) => {
    if (!assignUserId) return;
    try {
      await api.assignScorer(sessionId, parseInt(assignUserId, 10));
      const r = await api.sessionScorers(sessionId);
      setSessionScorers((ss) => ({ ...ss, [sessionId]: r.scorers }));
      setAssigningTo(null);
      setAssignUserId('');
    } catch (err) {
      alert(err.message);
    }
  };

  const unassignScorer = async (sessionId, userId) => {
    try {
      await api.unassignScorer(sessionId, userId);
      setSessionScorers((ss) => ({ ...ss, [sessionId]: (ss[sessionId] || []).filter((u) => u.id !== userId) }));
    } catch (err) {
      alert(err.message);
    }
  };

  const addPlayer = async () => {
    if (!newPlayer.firstName || !newPlayer.lastName || !newPlayer.jersey || !activeEvent || !activeGroup) return;
    setAddingPlayer(true);
    try {
      const r = await api.addPlayer({
        firstName: newPlayer.firstName,
        lastName: newPlayer.lastName,
        jerseyNumber: parseInt(newPlayer.jersey, 10),
        ageGroupId: activeGroup.id,
        eventId: activeEvent.id,
      });
      setPlayers((p) => [...p, r.player].sort((a, b) => a.jersey_number - b.jersey_number));
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
      setPlayers((p) => p.filter((x) => x.id !== playerId));
    } catch (err) {
      alert(err.message);
    }
  };

  const updateSlot = (i, field, val) => {
    setBlockWizard((w) => ({ ...w, slots: w.slots.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)) }));
  };
  const addSlot = () => {
    setBlockWizard((w) => ({ ...w, slots: [...w.slots, { time: '', lastNameStart: 'A', lastNameEnd: 'Z', jerseyMin: '', jerseyMax: '' }] }));
  };
  const removeSlot = (i) => {
    setBlockWizard((w) => ({ ...w, slots: w.slots.filter((_, idx) => idx !== i) }));
  };
  const updateTeam = (i, field, val) => {
    setBlockWizard((w) => ({ ...w, teams: w.teams.map((t, idx) => (idx === i ? { ...t, [field]: val } : t)) }));
  };
  const updateGame = (i, field, val) => {
    setBlockWizard((w) => ({ ...w, games: w.games.map((g, idx) => (idx === i ? { ...g, [field]: val } : g)) }));
  };

  const createBlock = async () => {
    if (!blockWizard.date || !activeEvent) return;
    setCreatingBlock(true);
    setBlockMsg('');
    try {
      const payload = {
        eventId: activeEvent.id,
        ageGroupId: activeGroup?.id,
        blockType: blockWizard.blockType,
        splitMethod: blockWizard.splitMethod,
        label: blockWizard.label || null,
        sessionDate: blockWizard.date,
        scoringMode: blockWizard.scoringMode,
      };
      if (blockWizard.blockType === 'skills') {
        payload.slots = blockWizard.slots.map((s) => ({
          time: s.time || null,
          lastNameStart: s.lastNameStart || null,
          lastNameEnd: s.lastNameEnd || null,
          jerseyMin: s.jerseyMin ? parseInt(s.jerseyMin, 10) : null,
          jerseyMax: s.jerseyMax ? parseInt(s.jerseyMax, 10) : null,
        }));
      } else {
        payload.teamCount = blockWizard.teams.length;
        payload.teams = blockWizard.teams;
        payload.games = blockWizard.games.map((g) => ({
          ...g,
          homeTeam: parseInt(g.homeTeam, 10),
          awayTeam: parseInt(g.awayTeam, 10),
        }));
        payload.playerAssignment = blockWizard.playerAssignment;
      }
      const r = await api.createSessionBlock(payload);
      const newSessions = r.sessions || [];
      setSessions((prev) => [...prev, ...newSessions]);
      setAllSessions((prev) => [...prev, ...newSessions]);
      setShowBlockWizard(false);
      setBlockMsg('');
      setBlockWizard(defaultBlock());
      refreshEvents();
    } catch (err) {
      setBlockMsg(err.message || 'Failed to create block');
    } finally {
      setCreatingBlock(false);
    }
  };

  const addCoach = async () => {
    const { firstName, lastName, email, password, role, sessions: coachSessions } = newCoach;
    if (!firstName || !lastName || !email || !password) return;
    setAddingCoach(true);
    setCoachError('');
    setCoachSuccess('');
    try {
      const created = await api.register({ firstName, lastName, email, password, role });
      if (coachSessions.size > 0) {
        await Promise.all([...coachSessions].map((sid) => api.assignScorer(sid, created.user.id)));
      }
      const updated = await api.users();
      setUsers(updated.users);
      setNewCoach({ firstName: '', lastName: '', email: '', password: '', role: 'scorer', sessions: new Set() });
      setCoachSuccess(`Account created for ${firstName} ${lastName}.`);
    } catch (err) {
      setCoachError(err.message);
    } finally {
      setAddingCoach(false);
    }
  };

  const openEditCoach = async (u) => {
    if (editingCoachId === u.id) {
      setEditingCoachId(null);
      return;
    }
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

  const saveCoach = async (overridePassword = undefined) => {
    setSavingCoach(true);
    setEditCoachMsg({ type: '', text: '' });
    const payload = {};
    if (editCoach.firstName) payload.firstName = editCoach.firstName;
    if (editCoach.lastName)  payload.lastName  = editCoach.lastName;
    if (editCoach.email)     payload.email     = editCoach.email;
    if (editCoach.role)      payload.role      = editCoach.role;
    // overridePassword=null means "profile-only save, skip password"
    // overridePassword=string means "password reset"
    const pw = overridePassword !== null && overridePassword !== undefined
      ? overridePassword
      : (editCoach.password || '');
    if (pw) payload.password = pw;
    try {
      const r = await api.updateUser(editingCoachId, payload);
      setUsers((us) => us.map((u) => (u.id === editingCoachId ? r.user : u)));
      setEditCoach((c) => ({ ...c, password: '' }));
      setEditCoachMsg({ type: 'success', text: 'Saved successfully.' });
    } catch (err) {
      setEditCoachMsg({ type: 'error', text: err.message });
      throw err;
    } finally {
      setSavingCoach(false);
    }
  };

  const unassignCoachSession = async (sessionId) => {
    await api.unassignScorer(sessionId, editingCoachId);
    setEditCoachSessions((s) => s.filter((x) => x.id !== sessionId));
  };

  const assignSessionToCoach = async () => {
    if (!assigningSessionId) return;
    try {
      await api.assignScorer(parseInt(assigningSessionId, 10), editingCoachId);
      const r = await api.userSessions(editingCoachId);
      setEditCoachSessions(r.sessions || []);
      setAssigningSessionId('');
    } catch (err) {
      setEditCoachMsg({ type: 'error', text: err.message });
    }
  };

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
    } finally {
      setCreatingEvent(false);
    }
  };

  const archiveEvent = async (id) => {
    if (!window.confirm('Archive this event? All data is preserved.')) return;
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
    if (viewingEventId === id) {
      setViewingEventId(null);
      setEventStats(null);
      return;
    }
    setViewingEventId(id);
    setEventStats(null);
    const data = await api.eventStats(id);
    setEventStats(data);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeEvent || !activeGroup) return;
    setImportResult(null);
    setImportMsg('');
    const text = await file.text();
    setImportCsvText(text);
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
    if (!importCsvText || !activeEvent || !activeGroup) return;
    setImportRunning(true);
    setImportResult(null);
    try {
      const r = await api.importCommit({ csvText: importCsvText, eventId: activeEvent.id, ageGroupId: activeGroup.id });
      setImportResult(r);
      if (r.added?.length) {
        setPlayers((p) => [...p, ...r.added].sort((a, b) => a.jersey_number - b.jersey_number));
      }
      setImportCsvText('');
      setImportPreview(null);
      setImportSummary(null);
    } catch (err) {
      setImportMsg(err.message || 'Import failed');
    } finally {
      setImportRunning(false);
    }
  };

  const addAgeGroup = async (data) => {
    const r = await api.createAgeGroup(data);
    setAgeGroups((ag) => [...ag, r.ageGroup].sort((a, b) => a.sort_order - b.sort_order));
  };

  const changeBlockAssignment = async (blockId, data) => {
    await api.updateSessionBlock(blockId, data);
    if (activeGroup && activeEvent) await loadGroupData(activeGroup, activeEvent.id);
    if (route.view === 'sessions') await loadAllSessions();
  };

  const clearImport = () => {
    setImportCsvText('');
    setImportPreview(null);
    setImportSummary(null);
    setImportResult(null);
    setImportMsg('');
  };

  const groupStats = (code) =>
    dashboard.find((d) => d.age_group_code === code) || { total_sessions: 0, complete_sessions: 0, total_players: 0, total_scores: 0 };

  const uniqueDates = [...new Set(allSessions.map((s) => String(s.session_date).slice(0, 10)))].sort();
  const filteredSessions = sessDateFilter === 'all'
    ? allSessions
    : allSessions.filter((s) => String(s.session_date).slice(0, 10) === sessDateFilter);

  const currentNav = route.view === 'groupDetail' ? 'groups'
    : route.view === 'sessionGroup' ? 'sessions'
    : route.view === 'rankings' ? 'results'
    : route.view;
  const backTarget = route.view === 'groupDetail'
    ? { label: '← Age Groups', to: '/admin/groups' }
    : route.view === 'sessionGroup'
      ? { label: '← Sessions', to: '/admin/sessions' }
      : route.view === 'rankings'
        ? { label: '← Results', to: '/admin/results' }
        : null;

  const pageTitle = {
    overview: 'Dashboard',
    sessions: 'Sessions',
    sessionGroup: activeGroup ? `${activeGroup.name} Sessions` : 'Sessions',
    events: 'Events',
    groups: 'Age Groups',
    groupDetail: activeGroup ? activeGroup.name : 'Age Groups',
    rankings: activeGroup ? `${activeGroup.name} Rankings` : 'Rankings',
    coaches: 'Coaches & Scorers',
    results: 'Results',
    checkin: 'Check-In',
  }[route.view];

  return (
    <div className="admin-shell" style={A.shell}>
      <style>{ADMIN_CSS}</style>

      <Sidebar currentNav={currentNav} user={user} logout={logout} onNavigate={goTo} />

      <div style={A.main}>
        <div style={A.topbar}>
          <div style={A.topbarLeft}>
            {backTarget && (
              <button onClick={() => goTo(backTarget.to)} style={A.backLink}>{backTarget.label}</button>
            )}
            <h2 style={A.pageTitle}>{pageTitle}</h2>
          </div>
          <div style={A.topbarRight}>
            {activeEvent && <span style={A.eventPill}>{activeEvent.name}</span>}
            {route.view === 'sessionGroup' && (
              <button onClick={() => setShowBlockWizard((v) => !v)} style={showBlockWizard ? A.ghostBtn : A.primaryBtn}>
                {showBlockWizard ? 'Cancel' : '+ Session Block'}
              </button>
            )}
            {route.view === 'events' && (
              <button onClick={() => setShowCreateEvent((v) => !v)} style={showCreateEvent ? A.ghostBtn : A.primaryBtn}>
                {showCreateEvent ? 'Cancel' : '+ New Event'}
              </button>
            )}
          </div>
        </div>

        <div style={A.contentArea}>
          {loading && <p style={A.muted}>Loading…</p>}

          {!loading && route.view === 'overview' && (
            <OverviewView
              dashboard={dashboard}
              users={users}
              ageGroups={ageGroups}
              todayDate={todayDate}
              setTodayDate={setTodayDate}
              todayLoading={todayLoading}
              todaySessions={todaySessions}
              todayScorers={todayScorers}
              todayCheckIns={todayCheckIns}
              groupStats={groupStats}
              openGroup={openGroup}
              openRankings={openRankings}
            />
          )}

          {!loading && route.view === 'sessions' && (
            <SessionsIndexView ageGroups={ageGroups} groupStats={groupStats} openSessionGroup={openSessionGroup} />
          )}

          {!loading && route.view === 'sessionGroup' && activeGroup && (
            <SessionsView
              showBlockWizard={showBlockWizard}
              setShowBlockWizard={setShowBlockWizard}
              blockWizard={blockWizard}
              setBlockWizard={setBlockWizard}
              updateSlot={updateSlot}
              addSlot={addSlot}
              removeSlot={removeSlot}
              updateTeam={updateTeam}
              updateGame={updateGame}
              createBlock={createBlock}
              creatingBlock={creatingBlock}
              blockMsg={blockMsg}
              sessDateFilter={sessDateFilter}
              setSessDateFilter={setSessDateFilter}
              uniqueDates={uniqueDates}
              sessLoading={sessLoading}
              filteredSessions={filteredSessions}
              sessionScorers={sessionScorers}
              users={users}
              onSaveSession={patchSession}
              updateStatus={updateStatus}
              removeSession={removeSession}
              assigningTo={assigningTo}
              setAssigningTo={setAssigningTo}
              assignUserId={assignUserId}
              setAssignUserId={setAssignUserId}
              assignScorer={assignScorer}
              unassignScorer={unassignScorer}
              onChangeAssignment={changeBlockAssignment}
            />
          )}

          {!loading && route.view === 'events' && (
            <EventsView
              events={events}
              activeEvent={activeEvent}
              newEvent={newEvent}
              setNewEvent={setNewEvent}
              showCreateEvent={showCreateEvent}
              createEvent={createEvent}
              creatingEvent={creatingEvent}
              archiveEvent={archiveEvent}
              eventStats={eventStats}
              viewingEventId={viewingEventId}
              loadEventStats={loadEventStats}
              eventMsg={eventMsg}
              restoreEvent={async (id) => {
                await api.archiveEvent(id, false);
                const r = await api.events();
                setEvents(r.events);
              }}
            />
          )}

          {!loading && route.view === 'groups' && (
            <GroupsIndexView ageGroups={ageGroups} groupStats={groupStats} openGroup={openGroup} onAddAgeGroup={addAgeGroup} />
          )}

          {!loading && route.view === 'groupDetail' && activeGroup && (
            <GroupDetailView
              sessions={sessions}
              players={players}
              sessionScorers={sessionScorers}
              users={users}
              showBlockWizard={showBlockWizard}
              setShowBlockWizard={setShowBlockWizard}
              blockWizard={blockWizard}
              setBlockWizard={setBlockWizard}
              updateSlot={updateSlot}
              addSlot={addSlot}
              removeSlot={removeSlot}
              updateTeam={updateTeam}
              updateGame={updateGame}
              createBlock={createBlock}
              creatingBlock={creatingBlock}
              blockMsg={blockMsg}
              showAddSession={showAddSession}
              setShowAddSession={setShowAddSession}
              newSession={newSession}
              setNewSession={setNewSession}
              addSession={addSession}
              addingSession={addingSession}
              showAddPlayer={showAddPlayer}
              setShowAddPlayer={setShowAddPlayer}
              newPlayer={newPlayer}
              setNewPlayer={setNewPlayer}
              addPlayer={addPlayer}
              addingPlayer={addingPlayer}
              removePlayer={removePlayer}
              onSaveSession={patchSession}
              updateStatus={updateStatus}
              removeSession={removeSession}
              assigningTo={assigningTo}
              setAssigningTo={setAssigningTo}
              assignUserId={assignUserId}
              setAssignUserId={setAssignUserId}
              assignScorer={assignScorer}
              unassignScorer={unassignScorer}
              onChangeAssignment={changeBlockAssignment}
              showImport={showImport}
              setShowImport={setShowImport}
              importPreview={importPreview}
              importSummary={importSummary}
              importRunning={importRunning}
              importResult={importResult}
              importMsg={importMsg}
              handleImportFile={handleImportFile}
              commitImport={commitImport}
              clearImport={clearImport}
            />
          )}

          {!loading && route.view === 'results' && (
            <ResultsView
              ageGroups={ageGroups}
              activeEvent={activeEvent}
              openRankings={openRankings}
              groupStats={groupStats}
            />
          )}

          {!loading && route.view === 'rankings' && (
            <RankingsView rankings={rankings} activeGroup={activeGroup} />
          )}

          {!loading && route.view === 'checkin' && (
            <CheckInView
              activeEvent={activeEvent}
              ageGroups={ageGroups}
            />
          )}

          {!loading && route.view === 'coaches' && (
            <CoachesView
              users={users}
              newCoach={newCoach}
              setNewCoach={setNewCoach}
              addCoach={addCoach}
              addingCoach={addingCoach}
              coachError={coachError}
              coachSuccess={coachSuccess}
              editingCoachId={editingCoachId}
              editCoach={editCoach}
              setEditCoach={setEditCoach}
              openEditCoach={openEditCoach}
              editCoachSessions={editCoachSessions}
              allSessionsList={allSessionsList}
              assigningSessionId={assigningSessionId}
              setAssigningSessionId={setAssigningSessionId}
              assignSessionToCoach={assignSessionToCoach}
              unassignCoachSession={unassignCoachSession}
              saveCoach={saveCoach}
              savingCoach={savingCoach}
              editCoachMsg={editCoachMsg}
            />
          )}
        </div>
      </div>
    </div>
  );
}
