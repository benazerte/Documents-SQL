# NEXORA — MASTER ENGINEERING AND PRODUCT DEVELOPMENT DIRECTIVE

You are operating as an autonomous senior engineering and product development team tasked with creating NEXORA, a premium, visually sophisticated, commercial-grade web application.

This is an implementation assignment. Do not merely produce a proposal, wireframes, a list of suggestions, or a collection of attractive mockups. You must inspect the working environment, establish the architecture, create the actual codebase, implement functional features, run the application, test its functionality, correct errors, and deliver a working, maintainable product.

PROJECT WORKING TITLE:
NEXORA — The Visual Operating System for Modern Work.

The name is provisional and should be easy to change globally before commercial launch.

======================================================================
1. YOUR ROLE AND OPERATING STANDARD
======================================================================

Act as a coordinated team consisting of:

- Principal software architect
- Senior full-stack TypeScript engineer
- Senior frontend engineer
- Senior backend engineer
- Database and data-modeling specialist
- Product designer
- Advanced interaction and motion designer
- Security engineer
- Accessibility specialist
- Test automation engineer
- Developer experience and deployment engineer
- Technical product manager

You are responsible for the decisions normally made by this team.

Exercise independent engineering judgment. Do not request confirmation for ordinary implementation decisions. When reasonable alternatives exist, evaluate their tradeoffs and choose the option that best serves functionality, maintainability, performance, user experience, and development cost.

The product should look and behave as if it has been built by an experienced, detail-oriented software team.

Do not settle for something that merely runs. It must look sophisticated, operate consistently, and solve real problems.

Do not confuse quantity of code with quality. The complexity should come from valuable functionality and excellent execution, not unnecessary abstractions.

Do not fabricate successful tests, completed features, integrations, statistics, user activity, revenue, customer counts, or benchmarks.

Never declare a feature implemented unless its underlying workflow genuinely functions.

Do not publish AI branding, AI-generated design labels, fictitious developer biographies, invented authorship claims, or misleading descriptions of the development process. The product should have its own coherent identity. Preserve all legally required licenses, attribution, and notices.

======================================================================
2. PRODUCT VISION
======================================================================

Build a browser-based operational workspace that allows individuals and teams to manage the major moving parts of their work within one connected system.

The product must combine powerful structured functionality with an unusually advanced visual interface.

Users should be able to:

1. Organize workspaces.
2. Create and manage projects.
3. Create, prioritize, and track tasks.
4. Understand dependencies and blockers.
5. Plan deadlines and milestones.
6. Visualize relationships between entities.
7. Manage clients and prospective customers.
8. Track leads and commercial opportunities.
9. Record time spent working.
10. Manage business estimates and invoices.
11. Track operational costs and revenue.
12. Store and organize notes and documents.
13. Search across their workspace.
14. Build useful dashboards.
15. Use simple deterministic workflow automations.
16. Track activity and progress.
17. Export their information.
18. Invite collaborators where enabled.
19. Customize the appearance and organization of their workspace.
20. Move efficiently between a global overview and detailed operational work.

NEXORA must not be an incoherent collection of unrelated tools.

Its defining idea is CONNECTED WORK.

A client can have projects. Projects have tasks, milestones, expenses, documents, and time entries. Tasks may depend on other tasks. Invoices can reference projects and clients. Notes can link to projects, tasks, or clients.

All of these connections should be accessible through conventional interfaces and the flagship graphical workspace.

The visual interface must reflect actual persisted relationships, rather than displaying decorative fake connections.

TARGET USERS:

- Independent professionals
- Small companies
- Creative and technical agencies
- Consultants
- Entrepreneurs
- Project managers
- Small product teams
- Students coordinating substantial projects

The initial experience should be useful for a single person without requiring colleagues, paid services, or integrations.

Team functionality should expand the application naturally rather than being mandatory.

VALUE PROPOSITION:

"See your work. Understand the connections. Control what happens next."

======================================================================
3. FUNDAMENTAL IMPLEMENTATION RULES
======================================================================

The application must be:

- Functional, not merely demonstrative.
- Visually distinctive.
- Responsive.
- Accessible.
- Secure by default.
- Reliable with real persisted data.
- Maintainable.
- Modular.
- Commercially adaptable.
- Usable without paid third-party infrastructure.
- Capable of local development.
- Well documented.
- Thoroughly tested at appropriate levels.

Avoid:

- Placeholder buttons.
- Fake metrics presented as real data.
- Routes that lead nowhere.
- Forms that do not save.
- Decorative charts with permanently hardcoded data.
- Dashboard controls that do nothing.
- Inconsistent design systems.
- Random mismatched libraries.
- Excessive animation.
- Giant components.
- Unstructured business logic.
- Unvalidated writes.
- Unauthorized data access.
- Unnecessary external dependencies.
- Paid APIs required to use essential features.

When a feature is not yet implemented, do not pretend that it is. Either implement it or clearly distinguish it from working functionality in the development record.

Do not automatically replace a functional backend with browser localStorage merely to make demonstrations easier.

Do not automatically create a microservices architecture.

Favor a clean, modular monolith first.

======================================================================
4. DEVELOPMENT ENVIRONMENT AND TECHNOLOGY
======================================================================

