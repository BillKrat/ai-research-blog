# Architecture principles — ai-research-blog

Context document for code reviews. Written 2026-10-11 by Claude from the sources the human named in the Blog AI Design page (https://adventuresontheedge.net/blogai/page/blog-ai-design, 3 Oct 2026). Code is reviewed against these; a violation becomes a candidate for human + Claude discussion, which decides *refactor* or *leave as-is with a comment noting why*. A principle is never "failed" silently.

## Sources and their standing

| Source | Standing | Read |
|---|---|---|
| `docs/architecture/AppArchGuide2.0.pdf` (Microsoft patterns & practices, Application Architecture Guide 2.0a) | **Source of truth** | Ch. 3 (guidelines), 10 (presentation), 11 (business), 12 (data), 15 (web archetype) in full; the other chapters only by outline |
| MVPVM Design Pattern, Bill Kratochvil, MSDN Magazine, Dec 2011 (learn.microsoft.com, `…/2011/december/mvpvm-design-pattern-…`) | **Source of truth.** Not in `docs/architecture`; read online | Whole article |
| `docs/architecture/PotelPaper.pdf` (Potel, Taligent MVP, 1996) | Reference, not source of truth | Whole paper. The last paragraph of the file is appended web-scraped text with errors; ignored |
| `docs/architecture/TwistingTheTriad.PDF` (Bower and McGlashan, Dolphin MVP, 2000) | Reference, not source of truth | Whole paper |

Chapters 4 to 9 and 13, 14, 16 to 21 of the App Arch Guide are not summarised here; add rules from them when a review needs them.

## The principles

IDs are stable so reviews can cite them.

### A. Layering and the Presenter pattern (MVPVM)

- **A1. Layers.** Presentation → Business (BLL) → Data access (DAL). Calls go downward only; no upstream dependencies. The BLL knows nothing of the presentation layer; the DAL knows nothing of business processes. (AppArch 3, 11, 12)
- **A2. Only the DAL touches persisted data.** Connection strings, files, REST endpoints and persisted Model objects belong to the DAL, which returns domain objects. The BLL works only with domain objects and interfaces and gets its DAL by DI. (MVPVM; AppArch 11, 12)
- **A3. No data access in the BLL, no business rules in the DAL, no business logic in the UI/presentation layer** beyond input/data validation. Do not mix component types within a layer. (AppArch 3, 10, 11)
- **A4. The Presenter's dependencies are the BLL interfaces** (plus its View and ViewModel). The Presenter is the starting point for understanding a screen. (MVPVM)
- **A5. Only the Presenter is tightly coupled.** It is coupled to View, ViewModel and BLL interfaces. View and ViewModel stay decoupled from each other, so a View can use different ViewModels and a ViewModel serve different Views. The Presenter wires the two (sets the DataContext). (MVPVM)
- **A6. The ViewModel has no application business logic**, so it is reusable across views and apps; change notification is how the View learns of new data. (MVPVM)
- **A7. Presenters are not meant to be reused**; they carry the business logic/rules of one concern. When a presenter *is* reusable across applications, it belongs in a module/library coded against interfaces and resolved by DI (MEF or Unity in the article). (MVPVM)
- **A8. In a web application the presentation→business interface is message-based** (DTOs/coarse-grained messages, a façade), even in one process. (AppArch 3, 15)
- **A9. Abstraction between layers**: interfaces/abstract bases, dependency inversion. Consistent design pattern within a layer (e.g. do not mix Repository and Table Data Gateway). (AppArch 3, 12)
- **A10. Composition over inheritance; avoid "Blob" base classes.** (AppArch 3)

### B. Design hygiene

- **B1. Separation of concerns, single responsibility, least knowledge, DRY**: one component per functionality, no duplicated functionality. (AppArch 3)
- **B2. Keep cross-cutting code (logging, security, validation, exception handling) out of business logic** and centralised. (AppArch 3)
- **B3. Consistent naming conventions.** (AppArch 3)
- **B4. Evolve the design; avoid big design up front.** (AppArch 3)

### C. Web application concerns (AppArch 15, 10, 11, 12)

- **C1. Validation.** Validate every input crossing a trust boundary on the server, for length, range, format and type; client-side validation is for UX only. Validate again in the BLL. Centralise and reuse rules.
- **C2. Authentication.** Authenticate at trust boundaries; store only password hashes; enforce lockout and strong password policy; no plaintext passwords on the wire.
- **C3. Authorization.** Authorize across trust boundaries; role-based for business decisions, resource-based for auditing; avoid over-fine granularity.
- **C4. Exception management.** Catch only what you can handle or must annotate; never use exceptions for control flow; separate business errors (friendly message, retry) from system exceptions (log, generic message); global handler; exception shielding (no internals or sensitive data to the user); the DAL handles data-source exceptions and passes on only what affects the caller.
- **C5. Logging and audit.** Centralised, configurable, no sensitive data; audit user-management events and business-critical operations at the point of resource access.
- **C6. Statelessness and session.** BLL stateless; avoid server affinity (no local state that must be synchronised in a web farm).
- **C7. Caching.** Cache ready-to-use data, never volatile or unencrypted sensitive data; do not depend on the cache holding.
- **C8. Navigation and layout.** Navigation separate from processing and UI components; templates/master layout and composite views; CSS for layout; design for accessibility, localisation and different devices.
- **C9. Configuration and secrets.** Least-privilege accounts; sensitive configuration protected; admin UI for configuration where appropriate.
- **C10. DAL practice.** Connections opened late, released early; batch to reduce round trips; data integrity enforced in the database; do not couple the application model to the schema (mapping layer).
- **C11. Concurrency.** Choose a model (optimistic/pessimistic) deliberately; avoid long locks.
- **C12. Testability.** Passive View / presenter-centred design, loosely coupled units, inputs and outputs defined up front.

### D. Project-specific requirements from the Blog AI Design page

- **D1.** BlogAI (BlogEngine.NET 3.3.6 fork) is the source of truth for design. Keep all its features; first iteration is a one-to-one port of how BlogEngine did processing (fields and data handling), reusing classes and porting AngularJS logic where feasible. Modernise BLLs/DALs later, by priority.
- **D2.** SQL Server tables keep the same schema **except Contacts**, which is dropped. For ai-research-blog the schema is expressed as generated N-Quad schemas that match the legacy SQL schema; only N-Quads in the new app, legacy SQL stays as is. Migration from an existing BlogEngine must be seamless.
- **D3.** BLL/DAL layering matters. **Versioning**: data backward and forward compatible; BLL/DAL versions locked so a migrated legacy blog keeps its legacy BLL/DAL while new features arrive as versioned fields/BLLs/DALs that users opt into.
- **D4.** Plugins and Widgets are built with **MEF**: one pattern for blog developers, supporting both compiled code and a monitored folder.
- **D5.** Start order: Admin > Users (Profile, Roles, Users, Contacts) as the place to flesh out **dynamic Angular forms generated from N-Quad data**, with parent/child relationships and the parent's data in a grid; then CRUDL for Posts and Pages.
- **D6.** Tenancy: Tenant 1 = www.Global-Webnet.com (no other tenants yet, but code supports tenants). Organisation = a Blog. Roles apply to both Tenant and Org; tenant roles apply to every org.
- **D7.** Admin sections to be completed in order on the page: Dashboard, Content (Posts, Comments, Pages, Categories, Tags), Custom (Themes, Plugins, Widgets), Users (Profile, Roles, Users, Contacts), Settings (Basic, E-Mail, Feed, Comments, Controls), About.

### E. Earlier agreed decisions that still bind (see `Claude-architecture-decisions.md`)

Custom JWT instead of an external IdP; Postgres JSONB hybrid + N-Quads; Option B (generic Dal/Bll with thin named, versioned subclasses for security-critical entities); MEF for MCP tool sets; point-in-time reproducibility rules for approved snapshots.

## How the web client maps to MVPVM (needs the human's decision)

The sources are written for WPF, where the View is XAML. For this stack the mapping is *not yet agreed*. The code currently does this: the **Presenter and ViewModel live on the server** (`EntityPresenter<T>` builds an `EntityFormModel`), and the Angular app is a thin renderer plus per-page components that call services. Potel's client/server section explicitly allows the presenter to straddle client and server ("most of the presenter code on the server with a thin client" is the classic web arrangement), so this is defensible, but it is a choice, not something the sources dictate. See the review's discussion item D-1.
