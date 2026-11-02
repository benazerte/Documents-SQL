# NEXORA implementation status

This is the authoritative checkpoint for the supplied [master product directive](PRODUCT_DIRECTIVE.md). The first runnable release is implemented and verified; the full master directive remains in progress. No public deployment or commercial certification is claimed.

## Implemented

| Area                   | Working scope                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity               | Better Auth registration, sign-in/out, secure cookie sessions, password change, operator recovery, session invalidation, throttling and origin enforcement                                                                                                                                                                                        |
| Workspaces             | Clean or explicitly labeled sample workspaces, switching, owner/admin/member/viewer permissions, adding existing registered accounts, member role changes                                                                                                                                                                                         |
| Projects               | Create/edit, ownership, client links, dates, priority, archive/restore, safeguarded deletion, progress and task detail                                                                                                                                                                                                                            |
| Tasks                  | Create/edit/delete, assignment, parent tasks, dates/estimates, list and Kanban status changes, keyboard status alternatives, comments, validated prerequisites                                                                                                                                                                                    |
| Integrity              | Server-side workspace scoping, referenced-record validation, transactions, explicit initial SQLite migration, foreign keys, combined dependency/subtask cycle checks, completion/reopening safeguards                                                                                                                                             |
| Visual workspace       | Real project/task/client/document/invoice nodes, persisted relationship edges, directional prerequisites and subtasks, pan/zoom/minimap, selection/inspector, status editing, keyboard relationship editor, filters, focused neighbors, collapsed project children, compact automatic layout, saved manual positions, accessible list alternative |
| Overview and analytics | Counts, completion distribution, project health, actionable deadlines, real activity, project/time filters, CSV reports, scoped command-palette search and navigation                                                                                                                                                                             |
| Planning               | Task and project dates in month/week/agenda calendar views; milestones and standalone events are not yet implemented                                                                                                                                                                                                                              |
| Clients                | Contact/organization information, lead/active/archive statuses, editing, project associations, client inspectors; no deals pipeline yet                                                                                                                                                                                                           |
| Documents              | Project-linked Markdown documents, title/content editing, safe preview with raw HTML disabled, explicit save state, navigation/unload guards, archive/restore/delete                                                                                                                                                                              |
| Time                   | Persistent single active timer per user, stop, manual intervals, project/task links, history, delete, exact timestamps and whole-minute summaries; overlapping/future intervals rejected                                                                                                                                                          |
| Finance                | Draft invoice line items, integer minor-unit arithmetic, basis-point tax rounding, currencies EUR/USD/GBP, stable sequential numbering, immutable issued totals and client snapshot, partial/full payments, voiding unpaid invoices, expenses, CSV and print/PDF output                                                                           |
| Data portability       | Workspace JSON and task/invoice CSV export with spreadsheet formula protection; consistent online SQLite backups with private files and overwrite protection                                                                                                                                                                                      |
| Interface              | Original vector brand, dark/light themes, responsive navigation, native accessible dialogs, command palette, empty/error states, reduced-motion support                                                                                                                                                                                           |
| Operations             | Pinned pnpm lockfile, Node 24 toolchain, standalone production start, Docker image with non-root runtime, root CI workflow, installation/security/architecture docs and collected third-party notices                                                                                                                                             |

## Verification evidence