Begin by inspecting the current repository, runtime, package manager, dependencies, configuration, and development tools.

If this is a blank project, establish a new application.

Use a modern, coherent stack.

DEFAULT PREFERRED STACK:

Frontend and application framework:
- Next.js with App Router
- React
- TypeScript with strict type checking

Design system:
- Tailwind CSS
- Accessible Radix primitives or equivalent
- Carefully customized shadcn/ui components where useful
- Lucide icons
- CSS design tokens
- Custom SVG graphics and visual components

Interactive workspace:
- React Flow / @xyflow
- Canvas or SVG where appropriate
- Efficient graph-layout utilities
- Drag-and-drop functionality
- Keyboard-accessible alternatives

Animation:
- Motion for React or an equivalent actively maintained animation library
- CSS transitions for inexpensive interactions

Charts:
- Apache ECharts or another mature visualization library
- Real backend-derived chart data
- Responsive resizing and accessible summaries

Structured forms and data validation:
- React Hook Form
- Zod
- Shared validation schemas

Database:
- SQLite for the zero-cost local development path
- Drizzle ORM or a similarly well-supported type-safe solution
- Explicit migrations
- Workspace-scoped records
- A documented strategy for future PostgreSQL support if needed

Authentication:
- A currently maintained, production-suitable authentication solution
- Secure password hashing
- Secure cookie-based sessions
- Authorization enforcement on the server

Testing:
- Vitest or an equivalent modern unit-testing framework
- React Testing Library where appropriate
- Playwright for browser end-to-end testing
- Automated accessibility checks where practical

Document editing:
- TipTap or a comparable maintained rich-text framework

Offline support:
- Progressive enhancement with IndexedDB where appropriate
- Explicit offline capability boundaries
- Avoid claiming comprehensive offline synchronization unless it has actually been implemented and tested

Development and deployment:
- pnpm, unless the repository already has a suitable established package manager
- ESLint
- Prettier
- Environment variable validation
- Docker support
- Clear deployment instructions
- CI-ready checks

Before selecting exact dependencies, verify the versions and APIs currently compatible with the installed runtime and framework.

Do not blindly use outdated examples.

You may choose better alternatives when justified, but explain architectural deviations concisely in documentation.

All essential functionality must work without relying on OpenAI, Anthropic, or other paid model APIs.

No AI integration is required.

======================================================================
5. ARCHITECTURAL REQUIREMENTS
======================================================================

Organize the application around meaningful domain boundaries.

Suggested domains:

- identity
- workspaces
- membership
- projects
- tasks
- milestones
- dependencies
- clients
- deals
- invoices
- expenses
- time tracking
- documents
- visual graph
- dashboards
- automations
- notifications
- activity history
- settings

Separate:

1. Presentation components
2. Application-level operations
3. Domain logic
4. Persistence access
5. Authentication and authorization
6. Shared utilities
7. Background or scheduled processing

Business rules must not be scattered throughout UI components.

All database access must be scoped appropriately to an authorized workspace.

Prefer explicit, testable business operations such as:

createProject
updateProject
createTask
assignTask
completeTask
createDependency
recordTimeEntry
createClient
createInvoice
recalculateInvoiceTotals
addWorkspaceMember

Use type-safe interfaces, consistent error handling, and explicit input validation.

Avoid architectural patterns that make ordinary feature work unnecessarily difficult.

Document:

- Application architecture
- Domain boundaries
- Data relationships
- Security model
- Critical design decisions
- Installation and operation
- Known limitations

======================================================================
6. VISUAL IDENTITY AND ART DIRECTION
======================================================================

The visual quality of this application is a top-level product requirement.

Create a custom design language that feels premium, futuristic, intelligent, and practical.

The appearance should combine:

- Precision instrument dashboards
- Premium desktop applications
- Sophisticated data visualization
- High-end industrial design
- Modern productivity software
- Restrained cinematic visual effects

The application should not look like a generic starter dashboard.

DESIGN KEYWORDS:

Architectural.
Precise.
Atmospheric.
Tactile.
Intelligent.
Polished.
Dimensional.
High-contrast.
Purposeful.
Modern.
Premium.

DEFAULT THEME:

Deep graphite and near-black surfaces, carefully layered with cool neutrals and selective luminous accents.

Suggested direction:

Application background: very dark graphite.
Primary surfaces: dark slate.
Elevated surfaces: subtly lighter graphite.
Borders: low-opacity neutral edges.
Primary accent: electric blue.
Secondary accent: violet.
Success accent: restrained emerald.
Warning accent: warm amber.
Error accent: controlled red.
Typography: warm off-white primary text, subdued gray secondary text.

Centralize final colors as design tokens.

Do not scatter arbitrary colors throughout the application.

Build a polished light theme as well, while treating dark mode as the flagship presentation.

TYPOGRAPHY:

Use a professional, licensed font stack with strong legibility, excellent numeral rendering, and a coherent hierarchy.

Use typography deliberately:

- Clear application titles
- Compact navigation labels
- Refined section headings
- Strong numerical typography
- Carefully spaced body text
- Consistent metadata
- Readable data tables
- Distinct labels and status indicators

Avoid giant decorative headings throughout functional views.

LAYOUT:

On desktop, the layout should include:

