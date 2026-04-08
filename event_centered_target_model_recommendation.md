# Event-Centered Target Model Recommendation

## Purpose

This document translates the broader event-centered redesign idea into a version that fits the current tryout app.

The goal is to keep the parts of the current stack that already work well, while fixing the one major structural limitation:

- players are currently stored as event-bound records instead of persistent people across seasons/events

This recommendation is intentionally narrower than a full rewrite.

## Summary

The app is already event-centered in several important ways:

- `tryout_events` is already the top-level operational object
- `age_groups` already act as the division/category taxonomy
- `sessions` are already first-class operational records
- `session_players` already model per-session roster membership and check-in state
- `scores` already model evaluator-per-session scoring

Because of that, the right redesign is:

1. Keep the current event/session architecture
2. Introduce a new registration layer between players and events
3. Convert `players` into a persistent cross-event identity table
4. Re-point session roster and scoring records to registrations
5. Standardize gender to `M` / `F`

## What To Keep

These tables should remain part of the target model:

- `users`
- `age_groups`
- `tryout_events`
- `session_blocks`
- `sessions`
- `game_teams`
- `session_scorers`
- `evaluation_templates`
- `evaluation_criteria`
- `scores`
- `score_entries`
- `audit_log`

These concepts already match the business workflow well enough and do not need wholesale replacement.

## What To Avoid

The following additions are not recommended for this repo right now:

- A separate `divisions` table if it only duplicates `age_groups`
- A separate `evaluators` table if evaluators are just `users`
- A standalone `seasons` table unless the app later needs season-level workflows beyond the existing `tryout_events.season` column
- A full old-schema/new-schema parallel universe for every domain object

## Recommended Vocabulary

To align product language with the current schema:

- Event = `tryout_events`
- Division = `age_groups` in business language
- Registration = new `player_event_registrations`
- Session attendance / roster = `session_players`
- Evaluation = `scores` + `score_entries`

If the product team wants to say "division" in the UI, that can be mostly a naming/UI concern rather than a new core table.

## Target Data Model

### 1. `players`

This becomes the persistent person record.

One row should represent one real player across all events.

Suggested columns:

- `id`
- `first_name`
- `last_name`
- `date_of_birth`
- `gender`
- `external_id`
- `created_at`
- `updated_at`

Optional columns that can remain here if you want them to be person-level defaults:

- `shot`

Columns that should move out of `players` because they are event-scoped:

- `event_id`
- `age_group_id`
- `jersey_number`
- `position`
- `will_tryout`
- `outcome`
- `birth_year` once `date_of_birth` is reliable

### 2. `player_event_registrations`

This is the main new table.

One row should represent one player's participation in one event.

Suggested columns:

- `id`
- `player_id` FK -> `players.id`
- `event_id` FK -> `tryout_events.id`
- `age_group_id` FK -> `age_groups.id`
- `jersey_number`
- `position`
- `shot`
- `will_tryout`
- `outcome`
- `registered_at`
- `created_at`
- `updated_at`

Suggested constraints:

- `UNIQUE (player_id, event_id)`
- index on `(event_id, age_group_id)`
- index on `(event_id, jersey_number)`

Business meaning:

- persistent player identity stays in `players`
- event participation, grouping, and outcome live here

### 3. `session_players`

Keep this table, but re-anchor it to registrations instead of raw players.

Current responsibility to preserve:

- per-session roster membership
- check-in state
- attendance status
- optional team assignment

Suggested target columns:

- `id`
- `session_id` FK -> `sessions.id`
- `registration_id` FK -> `player_event_registrations.id`
- `team_number`
- `checked_in`
- `checked_in_at`
- `attendance_status`
- `created_at`
- `updated_at`

Suggested constraints:

- `UNIQUE (session_id, registration_id)`

### 4. `scores`

Keep this table, but point it at registrations instead of event-bound player rows.

Suggested target columns:

- `id`
- `session_id`
- `registration_id`
- `scorer_id`
- `status`
- `template_id`
- `notes`
- `submitted_at`
- `locked_at`
- `finalized_at`
- `locked_by`
- `finalized_by`
- `created_at`
- `updated_at`

If legacy fixed score columns are still needed during transition, they can remain temporarily:

- `skating`
- `puck_skills`
- `hockey_sense`

Suggested constraint:

- `UNIQUE (session_id, registration_id, scorer_id)`

`score_entries` can remain attached to `scores` as-is.

## Recommended ERD

```text
users
  └─< session_scorers >─ sessions

tryout_events
  ├─< sessions
  ├─< session_blocks
  └─< player_event_registrations

age_groups
  ├─< sessions
  └─< player_event_registrations

players
  └─< player_event_registrations
        ├─< session_players >─ sessions
        └─< scores >─ users
              └─< score_entries >─ evaluation_criteria >─ evaluation_templates
```

