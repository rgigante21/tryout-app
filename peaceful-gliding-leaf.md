# Tryout App: Revised Production Readiness Plan

## Executive Assessment

The original plan is directionally solid on operations and frontend reliability, but it is not yet sufficient for an internet-facing production deployment.

The biggest gaps are not UI issues. They are backend trust boundaries:

1. `POST /api/auth/register` is currently public, even though the app treats account creation as admin-driven.
2. Any authenticated user appears able to fetch arbitrary session rosters and submit scores for arbitrary sessions unless additional checks exist elsewhere.
3. Auth uses bearer tokens in `localStorage`, which is a weaker posture than an `HttpOnly` cookie-based session model for this app.
4. Logging, auditability, secret management, and deployment controls are not yet called out strongly enough.

Because of that, the right move is to keep most of the product roadmap, but reorder it so security blockers come first.

---

## Production Readiness Principles

- Do not ship public registration. User creation should be admin-only or invite-only.
- Enforce authorization at the resource level, not just by role.
- Prefer secure server-managed sessions or `HttpOnly` auth cookies over bearer tokens in `localStorage`.
- Validate every request with a real schema layer, not ad hoc field checks.
- Log security-relevant events, but never log passwords, tokens, session identifiers, DB credentials, or secrets.
- Treat deployment controls as part of the product: TLS, secret rotation, backups, dependency scanning, and restore drills are required work.

---

## Phase 0 — Critical Security Blockers

These items should be completed before any production pilot.

### 0.1 Replace public registration
**Current risk:** `/api/auth/register` is public.

**Recommendation:**
- Remove public self-service registration entirely.
- Move account creation to a protected admin flow:
  - either `POST /api/admin/users`
  - or invite-only onboarding with a one-time token and expiration
- If invites are added later, require single-use invite tokens, short TTL, and audit logging.

### 0.2 Fix resource-level authorization
**Current risk:** role checks exist, but resource ownership checks appear incomplete.

**Required rules:**
- A scorer can only:
  - view sessions assigned to them
  - fetch players for sessions assigned to them
  - submit/update scores only for sessions assigned to them
- Admin/coordinator can access all sessions
- Any endpoint using `:sessionId`, `:playerId`, or block/session relationships must verify the caller is authorized for that specific resource

**Files most likely affected:**
- `/backend/routes/sessions.js`
- `/backend/routes/scores.js`
- `/backend/routes/session-blocks.js`
- `/backend/routes/admin.js`
- `/backend/middleware/auth.js`

### 0.3 Replace `localStorage` token auth
**Current risk:** JWT stored in `localStorage`.

**Recommendation:**
- Move to cookie-based auth for the web app:
  - `HttpOnly`
  - `Secure`
  - `SameSite=Lax` or `Strict` unless cross-site requirements force otherwise
- Add:
  - `POST /api/auth/logout`
  - session expiration policy
  - server-side invalidation on logout, password reset, and role change
- If JWTs are kept temporarily, add:
  - short access token TTL
  - refresh-token rotation
  - `jti` or token version invalidation

**Implementation note:** because this app is a single web client talking to its own API, cookie auth is the simpler and safer default.

### 0.4 Add proper request validation
The original `validate.js` idea is right, but hand-rolled validators will not scale.

**Recommendation:**
- Use a schema library such as `zod` or `express-validator`
- Validate:
  - params
  - query strings
  - request bodies
  - enums
  - date/time formats
  - integer bounds
- Normalize and reject unexpected fields

### 0.5 Add audit logging
Operationally, this app needs a real audit trail.

**Log these events:**
- login success/failure
- logout
- account creation
- role changes
- password resets/changes
- player moved between sessions
- check-in changes
- attendance status changes
- session/block creation or reassignment
- result finalization/export

**Do not log:**
- passwords
- tokens
- session IDs
- DB connection strings
- secrets

### 0.6 Lock down deployment defaults
Add production requirements to the plan:

- TLS 1.3 by default, TLS 1.2 only if required by hosting constraints
- HSTS at the reverse proxy
- production secret storage outside `.env` where possible
- DB SSL enabled in production
- least-privileged DB user
- security patching and dependency scanning in CI
- nightly backups plus restore test cadence

---

## Phase 1 — Backend Hardening

### 1.1 Packages
**File:** `/backend/package.json`

Add:
- `helmet`
- `express-rate-limit`
- `zod` or `express-validator`
- `pino-http` or another JSON logger
- optionally `cookie-parser` if using signed cookies

Replace the original `morgan('combined')` recommendation with structured JSON request logging.

### 1.2 New file: `/backend/middleware/security.js`
Responsibilities:
- `helmet()` with API-appropriate settings
- request size limits
- exact CORS allowlist from env
- request ID generation / propagation
- auth rate limiting
- optional general API rate limiting for abusive clients
- `app.set('trust proxy', 1)` when running behind a load balancer or reverse proxy

### 1.3 New file: `/backend/middleware/validate.js`
Schema-backed request validation helpers:
- `validateBody(schema)`
- `validateQuery(schema)`
- `validateParams(schema)`

### 1.4 Expand `/backend/middleware/auth.js`
Add helpers for:
- `requireAuth`
- `requireRole`
- `requireAssignedSessionAccess`
- `requireAdminOrCoordinator`
- token/session invalidation checks