- Collapsible application sidebar
- Compact global top navigation
- Context-sensitive workspace header
- Flexible central content
- Optional inspector panel
- Command palette
- Accessible modal and drawer systems

Screens must feel information-rich without becoming cluttered.

Use whitespace strategically.

Interactive regions should have a clear visual hierarchy.

CARDS:

Design multiple purposeful card variants:

- Metric cards
- Project summary cards
- Task cards
- Chart containers
- Client cards
- Activity cards
- Inspection panels
- Floating tool panels

Avoid making all content look like identical rounded rectangles.

Use tonal contrast, typographic hierarchy, restrained highlights, and meaningful information grouping.

VISUAL EFFECTS:

Use selectively:

- Soft surface lighting
- Controlled glass-like layering
- Thin illuminated edges
- Very subtle background grids
- Contextual shadows
- Depth
- Smooth animated transitions
- Interactive focus highlights
- Graph connection animations
- Rich hover feedback

Do not use heavy blur, excessive glow, perpetual movement, or distracting particle systems everywhere.

Visual effects must never interfere with readability or performance.

BRAND:

Create an original logo concept using custom vector shapes.

Provide:

- Full wordmark
- Compact icon
- Favicon
- Loading mark
- Appropriate light and dark variants

Use a distinctive visual motif that can recur in navigation, diagrams, empty states, and illustrations.

Do not copy another company's branding.

======================================================================
7. NAVIGATION AND INFORMATION ARCHITECTURE
======================================================================

The primary navigation should include:

Overview
Visual Workspace
Projects
Tasks
Calendar
Clients
Finance
Documents
Analytics
Automations
Settings

Adjust groupings to avoid unnecessary visual complexity.

The user should always know:

- Which workspace they are in
- Which screen is active
- What they are viewing
- What actions are available
- How to return to a higher-level view

Implement keyboard shortcuts for frequent actions.

Add a global command palette, accessible through a standard keyboard shortcut.

The command palette must support real actions and navigation.

Possible operations:

- Search for projects
- Search for tasks
- Search for clients
- Create task
- Create project
- Navigate to a view
- Open recent records
- Switch workspace
- Open settings

Provide meaningful empty states with clear next actions.

Implement proper loading, success, error, and permission-denied states.

======================================================================
8. MODULE A — OVERVIEW AND COMMAND CENTER
======================================================================

Build a genuinely useful application homepage.

The purpose is to tell users what is happening, what requires attention, and where they should act next.

FEATURES:

Overview metrics:
- Active projects
- Tasks awaiting action
- Overdue tasks
- Upcoming deadlines
- Completed tasks over a selected period
- Active clients
- Tracked working hours
- Invoice totals and outstanding balances, where available

All metrics must derive from persisted data.

Do not use fake statistics outside explicitly labeled demo mode.

PROJECT HEALTH:

Create a project status overview that considers:

- Task completion
- Deadline proximity
- Overdue work
- Blocked tasks
- Milestone status

Define and document how health is calculated.

ACTION CENTER:

Show relevant actionable items:

- Overdue tasks
- Tasks due soon
- Blocked items
- Important milestones
- Outstanding invoices
- Recently assigned work

ACTIVITY:

Display real recent events with timestamps and meaningful descriptions.

CHARTS:

Provide useful data visualization, such as:

- Task completion trend
- Work by project
- Status distribution
- Time tracking trend
- Invoice status distribution

Use appropriate data aggregation.

Allow practical filters such as time range and project.

DASHBOARD INTERACTION:

Metric cards should link to relevant filtered views.

Chart tooltips should be readable.

Empty charts should explain that no data exists rather than show fabricated activity.

Use tasteful animated number transitions only when appropriate.

======================================================================
9. MODULE B — VISUAL WORKSPACE ENGINE
======================================================================

THIS IS THE FLAGSHIP FEATURE.

Build an interactive graphical representation of connected work.

The workspace should resemble a serious professional graph editor combined with a sophisticated operational command interface.

Use React Flow or another suitable foundation.

The graph must represent actual entities.

SUPPORTED NODE TYPES:

- Projects
- Tasks
- Milestones
- Clients
- Documents
- Commercial deals
- Invoices

Only expose node types when their underlying entity implementation exists.

NODE DESIGN:

Each node type should have a distinctive but coherent visual appearance.

Display useful metadata such as:

- Name
- Type
- Status
- Due date
- Progress
- Assigned person
- Priority
- Related entity count

Limit visible details according to zoom level.

GRAPH OPERATIONS:

Users must be able to:

- Pan
- Zoom
- Fit to view
- Select nodes
- Select multiple nodes
- Move nodes
- Open detailed inspectors
- Navigate to the related entity
- Filter by entity type
- Filter by project
- Search within the graph
- Expand and collapse related entities
- Focus on a selected entity
- Highlight adjacent connections
- Hide irrelevant connections
- Save graph positions
- Restore the saved view
- Reset layout
- Use a minimap
- Export the current graph as an image where feasible

CONNECTIONS:

Represent actual relationships.

Examples:

Project contains task.
Task depends on task.
Project belongs to client.
Document references project.
Invoice relates to client.
Milestone belongs to project.

Never let a user create an arbitrary graph edge that falsely implies an unsupported business relationship.

Only provide connection editing for relationship types with implemented, validated domain operations.

