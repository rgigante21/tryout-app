import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';

export function useWorkspaceData(eventId, ageGroupId) {
  const [sessions, setSessions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [checkInPlayers, setCheckInPlayers] = useState({});
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(new Set());

  const fetchAll = useCallback(async (signal, silent = false) => {
    if (!eventId || !ageGroupId) return;
    if (!silent) setLoading(true);
    try {
      const [sessRes, playRes, rankRes] = await Promise.all([
        api.allSessions(ageGroupId, eventId),
        api.players(ageGroupId, eventId),
        api.rankings(ageGroupId, eventId),
      ]);
      if (signal?.aborted) return;
      const sessionList = sessRes.sessions || [];
      setSessions(sessionList);
      setPlayers(playRes.players || []);
      setRankings(rankRes.rankings || []);

      if (sessionList.length) {
        const pairs = await Promise.all(
          sessionList.map((s) =>
            api.sessionPlayers(s.id)
              .then((r) => [s.id, r.players || []])
              .catch(() => [s.id, []])
          )
        );
        if (!signal?.aborted) setCheckInPlayers(Object.fromEntries(pairs));
      } else {
        setCheckInPlayers({});
      }
    } catch (err) {
      if (!signal?.aborted) console.error(err);
    } finally {
      if (!signal?.aborted && !silent) setLoading(false);
    }
  }, [eventId, ageGroupId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAll(controller.signal);
    const timer = setInterval(() => fetchAll(controller.signal, true), 15_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [fetchAll]);

  const refreshAll = useCallback(() => fetchAll(), [fetchAll]);

  const handleToggleCheckIn = async (sessionId, player, attendanceStatus) => {
    const key = `${sessionId}-${player.id}`;
    setToggling((prev) => new Set([...prev, key]));
    try {
      const nextStatus = attendanceStatus === undefined
        ? (player.checked_in ? '' : 'checked_in')
        : attendanceStatus;
      const checkedIn = nextStatus === 'checked_in' || nextStatus === 'late_arrival';
      await api.checkin(sessionId, player.id, checkedIn, nextStatus || null);
      setCheckInPlayers((prev) => ({
        ...prev,
        [sessionId]: (prev[sessionId] || []).map((p) =>
          p.id === player.id ? { ...p, checked_in: checkedIn, attendance_status: nextStatus || null } : p
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

  const handleAddPlayer = async (data) => {
    const r = await api.addPlayer({ ...data, ageGroupId: parseInt(ageGroupId, 10), eventId: parseInt(eventId, 10) });
    setPlayers((p) => [...p, r.player].sort((a, b) => a.jersey_number - b.jersey_number));
    return r.player;
  };

  const handleRemovePlayer = async (playerId) => {
    if (!window.confirm('Remove this player?')) return;
    await api.deletePlayer(playerId);
    setPlayers((p) => p.filter((x) => x.id !== playerId));
  };

  const handleUpdateSessionStatus = async (sessionId, status) => {
    try {
      const r = await api.updateSession(sessionId, { status });
      setSessions((list) => list.map((s) => (s.id === sessionId ? { ...s, status: r.session.status } : s)));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveSession = async (sessionId) => {
    if (!window.confirm('Delete this session and all its scores?')) return;
    await api.deleteSession(sessionId);
    setSessions((list) => list.filter((s) => s.id !== sessionId));
    setCheckInPlayers((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  };

  const handleSaveSession = async (sessionId, data) => {
    const r = await api.updateSession(sessionId, data);
    setSessions((list) => list.map((s) => (s.id === sessionId ? { ...s, ...r.session } : s)));
  };

  return {
    sessions,
    players,
    checkInPlayers,
    rankings,
    loading,
    toggling,
    handleToggleCheckIn,
    handleAddPlayer,
    handleRemovePlayer,
    handleUpdateSessionStatus,
    handleRemoveSession,
    handleSaveSession,
    refreshAll,
  };
}
