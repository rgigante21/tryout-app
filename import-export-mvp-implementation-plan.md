# Import/Export MVP Implementation Plan

## Overview

This implementation plan is for the hockey tryout app, with **SportsEngine treated as the system of record** for registration, teams, and schedule. The tryout app should focus on the operational workflow around tryouts:

- importing player and evaluator data
- organizing tryout events and sessions
- capturing evaluations
- generating team recommendations
- exporting SportsEngine-friendly outputs

The goal is to build a **lean, safe, event-scoped import/export system** that works well for a youth organization side project without overengineering.

---

## Product Boundary

### SportsEngine owns
- registration
- official teams
- schedule
- parent-facing system of record

### Tryout app owns
- tryout events
- sessions
- player check-in
- evaluator scoring
- ranking and notes
- team recommendation workflow
- exports for downstream roster handling

### MVP operating model
- SportsEngine data comes in through manual import
- final results go out through manual export
- no direct SportsEngine API integration in MVP
- imports and exports are scoped to a specific tryout event

---

## Phase 0: Lock the product boundary

### Goal
Make sure the app stays focused before building features.

### Decisions to finalize
- SportsEngine remains the upstream and downstream system
- the tryout app does not become a registration system
- import/export lives inside the event workflow
- MVP supports **manual CSV/XLSX exchange**
- only a few known import and export types are supported

### Deliverables
- short product note describing system responsibilities
- list of supported import types
- list of supported export types
- decision that all import/export actions are event-scoped

### Success criteria
Everyone working on the app understands this product message:

> Import registrations in. Run tryouts. Export placements out.

---

## Phase 1: Define the internal data contract

### Goal
Create a stable internal model that imports map into and exports read from.

### Core entities

#### Event
Represents the overall tryout event for the organization.

Suggested fields:
- `id`
- `org_id`
- `name`
- `season`
- `sport`
- `status`

#### Session
Represents a session within an event, usually tied to an age group or level.

Suggested fields:
- `id`
- `event_id`
- `name`
- `age_group`
- `level`
- `date_time`
- `location`

#### Player
Represents the base player identity across events.

Suggested fields:
- `id`
- `org_id`
- `external_player_id` nullable
- `first_name`
- `last_name`
- `birth_year` or `dob`
- `age_group`
- `parent_email` nullable
- `jersey_number` nullable
- `current_team` nullable
- `registration_status` nullable

#### EventPlayer
Represents the player in the context of a specific tryout event.

Suggested fields:
- `id`
- `event_id`
- `player_id`
- `check_in_status`
- `bib_number` nullable
- `imported_batch_id` nullable
- `recommendation_status` nullable
- `recommended_team` nullable
- `admin_notes` nullable

#### Evaluator
Represents coaches/evaluators participating in the tryout process.

Suggested fields:
- `id`
- `org_id`
- `first_name`
- `last_name`
- `email`
- `role`

#### Evaluation or Score
Represents scoring by an evaluator for a player in a session.

Suggested fields:
- `id`
- `event_player_id`
- `session_id`
- `evaluator_id`
- metric-based scores
- comments
- `total_score` nullable

### Import support entities

#### ImportBatch
Tracks one upload/import attempt.

Suggested fields:
- `id`
- `org_id`
- `event_id`
- `import_type`
- `source_filename`
- `status`
- `created_by`
- `total_rows`
- `valid_rows`
- `invalid_rows`
- `created_at`

#### ImportRowResult
Tracks row-level validation results for preview and audit.

Suggested fields:
- `id`
- `import_batch_id`
- `row_number`
- `raw_data_json`
- `normalized_data_json`
- `status`
- `action`
- `errors_json`

### Deliverables
- schema review
- migration plan
- ERD or simple relationship diagram
- agreement on canonical field names

### Success criteria
The app has a reliable structure for:
- importing data safely
- associating data to a specific event
- generating exports from normalized internal records

---

## Phase 2: Build the import foundation

### Goal
Create one reusable import pipeline instead of one-off logic.

### Supported file types
- CSV
- XLSX

### Supported MVP import types
- Players
- Evaluators

Session assignment import can come later after the basics are stable.

### Core backend layers

#### Parser layer
Responsibilities:
- read CSV files
- read XLSX files
- convert both into a shared row array format

#### Normalization layer
Responsibilities:
- trim whitespace
- normalize header names
- convert blank values to `null`
- normalize field casing where appropriate
- standardize booleans and dates if needed

