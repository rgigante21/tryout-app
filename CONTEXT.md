# TryoutOPS

A multi-tenant hockey tryout evaluation platform. Admins manage events, age groups, sessions, and player rosters. Scorers evaluate players on the ice. The platform targets hockey organizations of varying sizes and naming conventions.

## Language

### Organization & Events

**Organization**: A hockey club or association that owns its own data, users, and branding. The top-level tenant unit.
_Avoid_: Club, team, customer

**Tryout Event**: A multi-day evaluation event tied to one Organization. Contains age groups, sessions, and players.
_Avoid_: Tournament, camp

**Season Year**: The calendar year in which a Tryout Event takes place, derived from the event's `start_date`. Used to calculate valid birth years for U-level Age Groups.

### Age Groups

**Age Group**: A player division within a Tryout Event. An Organization names it however they prefer. Two models exist:

- **U-level Age Group**: Has a `max_age` (e.g., `8` for U8). Valid birth years are derived at runtime: `[season_year - max_age, season_year - max_age + 1]`. The window always spans exactly 2 birth years. The display name is freeform (e.g., "Mites", "U8", "Peewee").
- **Birth Year Age Group**: Has explicit `birth_year_min` and `birth_year_max`. Used by organizations that group players by year of birth rather than age level (e.g., "2018/2019 Group"). `max_age` is null.

If neither `max_age` nor `birth_year_min/max` is set, no birth year validation runs (e.g., "Open" groups).

_Avoid_: Division, bracket, level

### Import

**Import Preview**: The first phase of a two-phase roster import. Parses and validates each row, returning per-row errors and warnings without writing to the database. Admins review before committing.

**Import Commit**: The second phase. Atomically writes all valid rows; error and skipped rows are excluded. Cannot be undone — prevention of bad imports happens at the Preview stage.

**Birth Year Mismatch Warning**: A warning surfaced during Import Preview when a player's `birth_year` falls outside the Age Group's valid range (derived or explicit). Does not block commit — it is the admin's responsibility to confirm or abort.

_Avoid_: Upload, sync

### Session Status

**Session Status**: The lifecycle stage of a session. Five states in order:

- **Pending**: Scheduled but not yet started. Auto-transitions to On Ice 10 minutes before start time.
- **On Ice**: Session is actively running. Scorers can evaluate players. _(was: Active)_
- **Off Ice**: Session has ended but scores may still be missing. _(was: Complete)_
- **Scores In**: All scorers have submitted their evaluations. Coordinators can advance to this state. _(was: Scoring Complete)_
- **Finalized**: Admin has locked the session. Scores and player moves are blocked. Coordinators understand this state but only Admins can set it.

_Avoid_: Complete, Scoring Complete (old names — replaced)

### Scorer Experience

**Scorer**: A user who evaluates players on the ice during a session. Typically working from a phone on the bench.

**Player Grid**: The primary scorer interface — a grid of jersey number buttons, color-coded by score status (yellow = incomplete, green = complete). Scorers find players by jersey number (they watch a player skate, then tap their number). This is the correct interaction model — do not replace with a list view.

- Players who have not been checked in are disabled and greyed out. Scorers cannot evaluate non-attending players.
- Mobile layout: 4 columns (not 5) for adequate tap target size.

### Sessions & Today

**Session Block**: A planning unit that creates one or more related Sessions for the same Tryout Event and Age Group.
_Avoid_: Session group, batch

**Balanced Session Split**: A previewed player distribution across a Session Block's time slots that prioritizes the most even player count per Session over neat-looking alphabet or jersey ranges.
_Avoid_: Even split, automatic placement

**Tryout Participant**: A player registration marked as expected to participate in a Tryout Event.
_Avoid_: Registered player, active player

**Planning Gap**: An open time slot inferred from already-created Sessions in a Tryout Event schedule.
_Avoid_: Rink availability, ice reservation

**Game Line Tier**: A configurable ranked band of Tryout Participants used to place similar-skill players against each other during game Sessions.
_Avoid_: A team, cut line, final placement

**Game Roster Draft**: A coordinator-editable team and line assignment generated from Results before game Sessions are run.
_Avoid_: Automatic roster, final game roster

**Roster Seed Source**: The starting point used to generate a Game Roster Draft, such as skills rankings, Current Team Context, or a manual blank draft.
_Avoid_: Ranking mode, auto-sort

**Default Roster Seed Source**: The admin-selected Roster Seed Source normally used for an Age Group.
_Avoid_: Required ranking mode, permanent roster rule

**Age Group Planning Defaults**: Admin-selected defaults that prefill session planning and roster-building workflows for an Age Group without limiting which options can be used.
_Avoid_: Age group restrictions, locked workflow

Session planning defaults include preferred session type, default skill slot length, preferred split method, and default roster seed source.
Game roster defaults include default team count, default players per line or tier, and default Team Context Ladder.

