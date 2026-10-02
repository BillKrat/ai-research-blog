# Architecture decisions — ai-research-blog

Distilled 2026-09-25 from the retired `SESSION_HANDOFF.md` (466 lines of dated session narrative; full text is in git history before that date). Only decisions that still shape the code are kept. Incidents, resolved bugs, and abandoned plans were dropped unless they explain a "don't do this" rule.

**How to treat these:** each was reached by deliberate discussion, not decree. Revisit through an equally rigorous discussion, not by silently overriding and not by treating it as untouchable.

## Product

`ai-research-blog` is an open-source **AI starter kit**: cheap and learnable for developers standing up their own AI-assisted research/blog system. Cost near zero is a design constraint (it drove the auth decision below). It replaces the legacy BlogEngine.NET site (`BlogAI` repo, adventuresontheedge.net), which stays live and untouched by new-stack work.

## Stack

- **Client:** Angular (latest, created with the Angular CLI, not Visual Studio's SPA template) + **Angular Material**. PrimeNG was dropped: v22 requires a paid/registered license and injects a banner without a key. Don't re-add it without planning for the account signup.
- **Backend:** ASP.NET Core Web API (`AiBlogResearch.WebApi`) plays the **MCP Host** role. Planned: an `AiBlogResearch.McpHost` library exposing `IResearchAgent`, registered by DI (not yet built).
- **AI:** Microsoft Agent Framework (Semantic Kernel is maintenance-only) plus the official `Anthropic` C# NuGet package.
- **Local orchestration:** .NET Aspire (`AppHost` + `ServiceDefaults`); Angular is added with `AddNpmApp`. Solution format is `.slnx`.
- **Node:** install system-wide (v24+; Angular 22 rejects older). No PATH-prepending hacks in `AppHost.cs`; they were tried and abandoned.
- **Editors:** Visual Studio for .NET; VS Code Insiders for the Angular client. VS-side TypeScript debugging is not pursued.
- **No Python** in this stack.
- **Why not Blazor:** single-vendor client-framework risk (Silverlight/WPF/UWP precedent), small community. Angular compiles to portable static JS, MIT, and has a low-pain upgrade history. MCP itself is not single-vendor risk: it sits under the Linux Foundation's Agentic AI Foundation.

## Hosting and deploy

- SmarterASP.NET, one site per app pool with scoped FTP credentials. `global-webnet.com` (Angular), `api.global-webnet.com` (WebApi) and `mcp.global-webnet.com` (McpServer) are the **dev** environment all new work targets. `adventuresontheedge.net` is live production of the legacy blog: never touch it from here.
- Deploy is GitHub Actions building each app and FTP-deploying on **push to `main`** (SmarterASP's own GitHub Deploy is Node-only and unusable). Hence the rule: never push to `main` without the human's go-ahead.
- The `/BlogAi` virtual-path idea (new stack under the legacy site) is scrapped; there is no plan to put the new stack under adventuresontheedge.net. Domains `adventuresEdge.net` and `blogresearch.net` are still on Railway and move at beta.
- Setup walkthrough for others: [Claude-developer-setup-guide.md](Claude-developer-setup-guide.md).

## Security and identity

- **Custom JWT, not Auth0.** Auth0's free tier allows only 1,000 machine-to-machine tokens a month, and the MCP design makes M2M calls the core request path. A starter kit can't require paying just to run. `Adventures.Security` (now in `Adventures.Foundation`) issues and validates HMAC-SHA256 JWTs and implements OAuth2 client credentials (`IClientCredentialStore`, salted hashes, constant-time compare, per-scope authorization policies). This is permanent for this project; a fork may swap in an external IdP.
- Real user login lives in `Adventures.Identity` (entity store + vault) and is wired into `AuthController` (2026-09-21). The demo-user placeholder is gone.
- Signing keys and credentials live in `dotnet user-secrets` locally and env vars/secret store in production. Never commit them.

## Data

- **Postgres, JSONB hybrid + W3C N-Quads:** boring always-queried fields get indexed structure; the long tail of ad hoc and tenant-authored fields stays as triples. Any real-scale build needs a subject/predicate composite index and a b-tree on any search-value column.
- The dev database is SmarterASP-hosted Postgres. Local Docker Postgres was abandoned: Docker Desktop cannot run in Windows-on-Parallels (hard platform limit).
- Recurring gotcha: Dapper record materialization needs `DateTime`, not `DateTimeOffset`, for Npgsql `timestamptz` and SQL Server `datetime` columns.

## Entity model (agreed 2026-09-20; mostly not yet built)

Reconciles the `poc` repo's in-memory N-Quad vision with the JSONB-hybrid decision.

1. **Option B.** ~95% of a Dal/Bll is mechanical, so extract `GenericDal<T>`/`GenericBll<T>`. Product-defined, security-critical entities (User, credentials, tokens) get thin, named, versioned subclasses that override only real business rules. Tenant-authored entities use the generic engine with no subclass. `ICrudlDal<T>` is the backend-swap boundary; one `User : DynamicEntity` shape serves every backend. Name a Dal after what it actually talks to (`NQuadDalBase`, not `MsSqlDal` for an HTTP-fronted source). Option A (zero per-entity code, security rules as data) was rejected.
2. **Schema-driven field metadata** (not built): `encrypted`, `searchable`, per-field role requirement, `version`, and a value-transform property replacing the POC's hardcoded `mailto:` rule.
3. **PHI/PII gets two representations:** a vault value (AES-256-GCM, random nonce, reversible) and, only if searchable, a separate HMAC-SHA256 search value over the normalized plaintext, keyed by an HKDF-derived key distinct from the vault key. A merged deterministic ciphertext was rejected (permanent equality map for anyone who exfiltrates the table). Search is exact-match only. The search key still needs rotation and access discipline: a leaked key permits offline dictionary confirmation. Root keys must live in a real KMS outside the app's storage; the provider is unchosen (an env-held key is prototype-only).
4. **Security/identity schemas are structurally excluded** from any tenant schema editor.
5. **Role-based field filtering happens at materialization**, before the entity is built, never in the serializer or the UI.
6. **Point-in-time reproducibility, two axes.** *Fidelity* (how an approved record rendered) is versioned: coexisting Bll implementations under keyed DI, chosen by the version stamped on the record, never by the caller (downgrade attack). *Access* (field permissions) is never versioned and always current, so replaying old logic cannot leak what today's policy redacts. Applies only to **Approved snapshots** of blogs and their documents; editing one is a one-way, warned action that re-enters through current logic. Attached files are content-hash addressed and never overwritten; viewing a snapshot writes its own access-log entry.
7. **Indexing:** the POC's full-scan `List().Where(...)` is fine at POC scale only.

Built so far: `Adventures.Entities` with `FieldValue(id, value)` so update/delete can target the originating record, and `NQuadUserAdapter`. Not built: Generic Dal/Bll, schema-authoring UI/API, encryption and KMS, role filtering, version-keyed Bll, multi-tenant graph scoping.

## MCP architecture

- One consolidated **`mcp.global-webnet.com`** server, called by the WebApi (Host) over M2M auth. This replaced the earlier plan of separate FileSearch and Database server processes.
- Tool sets (PostgreSQL, SQL Server, file system, later others) are separate class libraries **composed via MEF**. Deciding requirement: a third party can drop a compiled assembly in a folder, with no host rebuild and no source access, as BlogAI's `BlogEngine.Wiki` extensions already allow. Don't revisit "just use DI" unless that requirement changes.
- Each tool library is built TDD, with the test project standing in for the future MCP Server calling the tool.
- Live so far: a scoped-down pipeline shakedown (2026-09-23), a single M2M-authenticated hello-world endpoint that the WebApi health check calls. MEF loading, the real Host/Server logic, and the tool modules are not started. Diagram: [Claude-solution-uml.jpg](Claude-solution-uml.jpg).
- Seeded M2M scopes today: `mcp.postgres.query`, `mcp.filesearch.search`; new scopes per tool domain are unnamed.

## Vision and parked work

- **"BlogAI (new)"** is a spinoff, not a replacement: a developer-review tool. As AI writes more code, it auto-generates review blogs (concepts, Mermaid sequence diagram, code overview, tagged to PBI/Task) so a human can approve without reading every line. This repo's stage-review convention is the manual version of it.
- **Parked, about two years out, do not design further without a near-term trigger:** (1) an interim authoring tool against the live BlogAI through a new minimal HTTP endpoint on BlogAI itself (not raw SQL Server access, not a BLL reference); (2) a permanent one-way BlogEngine.NET migration feature, built last against the *core* BlogEngine schema (BlogAI's only deviation is its GwnWiki extension). The `poc` repo holds a not-started spec for a `BlogTools.SqlServer` library toward (1).

## Working across machines

The Mac home directory is mounted as `M:\` in Windows (Parallels): same files, one `.git`, not clones. Windows is the primary dev machine. Claude Code peer messaging does not bridge Mac and Windows; don't retest. Git gotchas on the shared mount (`core.fileMode`, autocrlf, per-OS `node_modules` binaries): see the `dev-tools` repo.

## Reference

- [Claude-ai-system-architecture.opml](Claude-ai-system-architecture.opml): design-rationale backup of the MindMapAI concept map (UI, Agent, Model, Tool, Retrieval, Memory, Security, MCP Host, MCP Server). Keep it in sync with the canvas.
- [assets/20260920_182633_rdd-ai-development.jpg](../assets/20260920_182633_rdd-ai-development.jpg): the same concept map as an image (also embedded in the README).