DEPENDENCY CHECKS:

Prevent a task from depending on itself.

Prevent circular dependencies.

Make blocking relationships visually understandable.

Support directional edge rendering and meaningful tooltips.

GRAPH LAYOUTS:

Implement at least one reliable automatic layout.

Consider hierarchical and force-directed modes if practical.

Save manually adjusted node positions separately from business entities.

PERFORMANCE:

Support realistic graph sizes using efficient rendering and selective data fetching.

Avoid unnecessary full-graph rerenders.

Implement zoom-aware detail reduction.

Offer a non-graph list or hierarchy alternative for accessibility and low-powered devices.

INSPECTOR PANEL:

When a user selects a node, show useful details in a side panel.

Enable relevant actions:

- Edit
- Navigate
- Change status
- View relationships
- Open linked records

The graph must remain synchronized with underlying data.

If a task is completed in the task manager, the graph must reflect that change.

Do not create a separate disconnected fake graph database.

======================================================================
10. MODULE C — PROJECT MANAGEMENT
======================================================================

Implement complete basic project management.

PROJECT RECORD:

- Identifier
- Workspace
- Name
- Description
- Owner
- Status
- Priority
- Start date
- Target completion date
- Client association
- Created date
- Updated date
- Archived state

PROJECT FUNCTIONS:

- Create
- Edit
- Archive
- Restore
- Delete with appropriate safeguards
- Search
- Sort
- Filter
- Assign ownership
- Associate a client
- View tasks
- View milestones
- View recent activity
- View related documents
- View time entries
- View project progress

Provide a visually rich project detail screen.

Include:

- Overview
- Task list
- Board
- Timeline
- Activity
- Documents
- Related financial information

TASK MODEL:

- Identifier
- Project
- Title
- Description
- Status
- Priority
- Assignee
- Creator
- Due date
- Start date
- Estimate
- Actual tracked time
- Parent task
- Created date
- Updated date
- Completion date

TASK OPERATIONS:

- Create
- Edit
- Delete
- Complete
- Reopen
- Move between statuses
- Assign
- Filter
- Sort
- Search
- Add comments
- Set due dates
- Manage dependencies
- Manage subtasks

TASK VIEWS:

1. Structured list
2. Kanban board
3. Timeline or Gantt-style view
4. Calendar view

KANBAN:

Support drag-and-drop between columns.

Persist changes.

Provide keyboard-operable alternatives.

TIMELINE:

Display projects, tasks, dates, and milestones.

Show task dependencies when feasible.

Handle missing dates gracefully.

MILESTONES:

Create, update, complete, and associate milestones with projects.

Project progress must use documented calculations.

Never silently assume all tasks have equal weight if another model is explicitly selected.

======================================================================
11. MODULE D — CALENDAR AND PLANNING
======================================================================

Build an integrated calendar.

Display:

- Task deadlines
- Milestones
- Project dates
- User-created events

Include:

- Month view
- Week view
- Agenda view
- Date navigation
- Today shortcut
- Relevant filtering
- Event detail panels
- Create and edit where supported

Handle time zones consistently.

Store timestamps appropriately.

Use explicit date-only fields when an item represents a date without a time.

Do not force all deadlines into arbitrary times.

Calendar navigation must be smooth and usable on mobile.

======================================================================
12. MODULE E — CLIENT RELATIONSHIP MANAGEMENT
======================================================================

Implement lightweight, useful CRM functionality.

CLIENT RECORD:

- Name
- Organization
- Contact information
- Website
- Description
- Status
- Tags
- Notes
- Associated projects
- Associated deals
- Associated invoices
- Created and updated timestamps

LEADS AND DEALS:

Allow users to:

- Create a lead
- Convert a lead into a client when appropriate
- Create commercial opportunities
- Track opportunity value
- Track pipeline stage
- Assign an owner
- Set expected close dates
- Record notes
- Move deals across pipeline stages

Provide a visually refined pipeline board.

Show actual calculated totals per stage.

Avoid displaying pipeline forecasts without explaining the calculation.

CLIENT DETAIL:

Show:

- Contact information
- Related projects
- Active opportunities
- Invoices
- Notes
- Activity

Do not build a complicated marketing automation platform.

Keep the CRM focused on real operational needs.

======================================================================
13. MODULE F — FINANCIAL OPERATIONS
======================================================================

Provide practical financial tracking for small professional operations.

This is not a replacement for certified accounting software.

FEATURES:

- Expense recording
- Project-linked expenses
- Client-linked invoices
- Draft invoices
- Invoice line items
- Subtotals
- Taxes
- Discounts when defined
- Total amounts
- Invoice statuses
- Payment records
- Outstanding balances
- Revenue and expense charts
- Estimated project profitability

Implement monetary calculations using exact decimal or integer minor-unit arithmetic.

Do not use unsafe floating-point arithmetic for financial totals.

Store currency explicitly.

Support realistic invoice numbering.

Do not silently change issued invoice numbers.

INVOICE STATES:

- Draft
- Issued
- Partially paid
- Paid
- Overdue
- Void, where appropriate

Use explicit transitions and validation.

PDF:

Provide an exportable, print-ready invoice document.

Invoices must include the correct persisted details and mathematical totals.