#### Template registry
Responsibilities:
- define required headers per import type
- define optional headers per import type
- define allowed canonical field mappings
- keep supported templates explicit and predictable

#### Validation layer
Responsibilities:
- validate required fields
- validate types and enums
- validate business rules
- produce row-level results with errors and warnings

### Important product rule
Do **not** build a universal spreadsheet mapper yet.

Instead:
- provide downloadable templates
- require known headers
- keep imports strict and predictable

### Deliverables
- shared import service structure
- CSV parser
- XLSX parser
- normalization utility
- template registry for import types
- validation result shape

### Success criteria
An uploaded file can be parsed, normalized, and validated into a previewable result set before any records are committed.

---

## Phase 3: Build Players import end to end

### Goal
Deliver the highest-value workflow first.

### Supported use case
Admin imports registered players from SportsEngine-derived data into a tryout event.

### Players import fields

#### Required
- `first_name`
- `last_name`
- `age_group` or `birth_year`

#### Optional
- `external_player_id`
- `parent_email`
- `jersey_number`
- `current_team`
- `registration_status`
- `notes`

### Validation rules
- file type must be CSV or XLSX
- required headers must exist
- required row fields must not be blank
- duplicate rows inside the file must be flagged
- duplicate external IDs must be flagged
- age group must be valid for the org or event
- updates must remain within the same org
- no weak merges by name alone

### Matching priority
Use a conservative matching strategy:
1. `external_player_id`
2. exact email match if trusted and unique
3. exact first name + last name + DOB or birth year

Never auto-merge using only a loose name match.

### Commit behavior
When the user commits valid rows:
- create a `Player` if no trusted match exists
- update the `Player` if a trusted match exists
- create or link an `EventPlayer` for the event
- attach the import batch ID for traceability

### API endpoints
Suggested endpoints:
- `POST /api/events/:eventId/imports`
- `GET /api/imports/:importId/preview`
- `POST /api/imports/:importId/commit`

### Frontend flow
Inside the event:
- Imports & Exports tab
- choose **Import Players**
- upload file
- view validation preview
- commit valid rows

### Preview design
Show:
- total rows
- valid rows
- warning rows
- invalid rows

Each row should have a status:
- valid
- warning
- invalid

Warnings might include:
- existing player will be updated
- optional fields missing
- possible duplicate detected

### Deliverables
- players template file
- players import parser/validator
- preview screen
- commit flow
- results summary

### Success criteria
An admin can take player registration data, preview exactly what will happen, and safely import players into a tryout event.

---

## Phase 4: Build Evaluators import

### Goal
Allow admins to load evaluators quickly without manual entry.

### Supported fields

#### Required
- `first_name`
- `last_name`
- `email`

#### Optional
- `role`
- `assigned_age_group`

### Validation rules
- email must be valid
- duplicate emails in the file must be flagged
- role must be within allowed values
- import must not allow privilege escalation

### Commit behavior
- create evaluator if new
- update evaluator if a trusted match exists
- optionally associate evaluator to the event if your model supports it

### Frontend flow
Reuse the same upload → preview → commit pattern as Players import.

### Deliverables
- evaluator template file
- evaluator import service
- evaluator preview/commit UI

### Success criteria
An admin can bulk load evaluators for a tryout with minimal effort.

---

## Phase 5: Build export foundation

### Goal
Create clean exports from tryout decisions, including SportsEngine-friendly output.

### MVP export types

#### Team Recommendations export
Purpose:
- give admins a clean output of final tryout results

Suggested fields:
- `external_player_id`
- `first_name`
- `last_name`
- `age_group`
- `tryout_score_summary`
- `recommended_team`
- `alternate_team`
- `recommendation_status`
- `admin_notes`

#### SportsEngine-friendly export
Purpose:
- provide a structured output that reduces manual roster handling downstream

Suggested fields:
- `external_player_id`
- `first_name`
- `last_name`
- `birth_year`
- `age_group`
- `recommended_team`
- `jersey_number` optional
- `notes` optional

### Backend endpoints
Suggested endpoints:
- `GET /api/events/:eventId/exports/team-recommendations.csv`
- `GET /api/events/:eventId/exports/sportsengine-basic.csv`

### Export filters
Support simple filters:
- by age group
- finalized only
- by recommended team

### Frontend flow
Inside the event:
- Imports & Exports tab
- choose export type
- select optional filters
- download CSV

### Deliverables
- CSV export generator
- team recommendations export
- SportsEngine-friendly export
- export UI with filters

### Success criteria
Admins can move roster decisions from the tryout app into SportsEngine-related workflows without retyping everything manually.

