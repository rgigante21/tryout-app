# Rosterline

A multi-tenant youth hockey operations platform that carries a player's history from tryout evaluation into team selection, season operations, coaching, and long-term development. Tryouts are the current product wedge, not the platform boundary.

## Language

### Organization & Events

**Hockey Operations Lifecycle**: The connected Rosterline journey: Evaluate → Build Teams → Activate Rosters → Communicate → Coordinate → Coach → Develop. Registration, payments, league scheduling, facility management, and generic club accounting remain outside this lifecycle.
_Avoid_: Generic club management, SportsEngine replacement

**Organization**: A hockey club or association that owns its own data, users, and branding. The top-level tenant unit.
_Avoid_: Club, team, customer

**Hockey Director**: The Organization leader accountable for hockey operations and Rosterline's primary customer and economic buyer. Coaches, team managers, players, and guardians are essential users but do not define the platform boundary when their needs conflict.
_Avoid_: League administrator, independent coach, generic account owner

**Player Identity**: The minimal Rosterline-wide identity of one player, allowing the same person to participate in multiple Organizations without being lost or conflated. It does not expose one Organization's hockey data to another.
_Avoid_: Organization evaluation record, global scouting profile

**Organization Player Record**: An Organization-owned, longitudinal record linked to one Player Identity that preserves the Organization's hockey decisions, participation, and development context across Tryout Events and Seasons. Another Organization cannot see it without an explicit sharing or transfer workflow.
_Avoid_: Global player profile, registration row, shared cross-organization history

**Hockey Operations System of Record**: Rosterline's role as the authoritative home for tryout decisions, team activation, coaching context, and player development history. External systems remain authoritative for registration, payments, league schedules, facilities, and accounting.
_Avoid_: All-in-one club system, registration platform, SportsEngine replacement

**Product North Star**: An Organization can turn Tryout Participants into activated teams and run the hockey-development year without losing decisions, context, or player history between tools.
_Avoid_: Feature count, generic engagement

**Hockey-First Product**: Rosterline's current product, design, and commercial priority is hockey from tryout through development. Multisport Tryout Operations is a future expansion opportunity, not a current parity requirement.
_Avoid_: Fully sport-neutral platform, multisport team operations roadmap

**Launch Market**: Rosterline's initial regulatory and commercial market is the United States. Canadian requirements are considered only when expansion becomes an active decision.
_Avoid_: Simultaneous North American launch, jurisdiction-neutral compliance

**Multisport Expansion Gate**: The point after the hockey evaluation foundation is reliable when a real second-sport design partner can validate whether Tryout Operations should become a multisport product.
_Avoid_: Speculative sport abstraction, launch requirement, multisport team operations

**Tryout Event**: A multi-day evaluation event tied to one Organization. Contains age groups, sessions, and players.
_Avoid_: Tournament, camp

**Local Tryout Event**: The first product wedge: one Organization running its own annual youth hockey tryout with volunteer coordinators and scorers. It is the entry point to the broader Hockey Operations Lifecycle, not the full product boundary.
_Avoid_: Tournament operation, private evaluation service, complete platform scope

**Season Year**: The calendar year in which a Tryout Event takes place, derived from the event's `start_date`. Used to calculate valid birth years for U-level Age Groups.

### Season Teams

**Season**: An Organization-owned hockey operating period containing the teams, rosters, staff, events, and development work for one playing year.
_Avoid_: Tryout Event, calendar year

**Team Selection**: The finalized historical outcome of a Tryout Event that records the Organization's intended player placements. It seeds team activation but is not rewritten when later roster circumstances change.
_Avoid_: Live roster, game roster, mutable ranking

**Activated Team**: A season-specific operating group created from an approved Team Selection and belonging to exactly one Organization and one Season.
_Avoid_: Game team, multi-year team, tryout roster draft

**Team Lineage**: The connection among distinct Activated Teams that represent the same continuing hockey cohort or program across successive Seasons.
_Avoid_: Multi-season Team, permanent roster

**Roster Offer**: A proposed place for one player on an Activated Team, derived from Team Selection or a later roster decision and tracked as accepted, declined, or withdrawn before it becomes a Season Roster membership.
_Avoid_: Automatic notification, active roster membership, registration payment

**Season Roster**: The current set of players affiliated with one Activated Team. It begins from the Team Selection but may change before or during the Season without altering that historical selection.
_Avoid_: Team Selection, Published Game Roster, permanent player placement

**Roster Change**: A player addition, removal, or movement between Activated Teams that changes a Season Roster without rewriting the originating Team Selection.
_Avoid_: Evaluation adjustment, selection rewrite

