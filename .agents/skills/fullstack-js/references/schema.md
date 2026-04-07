# Database Schema Reference

Source of truth: `postgres/init.sql` — runs once on first container startup.

## Table Overview

```
tryout_events
  └── age_groups (via age_group_id on players, sessions, session_blocks)
      └── players (event_id + age_group_id)
          └── session_players (player ↔ session roster)

session_blocks (event + age_group + date + split_method)
  └── sessions (many per block)
      ├── session_players (roster, with team_number for games)
      ├── session_scorers (assigned scorers)
      └── scores (one per player+scorer+session)

users (role: scorer | coordinator | admin)
  └── session_scorers (user ↔ session assignment)
  └── scores (scorer_id)

evaluation_templates
  └── evaluation_criteria (criteria keys + weights)
  └── age_groups.default_template_id (FK)
```

## Key Tables

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| email | VARCHAR UNIQUE | login credential |
| password | VARCHAR | bcrypt hashed |
| first_name, last_name | VARCHAR | |
| role | VARCHAR | `scorer` \| `coordinator` \| `admin` |

### `tryout_events`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| name | VARCHAR | e.g. "Fall 2026 Tryouts" |
| season | VARCHAR | e.g. "2026-27" |
| start_date, end_date | DATE | |
| archived | BOOLEAN | soft delete |

### `age_groups`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| name | VARCHAR | e.g. "Bantam" |
| code | VARCHAR UNIQUE | e.g. "U14" |
| sort_order | INT | display ordering |
| default_template_id | INT FK → evaluation_templates | |

### `session_blocks`
Groups related sessions by date and split method.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| event_id | INT FK | |
| age_group_id | INT FK | |
| block_type | VARCHAR | `skills` \| `game` |
| split_method | VARCHAR | `last_name` \| `jersey_range` \| `division` \| `manual` \| `none` |
| label | VARCHAR | optional display label |
| session_date | DATE | |
| team_count | SMALLINT | 2–8, for game blocks |
| scoring_mode | VARCHAR | `full` \| `observe` |

### `sessions`
Individual ice slots within a block.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| event_id | INT FK | |
| age_group_id | INT FK | |
| block_id | INT FK → session_blocks | |
| name | VARCHAR | display name |
| session_type | VARCHAR | `skills` \| `game` |
| session_date | DATE | |
| start_time | TIME | used by scheduler for auto-activation |
| status | VARCHAR | `pending` → `active` → `complete` |
| last_name_start/end | VARCHAR | for last_name split |
| jersey_min/max | INT | for jersey_range split |
| home_team, away_team | SMALLINT | for game sessions |

### `players`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| first_name, last_name | VARCHAR | |
| jersey_number | INT | |
| age_group_id | INT FK | |
| event_id | INT FK | |
| position | VARCHAR | `skater` \| `goalie` \| `defense` \| `forward` |
| will_tryout | BOOLEAN | false = registered but won't participate |
| birth_year | INT | |
| outcome | VARCHAR | `moved_up` \| `retained` \| `left_program` \| NULL |
| UNIQUE | (jersey_number, age_group_id, event_id) | jersey numbers are per-group per-event |

### `session_players`
Explicit player roster for each session (populated by split logic).

| Column | Type | Notes |
|--------|------|-------|
| session_id | INT FK | |
| player_id | INT FK | |
| team_number | SMALLINT | populated for game sessions |
| checked_in | BOOLEAN | attendance |
| attendance_status | VARCHAR | `checked_in` \| `late_arrival` \| `no_show` \| `excused` |
| UNIQUE | (session_id, player_id) | |

### `session_scorers`
Which scorers are assigned to which sessions.

| Column | Type | Notes |
|--------|------|-------|
| session_id | INT FK | |
| user_id | INT FK | |
| UNIQUE | (session_id, user_id) | |

### `scores`
One row per scorer+player+session. The unit of evaluation.

| Column | Type | Notes |
|--------|------|-------|
| session_id | INT FK | |
| player_id | INT FK | |
| scorer_id | INT FK → users | |
| criteria_scores | JSONB | `{ "skating": 4, "puck_skills": 3, "hockey_sense": 5 }` |
| notes | TEXT | optional |
| UNIQUE | (session_id, player_id, scorer_id) | one score per scorer per player per session |

### `evaluation_templates` + `evaluation_criteria`
ADM-aligned rubrics. Templates have many criteria with keys (like `"skating"`), labels, weights, and sort order. Age groups can have a default template.

## Common Query Patterns

**Players in a session with their scores:**
```sql
SELECT p.*, sp.checked_in, sp.team_number,
       s.criteria_scores, s.scorer_id
FROM session_players sp
JOIN players p ON p.id = sp.player_id
LEFT JOIN scores s ON s.session_id = sp.session_id AND s.player_id = sp.player_id
WHERE sp.session_id = $1
ORDER BY p.last_name, p.first_name;
```

**Sessions a scorer is assigned to:**
```sql
SELECT s.*, sb.label AS block_label
FROM sessions s
JOIN session_scorers ss ON ss.session_id = s.id
LEFT JOIN session_blocks sb ON sb.id = s.block_id
WHERE ss.user_id = $1
ORDER BY s.session_date, s.start_time;
```

**Rankings for an age group + event:**
```sql
SELECT p.id, p.first_name, p.last_name, p.jersey_number,
       COUNT(sc.id) AS score_count,
       AVG((sc.criteria_scores->>'skating')::numeric) AS avg_skating
FROM players p
LEFT JOIN scores sc ON sc.player_id = p.id
WHERE p.age_group_id = $1 AND p.event_id = $2
GROUP BY p.id
ORDER BY avg_skating DESC NULLS LAST;
```

## Schema Change Workflow

The init.sql only runs on first container initialization. To make a schema change in development:
1. Edit `postgres/init.sql`
2. `docker compose down -v && docker compose up --build` (wipes all data)

For production-style incremental migrations, a migration tool (node-pg-migrate, Flyway) should be adopted. As of now, this project uses init.sql only.
