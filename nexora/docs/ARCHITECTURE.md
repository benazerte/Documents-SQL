# Architecture

NEXORA is a modular monolith. The application uses one Next.js server and one SQLite database. This keeps local setup free of external services and leaves ordinary feature work in one codebase.

## Boundaries

- `src/app`: application entry points, layouts, and authenticated HTTP adapters.
- `src/components`: the responsive shell, conventional operational views, organization modules, and visual workspace.
- `src/lib/types.ts`: shared serialized domain contracts and the central product name.
- `src/server/auth.ts`: Better Auth configuration and session handling.
- `src/server/db.ts`: database initialization, migrations, foreign-key configuration, and connection lifecycle.
- `src/server/core.ts`: authorized workspace operations, core records, activity, and snapshots.
- `src/server/domain.ts`: testable dependency, progress, and health rules.
- `src/server/extended.ts`: clients, documents, timers, invoices, payments, and expenses.
- `tests`: domain, SQLite integration, and browser workflow checks.

Database access remains on the server. Views call validated commands and refresh the authorized workspace snapshot after mutations. The visual workspace consumes that same snapshot; it has no independent graph-only business database.

## Relational model

A user has sessions and workspace memberships. A membership grants one role in one workspace. Projects, tasks, clients, documents, time entries, invoices, expenses, comments, graph positions, and activity are workspace scoped.

Projects contain tasks and may reference clients. Tasks may reference assignees, parent tasks, and prerequisite tasks. Dependency creation checks self-reference and cycles on the server. Records referenced by another record must belong to the authorized workspace. Foreign keys provide deletion safeguards; server operations add the cross-workspace checks that single-column foreign keys cannot express alone.

Invoices reference clients and optionally projects. Invoice lines and payment records are persisted with their invoice. Monetary inputs and totals use integer minor units with explicit currency and bounded tax rates. Issued invoice totals and numbering must remain stable.

Graph positions are separate from business entities. Moving a node does not change project membership or create a relationship. Edges derive from persisted project containment, task dependencies, and implemented entity associations.

## Request flow

1. The client sends a request using its HTTP-only session cookie.
2. Better Auth verifies the current session.
3. The workspace adapter verifies membership and the required role.
4. The operation validates input and every referenced workspace record.
5. Related writes run in a database transaction and record activity.
6. The client refreshes the current snapshot and reuses the resulting state across views.

The main API uses `GET /api/workspaces`, `POST /api/workspaces`, `GET /api/workspaces/:id`, and `POST /api/workspaces/:id/commands`. Authentication lives under `/api/auth`.

## Deliberate choices

- **SQLite and explicit prepared SQL:** a small typed repository layer avoids an ORM runtime and makes authorization boundaries, migrations, and transactions visible. It trades some schema-derived typing for straightforward SQLite behavior. Runtime inputs are validated separately.
- **Maintained authentication library:** Better Auth handles credential hashing and cookie sessions; NEXORA still owns workspace authorization and deployment configuration.
- **React Flow:** the graph foundation provides navigation, selection, and accessibility behavior while custom nodes carry actual operational records.
- **Markdown documents:** documents start with explicit saves and safe Markdown rendering rather than a custom collaborative editor. Full rich-text autosave and collaborative editing are future work unless the implementation record states otherwise.
- **No external tracker or model API:** the application works without paid providers and does not send operational data to analytics services by default.

## Time and calculations

Date-only deadlines are stored as date-only values. Timestamped events use ISO timestamps. Browser display follows the user's locale. Running timers store their start timestamp on the server so reloads do not invent a new session. Stopping a timer persists its ending timestamp and duration.

Progress and health calculations are centralized in `src/server/domain.ts` and reused by the operational views:

- Progress is the rounded percentage of tasks with status `done`; tasks have equal weight. No tasks yields zero percent.
- Health is `complete` for a completed project or a nonempty project whose tasks are all done.
- Otherwise it is `at_risk` when an unfinished task or the project is overdue.
- Otherwise it is `attention` when a task is explicitly blocked, or the project is due within seven days with progress below 80 percent.
- Otherwise it is `on_track`.

Milestone-based health is not included because milestone management remains planned. Dashboard counts and visualizations aggregate persisted records. An empty database yields empty views or zero counts, not invented activity.

## Scaling boundaries

The initial snapshot API favors coherent small-team workspaces. It does not claim benchmarked support for very large datasets. Large deployments will need paginated queries, more selective graph retrieval, background work, and performance measurements. SQLite WAL supports a practical single-node deployment; it is not a multi-region persistence solution.

For PostgreSQL, retain workspace-scoped operation contracts, replace SQLite connection and migration handling, port SQL-specific expressions and transaction behavior, and rerun authorization and concurrency tests. Authentication storage must migrate consistently with application data.

## Toolchain compatibility

The application pins Node 24, Next.js 16.4.4, React 19.3.1, and pnpm 11.25.0. ESLint remains on the supported 9.x line because the current framework lint plugin peer ranges do not yet support ESLint 10. Upgrade those dependencies together and rerun lint, type checks, production build, and browser tests.