Executed on 2 November 2026 in this managed environment:

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm format:check`: passed.
- `pnpm test`: **53 tests passed in 8 files**, covering domain calculations, SQLite CRUD/persistence, workspace/role isolation, hierarchy/dependency deadlocks, graph extraction/layout, exact financial totals and transitions, timers, HTTP validation/CSRF, real authentication throttling, CSV safety, and online backup/restore.
- `pnpm build`: passed; standalone assets are prepared by the build script. The final CSS accessibility correction and compact graph layout are included in the verified build.
- `pnpm db:migrate` and `pnpm db:backup`: executed successfully with the actual configured development database. The backup test reopens a consistent snapshot containing committed WAL data and checks file permissions and overwrite protection.
- `pnpm audit --prod`: reported no known vulnerabilities at check time. This is not an independent security audit.
- Docker build: passed using the managed proxy CA and Node's supported proxy handling; TLS/checksum validation remained enabled.
- Docker functional check: non-root runtime registered a test user, created a workspace/project/task, restarted, and verified the same session and persisted records. The temporary container/data were removed; no public port was exposed.
- Development server: started on port 3000, HTML returned 200, and unauthenticated workspace API returned 401.
- `pnpm test:e2e`: **all 4 browser tests passed (15.6 seconds)**. These cover registration, clean workspace, project/tasks, dependency rejection, graph inspector/layout persistence/reload, search, HTTP workspace isolation/viewer denial, document save/unsaved guard/reload, manual time, invoice/payment/print, persisted timers/exact financial totals, mobile keyboard navigation, and representative dark/light theme axe scans. All earlier failures were corrected and the complete suite rerun successfully.
- Screenshot review: the final explicit sample workspace was captured in desktop/mobile/dark/light variants with **no browser console or page errors**. The compact graph layout and settled theme colors were visually reviewed. See [screenshots](screenshots/).

CI configuration exists at `../.github/workflows/nexora.yml`; it has not been executed on GitHub in this session. No tests were skipped to obtain a pass.

## Local signup correction — 2 November 2026

A user-reported fresh-download defect was reproduced in an isolated Next development server without `.env.local`: Next's internal request URL used `0.0.0.0`, while the browser used `localhost`; the origin guard rejected registration with 403. Earlier configured production tests did not cover this no-configuration development path.

Authentication and CSRF checks now share a canonical URL resolver. Without an explicit URL it uses `localhost` and Next's actual listening port. Explicit URLs remain authoritative, and arbitrary Host/forwarded headers remain untrusted. The sign-in form also preserves useful wrapper errors instead of blaming account details for an origin rejection.

Verified for this correction:

- Real browser registration, session persistence and workspace creation passed in a clean development copy with no `.env` file.
- Strict typecheck, lint, all **70 unit/integration tests across 10 files**, and the production build passed.
- Added origin regression cases for internal bind addresses, actual ports, configured origins, and spoofed/cross-site headers; added safe client-error normalization tests.
- The rebuilt browser suite, including the new rejected-origin error-message case, passed: **5 browser tests in 14.2 seconds**. Configured production-origin checks, existing work management, financial flows and dark/light accessibility checks remain passing.

## Architecture decisions

- Application lives in `nexora/` within the selected Documents-SQL repository. Original SQL teaching files are unchanged; NEXORA uses its own SQLite database.
- Next.js App Router, React and strict TypeScript form a modular monolith. Native forms/dialogs and CSS tokens keep essential interactions small and accessible. React Flow is lazy loaded.
- Typed application services use explicit prepared SQL and initial migration code instead of an ORM runtime. Runtime inputs are Zod validated; workspace authorization and transactions remain on the server.
- Better Auth provides maintained credential and session primitives. No paid services, external trackers, model APIs, or outbound messaging integrations are required.
- Monetary amounts are integer minor units. Tax is basis points with half-up rounding. Date-only deadlines remain date-only; timed events use UTC ISO instants.
- Task progress is equal-weight completion percentage. Health considers completion, overdue work, explicit blockers and near target dates. Milestones are not included until implemented. See [architecture](ARCHITECTURE.md).
- Conventional views and graph consume the same authorized snapshot. Graph coordinates are persisted separately from business relationships.

## Known limitations and pending modules

- This is a single-host SQLite release for modest workspaces. Snapshot queries are not yet paginated or benchmarked for large organizations; PostgreSQL needs a real adapter/migration effort.
- Milestones, Gantt/timeline planning, standalone calendar events, commercial deals/pipeline, notifications, deterministic automations, saved dashboard configurations, and graph image export remain **planned**.
- Documents use Markdown and explicit saves. WYSIWYG editing, autosave/version conflicts, collaborative editing, attachment uploads and comprehensive offline synchronization remain **planned**.
- Time entry editing is not implemented; entries can be recorded/deleted. Advanced estimated-versus-actual reporting remains planned.
- Financial documents lack jurisdiction-specific issuer/address/tax identity configuration and discounts. Payment records are persisted, but richer payment-history UI and accounting exports remain planned. Do not claim universal invoice compliance.
- Membership additions require an existing registered account. Email invitations, membership removal/ownership transfer, account deletion and external email recovery remain planned.
- Accessibility checks cover representative core/mobile/theme flows, not every WCAG criterion. No enterprise scale, penetration, legal or commercial distribution audit has been performed.
- Production needs an independent strong authentication secret, HTTPS canonical origin, protected storage and backups. Proxy IP headers are trusted only with explicit operator configuration; direct exposure with forged forwarded headers does not bypass default auth throttling.
- First-party distribution licensing remains undecided; collected dependency notices and redistribution obligations require review before commercial distribution.

## Exact next implementation priorities

1. Add a versioned migration for project milestones, scoped CRUD and completion operations, calendar/graph representation, and health calculation tests. Finish this workflow before expanding planning.
2. Add standalone calendar events and a real timeline view, retaining explicit date-only/time-zone semantics and task list alternatives.
3. Implement deals with client/lead conversion, validated pipeline transitions, exact monetary stage totals and an operational pipeline board.
4. Add internal notifications and a small allowlisted automation engine, with transactional execution logs, permission checks and recursion/idempotency tests.
5. Add document revision/optimistic-conflict handling before autosave or richer editing, then safe time-entry editing.
6. Expand financial issuer fields, payment-history UI, reports and export coverage; verify target-jurisdiction requirements separately.
7. Measure realistic larger workspaces and introduce pagination/selective graph retrieval before claiming scale.

Continue from existing code and this record. Preserve working workflows and the original repository; do not rebuild the application shell or create a Git worktree unless explicitly requested.
