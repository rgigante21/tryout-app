# Per-org feature flags stored as JSONB on organizations

Feature toggles that vary by organization (e.g., multi-rink support, game session types) are stored in a `features` JSONB column on the `organizations` table rather than as individual boolean columns. New flags are added to the JSON object without requiring schema migrations. The tradeoff is weaker DB-level constraints on flag names, accepted in favor of flexibility as the flag set grows.
