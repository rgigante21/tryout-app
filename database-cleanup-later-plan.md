# Database Cleanup Later Plan

## Purpose

This plan tracks the remaining database work for the registration-centered player model.

The app already uses `player_event_registrations` in many important paths, but the schema still preserves legacy event-scoped player columns and dual `player_id`/`registration_id` references. That is intentional transitional state. Cleanup should happen later as its own focused migration effort.

## Current State

Implemented:

- `player_event_registrations`
- nullable `registration_id` on `session_players`
- nullable `registration_id` on `scores`
- registration backfill migration
- registration-aware imports
- registration-aware session assignment
- registration-aware rankings and exports
- gender normalized to `M` / `F`

Still transitional:

- `players` still has event-scoped columns.
- `session_players` still has both `player_id` and `registration_id`.
- `scores` still has both `player_id` and `registration_id`.
- legacy uniqueness constraints still use `player_id` in key places.
- some seed data and compatibility paths still reference old player fields.

## Why This Should Wait

This is higher-risk than the app-facing leftovers because it changes core relational contracts.

Do this after:

- finalization UI is complete
- move-player UI is complete
- import/export behavior is stable
- tests cover the main event-day workflows
- a full code search confirms old columns are no longer needed

## Phase 1: Audit Remaining Legacy Usage

### Goal

Prove which code paths still depend on legacy player columns or player-based roster/score identity.

### Search Targets

- `players.event_id`
- `players.age_group_id`
- `players.jersey_number`
- `players.position`
- `players.will_tryout`
- `players.outcome`
- `session_players.player_id`
- `scores.player_id`
- `ON CONFLICT (session_id, player_id`
- direct joins from events or age groups to `players`

### Acceptance Criteria

- Every remaining use is classified as:
  - safe to remove
  - needs code migration
  - seed/test-only
  - intentionally retained compatibility

## Phase 2: Complete Application Cutover

### Goal

Make registration identity the primary application contract.

### Work

- Use `registration_id` for session roster updates.
- Use `registration_id` for score writes and conflict handling.
- Use `registration_id` for check-in updates.
- Use `registration_id` for move-player operations.
- Keep `player_id` available through joins only when person identity is needed for display.
- Update API response shapes deliberately if frontend callers need `registrationId`.

### Acceptance Criteria

- New roster rows always have `registration_id`.
- New score rows always have `registration_id`.
- No new app write path depends on `players.event_id` or `players.age_group_id`.

## Phase 3: Tighten Constraints

### Goal

Move from transitional dual identity to enforced registration identity.

### Candidate Changes

- Make `session_players.registration_id` `NOT NULL`.
- Make `scores.registration_id` `NOT NULL`.
- Replace `UNIQUE(session_id, player_id)` with `UNIQUE(session_id, registration_id)`.
- Replace score conflict handling with `UNIQUE(session_id, registration_id, scorer_id)`.
- Add or confirm indexes:
  - `player_event_registrations(event_id, age_group_id)`
  - `player_event_registrations(event_id, jersey_number)`
  - `session_players(registration_id)`
  - `scores(registration_id)`

### Acceptance Criteria

- The database prevents duplicate session roster rows by registration.
- The database prevents duplicate score rows by session, registration, and scorer.
- Existing data passes all new constraints before they are enforced.

## Phase 4: Simplify `players`

### Goal

Make `players` a persistent person table rather than an event-scoped participation table.

### Candidate Columns To Drop

- `event_id`
- `age_group_id`
- `jersey_number`
- `position`
- `will_tryout`
- `outcome`

### Candidate Columns To Revisit

- `birth_year`, once `date_of_birth` is reliable enough
- `shot`, depending on whether it should be person-level default or registration-level event data

### Acceptance Criteria

- Person identity fields remain on `players`.
- Event participation fields live on `player_event_registrations`.
- Imports create or update both records through the registration service.

## Phase 5: Remove Legacy Compatibility

### Goal

Remove fallback paths that exist only for the transitional schema.

### Work

- Remove fallback score joins using `scores.player_id`.
- Remove fallback roster joins using `session_players.player_id`.
- Remove legacy import paths if the workspace and group views no longer use them.
- Update seed data to insert persistent players plus registrations directly.
- Update tests to create registrations as the canonical fixture.

### Acceptance Criteria

- Code reads cleanly around registration identity.
- Tests do not need legacy player event columns.
- Fresh installs and migrations produce the same effective schema.

## Verification Checklist

- Fresh `docker compose down -v && docker compose up --build` succeeds.
- Existing migrated database can apply cleanup migrations without data loss.
- Player import creates persistent player records and event registrations.
- Session assignment writes registration-backed roster rows.
- Score submission writes registration-backed score rows.
- Rankings and exports still match pre-cleanup behavior.
- Check-in and move-player behavior still works.

## Do Not Bundle With

Keep this work separate from:

- frontend finalization UI
- move-player UI
- import/export filter polish
- visual redesign
- production hosting setup

This should be its own branch or pull request because rollback and review are much easier when the schema cleanup is isolated.
