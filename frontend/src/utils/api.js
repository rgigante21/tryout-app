const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function headers() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    // Response was empty or not JSON (e.g. server crash, proxy error)
    throw new Error(`Server error (${res.status}) — check that the backend is running`);
  }
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    // Attach any extra fields the backend sends (e.g. code, opensAt, sessionDate)
    Object.assign(err, data);
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  login:    (email, password) => request('POST', '/auth/login', { email, password }),
  register: (payload)         => request('POST', '/auth/register', payload),
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
  sessionPlayers: (id)                 => request('GET',    `/sessions/${id}/players`),
  sessionScorers: (id)                 => request('GET',    `/sessions/${id}/scorers`),
  createSession:  (data)               => request('POST',   '/sessions', data),
  updateSession:  (id, data)           => request('PATCH',  `/sessions/${id}`, data),
  deleteSession:  (id)                 => request('DELETE', `/sessions/${id}`),
  assignScorer:   (sessionId, userId)  => request('POST',   `/sessions/${sessionId}/assign`, { userId }),
  unassignScorer: (sessionId, userId)  => request('DELETE', `/sessions/${sessionId}/scorers/${userId}`),

  // Scores
  submitScore: (payload)             => request('POST', '/scores', payload),
  rankings:    (ageGroupId, eventId) => request('GET', `/scores/rankings/${ageGroupId}/${eventId}`),
  dashboard:   ()                    => request('GET', '/scores/dashboard'),

  // Admin
  ageGroups:     ()                            => request('GET',    '/admin/age-groups'),
  createAgeGroup:(data)                        => request('POST',   '/admin/age-groups', data),
  events:        ()                            => request('GET',    '/admin/events'),
  createEvent:   (data)                        => request('POST',   '/admin/events', data),
  archiveEvent:  (id, archive)                 => request('PATCH',  `/admin/events/${id}/archive`, { archive }),
  eventStats:    (id)                          => request('GET',    `/admin/events/${id}/stats`),
  players:       (ageGroupId, eventId)         => request('GET',    `/admin/players?age_group_id=${ageGroupId}&event_id=${eventId}`),
  addPlayer:     (data)                        => request('POST',   '/admin/players', data),
  deletePlayer:  (id)                          => request('DELETE', `/admin/players/${id}`),
  bulkPlayers:   (data)                        => request('POST',   '/admin/players/bulk', data),
  setOutcome:    (id, outcome)                 => request('PATCH',  `/admin/players/${id}/outcome`, { outcome }),
  users:         ()                            => request('GET',    '/admin/users'),
  updateUser:    (id, data)                    => request('PATCH',  `/admin/users/${id}`, data),
  userSessions:  (id)                          => request('GET',    `/admin/users/${id}/sessions`),

  // Session Blocks
  sessionBlocks: (eventId, ageGroupId) => {
    const p = new URLSearchParams({ event_id: eventId });
    if (ageGroupId) p.append('age_group_id', ageGroupId);
    return request('GET', `/session-blocks?${p}`);
  },
  createSessionBlock: (data) => request('POST', '/session-blocks', data),
  updateSessionBlock: (id, data) => request('PATCH', `/session-blocks/${id}`, data),
  deleteSessionBlock: (id)   => request('DELETE', `/session-blocks/${id}`),
  reassignBlock:      (id)   => request('POST', `/session-blocks/${id}/reassign`),
  suggestRanges:      (id, slots) => request('GET', `/session-blocks/${id}/suggest-ranges?slots=${slots}`),

  // Import
  importPreview: (data) => request('POST', '/import/preview', data),
  importCommit:  (data) => request('POST', '/import/commit',  data),
  csvTemplate:   ()     => `${BASE}/import/csv-template`,

  // Check-in
  checkin: (sessionId, playerId, checkedIn = true) =>
    request('PATCH', `/sessions/${sessionId}/players/${playerId}/checkin`, { checkedIn }),

  // Evaluation templates
  evaluationTemplates: () => request('GET', '/evaluation-templates'),
};