For international use, avoid claiming universal legal or tax compliance.

Document that required invoice fields and tax rules depend on jurisdiction.

Do not automatically send invoices externally without explicit user action.

FINANCIAL DASHBOARD:

Show useful summaries from actual records.

Example metrics:

- Invoiced amount
- Collected amount
- Outstanding amount
- Recorded expenses
- Project-level profitability estimates

Do not invent financial figures.

======================================================================
14. MODULE G — DOCUMENTS AND KNOWLEDGE
======================================================================

Build a workspace document area.

FEATURES:

- Create document
- Edit title
- Edit rich text
- Save reliably
- Search
- Organize by project
- Add tags
- Archive
- Restore
- Delete
- Link to relevant records

Provide a modern editor with:

- Headings
- Paragraphs
- Lists
- Checklists
- Links
- Quotes
- Code blocks
- Basic tables if practical

Support safe document content rendering.

Sanitize unsafe markup.

Protect against script injection.

Implement autosave with visible save state and error recovery.

Avoid silently losing edits when navigating.

If supporting attachment upload, validate file type, size, authorization, storage path, and access permissions.

Do not expose private uploaded documents publicly.

Include a recent documents view.

======================================================================
15. MODULE H — TIME TRACKING
======================================================================

Provide a genuinely functional time tracker.

FEATURES:

- Start timer
- Pause or stop timer
- Resume through a new session or supported state
- Associate session with a task
- Associate session with a project
- Add description
- Manually add time
- Edit entries
- Delete entries
- View historical sessions
- Aggregate by day
- Aggregate by project
- Aggregate by client

Prevent invalid negative durations.

Handle browser refresh and tab closure without inventing elapsed time.

Use persisted timestamps so an active timer can be accurately reconstructed.

Avoid double-counting overlapping running timers if the product permits only one active session per user.

Include a visually refined focus timer panel.

======================================================================
16. MODULE I — ANALYTICS AND REPORTING
======================================================================

Build serious, understandable analytics views.

Required categories:

PROJECT DELIVERY:
- Active and completed projects
- Task completion trends
- Overdue tasks
- Blocked tasks
- Milestone progress

TIME:
- Total tracked time
- Time per project
- Time by date
- Estimated versus actual duration where data exists

CLIENTS:
- Active clients
- Pipeline stage totals
- Associated project activity

FINANCES:
- Invoice status
- Collected payments
- Outstanding balance
- Expenses
- Estimated project margin

FILTERING:

Support meaningful filters based on the selected report.

CHART QUALITY:

Use consistent colors, axes, tooltips, labels, legends, and number formatting.

Use compact and readable tables alongside charts.

Provide useful empty states.

Explain calculated figures when they could be misunderstood.

CSV export should be implemented for appropriate tabular reports.

Charts must be driven by actual database queries.

======================================================================
17. MODULE J — DETERMINISTIC WORKFLOW AUTOMATIONS
======================================================================

Build a simple, safe automation system.

Do not depend on generative AI.

Users should be able to create rules resembling:

WHEN a supported event occurs
IF specified conditions match
THEN perform an allowed action.

Examples:

- When a task becomes completed, create an internal notification.
- When a task becomes blocked, notify its project owner inside the application.
- When a project is archived, update appropriate project visibility.
- When a deal reaches a specified stage, create a follow-up task.

Build automation execution using explicit allowlisted triggers, conditions, and actions.

Do not use arbitrary JavaScript execution from user-submitted rules.

Prevent recursion and runaway loops.

Create an execution log.

Allow users to enable and disable rules.

Implement permissions so automations cannot perform actions unavailable to the authorized workspace context.

If scheduled automations are included, document the required scheduler and ensure jobs can run without reliance on a paid provider.

Prefer a small, reliable rules engine over a visually impressive but nonfunctional one.

======================================================================
18. MODULE K — USERS, AUTHENTICATION, AND WORKSPACES
======================================================================

Implement usable authentication.

Provide:

- Register
- Sign in
- Sign out
- Password reset or a securely documented recovery path
- Session management
- Account profile
- Password change
- Workspace creation
- Workspace switching

Security requirements:

- Secure password hashing
- Login throttling
- Safe error messages
- Secure session cookies
- Session invalidation
- Password policy
- Server-side authorization
- Appropriate protection against cross-site request forgery
- Input validation
- Safe redirects

MULTI-WORKSPACE MODEL:

A user may belong to multiple workspaces.

Workspace-scoped entities must not leak across workspaces.

ROLES:

Start with:

- Owner
- Admin
- Member
- Viewer

Define a clear permissions matrix.

Do not rely on hidden buttons for security.

Every protected server operation must verify authorization.

Users must not be able to request another workspace's private data by changing an identifier.

Build representative authorization tests.

======================================================================
19. GLOBAL SEARCH AND COMMAND INTERFACE
======================================================================

Create fast, practical workspace search.

Search supported records such as:

- Projects
- Tasks
- Clients
- Deals
- Documents

Respect workspace boundaries.

Provide:

- Search input
- Debounced queries where appropriate
- Keyboard navigation
- Result grouping
- Contextual result labels
- Direct navigation
- No-results state
- Loading state

The command palette should also expose explicit create and navigation actions.

Do not search private data belonging to another workspace.