### 1.5 Update `/backend/index.js`
- Validate required env on startup:
  - `JWT_SECRET` if JWT remains in use
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASS`
  - `CORS_ORIGINS`
- Fail fast in production if secure settings are missing
- Add centralized error handler
- Add request logging
- Add `Cache-Control: no-store` on auth/session-sensitive responses

### 1.6 Lock down auth routes
**File:** `/backend/routes/auth.js`

Required changes:
- remove or protect `/register`
- normalize login failure responses
- rate-limit login
- add logout endpoint
- optionally add password reset flow later

Password policy:
- minimum 12 characters for admins/coordinators; allow passphrases
- maximum at least 64 characters
- do not require arbitrary composition rules

### 1.7 Tighten DB access
**File:** `/backend/db/pool.js`

Add:
- `ssl` in production
- pool sizing from env
- `statement_timeout`
- `idle_in_transaction_session_timeout`
- connection lifecycle logging without leaking credentials

### 1.8 New file: `/backend/routes/session-players.js`
Keep the planned move endpoint:

`PATCH /api/session-players/move`

But require:
- admin/coordinator auth
- validated body schema
- transaction
- audit log entry
- concurrency-safe checks

Body:
```json
{ "playerId": 1, "fromSessionId": 10, "toSessionId": 11, "keepCheckinStatus": true }
```

### 1.9 Add to `/backend/routes/session-blocks.js`
Keep the planned preview endpoint:

`GET /api/session-blocks/suggest-ranges-preview`

Add:
- schema validation
- explicit auth guard
- route ordering ahead of `/:id`

### 1.10 Add to `/backend/routes/sessions.js`
Keep the planned sibling-session endpoint:

`GET /api/sessions/:id/siblings`

But authorization should be:
- admin/coordinator: allowed
- scorer: only if assigned to that source session

### 1.11 Fix score submission authorization
**File:** `/backend/routes/scores.js`

Before insert/update:
- verify caller is assigned to `sessionId` unless admin/coordinator
- verify `playerId` belongs to that session roster
- reject scoring against unrelated sessions/players

This is a must-have production fix.

### 1.12 Add security-focused tests
Add API tests for:
- unauthorized roster access
- unauthorized score submission
- public registration blocked
- cookie flags or token expiry behavior
- rate-limit behavior
- move-player transaction integrity

---

## Phase 2 — Operational Flexibility

### 2.1 Fix session renaming state bug
**File:** `/frontend/src/pages/Admin.jsx`

Keep the original fix:
- stop appending optimistic session objects after block creation
- re-fetch authoritative session data from the server

### 2.2 Add move-player UI in admin
**File:** `/frontend/src/features/admin/views/SessionsView.jsx`

Keep the original feature, with two additions:
- show current check-in state before confirm
- require an explicit confirmation dialog before moving a checked-in player

### 2.3 Add admin APIs in `/frontend/src/utils/api.js`
Keep:
- `movePlayer`
- `suggestRangesPreview`
- `sessionSiblings`

If cookie auth is adopted, also update the request helper to use:
- `credentials: 'include'`
- no manual `Authorization` header from `localStorage`

### 2.4 Smart distribution in block wizard
**File:** `/frontend/src/features/admin/shared.jsx`

Keep the planned even-distribution preview, plus:
- warn if projected slot counts drift beyond a tolerance
- allow manual lock of one slot so auto-distribution only adjusts the others

### 2.5 Add evaluator-side session awareness
**File:** `/frontend/src/pages/Score.jsx`

Keep:
- checked-in indicators
- manual refresh
- auto-refresh
- move-player affordance

Add:
- scorer completion summary for the session
- badge showing unscored players remaining

### 2.6 Add a session ops panel
This is missing from the original plan and is high value day-of.

**Recommended feature:**
- one compact admin panel per session showing:
  - assigned scorers
  - checked-in count
  - not-present count
  - scores submitted / expected
  - last refresh time

This becomes the day-of control surface instead of making admins infer status from several screens.

---

## Phase 3 — Check-In, Accountability, and Event Controls

### 3.1 Polling in `CheckInView.jsx`
Keep the original silent polling plan.

### 3.2 Accountability badge on session cards
Keep the original plan.

### 3.3 Attendance status
Keep the optional `attendance_status` migration.

Recommended values:
- `checked_in`
- `late_arrival`
- `no_show`
- `excused`

If you keep `checked_in` as a separate boolean, make sure the semantics are documented so the two fields cannot drift.

### 3.4 Add scorer completion tracking
This is a missing feature.

**Recommendation:**
- For each session, track:
  - total players
  - checked-in players
  - players with at least one score
  - players missing one or more scorer submissions
- Surface this in:
  - admin overview
  - session cards
  - evaluator session page

This matters as much as check-in accountability because incomplete scoring is a real event-day failure mode.

### 3.5 Add session finalization / lock workflow
Another missing production feature.

**Recommendation:**
- Session statuses should support:
  - `pending`
  - `open`
  - `scoring_complete`
  - `finalized`
- Once finalized:
  - no roster moves without admin override
  - no score edits without admin override
  - all changes generate audit logs

---

## Phase 4 — Frontend Reliability

### 4.1 Error boundaries
Keep the original plan.

### 4.2 Status and error components
Keep the original plan, but ensure auth errors and permission errors are rendered distinctly from generic failures.

### 4.3 Admin state refactor
The `useReducer` refactor is reasonable, but it is not more important than security or day-of operations.

**Recommendation:**
- keep it as Phase 4 work
- do not start it until Phases 0-3 are stable
- consider splitting by feature modules instead of a single large admin context if the state graph stays broad

### 4.4 Route-aware stale data handling
Add:
- `AbortController` for in-flight requests on view changes
- stale request guards so slow responses do not overwrite newer state

### 4.5 Auth failure handling
If cookie auth/session expiry is added:
- redirect cleanly on `401`
- clear local user state
- preserve intended destination where appropriate

---

## Phase 5 — Ops, Compliance, and Release Readiness

This was mostly missing from the original plan and should be explicit.

### 5.1 CI security checks
Add CI jobs for:
- `npm audit` or equivalent dependency scanning
- lint/test
- API security tests
- migration checks

### 5.2 Secret management
Document:
- where production secrets live
- who can rotate them
- rotation cadence
- emergency revocation procedure

### 5.3 Backups and recovery
Define:
- backup frequency
- retention policy
- restore owner
- restore test cadence
- RPO/RTO target

### 5.4 Monitoring and alerting
Add:
- error-rate alerting
- auth-failure spikes
- repeated 403/429 patterns
- DB saturation
- scheduler/job failures

### 5.5 Release gates
Production deployment should require:
- successful migration dry run
- smoke test in staging
- auth/authz test pass
- backup confirmation
- rollback plan

---

## Recommended Feature Additions

These are the most useful missing features for real tryout operations:

1. Scorer completion tracking
2. Session finalization / lock workflow
3. Audit trail for all admin actions
4. Session ops panel with live operational status
5. Attendance status workflow
6. Exportable attendance and results reports

If you only add two beyond the original plan, make them:
- scorer completion tracking
- session finalization / locking

---

## Revised Implementation Order

| Week | Work |
|---|---|
| 1 | Phase 0 entirely: registration lockdown, resource authorization, auth storage/session model, audit logging design |
| 2 | Phase 1 core backend hardening: security middleware, validation, DB/ops settings, secure auth/logout, score authorization |
| 3 | Phase 2 operational flexibility: move-player API/UI, session renaming fix, smart distribution, session ops panel |
| 4 | Phase 3 accountability: check-in polling, attendance status, scorer completion tracking, session finalization |
| 5 | Phase 4 frontend reliability: error boundaries, stale request handling, auth expiry UX, status components |
| 6 | Phase 5 release readiness: CI security checks, backups, monitoring, staging verification, go-live checklist |

---

## Critical Files Likely Modified

- `/backend/index.js`
- `/backend/db/pool.js`
- `/backend/middleware/auth.js`
- `/backend/middleware/security.js`
- `/backend/middleware/validate.js`
- `/backend/routes/auth.js`
- `/backend/routes/sessions.js`
- `/backend/routes/scores.js`
- `/backend/routes/session-blocks.js`
- `/backend/routes/session-players.js`
- `/frontend/src/hooks/useAuth.jsx`
- `/frontend/src/utils/api.js`
- `/frontend/src/pages/Admin.jsx`
- `/frontend/src/pages/Score.jsx`
- `/frontend/src/features/admin/views/SessionsView.jsx`
- `/frontend/src/features/admin/views/CheckInView.jsx`
- `/frontend/src/features/admin/shared.jsx`

---

## Revised Key Risks

1. **Authorization drift**: role checks alone are not enough; session/resource ownership must be enforced consistently.
2. **Auth migration complexity**: moving from bearer tokens in `localStorage` to cookies will touch both frontend and backend.
3. **Event-day concurrency**: moving checked-in players, reassignment, and live polling can create race conditions unless transactions and reloads are handled carefully.
4. **State refactor scope**: the `Admin.jsx` refactor should not be allowed to delay security blockers.
5. **Operational blind spots**: without audit logs, completion tracking, and backups, production incidents will be hard to diagnose or recover from.

---

## Verification Checklist

### Security
- Public `POST /api/auth/register` is removed or returns `403/404`
- Unassigned scorer requesting another session roster gets `403`
- Unassigned scorer posting a score for another session gets `403`
- Auth cookies are `HttpOnly`, `Secure`, and `SameSite` as intended
- Logout invalidates the current session/token
- Login throttling returns `429` when limits are exceeded
- Logs do not contain passwords, tokens, session IDs, DB credentials, or secrets
- Production startup fails if critical secure env vars are missing

### Operations
- Session creation/block creation always reflects server-authoritative names after reload
- Moving a player between sessions updates both admin and evaluator views correctly
- Checked-in player moves preserve or reset attendance exactly as selected
- Auto-distribution gives sane slot estimates before block creation
- Scorer completion counts update as scores are submitted
- Finalized sessions reject normal edits

### Release readiness
- Backup restore test succeeds
- CI security checks pass
- Staging smoke test passes for login, check-in, scoring, move-player, and finalization

---

## Source Notes For Security Standards

This revised plan aligns with current OWASP guidance on:
- authentication controls
- session management
- logging hygiene
- secret management
- transport security

It also reflects current NIST password guidance direction: longer passphrases, no arbitrary composition rules, and stronger session handling around sensitive operations.