**Published Game Roster**: A Game Roster Draft that has been written into game Sessions as the operational roster.
_Avoid_: Locked draft, generated teams

**Game Roster Builder**: The Results workflow where coordinators create, adjust, and publish Game Roster Drafts from skills-session rankings, current team context, or manual coordinator judgment.
_Avoid_: Session setup, roster management

**Current Team Context**: An optional event registration value that records a player's known team placement within the Organization before the Tryout Event begins.
_Avoid_: Skill score, final outcome

**Team Context Ladder**: An ordered set of Current Team Context labels for a Tryout Event and Age Group.
_Avoid_: Free-text team labels, final rankings

**Submitted Evaluation**: A scorer's recorded assessment of a Tryout Participant for a Session.
_Avoid_: Editable ranking, coordinator adjustment

**Score Lock**: The point when Submitted Evaluations can no longer be changed because the Session has reached Scores In.
_Avoid_: Finalization, roster lock

**Today View**: The live tryout night dashboard. Shows active and upcoming sessions at a glance. Handles session status changes (manual override) and scorer progress (drill into session for detail). Scorer-level breakdown lives one tap into a session — Today stays scannable.

**Sessions View**: Setup and planning only. Used before tryout night to create session blocks, assign scorers, and manage the schedule. Not used during a live event.

**Auto-advance (Scores In)**: When all scorers who submitted at least one score have completed all checked-in players, the session automatically advances to Scores In. Scorers who submitted zero scores (no-shows) are excluded from the requirement. Admin can manually override at any time.

**Player Move**: Moving a player from one session to another. Available at any session status — not gated to On Ice. Primary use case: late-arriving or pre-notified player needs to move to a different time slot. Default destination: next session for the same Age Group. Cross-age-group moves are not standard but may be needed by other organizations. Scores are not carried over (moot in practice since moves happen before check-in).

## Relationships

- An **Organization** owns many **Tryout Events**
- An **Organization** owns many **Users**
- An email address may have one **Organization Membership** per **Organization**
- **Membership Creation** creates an **Organization Membership** inside exactly one **Organization**
- **Membership Activation** follows **Membership Creation**
- **Membership Recovery** applies to exactly one **Organization Membership**
- An **Organization Lookup** resolves one **Organization Login Code** to one **Organization**
- An **Organization Login Code Alias** resolves to the same **Organization** as its current **Organization Login Code**
- An **Organization Lookup** leads to one **Organization Sign-In Page**
- A **User** signs in through exactly one **Organization Login Context**
- An **Organization-Scoped Session** is valid for exactly one **Organization**
- A **Revocable Session** allows logout, password reset, or membership disablement to invalidate an **Organization-Scoped Session**
- An **Isolated Organization Cookie** carries one **Organization-Scoped Session**
- **State-Changing Request Protection** applies to authenticated Organization data changes
- A **Tryout Event** has many **Age Groups**
- A **U-level Age Group** derives its valid birth year range from `max_age` + the event's **Season Year**
- A **Birth Year Age Group** stores its valid range explicitly as `birth_year_min` / `birth_year_max`
- An **Import Preview** belongs to one **Tryout Event** and one **Age Group**
- A **Session Block** belongs to one **Tryout Event** and one **Age Group**
- A **Session Block** creates one or more **Sessions**
- A **Balanced Session Split** belongs to one **Session Block** and counts only **Tryout Participants**
- A **Planning Gap** is inferred from existing **Sessions**
- A **Game Line Tier** is derived from Results and can span multiple game teams
- A game team can contain players from multiple **Game Line Tiers**
- A **Game Roster Draft** is generated from **Game Line Tiers** and can be edited by a coordinator before game Sessions
- A **Published Game Roster** is created from one **Game Roster Draft**
- The **Game Roster Builder** belongs in Results and does not replace Sessions setup or event roster management
- Game Session scheduling and **Game Roster Draft** creation are independent until a coordinator publishes the draft into game Sessions
- A **Game Roster Draft** can be manually adjusted without changing **Submitted Evaluations**
- **Submitted Evaluations** are not changed to influence game roster tiers
- A **Score Lock** applies when a Session reaches Scores In
- A **Game Roster Draft** can be created without skills-session rankings when coordinators use **Current Team Context** or manual judgment
- A **Team Context Ladder** orders Current Team Context values for game roster seeding
- A **Game Roster Draft** has one **Roster Seed Source**
- An **Age Group** can have one **Default Roster Seed Source**
- An **Age Group** can have **Age Group Planning Defaults**
- **Age Group Planning Defaults** prefill workflows but do not remove options from other Age Groups

### Multi-Tenancy & Feature Flags

**User**: A person who signs in to one Organization to administer, coordinate, or score Tryout Events.
_Avoid_: Account

