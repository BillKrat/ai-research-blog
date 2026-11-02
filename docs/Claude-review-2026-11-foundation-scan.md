# Review: Foundation and app scan against separation, reusability and project placement (2026-11-02)

Owner: Claude. Requested by the human (2026-11-02), who held back his own findings until this evaluation was done; they have **not** been read or used here. The human's final review decides what goes into beta.

## 1. Method and its limits

- **Scope.** Every tracked `.cs`, `.csproj`, `.xaml` file of `Adventures.Foundation` (346 files, 29 projects) and `ai-research-blog` (110 files, 14 projects), plus the file names and cross-library imports of the five Angular libraries (`client/ai-blog-research-ui/projects/*`, about 140 files).
- **What "purpose" means.** Taken only from what the file states: its `<summary>` comment, its declared types and base types, its `using` lines, and the `ProjectReference`/`PackageReference` lines of its project. Nothing was inferred from a file name. Where a file states no purpose, the report says so (section 5).
- **Not done.** Method bodies were not read line by line; the Angular `.html`/`.scss` files and the `.nq`/`.sql` seeds were listed, not read. A claim below is either quoted from a file or backed by a grep, named in the evidence column. Items marked *check* are reads I did not complete.
- **Criteria.** (1) Separation of concerns, (2) Reusability, (3) the proper project. Rules are cited as R-n from `Claude-architecture-reference.md`; findings the refactor already fixed are not repeated.
- **Reproduce.** `docs/Claude-scan-inventory.ps1 -Repo <name> -Out <file>` regenerates the per-file inventory (file, line count, types, stated purpose, cross-project usings).

## 2. Verdict per project

S = separation, R = reuse, P = right project. **ok** / **watch** (works, will hurt later) / **fix** (fix before beta, see section 3).

| Project | What it states it is | S | R | P |
|---|---|---|---|---|
| Adventures.Ioc | lifetime markers, convention registration | ok | ok | ok |
| Adventures.Common | exceptions, Bll/Dal/Presenter markers, and the Diagnostics group (Triage, Redactor, LogSearch, probes) | watch | fix | watch (F2) |
| Adventures.Security | hashing, JWT issue, client credentials, ambient principal | ok | watch | ok (F8) |
| Adventures.Security.AspNetCore | auth handlers, JWT registration, `HttpContextPrincipal` | ok | ok | watch (F8) |
| Adventures.Entities | generic entity model, plus diagnostics entities, identity entities, rights, tenants | fix | watch | fix (F1) |
| Adventures.Data | JSONB `Entity`, `Triple`, `ISqlExecutor`, `DataMode` | watch | watch | watch (F4) |
| Adventures.Data.NQuad | N-Quad store, entity repository, schema reader, relation writer, guards, all seeds | fix | watch | fix (F3) |
| Adventures.Data.Postgres | Npgsql executor, record repository, triple store, SQL scripts | watch | watch | watch (F4) |
| Adventures.Data.Sql | SQL Server executor | ok | ok | ok |
| Adventures.Identity | login, credentials, provisioning, dev sign-in | watch | fix | ok (F5) |
| Adventures.Identity.Postgres | Postgres credential store | ok | ok | ok |
| Adventures.MEF | stored on/off state of plug-ins | ok | ok | fix (F9) |
| Adventures.Collaboration | collaboration items, conversation, plug-in definitions | watch | watch | ok (F6) |
| Adventures.Blog | posts, pages, taxonomy, public read side, media, migration | ok | watch | ok (F6) |
| Adventures.Blog.Postgres | media store | ok | ok | ok |
| Adventures.Blog.Legacy | Dals over BlogEngine tables | ok | ok | ok |
| Adventures.Blog.WebApi | blog controllers | ok | ok | ok |
| Adventures.WebApi | controller bases, correlation id, hardening, rights, tenancy, admin menu, AI triage, failure journal, probes | fix | fix | watch (F7) |
| Adventures.Client | desktop view models and remote presenter | ok | ok | ok |
| AiBlogResearch.WebApi | main API host | fix | fix | fix (F10) |
| McpServer.WebApi | MCP protocol, diagnostics tools, legacy-data tools | fix | fix | fix (F11) |
| NQuadBrowser.WebApi | browser host (55-line `Program.cs`, one controller) | ok | ok | ok |
| AiBlogResearch.Desktop | WPF host, composition root, views | ok | watch | watch (F12) |
| AiBlogResearch.AppHost, ServiceDefaults | Aspire host, shared defaults | ok | ok | ok |
| tools/LegacyImport | legacy import tool | watch | n/a | fix (F11, F13) |
| Angular libraries (5) | `@adventures/*` packaged client | watch | watch | watch (F14) |
| Test projects | see F15 | watch | | watch |

