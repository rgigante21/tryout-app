const BASE = '/api';

/**
 * Core fetch wrapper.
 * Uses credentials: 'include' so the browser sends the auth_token HttpOnly cookie.
 * No Authorization header — token lives in a cookie managed by the server.
 */
async function request(method, path, body, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
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
    if (res.status === 401 && typeof window !== 'undefined') {
      const here = `${window.location.pathname}${window.location.search}`;
      if (window.location.pathname !== '/login') {
        window.sessionStorage.setItem('postLoginRedirect', here);
      }
    }
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
  allSessions: (ageGroupId, eventId, date, options = {}) => {
    const p = new URLSearchParams();
    if (ageGroupId) p.append('age_group_id', ageGroupId);
    if (eventId)    p.append('event_id', eventId);
    if (date)       p.append('date', date);
    return request('GET', `/sessions?${p}`, undefined, options);
  },
  sessionPlayers:  (id, options = {}) => request('GET',    `/sessions/${id}/players`, undefined, options),
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
  dashboard:   (eventId)             => request('GET', eventId ? `/scores/dashboard?eventId=${eventId}` : '/scores/dashboard'),

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
  updateEvent:  (id, data)       => request('PATCH', `/admin/events/${id}`, data),
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

  // Import (legacy — used by WorkspacePage and GroupsView)
  importPreview: (data) => request('POST', '/import/preview', data),
  importCommit:  (data) => request('POST', '/import/commit',  data),
  csvTemplate:   ()     => `${BASE}/import/csv-template`,

  // Import — event-scoped (new ImportExportView)
  // formData must be a FormData instance with fields: file, importType, ageGroupId
  importUpload: (eventId, formData) =>
    fetch(`${BASE}/events/${eventId}/import/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData, // Do NOT set Content-Type — browser sets multipart boundary
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) { const err = new Error(data.error || 'Upload failed'); err.status = res.status; throw err; }
      return data;
    }),
  importBatchPreview:  (eventId, batchId) => request('GET',  `/events/${eventId}/import/${batchId}/preview`),
  importBatchCommit:   (eventId, batchId) => request('POST', `/events/${eventId}/import/${batchId}/commit`),
  importHistory:       (eventId)           => request('GET',  `/events/${eventId}/import/history`),
  importBatchErrors:   (eventId, batchId)  => `${BASE}/events/${eventId}/import/${batchId}/errors.csv`,
  importPlayersTemplate:     (eventId) => `${BASE}/events/${eventId}/import/players-template`,
  importEvaluatorsTemplate:  (eventId) => `${BASE}/events/${eventId}/import/evaluators-template`,
  importAssignmentsTemplate: (eventId) => `${BASE}/events/${eventId}/import/assignments-template`,

  // Export — event-scoped
  exportTeamRecs:    (eventId, ageGroupId, includeNotes = true, filters = {}) => {
    const p = new URLSearchParams();
    if (ageGroupId) p.append('ageGroupId', ageGroupId);
    p.append('includeNotes', String(includeNotes));
    if (filters.finalizedOnly) p.append('finalizedOnly', 'true');
    if (filters.outcome) p.append('outcome', filters.outcome);
    return `${BASE}/events/${eventId}/export/team-recommendations?${p}`;
  },
  exportSportsEngine: (eventId, ageGroupId, filters = {}) => {
    const p = new URLSearchParams();
    if (ageGroupId) p.append('ageGroupId', ageGroupId);
    if (filters.finalizedOnly) p.append('finalizedOnly', 'true');
    if (filters.outcome) p.append('outcome', filters.outcome);
    return `${BASE}/events/${eventId}/export/sportsengine?${p}`;
  },
  exportPreview: (eventId, type, ageGroupId, filters = {}) => {
    const p = new URLSearchParams({ type });
    if (ageGroupId) p.append('ageGroupId', ageGroupId);
    if (filters.finalizedOnly) p.append('finalizedOnly', 'true');
    if (filters.outcome) p.append('outcome', filters.outcome);
    return request('GET', `/events/${eventId}/export/preview?${p}`);
  },

  // Check-in
  checkin: (sessionId, playerId, checkedIn = true, attendanceStatus = undefined) =>
    request('PATCH', `/sessions/${sessionId}/players/${playerId}/checkin`, {
      checkedIn,
      ...(attendanceStatus !== undefined ? { attendanceStatus } : {}),
    }),

  // Evaluation templates
  evaluationTemplates: () => request('GET', '/evaluation-templates'),

  // Org settings — branding
  orgSettings:      ()     => request('GET',   '/admin/org'),
  updateOrgSettings: (data) => request('PATCH', '/admin/org', data),
};