**Guardian**: An adult authorized to receive family-facing team access and act on behalf of a minor player.
_Avoid_: Player account, coach, generic contact

**Team Communication**: Activated Team communication that begins with announcements, acknowledgements, availability, and event-specific discussion and ultimately includes team chat for staff and families.
_Avoid_: Organization-wide marketing, generic social network

**Communication Foundation**: The shared contact, preference, invitation, audience, delivery, acknowledgement, and outbound-message capabilities used by Team Release and later communication channels.
_Avoid_: Team chat feature, email-only integration, marketing automation

**Pre-Release Team Workspace**: The private Activated Team workspace where directors and coaches can prepare rosters, staff, schedules, and plans before families are notified.
_Avoid_: Public team page, family announcement

**Team Release**: The Hockey Director's explicit publication of all Activated Teams in one selection cohort, making their family-facing information and invitations available together.
_Avoid_: Team creation, automatic notification, coach draft

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

**Tryout Observer**: An evaluator or tryout-assigned coach who records qualitative observations about Tryout Participants. A Tryout Observer may have note-taking permission without scoring permission.
_Avoid_: Season coach, anonymous note author

**Tryout Observation**: An authored qualitative note tied to one Tryout Participant and Tryout Event that may inform Team Selection and post-tryout feedback.
_Avoid_: Submitted Evaluation, Season Coach Note, anonymous comment

**Season Coach Note**: An authored note about a player within an Activated Team and Season, used for ongoing coaching and development rather than tryout scoring.
_Avoid_: Tryout Observation, evaluation score, permanent global note

**Player Feedback**: A curated, shareable summary created from selected evaluation evidence or Tryout Observations for a player after tryouts.
_Avoid_: Raw evaluator notes, automatic note publication, score export

**Development Focus**: An explicitly promoted area for a player to work on that can carry from tryout feedback into the Season while retaining its source context.
_Avoid_: Raw Tryout Observation, permanent label, hidden ranking

**Evaluation Draft**: An evaluator's durable, editable work for one Tryout Participant and Session before explicit submission. It does not count toward evaluation completion.
_Avoid_: Browser-only draft, Submitted Evaluation, completed score

**Evaluation Submission**: The evaluator's explicit lock of an Evaluation Draft as their completed assessment. Later corrections are exceptional and retain an audit trail.
_Avoid_: Autosave, any score row, silent overwrite

**Evaluation Completion Gate**: The rule that a Session is not evaluation-complete until every required evaluator has an acknowledged Evaluation Submission for every required Tryout Participant.
_Avoid_: Local save, unacknowledged sync, activity from some evaluators

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

**Needs Attention**: A Today View warning about a live-event operational risk that could disrupt check-in, scoring, session progress, or score completion.
_Avoid_: Setup warning, admin reminder

**Progress Warning**: A simple Needs Attention condition that flags missing scorer activity or incomplete evaluations without time-based stall detection.
_Avoid_: Stall detection, evaluator analytics

**Tryout Night Demo Promise**: A hockey Organization can run a Local Tryout Event from one live Today View, from check-in through scoring progress to rankings-ready results.
_Avoid_: General admin dashboard, spreadsheet replacement

**Pilot Demo**: The first roadmap milestone: one Local Tryout Event shown end-to-end with credible setup, live operations, scoring, rankings, and export.
_Avoid_: SaaS launch, generic platform demo

**Field Pilot**: A real Tryout Event where an Organization uses Rosterline as a secondary grading system alongside its existing evaluation process. A Field Pilot validates operational trust without yet making Rosterline the sole Hockey Operations System of Record.
_Avoid_: Pilot Demo, production launch, primary grading system

**Seeded Demo Event**: A realistic but fictional Local Tryout Event used to demonstrate Rosterline without exposing real minors' data.
_Avoid_: Real pilot data, empty sample data

**Hero Age Group**: The primary Age Group used in a Seeded Demo Event walkthrough, with enough players, sessions, scorers, check-in states, scores, and results to prove operational confidence.
_Avoid_: Sample division, demo bracket

**Live Operations Workflow**: The first-class Pilot Demo workflow covering Today View coordination and scorer phone evaluation during the live Local Tryout Event.
_Avoid_: Admin setup, spreadsheet workflow

**Admin Setup Story**: The Pilot Demo walkthrough segment that shows how an Organization configures the Local Tryout Event before tryout night without becoming the headline live workflow.
_Avoid_: Live dashboard, platform administration

