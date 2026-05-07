# Pilot Readiness Follow-Ups

These items were intentionally deferred from the low-risk pilot hardening pass because they change the auth/session model or require broader database cleanup.

## Security Model

- Add CSRF protection for cookie-authenticated mutating requests, either with explicit CSRF tokens or a carefully tested cookie policy change.
- Add JWT revocation with a `jti` claim, revocation storage, logout invalidation, and middleware checks.
- Remove the remaining unauthenticated login-failure audit fallback to organization `1` once login requires a trusted organization context such as subdomain.

## Data Model

- Complete the registration-centered cleanup separately: make `registration_id` the canonical roster and score identity, replace player-based uniqueness constraints, and remove legacy event-scoped player columns.