---

## Phase 6: Add session assignment import

### Goal
Reduce admin work when placing players into tryout sessions.

### Supported fields
- `player_external_id` or another strong player identifier
- `session_name` or `session_id`
- `age_group` optional if helpful for validation

### Validation rules
- player must already exist in the org or event
- session must exist in the selected event
- session age group must match the player age group
- duplicate assignment rows must be blocked

### Commit behavior
- create player-to-session assignment records
- prevent duplicate assignments

### Why this comes later
This depends on:
- stable player import
- stable event/session model
- clear event-level workflow

### Deliverables
- session assignment template
- validation rules
- preview + commit flow

### Success criteria
Admins can bulk assign players to sessions with confidence.

---

## Phase 7: Add admin polish and operational trust

### Goal
Improve usability and build trust in the workflow.

### Features to add

#### Import history
Event-level table showing:
- import date
- import type
- filename
- created by
- row counts
- status

#### Better preview UX
- downloadable invalid rows CSV
- grouped validation errors
- summary of creates vs updates vs skips

#### Export polish
- preview row count before download
- persist last-used filters per event if useful

### Deliverables
- import history table
- downloadable error report
- clearer result summaries

### Success criteria
Admins can troubleshoot bad imports themselves and understand what the system did.

---

## Phase 8: Add light hardening

### Goal
Get the benefits of security and resilience without building an enterprise ingestion platform.

### Add now
- max file size limits
- MIME and extension checking
- server-side org scoping
- simple audit trail for imports and exports
- transactional commit behavior
- double-submit protection on commit

### Nice later
- formula-content sanitization or stricter spreadsheet value handling
- background processing for large imports
- deeper rollback tooling
- richer audit events
- universal field mapping

### Not necessary yet
- malware scanning for trusted admin-only uploads
- async processing unless imports become large
- heavy staging architecture beyond batch and row results

### Deliverables
- safer commit path
- retry protection
- basic auditing

### Success criteria
The workflow is safe enough for trusted admin use and resilient to common mistakes.

---

## Suggested build order

### Sprint 1
- finalize data model
- add `ImportBatch` and `ImportRowResult`
- build parser and validator foundation
- create Players import template
- complete Players import preview + commit

### Sprint 2
- build Evaluators import
- build Team Recommendations export
- build SportsEngine-friendly export

### Sprint 3
- add import history
- add error CSV download
- add export filters
- improve update/create summaries

### Sprint 4
- add Session Assignment import
- harden matching rules
- add commit safety and basic audit improvements

---

## Frontend structure recommendation

Suggested event-scoped UI components:
- `EventImportExportPage`
- `ImportTypeSelector`
- `ImportUploadPanel`
- `ImportPreviewTable`
- `ImportSummaryCards`
- `ImportResultsPanel`
- `ExportPanel`
- `ImportHistoryTable`

### UX recommendation
Place this under the Event page as an **Imports & Exports** tab rather than as a global admin page.

That keeps the workflow aligned with how admins actually think:
- create event
- load players
- run sessions
- score players
- export placements

---

## Backend structure recommendation

Suggested services:
- `ImportService`
- `ImportTemplateRegistry`
- `PlayerImportService`
- `EvaluatorImportService`
- `SessionAssignmentImportService`
- `ExportService`
- `SportsEngineExportProfile`
- `PlayerMatchingService`

### Why this structure works
It keeps your code organized around reusable behaviors:
- file parsing
- normalization
- validation
- commit logic
- export formatting

without forcing you into a large enterprise architecture.

---

## Guardrails to avoid overbuilding

### Build now if it:
- reduces admin manual work immediately
- prevents bad imports
- supports SportsEngine handoff
- can be reused across events

### Delay if it:
- depends on fuzzy automation
- supports rare edge cases
- tries to replace SportsEngine
- requires arbitrary spreadsheet mapping
- adds a lot of architecture without clear day-one value

---

## MVP definition of done

Import/export MVP is complete when:

- admin can import players into an event from CSV or XLSX
- admin can import evaluators
- admin gets a preview and validation step before save
- app blocks obvious duplicate or invalid imports
- admin can export team recommendations
- admin can export a SportsEngine-friendly CSV
- all import/export actions are tied to an event
- basic import history exists

---

## Final product outcome

At the end of this plan, the tryout app should do one thing very well:

> Bring SportsEngine registration data into a clean tryout workflow, then export structured placement results back out.

That keeps the app focused, useful, and realistic for a youth hockey organization side project.