## 3. Findings

Each finding: what the files say, which criterion, and a suggested direction. Directions are suggestions for the human's final review, not decisions.

**F1. `Adventures.Entities` is three libraries in one (criteria 1, 3).**
Evidence: the digest of its 53 files. Generic model (`DynamicEntity`, `EntityBll`, `EntityDal`, `EntityPresenter`, `EntitySchema*`, form/grid models, validator, relations) sits beside the exception log (`ExceptionLog*`, `ExceptionSignature*`, `DiagnosticsReader`, `ClientReportedException`, `PersistedFailureException`) and the identity model (`User`, `Role`, `Tenant`, `Organization`, `Blog`, the two role-assignment entities, `Rights`, `RightsResolver`, `RoleRightsEditor`, `RoleRightsUpgrade`, `TenantResolver`). `EntityConstants.cs` names `User`, `ExceptionLog`, `Identity`, `Legacy`, `Lifecycle` inside the generic project, and `Blog.cs` says it lives here on purpose. A consumer that wants the generic model gets the security and exception model too.
Direction: keep generic in `Adventures.Entities`; move exceptions to a diagnostics-entities project and users, roles, rights, tenants to an identity-entities project (or into `Adventures.Security` model code); split `EntityConstants` by owner.

**F2. Diagnostics inside `Adventures.Common`, with workspace knowledge hard-coded (criteria 1, 2).**
Evidence: `Common/Diagnostics/Triage.cs` line 34 builds a command line naming `.\docs\Claude-secret.ps1`, the vault name `m2m/claude-diagnostics/claude-diagnostics` and `CLAUDE_DIAG_SECRET`. That is this workspace's tooling, inside a library any adopter would reference. `Triage`, `Redactor`, `LogSearch` are a diagnostics feature, not "common". No file in `Common` uses `IServiceCollection` (grep), yet the project lists two DI packages (*check* whether Ioc already supplies them).
Direction: a `Adventures.Diagnostics` project; the hand-off command comes from configuration or a registered formatter, never from a literal.

