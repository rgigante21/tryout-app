# Mite 60-Skater Simulation Results

Seeded into the current local database.

## Seeded Scenario

- Event: `Mite 60-Skater Simulation` (`event_id=75`)
- Age group: `Mite Simulation` (`age_group_id=80`, code `MITE-SIM`)
- Sessions:
  - `89` - `Mite Skills - All Skaters`
  - `90` - `Mite Game 1 - Black vs Gold`
  - `91` - `Mite Game 2 - White vs Maroon`
- Evaluators:
  - `mite-coach-1@tryouts.local`
  - `mite-coach-2@tryouts.local`
  - `mite-coach-3@tryouts.local`
- Evaluator password: same as local admin, `Admin1234!`

The reusable seed is in `scripts/seed-mite-simulation.sql`.

## Counts

| Area | Count |
|---|---:|
| Registered skaters | 60 |
| Checked in per session | 54 |
| Not checked in per session | 6 |
| Evaluators per session | 3 |
| Scores per session | 162 |
| Scores per evaluator per session | 54 |

Unchecked jerseys are `7`, `13`, `29`, `41`, `52`, and `60`. These players remain visible to admin/coordinator check-in tools, but are hidden from evaluator scoring rosters and cannot be scored through the API.

## Movement / Game Setup

Game 1 assigns checked-in players across teams `1` and `2`:

- Team 1: 27 checked-in skaters
- Team 2: 27 checked-in skaters

Game 2 rebalances into teams `3` and `4`:

- Team 3: 27 checked-in skaters
- Team 4: 27 checked-in skaters

The seed records a `player_moved` audit entry with `simulation=mite-60-skater` and a representative moved jersey list. The game-session team assignments also provide concrete data for roster setup screens that need to compare groupings across sessions.

## Outcomes For Roster Work

The simulation sets event registration outcomes from aggregate score tiers:

| Outcome | Count |
|---|---:|
| `moved_up` | 20 |
| `retained` | 20 |
| `left_program` | 20 |

This gives the rosters section enough volume to test filters, grouping, outcome-driven exports, and large-list scanning.

## Implementation Findings

- Evaluator session rosters must be based on checked-in players, not full assigned rosters.
- Score submission must enforce the same checked-in rule server-side, because hiding a skater in the UI is not enough.
- Admin/coordinator roster reads still need the full assigned roster for check-in, attendance edits, and moves.
- Scorer session cards should count checked-in players so progress reads like `54/54`, matching the actual clickable/scorable roster.
- Date rendering on the scorer page needs to accept API date strings with or without a time component.

## Verification

- Backend tests: `tests/sessions.test.js` and `tests/scores.test.js` pass.
- Browser check: logging in as `mite-coach-1@tryouts.local` shows three Mite sessions, each with `54/54 scored`.
- Browser check: opening the skills session renders 54 skater buttons; unchecked jerseys are absent.
- Roster-builder check: `Mite Simulation` saves a two-team split with a moveable divider and generated SportsEngine export folders.
- Import/Export check: saved roster export folders appear under Export with group-derived folder names and CSV download links.