**Organization Membership**: A User record inside one Organization, with its own role and credentials for that Organization.
_Avoid_: Global identity

**Membership Creation**: The controlled creation of an Organization Membership by an admin or approved Organization workflow.
_Avoid_: Self-registration, public signup

**Membership Activation**: The first-time password setup step that lets a newly created Organization Membership become usable for sign-in.
_Avoid_: Admin-set permanent password

**Membership Recovery**: The Organization-scoped password reset flow for an existing Organization Membership.
_Avoid_: Global password reset

**Organization Login Context**: The Organization boundary selected before credentials are checked; a User authenticates inside exactly one Organization context.
_Avoid_: Tenant login, global login

**Organization-Scoped Session**: A signed-in browser session that is valid only for the Organization Login Context recorded at authentication time.
_Avoid_: Global session

**Revocable Session**: An Organization-scoped session that can be invalidated server-side before its normal expiration.
_Avoid_: Stateless-only logout

**Isolated Organization Cookie**: An auth cookie scoped to one Organization host so a browser session for one Organization is not automatically sent to another Organization.
_Avoid_: Shared tenant cookie

**State-Changing Request Protection**: A CSRF defense for authenticated requests that create, update, or delete Organization data.
_Avoid_: CORS-only protection

**Organization Login Code**: A short, stable, unique code that a User enters to find their Organization before signing in.
_Avoid_: Organization ID name, org name, tenant code

**Organization Login Code Alias**: A previous Organization Login Code that temporarily redirects to the current Organization Login Context after a controlled rename.
_Avoid_: Duplicate login code

**Organization Lookup**: The pre-login step where a User enters an Organization Login Code to find the correct Organization-branded sign-in page.
_Avoid_: Authentication, login

**Organization Sign-In Page**: The Organization-branded page where a User enters credentials after an Organization Lookup has resolved the Organization Login Context.
_Avoid_: Global login page

**Generic Credential Login**: A sign-in form that checks email and password without first resolving an Organization Login Context. This is not part of the product model.
_Avoid_: Login

**Organization Features**: A JSONB `features` column on `organizations` controls which optional capabilities are enabled per org. Default is all flags off. Flags are added here rather than as individual boolean columns to avoid migrations per feature.

Known flags (planned):
- `multi_rink` (bool, default false) — shows ice surface field on sessions; calendar renders parallel rink columns when true
- `birth_year_groups` (bool) — org uses birth year age groups instead of U-level
- `cross_age_moves` (bool) — player moves can cross age group boundaries
- `game_sessions` (bool) — enables team/line game session type (future)

**Ice Surface**: A nullable text label on sessions (e.g., "Sheet 1", "East Rink"). Only visible when `multi_rink` feature flag is enabled for the org. Single-rink orgs never see this field.

### Today View Layout

**Today View** is a self-contained live operational screen for tryout night. All session management — status changes, scorer progress, player moves, and check-in — happens within this screen. Coordinators and admins do not navigate away from Today during a live event.

**Session Detail Drawer**: Tapping a session card opens a slide-in drawer (~70% width). The drawer contains: scorer progress, player list with per-player check-in controls (quick mark late/no-show), player move action, and status advance button. The session list remains visible behind the drawer.

**Check-in on Today**: The drawer provides quick per-player check-in actions for the 90% case (marking a late arrival, flagging a no-show). The dedicated Check-In page remains for bulk operations and larger coordinator/admin workflows.

**Today View** layout rules:

- **Sessions first** — the page leads with a session list grouped by status (On Ice Now / Up Next / Done). No large header or dashboard banner above them.
- **Slim header** — event name + date + a warning badge (⚠ N) when Needs Attention items exist. Badge expands to show the warning list inline.
- **Check-in display is status-aware** — Pending and On Ice sessions show check-in count prominently (with warning color if low). Off Ice and beyond show it small or not at all.
- **No Age Groups section** — age group summary cards do not appear on Today. That's a planning/results concern.

**Sidebar** — age group sub-items are removed from under Results and Rosters. Clicking Results or Rosters lands on those views directly; age group selection happens within the view. The Age Groups nav item itself remains.

## Flagged ambiguities

- "Mites - U8" was one field doing two jobs (display name + U-level). Resolved: `name` is freeform display; `max_age` is the machine-readable U-level number.
- "Undo import" was discussed but rejected in favor of prevention at Import Preview time. There is no rollback on a committed import.
- "organization id name" was used for the value entered before login. Resolved: call this the **Organization Login Code**; the **Organization** still has a separate display name.
- Generic email/password login was discussed for the single-Organization phase. Resolved: credentials are only checked after an **Organization Login Context** is resolved.
- `organizations.subdomain` currently backs the **Organization Login Code** in the database. Resolved: keep that field for now and expose the product/API language as login code.