**F3. `Adventures.Data.NQuad` holds a store, a repository, business rules and every feature's seed (criteria 1, 3).**
Evidence: `NQuadRelationWriter.cs` declares `LastTenantAdministratorGuard` and `SelfLockoutGuard`, rules about tenant administrators, in the data project (R6, R7). `NQuadUserAdapter.cs` builds a `User` in the store project. `Sql/seed/` ships 18 files including content, collaboration, plugins, role rights; `BlogConstants.cs` says its seeds stay here "until the Data split (S5)", and that split left them. The csproj lists `Npgsql` and `Dapper`; `NpgsqlNQuadStore.cs` and `Sql/schema-nquads.sql` live here although `Adventures.Data.Postgres` exists for Postgres code. `NQuadStoreProbe` uses `Common.Diagnostics` through Entities only.
Direction: move the two guards to the identity layer (they are rules), seeds to their feature projects (embedded, registered by each feature's `AddXxx`), the Npgsql store to a Postgres project; leave the store contract, in-memory store, repository, schema reader.

**F4. Two data stacks side by side (criteria 1, 3; R5).**
Evidence: `Adventures.Data` defines the older `Entity`/`Triple`/`IEntityRecordRepository`/`ITripleStore`; `Adventures.Identity` (`UserAccountService`, `UserProvisioning`, `UserAccount`) and `Adventures.Identity.Postgres` use it, while every other feature uses `IEntityRepository<T>` of the N-Quad stack. `DataMode` (a host-mode switch, New or Legacy) is declared in `Adventures.Data`. `Data.Postgres/Sql/seed-global-webnet-accounts.sql` carries this installation's tenant and account names inside the library.
Direction: decide one store for credentials and users; move `DataMode` to the host layer; account-seed scripts belong to the app repo.

**F5. A fixed dev sign-in ships in the reusable `Adventures.Identity` (criteria 2, security).**
Evidence: `DevLoginAccountService.cs` states the account `Admin` with the password `Password`, "accepted only on a developer machine"; the app has a guard test that it is registered only in Legacy mode. The gates are tested, but the code and the well-known credential travel with every consumer of the library.
Direction: move it to the app (or a dev-only package); keep the guard tests where it lands.

**F6. Blog depends on Collaboration; Comment sits in Collaboration with content IRIs (criteria 1, 3).**
Evidence: `Adventures.Blog.csproj` references `Adventures.Collaboration`; `PostBll`, `ContentAuthoring`, `PostConversationTarget` use it. `Collaboration.cs` line 28 to 30 puts `Comment` under `schema.global-webnet.com/content/` and `content#Comment`. The inversion through `IConversationTarget` is sound; the remaining coupling is the approval state and the shared Comment IRIs. `BlogConstants` and `Collaboration.cs` also fix the IRI base to `global-webnet.com` (a recorded convention, but an adopter cannot change it without editing the library; *question for the human*).
Direction: confirm the direction Blog to Collaboration is intended; consider the IRI base as configuration.

**F7. `Adventures.WebApi` mixes web infrastructure with an AI client, a failure journal and an app-topology probe (criteria 1, 2).**
Evidence: it holds controller bases, `CorrelationId*`, `RequestHardening`, `RightsAuthorization`, `AdminMenu`, `SiteDomain`, the tenancy middleware and options, and also `AiTriage.cs` (354 lines, an Anthropic options class and client), `FailureJournal`, `FailureReporter` (hosted services), and `DependencyProbes.cs` whose summary names "mcp's `api/hello`" (one particular deployment topology). Its csproj references only Entities and Security, so the diagnostics types arrive transitively.
Direction: split into web core, tenancy, diagnostics (journal, reporter, handler, AI triage), with the probes registered by the host.

**F8. Role and policy names in the generic security libraries (criteria 2, 3).**
Evidence: `WellKnownClaims.cs` lines 17 to 20 define `TenantAdminRole` and the policy `Role:TenantAdmin`; the three auth handlers and `JwtServiceCollectionExtensions` in `Security.AspNetCore` are in namespace `Adventures.Security`, not `Adventures.Security.AspNetCore`, so a reader cannot tell from `using` which package a type needs.
Direction: role names to the identity model; align namespaces with projects.

**F9. `Adventures.MEF` is not MEF (criterion 3).**
Evidence: its two files hold `Plugin` (an entity), `IPlugins`, `Plugins` (stored on/off state) and the registration. Nothing in it uses the Managed Extensibility Framework (usings listed in the digest). It references Entities.
Direction: rename to what it is (plug-in state), or build the extension point its name promises.

**F10. `AiBlogResearch.WebApi` owns controllers that any host would need (criteria 1, 2; R13).**
Evidence: `AuthController`, `M2MAuthController`, `UsersController`, `RolesController`, `ProfileController`, `LookupsController`, `TenantController`, `PluginsController`/`RequiresPluginAttribute`, `CollaborationControllers`, `ConversationController`, `AdminDiagnosticsController`, `AdminExceptionsController`, `ClientErrorsController`, `HealthController`, `HealthSnapshotCache`, `ReviewQueue`, `AdminMenuController` live in the app project; `NQuadBrowser` had to write its own `BrowserController` and `BrowserAuth`. `Program.cs` is 473 lines (the reference counted 429 on 2026-10-31) and the project references 17 Foundation projects. Blog controllers were moved (S3); these were not.
Direction: `Adventures.Identity.WebApi`, `Adventures.Collaboration.WebApi`, `Adventures.Diagnostics.WebApi`, each with one `MapXxx` entry; `Program.cs` shrinks to composition.

**F11. `McpServer.WebApi` carries a protocol, tools and a second SQL path (criteria 1, 2, 3; R7).**
Evidence: `McpController.cs` is 508 lines for one class; `BlogAiReader.cs` opens `Microsoft.Data.SqlClient` itself although `Adventures.Data.Sql` provides `SqlServerExecutor`; `LegacySchemaSeed` (a generator of N-Quad seeds) is in this web app and is consumed by `tools/LegacyImport`, whose csproj references `McpServer.WebApi` (a tool referencing a web host).
Direction: a protocol library (JSON-RPC, tool registration) separate from the tool set; BlogAi reads through the Foundation SQL executor; move the seed generator and shared legacy types to a library both reference.

**F12. Generic WPF views live in the app (criterion 3).**
Evidence: `EntityListView`, `EntityEditView`, `SignInView` (XAML plus code-behind) sit in `AiBlogResearch.Desktop`, while their view models are in `Adventures.Client`. The split between "library without UI" and "host" is clean; a second desktop app would copy the views.
Direction: optional `Adventures.Client.Wpf`; low priority.

**F13. Same type name in two namespaces (criterion 3; R16).**
Evidence: `public static class LegacyIds` in `Adventures.Blog.Legacy/Sql/LegacyBlog.cs` and in `tools/LegacyImport/LegacyIds.cs` (grep).

**F14. Angular libraries are Foundation-shaped but live in the app repo (criterion 3).**
Evidence: five libraries named `@adventures/core`, `entity-ui`, `collaboration`, `blog-reader`, `admin` sit under `client/ai-blog-research-ui/projects`. `core` holds `media.service.ts` and `profile.service.ts` (blog and profile specifics) and `entity-form.model.ts`; `blog-reader` imports `@adventures/collaboration`; `admin` holds `login`, `tenant.service`, `health.service`, `plugins.service`, `rights-checklist` (the app's own admin). The layering is enforced by `library-layering.spec.ts`.
Direction: for the human: should the generic two (core, entity-ui) move to the Foundation repo, the rest stay with the app.

**F15. Test projects (criteria 1, 3).**
Evidence: `Adventures.Tests` is test support (`TestIocBase`, mock Foo/Bar/Mvp types) yet named like a test project; `MvpVmTests` (tests of those Ioc mocks) lives in `Adventures.Common.Tests`; `NQuadStoreToolTests` says it "doubles as the purge/reseed/query tool". `RecordingExceptionLog` exists twice (inside `UnhandledExceptionHandlerTests.cs` and as its own file in `AiBlogResearch.WebApi.Tests`); fakes of `ISqlExecutor`, `IEntityRecordRepository` repeat across test projects. Projects with no test project of their own (their tests sit elsewhere): `Adventures.Data`, `Data.Sql` (tested through `Blog.Legacy.Tests`), `MEF` (through `Collaboration.Tests`), `Identity.Postgres`, `Blog.Postgres`, `Blog.WebApi` (through the app tests).
Direction: a `Adventures.Testing` support project; tests follow the project they test.

## 4. Sound as it stands (kept)

- `Adventures.Ioc`, `Security` core (hashers, JWT, client credentials, ambient principal), `Data.Sql`, `Identity.Postgres`, `Blog.Postgres`, `Blog.Legacy` (one Dal per table over `LegacyDalBase`), `Blog.WebApi`, `Client` (no UI toolkit; targets plain `net10.0`), `ServiceDefaults`, `AppHost`.
- `NQuadBrowser.WebApi` is the proof of reuse: 55-line `Program.cs`, one controller, five Foundation references. Its test says it "must be buildable from the reusable libraries alone".
- The architecture guard (`Adventures.Architecture.Tests`, `DependencyRulesTests`, 271 lines) and `RepositoryLayoutTests` hold the project graph in place.

## 5. Files with no stated purpose

Source files whose first lines carry no summary (purpose not stated, so not described): Foundation `Common/IBll.cs`, `IDal.cs`, `IPresenter.cs`, `Entities/User.cs`, `Ioc/IScopedLifetime.cs`, `ISingletonLifetime.cs`, `ITransientLifetime.cs`; app `AppHost.cs`, `ServiceDefaults/Extensions.cs`, `AiBlogResearch.WebApi/Program.cs`, `McpServer.WebApi/Program.cs`, `McpServer.WebApi/HealthController.cs`, the four Desktop code-behind files.

## 6. Questions for the human

1. F5: is a fixed dev sign-in acceptable inside the shared library for beta, or must it leave?
2. F6: IRI base `global-webnet.com` in the libraries: constant, or configuration?
3. F14: do `core` and `entity-ui` move to the Foundation repo?
4. Order: which of F1, F3, F10 first? They touch the same registrations and should not run in parallel.