**Admin Demo Options**: The setup options shown in the Pilot Demo that prove Rosterline can fit an Organization's tryout process: branding, event setup, age groups, imports, session blocks, scorer assignments, check-in readiness, and export filters.
_Avoid_: Feature flag management, security internals, exhaustive settings

**Check-in Gate**: The rule that only checked-in or late-arriving Tryout Participants can be scored in the Player Grid.
_Avoid_: Attendance note, optional check-in

**Attendance Correction**: A coordinator or admin change to a Tryout Participant's attendance state that makes the Check-in Gate reflect what is happening at the rink.
_Avoid_: Scoring override, bypass

**Sessions View**: Setup and planning only. Used before tryout night to create session blocks, assign scorers, and manage the schedule. Not used during a live event.

**Auto-advance (Scores In)**: When all scorers who submitted at least one score have completed all checked-in players, the session automatically advances to Scores In. Scorers who submitted zero scores (no-shows) are excluded from the requirement. Admin can manually override at any time.

**Player Move**: A break-glass live-event action that moves a Tryout Participant from one Session to another when the assigned time slot no longer works. Default destination: next Session for the same Age Group. Cross-age-group moves are not standard but may be needed by other organizations. Scores are not carried over.
_Avoid_: Primary scheduling workflow, session reassignment flow

### Delivery & Environments

**Cloud Development Environment**: The shared, non-production Rosterline environment used for continued engineering by the owner and authorized AI agents. It contains synthetic data only and may be stopped or recreated when not in use.
_Avoid_: Staging, Field Pilot, production

**Synthetic Development Data**: Fictional player, family, Organization, and evaluation data that cannot be linked to a real person. It is the only data permitted in development and CI.
_Avoid_: De-identified production data, copied pilot data, test customer data

**Pilot Readiness Gate**: The explicit security, privacy, reliability, recovery, and operational threshold Rosterline must pass before a Field Pilot or any use of real youth data.
_Avoid_: Successful deployment, feature-complete milestone, Production Environment

**Production Environment**: The isolated Rosterline environment authorized to hold real Organization and youth data after the Pilot Readiness Gate is satisfied.
_Avoid_: Cloud Development Environment, Field Pilot

## Relationships

- An **Organization** owns many **Tryout Events**
- An **Organization** owns many **Organization Memberships** and **Organization Player Records**
- A **Player Identity** can be linked to private **Organization Player Records** in multiple **Organizations**
- An **Account** can have memberships in multiple **Organizations** and Guardian Relationships to multiple Player Identities
- A **Local Tryout Event** is the primary commercial wedge for Rosterline
- An email address may have one **Organization Membership** per **Organization**
- **Membership Creation** creates an **Organization Membership** inside exactly one **Organization**
- **Membership Activation** follows **Membership Creation**
- **Account Recovery** applies to exactly one **Account**
- An **Organization Lookup** resolves one **Organization Login Code** to one **Organization**
- An **Organization Login Code Alias** resolves to the same **Organization** as its current **Organization Login Code**
- An **Organization Lookup** leads to one **Organization Sign-In Page**
- An **Account** accesses an **Organization** through an **Organization Membership**
- **Manual Organization Provisioning** creates the first **Organization Login Context** for an early pilot
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
- The **Tryout Night Demo Promise** is fulfilled primarily through the **Today View**, with setup and export workflows supporting it before and after the live event
- The **Pilot Demo** comes before SaaS commercialization work such as billing, public signup, custom domains, and advanced provisioning
- A **Pilot Demo** uses one **Seeded Demo Event** before real pilot data is imported
- A **Seeded Demo Event** can include multiple Age Groups, but the walkthrough centers on one **Hero Age Group**
- The **Live Operations Workflow** is polished before import/export, billing, public signup, custom domains, and advanced analytics
- The **Admin Setup Story** supports the **Pilot Demo** before the **Live Operations Workflow** begins
- **Admin Demo Options** are shown to prove fit for a hockey Organization, not to expose every platform setting
- The **Check-in Gate** controls scorer access to a Tryout Participant during a Session
- An **Attendance Correction** is the only live-event override for the **Check-in Gate**; scorers do not bypass attendance
- A **Player Move** is a break-glass action, not a headline **Live Operations Workflow** feature

### Multi-Tenancy & Feature Flags

**Account**: A Rosterline-wide sign-in identity anchored to a verified email address. One Account can hold roles in multiple Organizations and Guardian Relationships to multiple Player Identities.
_Avoid_: Organization Membership, Player Identity, tenant-specific credential

**Organization Membership**: The roles and permissions one Account holds inside one Organization.
_Avoid_: Account, global role, separate login

