# App-Facing Leftovers Plan

## Purpose

This plan consolidates the remaining user-visible work from the older production readiness and import/export plans.

The database registration-model cleanup is intentionally not included here. That work is tracked separately in `database-cleanup-later-plan.md`.

## Current State

The app already has most of the major foundations in place:

- HttpOnly cookie auth and logout
- public registration disabled
- scorer resource checks for assigned sessions
- score submission authorization
- import batch tracking
- CSV/XLSX import preview and commit
- player, evaluator, and session assignment imports
- event-scoped export endpoints
- registration-aware score and roster joins
- session finalization backend endpoint
- move-player backend endpoint

The remaining work is mostly about making those backend capabilities complete and obvious in the UI.

## Priority 1: Session Finalization UX

### Goal

Make `scoring_complete` and `finalized` real admin workflows, not hidden backend states.

### Work

- Add `scoring_complete` and `finalized` to frontend session status metadata.
- Allow coordinators to mark a session as `scoring_complete`.
- Allow admins to mark a session as `finalized`.
- Hide or disable normal score and roster edits for finalized sessions.
- Show a clear locked/finalized indicator in admin and scorer views.
- Refresh session data after finalization so the UI reflects server state.

### Backend Notes

The backend already exposes:

- `PATCH /api/admin/sessions/:id/finalize`
- score rejection for finalized sessions for non-admin callers

### Acceptance Criteria

- Coordinators can mark scoring complete from the admin UI.
- Admins can finalize from the admin UI.
- Scorers see finalized sessions as locked or non-editable.
- Normal score edits are blocked for finalized sessions.
- Tests cover scorer rejection and admin override behavior.

## Priority 2: Move-Player UI

### Goal

Expose the existing move-player backend workflow in the admin UI.

### Work

- Add a move action from a session roster row.
- Load sibling sessions via `GET /api/sessions/:id/siblings`.
- Show the player's current check-in state before moving.
- Require explicit confirmation when moving a checked-in player.
- Offer a preserve check-in option.
- Call `PATCH /api/session-players/move`.
- Refresh source and destination session rosters after a successful move.

### Backend Notes

The backend already exposes:

- `GET /api/sessions/:id/siblings`
- `PATCH /api/session-players/move`

### Acceptance Criteria

- Admins/coordinators can move a player between sessions in the same block.
- Checked-in player moves require confirmation.
- The user can choose whether to preserve check-in state.
- Source and destination rosters update after the move.
- Scorers cannot call the move endpoint.

## Priority 3: Session Ops Visibility

### Goal

Give admins a quick day-of view of whether a session is operationally healthy.

### Work

- Surface assigned scorer count.
- Surface checked-in count.
- Surface players with at least one score.
- Surface players missing scores.
- Show scorer-by-scorer completion counts when a session is expanded.
- Include last refresh time where the view polls or reloads.

### Backend Notes

The backend already exposes:

- `GET /api/admin/sessions/:id/completion`
- completion data from `GET /api/sessions/:id/players`

### Acceptance Criteria

- Expanded session cards show scorer completion status.
- Admin overview or session board shows missing score risk.
- Counts update after check-in, scoring, or manual refresh.

## Priority 4: Check-In Reliability Polish

### Goal

Make check-in more dependable for live event use.

### Work

- Add silent polling to the check-in page.
- Preserve optimistic updates, but reconcile with server data on poll.
- Surface attendance statuses beyond the boolean checked-in state:
  - `checked_in`
  - `late_arrival`
  - `no_show`
  - `excused`
- Avoid letting `checked_in` and `attendance_status` drift semantically.

### Acceptance Criteria

- Check-in page updates without a full manual refresh.
- Admins can distinguish checked-in players from no-shows and excused absences.
- Toggling check-in remains fast and stable.

## Priority 5: Import/Export Finish Line

### Goal

Make the current import/export workflow complete enough for SportsEngine-style manual exchange.

### Work

- Add export filters that map to real data already in the app:
  - age group
  - finalized sessions only
  - outcome
- Make export labels match current app vocabulary.
- Add row-count preview before download if it can be done cheaply.
- Ensure import summaries clearly distinguish:
  - added
  - updated
  - skipped
  - errored
- Keep the known-template approach. Do not add a universal spreadsheet mapper yet.

### Acceptance Criteria

- Admins can download useful filtered CSVs without hand-editing around obvious cases.
- Export data matches current app fields rather than future placeholder fields.
- Bad import rows can be diagnosed from the preview and error CSV.

## Priority 6: Frontend Reliability

### Goal

Reduce avoidable UI failure modes before a pilot or production run.

### Work

- Add an app-level error boundary.
- Show permission errors differently from generic failures.
- Add stale request guards or `AbortController` where route changes can race.
- Redirect cleanly on `401`.
- Preserve intended destination where practical.

### Acceptance Criteria

- A render error does not blank the whole app.
- Expired sessions take the user back to login cleanly.
- Slow responses from old views do not overwrite newer state.

## Priority 7: Focused Tests

### Goal

Protect the workflows most likely to break during event-day use.

### Tests To Add Or Extend

- Finalization endpoint role behavior:
  - coordinator can mark `scoring_complete`
  - coordinator cannot mark `finalized`
  - admin can mark `finalized`
- Move-player transaction behavior:
  - preserves check-in when requested
  - resets check-in when requested
  - rejects cross-event or cross-age-group moves
- Import/export smoke tests:
  - upload preview creates a batch
  - commit cannot run twice
  - filtered export returns CSV

## Explicitly Deferred

These are not part of this app-facing cleanup pass:

- dropping legacy columns from `players`
- removing `player_id` from `session_players` or `scores`
- changing database uniqueness constraints to registration-only
- introducing a full team-placement/recommendation schema
- CI, backups, monitoring, and production infrastructure

Those belong in either `database-cleanup-later-plan.md` or a deployment-readiness plan.