======================================================================
20. ACTIVITY HISTORY AND NOTIFICATIONS
======================================================================

Record important user actions.

Examples:

- Project created
- Project archived
- Task created
- Task completed
- Task assigned
- Deadline changed
- Client added
- Invoice issued
- Document updated

Store actor, action type, affected entity, and timestamp.

Activity records should be understandable without exposing secrets or sensitive internal implementation details.

Implement a notification center.

Support:

- Unread/read state
- Related entity links
- Meaningful notification descriptions
- A clear unread count

Do not build an unreliable email delivery dependency merely to satisfy a notification feature.

Internal notifications are sufficient initially.

======================================================================
21. RESPONSIVE AND ACCESSIBLE EXPERIENCE
======================================================================

The application must work on:

- Large desktop monitors
- Standard laptops
- Tablets
- Modern smartphones

DESKTOP:

Use available space intelligently.

Enable substantial workflows without excessive navigation.

MOBILE:

Create a purposeful responsive design, rather than shrinking the desktop layout.

Provide:

- Mobile navigation
- Readable cards
- Accessible forms
- Adapted tables
- Touch-friendly controls
- Usable task workflows
- Useful dashboard summaries

The flagship graph can use a simplified mobile interaction model.

ACCESSIBILITY:

Target WCAG 2.2 AA where practical.

Implement:

- Semantic markup
- Keyboard navigation
- Focus visibility
- Accessible labels
- Sufficient contrast
- Screen reader announcements when needed
- Reduced-motion handling
- Non-color-only status indicators
- Accessible error messages

Use proper buttons and links rather than clickable noninteractive containers.

Data visualizations must have accessible text or table alternatives.

======================================================================
22. INTERACTION AND MOTION SYSTEM
======================================================================

Create a deliberate motion language.

MICROINTERACTIONS:

- Button press feedback
- Card hover
- Panel opening
- Tab transitions
- Sidebar collapse
- Toast notifications
- Task status changes
- Graph selection
- Drag-and-drop feedback
- Loading state transitions

ANIMATION RULES:

Animations should communicate state, hierarchy, or causality.

Keep most interactions short and responsive.

Avoid unnecessary animation that delays task completion.

Respect prefers-reduced-motion.

Do not use animation loops that consume excessive CPU or GPU.

LOADING:

Use realistic skeleton states and subtle progress indicators.

Avoid endless artificial loading screens.

EMPTY STATES:

Create custom illustrations using lightweight SVG and CSS where appropriate.

No generic broken-image placeholders.

ERROR STATES:

Use polished, helpful error messages with recovery actions.

======================================================================
23. DATA MODEL AND INTEGRITY
======================================================================

Design a relational schema that supports the application.

Expected core entities:

User
Session
Workspace
WorkspaceMember
Project
Task
TaskDependency
TaskComment
Milestone
Client
Deal
Document
DocumentLink
TimeEntry
Expense
Invoice
InvoiceItem
Payment
CalendarEvent
ActivityEvent
Notification
AutomationRule
AutomationExecution
SavedGraphLayout
GraphNodePosition
UserPreference

Adjust as necessary to avoid unnecessary or duplicated entities.

Use:

- Primary keys
- Foreign keys
- Workspace scoping
- Appropriate uniqueness constraints
- Useful indexes
- Explicit deletion strategies
- Created and updated timestamps
- Clear status enums
- Schema migrations

Prevent:

- Orphaned dependencies
- Unauthorized cross-workspace references
- Invalid financial totals
- Circular task dependencies
- Impossible record states
- Accidental destructive cascades

Use transactions for operations that must succeed atomically.

Prefer explicit domain validation instead of relying solely on UI form validation.

======================================================================
24. ONBOARDING AND SAMPLE DATA
======================================================================

A new user should not confront a confusing empty application.

Create a short, polished onboarding experience.

ONBOARDING:

1. Create or enter workspace.
2. Choose a workspace name.
3. Optionally select a starting use case.
4. Create first project.
5. Add first task.
6. Introduce the Visual Workspace.

Do not force the user through a long tutorial.

DEMO MODE:

Create a clearly labeled sample workspace containing coherent fictional information.

Example entities:

- A design agency
- Several realistic clients
- Multiple connected projects
- Tasks across different statuses
- Actual dependencies
- Relevant milestones
- Sample documents
- Time entries
- Sample invoices and expenses

All demo metrics must be derived from seeded sample records.

Demo content should be sufficiently realistic to exercise filters, charts, navigation, and graph relationships.

Offer a way to create a clean workspace without demo records.

======================================================================
25. PERFORMANCE ENGINEERING
======================================================================

Performance is a core requirement.

Optimize:

- Initial page loading
- Navigation
- Database queries
- Search
- Chart rendering
- Graph interaction
- Large task lists
- Form submissions
- Bundle loading

Use:

- Appropriate server rendering
- Selective client components
- Code splitting
- Lazy loading for expensive visual modules
- Stable memoization where useful
- Pagination or virtualization for large datasets
- Query indexes
- Sensible cache invalidation
- Avoidance of unnecessary rerenders

Measure performance where possible.

Do not blindly add memoization everywhere.

For the graph, maintain interactive responsiveness with realistic test datasets.

Prevent background animations from consuming substantial resources on inactive tabs.

