# Issue tracker: GitHub

Issues and planning artifacts for this repo live as GitHub issues. Use the `gh` CLI for issue operations and infer the repository from `git remote -v`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list` with the appropriate state, label, assignee, and JSON filters
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- **Claim an issue**: `gh issue edit <number> --add-assignee "@me"`
- **Close an issue**: `gh issue close <number> --comment "..."`

When a skill says to publish something to the issue tracker, create a GitHub issue. When a skill says to fetch a ticket, read the issue and its comments.

## Wayfinding operations

- A Wayfinder map is one GitHub issue labelled `wayfinder:map`.
- Every decision ticket is a native child issue of its map and carries exactly one type label: `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- Create map and ticket issues first, then use GitHub's native sub-issue API through `gh api graphql` to attach each ticket to the map.
- Wire ticket prerequisites with GitHub's native blocked-by relationship through `gh api graphql`; do not emulate dependencies with task-list text when the native relationship is available.
- An open, unassigned ticket is unclaimed. Assign a ticket to the current developer before working it.
- The frontier is the map's open, unassigned child tickets for which every blocking ticket is closed. Determine it from native sub-issue and dependency data.
- Record a ticket's answer in its closing comment. The map's `Decisions so far` section contains only a one-line gist and a named link back to that closed ticket.
- Refer to maps and tickets by their linked titles in human-facing text, never by bare issue numbers.
