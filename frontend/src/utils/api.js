const BASE = '/api';

/**
 * Core fetch wrapper.
 * Uses credentials: 'include' so the browser sends the auth_token HttpOnly cookie.
 * No Authorization header — token lives in a cookie managed by the server.
 */
async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (${res.status}) — check that the backend is running`);
  }

  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    Object.assign(err, data);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  login:    (email, password) => request('POST', '/auth/login', { email, password }),
  logout:   ()                => request('POST', '/auth/logout'),
  me:       ()                => request('GET',  '/auth/me'),

  // Sessions
  mySessions: () => request('GET', '/sessions/mine').then(r => r.sessions || []),
  allSessions: (ageGroupId, eventId, date) => {
    const p = new URLSearchParams();
    if (ageGroupId) p.append('age_group_id', ageGroupId);
    if (eventId)    p.append('event_id', eventId);
    if (date)       p.append('date', date);
    return request('GET', `/sessions?${p}`);
  },
  sessionPlayers:  (id)               => request('GET',    `/sessions/${id}/players`),
  sessionScorers:  (id)               => request('GET',    `/sessions/${id}/scorers`),
  sessionSiblings: (id)               => request('GET',    `/sessions/${id}/siblings`),
  createSession:   (data)             => request('POST',   '/sessions', data),
  updateSession:   (id, data)         => request('PATCH',  `/sessions/${id}`, data),
  deleteSession:   (id)               => request('DELETE', `/sessions/${id}`),
  assignScorer:    (sessionId, userId)=> request('POST',   `/sessions/${sessionId}/assign`, { userId }),
  unassignScorer:  (sessionId, userId)=> request('DELETE', `/sessions/${sessionId}/scorers/${userId}`),

  // Scores
  submitScore: (payload)             => request('POST', '/scores', payload),
  rankings:    (ageGroupId, eventId) => request('GET', `/scores/rankings/${ageGroupId}/${eventId}`),
  dashboard:   ()                    => request('GET', '/scores/dashboard'),

  // Admin — users
  users:        ()                            => request('GET',    '/admin/users'),
  createUser:   (data)                        => request('POST',   '/admin/users', data),
  updateUser:   (id, data)                    => request('PATCH',  `/admin/users/${id}`, data),
  userSessions: (id)                          => request('GET',    `/admin/users/${id}/sessions`),

  // Admin — age groups
  ageGroups:     ()     => request('GET',  '/admin/age-groups'),
  createAgeGroup:(data) => request('POST', '/admin/age-groups', data),

  // Admin — events
  events:       ()               => request('GET',   '/admin/events'),
  createEvent:  (data)           => request('POST',  '/admin/events', data),
  archiveEvent: (id, archive)    => request('PATCH', `/admin/events/${id}/archive`, { archive }),
  eventStats:   (id)             => request('GET',   `/admin/events/${id}/stats`),

  // Admin — players
  players:      (ageGroupId, eventId) => request('GET',    `/admin/players?age_group_id=${ageGroupId}&event_id=${eventId}`),
  addPlayer:    (data)                => request('POST',   '/admin/players', data),
  deletePlayer: (id)                  => request('DELETE', `/admin/players/${id}`),
  bulkPlayers:  (data)                => request('POST',   '/admin/players/bulk', data),
  setOutcome:   (id, outcome)         => request('PATCH',  `/admin/players/${id}/outcome`, { outcome }),

  // Admin — session completion & finalization
  sessionCompletion: (id)          => request('GET',   `/admin/sessions/${id}/completion`),
  finalizeSession:   (id, status)  => request('PATCH', `/admin/sessions/${id}/finalize`, { status }),

  // Session Blocks
  sessionBlocks: (eventId, ageGroupId) => {
    const p = new URLSearchParams({ event_id: eventId });
    if (ageGroupId) p.append('age_group_id', ageGroupId);
    return request('GET', `/session-blocks?${p}`);
  },
  createSessionBlock: (data) => request('POST',   '/session-blocks', data),
  updateSessionBlock: (id, data) => request('PATCH',  `/session-blocks/${id}`, data),
  deleteSessionBlock: (id)   => request('DELETE', `/session-blocks/${id}`),
  reassignBlock:      (id)   => request('POST',   `/session-blocks/${id}/reassign`),
  suggestRanges:      (id, slots) => request('GET', `/session-blocks/${id}/suggest-ranges?slots=${slots}`),

  // Session players — move
  movePlayer: (data) => request('PATCH', '/session-players/move', data),

  // Import
  importPreview: (data) => request('POST', '/import/preview', data),
  importCommit:  (data) => request('POST', '/import/commit',  data),
  csvTemplate:   ()     => `${BASE}/import/csv-template`,

  // Check-in
  checkin: (sessionId, playerId, checkedIn = true, attendanceStatus = undefined) =>
    request('PATCH', `/sessions/${sessionId}/players/${playerId}/checkin`, {
      checkedIn,
      ...(attendanceStatus !== undefined ? { attendanceStatus } : {}),
    }),

  // Evaluation templates
  evaluationTemplates: () => request('GET', '/evaluation-templates'),
};