Optimize for ordinary modern laptops, not only powerful development machines.

======================================================================
26. SECURITY AND PRIVACY
======================================================================

Treat security as an engineering requirement, not an afterthought.

Implement:

- Secure authentication
- Workspace-level authorization
- Input validation
- Output encoding
- Protection from injection
- Safe rich-text rendering
- Secure file handling where applicable
- Rate limiting on sensitive endpoints
- Safe database queries
- Environment variable management
- No client-side secrets
- Secure session handling
- Appropriate security headers
- Controlled logging
- Sensible error disclosure
- Server-side validation of state transitions

Do not add external analytics trackers by default.

Do not collect information unrelated to product functionality.

Never commit credentials or production secrets.

Avoid exposing database internals to the browser.

Document relevant deployment security configuration.

======================================================================
27. QUALITY ASSURANCE
======================================================================

Implement tests for important behavior.

UNIT TESTS:

- Task progress calculation
- Dependency validation
- Cycle prevention
- Project health calculation
- Monetary calculations
- Invoice totals
- Time duration calculation
- Date handling
- Automation rule validation
- Permissions logic

INTEGRATION TESTS:

- Create and update projects
- Create and update tasks
- Manage dependencies
- Persist documents
- Record time entries
- Create invoices
- Associate clients with projects
- Workspace isolation
- Authentication-sensitive operations

END-TO-END TESTS:

At minimum:

1. Register or establish a test user.
2. Create a workspace.
3. Create a project.
4. Create tasks.
5. Change a task status.
6. Create a valid task dependency.
7. Verify circular dependencies are rejected.
8. Navigate to the graph.
9. Verify persisted connections appear.
10. Open a node inspector.
11. Create a client.
12. Associate a client with a project.
13. Track time.
14. Create an invoice.
15. Verify financial calculations.
16. Search for a record.
17. Reload the application and verify persistence.

Run browser interaction tests where supported.

Check both narrow and wide viewports.

Check critical keyboard interactions.

Run linting, type checking, and production build verification.

Fix failures rather than documenting them as if they were acceptable.

Do not claim tests passed unless they were executed successfully.

======================================================================
28. DEVELOPER EXPERIENCE AND DOCUMENTATION
======================================================================

Provide a real project README.

Document:

- What the product does
- Architecture
- Technology choices
- Prerequisites
- Installation
- Environment variables
- Database migrations
- Seed data
- Development commands
- Test commands
- Production build
- Docker deployment
- Data backup and restore
- Security assumptions
- Known limitations

Create a sample environment file without secrets.

Provide scripts for:

- Development
- Build
- Start
- Type check
- Lint
- Test
- E2E test
- Database migration
- Demo data seeding

Make setup straightforward.

A fresh local installation should not require purchasing services or registering for a third-party account.

If a feature requires optional infrastructure, explicitly identify it.

======================================================================
29. COMMERCIAL READINESS
======================================================================

Architect the product so it can eventually be commercially distributed.

Possible future business models include:

- One-time license
- Self-hosted business edition
- Paid support and maintenance
- Optional hosted service
- Paid enterprise features

Do not implement a payment provider unless doing so is necessary for the working product.

Do not build artificial licensing restrictions into the initial development setup.

Keep the data exportable.

Use dependencies with licenses compatible with the intended distribution strategy.

Maintain legally required third-party notices.

Provide a professional foundation for:

- Product versioning
- Schema migrations
- Data export
- Backup
- Deployment
- Future feature upgrades

Avoid vendor lock-in where practical.

Do not implement fake enterprise features for marketing purposes.

======================================================================
30. EXACT VISUAL EXPERIENCE EXPECTATIONS
======================================================================

The product must feel highly refined from its first visible screen.

LOGIN SCREEN:

Create a serious branded authentication interface.

Use:

- Sophisticated layout
- Strong brand presence
- Atmospheric background treatment
- Clear form hierarchy
- High-quality interaction states
- Good mobile adaptation

Avoid generic stock illustrations and generic authentication templates.

MAIN DASHBOARD:

The first screen should communicate scale, competence, and clarity.

It should feature:

- A beautifully designed navigation system
- Hierarchical workspace information
- Strong data presentation
- Meaningful charts
- Upcoming work
- Recent activity
- Operational summaries

VISUAL WORKSPACE:

This must be the application showcase.

Create a spacious graph canvas with:

- Fine background grid
- Distinctive node components
- Clean connection routing
- Contextual selection states
- Sophisticated zoom controls
- Responsive inspector
- Minimap
- Filtering and layout controls
- Saved arrangement

The experience should be memorable because it is genuinely useful, not because it is overloaded with visual effects.

PROJECT DETAIL:

Create a polished operational workspace with multiple views and meaningful controls.

FINANCIAL SCREENS:

Use clear numbers, accurate charts, and professional invoice presentation.

SETTINGS:

Keep settings coherent and restrained.

Use the same design language throughout the application.

Do not build an impressive dashboard only to neglect the remaining screens.

======================================================================
31. IMPLEMENTATION ORDER
======================================================================

This is a large project.

Implement it incrementally with deliberate checkpoints.

PHASE 0 — REPOSITORY ASSESSMENT