## Why This Fits The Current App

### Current strengths preserved

- Event setup still happens at the event/session level
- Age-group workflows remain intact
- Session block assignment logic remains conceptually the same
- Session-based scoring remains intact
- Check-in stays tied to the session roster where it belongs operationally

### Current limitation solved

The current schema cannot model one durable player across multiple events cleanly because `players` is tied directly to `event_id`.

The registration layer fixes:

- year-over-year player history
- returning player reporting
- cleaner imports and deduplication
- player profiles across seasons
- future cross-event analytics

## Gender Standard

The target gender rule should be:

- `gender VARCHAR(1)`
- allowed values: `M`, `F`

Recommended DB constraint:

```sql
CHECK (gender IN ('M', 'F'))
```

Recommended import normalization:

- `male`, `m` -> `M`
- `female`, `f` -> `F`
- anything else -> `NULL` or import validation warning

Note:

The current code has a mismatch between import normalization and DB constraint behavior. That should be corrected during this redesign so the app has one consistent rule.

## Suggested Migration Strategy

This should be done as an additive migration, then cut over in stages.

### Phase 1: Add new registration layer

Add:

- `player_event_registrations`
- `registration_id` nullable column on `session_players`
- `registration_id` nullable column on `scores`

Do not remove any old columns yet.

### Phase 2: Backfill registrations

For each current row in `players`:

- create one `player_event_registrations` row
- use current event-scoped player attributes to populate the registration

Initial backfill rule:

- one current `players` row maps to one registration row

Deduplication of players into persistent identities should be explicit and reviewable, not overly automatic.

### Phase 3: Backfill session roster and score references

Backfill:

- `session_players.registration_id`
- `scores.registration_id`

using the registration row created from the current player row.

### Phase 4: Update application queries and writes

Change the app to:

- create/find persistent `players`
- create `player_event_registrations` for event entry
- use `registration_id` in session roster logic
- use `registration_id` in scoring logic
- report by joining through registrations instead of direct event-bound players

### Phase 5: Simplify `players`

After the app no longer depends on event-bound player records:

- drop `players.event_id`
- drop `players.age_group_id`
- drop `players.jersey_number`
- drop `players.position`
- drop `players.will_tryout`
- drop `players.outcome`
- eventually drop `birth_year` if no longer needed

## Application-Level Changes

### Backend

Routes and service logic that currently assume `players` is event-bound will need to move to registration-based joins.

Most impacted areas:

- admin player creation/import
- session player loading
- session assignment logic
- scoring submission
- rankings/results aggregation
- event stats

### Frontend

The UI does not need a major conceptual rewrite.

The visible admin workflow can remain:

1. Create event
2. Pick age group
3. Import/register players
4. Create session blocks / sessions
5. Check players in
6. Score players
7. Review results

The main UI change is that "add player" and imports should really create:

- a persistent player identity
- plus an event registration

## Query and Reporting Impact

Once registrations exist, the app can support cleaner reporting:

- registrations by event
- registrations by age group
- returning players by event/season
- player history across events
- scores by session, event, and player history

This also makes it easier to compute "who returned this year" because the same player can now exist across multiple events without duplicate person records.

## Recommended Constraints and Indexes

### `players`

- unique partial index on `external_id` if trusted
- index on `(last_name, first_name, date_of_birth)` for matching and dedupe review

### `player_event_registrations`

- `UNIQUE (player_id, event_id)`
- index on `(event_id, age_group_id)`
- index on `(event_id, jersey_number)`
- index on `(age_group_id, event_id)`

### `session_players`

- `UNIQUE (session_id, registration_id)`
- index on `(registration_id)`

### `scores`

- `UNIQUE (session_id, registration_id, scorer_id)`
- index on `(registration_id)`
- index on `(session_id, scorer_id)`

## Migration Risks To Plan For

- duplicate current players that really refer to the same person
- players with missing DOB and weak external identity
- current reports that join directly from events to players
- session assignment helpers that currently assume `players.age_group_id` and `players.event_id`
- imports that currently write event-specific attributes directly into `players`

## Recommended Decision Log

These decisions should be treated as locked unless a new product requirement appears:

1. Keep `tryout_events` as the top-level event object
2. Keep `age_groups` instead of creating a duplicate `divisions` table
3. Add `player_event_registrations` as the missing participation layer
4. Make `players` persistent across events
5. Re-point session roster and scores to registrations
6. Keep the existing session-centered operational workflow
7. Standardize gender to `M` / `F`

## Next Step

The next design artifact should be a concrete migration blueprint that maps:

- current `players` columns -> `players` vs `player_event_registrations`
- current `session_players.player_id` -> `registration_id`
- current `scores.player_id` -> `registration_id`
- exact API queries that must change first

That migration blueprint should be written before touching application code.
