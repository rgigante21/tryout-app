# Domain Docs

This is a single-context repository. The frontend, backend, and database all implement the same Rosterline hockey-operations domain.

## Before exploring

- Read the root `CONTEXT.md` glossary and use its canonical terms.
- Read relevant system-wide decisions under `docs/adr/` when that directory exists.
- If either resource does not exist, proceed silently; producer skills create domain documentation lazily as decisions are resolved.

## Vocabulary

Use terms as defined in `CONTEXT.md` in issue titles, plans, hypotheses, test names, and implementation descriptions. Avoid synonyms that the glossary explicitly rejects.

If a required concept is absent or ambiguous, treat that as a domain-modeling question rather than silently inventing competing terminology.

## Architectural decisions

Surface conflicts with an existing ADR explicitly. Do not silently override an established decision.