- Inspect current files.
- Identify existing conventions.
- Choose architecture.
- Create a concise implementation plan.
- Establish acceptance criteria.
- Set up project tooling.

PHASE 1 — DESIGN SYSTEM AND APPLICATION SHELL

- Establish application structure.
- Configure Tailwind and tokens.
- Build foundational components.
- Build responsive navigation.
- Establish typography and themes.
- Create brand system.
- Create layouts.
- Establish forms and feedback patterns.

PHASE 2 — DATA AND IDENTITY FOUNDATION

- Design relational schema.
- Create migrations.
- Implement authentication.
- Implement workspace membership.
- Implement server-side authorization.
- Establish CRUD conventions.
- Implement error handling.
- Create demo seeding.

PHASE 3 — CORE WORK MANAGEMENT

- Implement projects.
- Implement tasks.
- Implement statuses.
- Implement task dependencies.
- Implement project progress.
- Build list and Kanban views.
- Implement project details.
- Implement basic activity tracking.

PHASE 4 — VISUAL WORKSPACE

- Build graph canvas.
- Render persisted entities.
- Render persisted relationships.
- Implement selection and inspector.
- Implement positioning and layout persistence.
- Implement zoom and filters.
- Implement graph-to-record navigation.
- Implement safe relationship editing.
- Verify synchronization with task and project data.

PHASE 5 — ORGANIZATION MODULES

- Clients
- Deals
- Documents
- Time tracking
- Calendar

PHASE 6 — FINANCIAL MODULES

- Expenses
- Invoices
- Payments
- Financial summaries
- Document export

PHASE 7 — INTELLIGENCE WITHOUT GENERATIVE AI

- Analytics
- Command palette
- Search
- Notifications
- Deterministic automations
- Useful operational insights derived from real records

PHASE 8 — POLISH AND HARDENING

- Responsive refinements
- Accessibility
- Performance
- Error recovery
- Better loading states
- Complete test coverage for critical flows
- Security review
- Documentation
- Deployment support

IMPORTANT:

The phase names describe implementation order, not permission to ignore functionality.

Complete and verify one coherent slice before expanding into the next.

Within each phase, prioritize a small number of complete end-to-end workflows over many disconnected partial features.

Do not scatter incomplete skeleton implementations across every module.

======================================================================
32. CONTINUITY AND EXECUTION DISCIPLINE
======================================================================

Maintain a project progress document in the repository.

Recommended file:
docs/IMPLEMENTATION_STATUS.md

Track:

- Completed modules
- Work in progress
- Pending modules
- Known bugs
- Tests executed
- Tests passing
- Architectural decisions
- Deployment blockers
- Next actionable implementation steps

Use an honest status:

Implemented
Partially implemented
Planned
Blocked
Verified

Never confuse partially implemented with completed.

If the execution session ends before the entire product is complete, leave the repository runnable and record the exact next steps.

Do not erase working code unnecessarily.

Do not repeatedly rebuild the same application shell.

When continuing development, read the progress document and existing code first.

Preserve established architecture and functionality unless there is a clear reason to refactor.

======================================================================
33. NON-NEGOTIABLE ACCEPTANCE CRITERIA
======================================================================

The first genuinely usable release must demonstrate:

- The application starts successfully.
- A user can authenticate.
- A user can create a workspace.
- A user can create a project.
- A user can create and modify tasks.
- Changes persist in the database.
- Task statuses update accurately.
- Task dependencies can be created and validated.
- The graph reflects real entities and relationships.
- Graph positions can be saved.
- A selected graph node opens relevant details.
- Project and task information remains consistent across views.
- The dashboard uses real data.
- Basic search works.
- Workspace authorization is enforced.
- Responsive layouts are usable.
- Critical forms handle errors.
- Essential keyboard navigation works.
- The production build succeeds.
- The documented tests can be run.
- The repository has clear setup instructions.

After this first release is verified, expand into the additional modules.

Do not consider the product complete merely because its homepage looks impressive.

======================================================================
34. REQUIRED FIRST RESPONSE AND IMMEDIATE ACTION
======================================================================

Begin by inspecting the repository and environment.

Then briefly explain:

1. Existing environment findings.
2. Chosen architecture.
3. Main modules.
4. Initial implementation sequence.
5. Any genuine technical constraints.

Do not ask me to choose among several UI styles.

Make the design decisions yourself according to this document.

Do not spend the entire session producing planning documents.

Immediately proceed to creating or modifying actual project files.

After implementing a coherent slice:

- Run the relevant checks.
- Fix identified failures.
- Verify persistence.
- Update the implementation status.
- Continue to the next priority when possible.

Only present verified results as verified.

The finished codebase must be a real foundation for a large, useful software product.

======================================================================
35. FINAL QUALITY PRINCIPLE
======================================================================

NEXORA should deliver the impression of a serious, carefully engineered, unusually polished commercial application.

Every visual element should have a purpose.

Every important button should perform an action.

Every displayed metric should have a real source.

Every critical workflow should preserve data correctly.

Every important record should belong to the right workspace.

Every major module should follow a coherent architecture.

The flagship graphical interface should provide a genuinely new, convenient way to understand and manage connected work.

Build something that users could reasonably choose to use in their daily lives.

Do not build a beautiful illusion of a product.

BUILD THE PRODUCT.

Begin now.