**Guardian Relationship**: An authorized link between one Account and one Player Identity that grants family-facing access for that player.
_Avoid_: Organization Membership, shared password, player login

**Federated Sign-In**: Authentication where Google or Microsoft verifies an Account holder through OpenID Connect while Rosterline retains responsibility for its own Account, access, and session records.
_Avoid_: Organization password, email-only identity matching

**Magic-Link Sign-In**: A passwordless fallback where control of a verified email address authenticates an Account through a short-lived, single-use link or code.
_Avoid_: Permanent password, reusable invitation link

**Managed Identity Service**: The external service responsible for federated sign-in, magic links, account linking, recovery, and future authentication methods. Rosterline still owns Accounts, authorization relationships, sessions, and audit history.
_Avoid_: Rosterline password store, outsourced product authorization

**Global Sign-In**: The Rosterline entry flow that authenticates one Account before selecting an Organization or Team workspace. Invitation links may preserve workspace context, but the workspace never grants access without a valid Organization Membership or Guardian Relationship.
_Avoid_: Organization Login Code as security boundary, globally shared tenant data

**Access Invitation**: An Organization-authorized invitation that a verified Account claims to receive an Organization Membership or Guardian Relationship. Creating an Account alone grants no Organization or Player access.
_Avoid_: Open membership, self-attached guardian, automatic authorization

**Membership Creation**: The controlled creation of an Organization Membership by an admin or approved Organization workflow.
_Avoid_: Self-registration, public signup

**Membership Activation**: The step where a verified Account accepts or claims a newly created Organization Membership.
_Avoid_: Separate Organization password, admin-set permanent password

**Account Recovery**: The global recovery flow that restores access to one Account without changing its Organization Memberships or Guardian Relationships.
_Avoid_: Organization-scoped password reset, membership recovery

**Manual Organization Provisioning**: The early-pilot process where Rosterline staff create an Organization and its first admin before the Organization signs in.
_Avoid_: Public signup, self-service onboarding

**Organization Login Context**: The Organization boundary selected before credentials are checked; an Account authenticates inside exactly one Organization context.
_Avoid_: Tenant login, global login

**Organization-Scoped Session**: A signed-in browser session that is valid only for the Organization Login Context recorded at authentication time.
_Avoid_: Global session

**Revocable Session**: An Organization-scoped session that can be invalidated server-side before its normal expiration.
_Avoid_: Stateless-only logout

**Isolated Organization Cookie**: An auth cookie scoped to one Organization host so a browser session for one Organization is not automatically sent to another Organization.
_Avoid_: Shared tenant cookie

**State-Changing Request Protection**: A CSRF defense for authenticated requests that create, update, or delete Organization data.
_Avoid_: CORS-only protection

**Organization Login Code**: A short, stable, unique code that an Account holder enters to find their Organization before signing in.
_Avoid_: Organization ID name, org name, tenant code

**Organization Login Code Alias**: A previous Organization Login Code that temporarily redirects to the current Organization Login Context after a controlled rename.
_Avoid_: Duplicate login code

**Organization Lookup**: The pre-login step where an Account holder enters an Organization Login Code to find the correct Organization-branded sign-in page.
_Avoid_: Authentication, login

**Organization Sign-In Page**: The Organization-branded page where an Account holder enters credentials after an Organization Lookup has resolved the Organization Login Context.
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
- **Live operations only** — full roster editing, rankings tables, import/export, session block planning, scorer score history, and Organization settings stay one click away from Today.
- **Needs Attention is live-only** — Today warnings cover operational risks such as low check-in, missing scorers, stalled scorer progress, and incomplete evaluations; setup/admin reminders stay outside Today.
- **Simple progress warnings first** — the Pilot Demo uses zero-submission and incomplete-evaluation warnings before introducing time-based stall detection.

**Sidebar** — age group sub-items are removed from under Results and Rosters. Clicking Results or Rosters lands on those views directly; age group selection happens within the view. The Age Groups nav item itself remains.

## Flagged ambiguities

- "Mites - U8" was one field doing two jobs (display name + U-level). Resolved: `name` is freeform display; `max_age` is the machine-readable U-level number.
- "Undo import" was discussed but rejected in favor of prevention at Import Preview time. There is no rollback on a committed import.
- "organization id name" was used for the value entered before login. Resolved: call this the **Organization Login Code**; the **Organization** still has a separate display name.
- Generic email/password login was discussed for the single-Organization phase. Resolved: credentials are only checked after an **Organization Login Context** is resolved.
- `organizations.subdomain` currently backs the **Organization Login Code** in the database. Resolved: keep that field for now and expose the product/API language as login code.
