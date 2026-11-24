# Stage review: R7 the API host composition (the last wiring of the host reuse review, 2026-11-24)

**What was built.** The remaining identity, platform and start-up wiring left the API host. A new Foundation project, `Adventures.Hosting`, is the composition layer of a full API host; the host is now its name, its assembly and the features it uses.

```csharp
await ApiHost.RunAsync(args, new ApiHostOptions
{
    ServiceName = "AiBlogResearch.WebApi", HostAssembly = typeof(Program).Assembly, AssemblyPrefix = "AiBlogResearch",
    Seeds = [.. DiagnosticsSeeds.All, .. IdentitySeeds.All, ...],
    RequiredSchemas = [...],
    AddServiceDefaults = ..., MapDefaultEndpoints = ...,
});
```

| Was in the API host | Now in `Adventures.Hosting` |
|---|---|
| `Program.cs` (187 lines: bootstrap logger, checks, live data, data mode, store choice, seeding, plug-ins, entities, start-up tasks) | `ApiHost.RunAsync` |
| `AppPlatformServices` (CORS, controllers, JWT, hardening, M2M, health cache, MCP client, AI triage) | `Wiring/PlatformServices` |
| `AppIdentityServices` (Postgres or Legacy sign-in) | `Wiring/IdentityServices` |
| `AppEntityServices` (tenancy, rights, mail, platform administrators, onboarding) | `Wiring/EntityServices` |
| `AppPipeline` (the part after the shared preamble) | `Wiring/ApiPipeline` |
| `RequestGraphScope`, `RuntimeController`, `LegacyModePlugins`, `LegacyUserProvisioning` | `Wiring/` and `Legacy/` |

The host project: 584 lines in 9 files, then 19 lines in 1 file. Its project file lists only the Hosting library, the Aspire defaults project and the feature libraries it names. The ratchet budget for the API host is now 30 lines (was 620) and the host may reference only `Adventures.Blog.Legacy` among store projects (for the legacy seeds); the store choice lives in the Hosting library.

**Why a library, and what it costs.** A second API host (the private project) now starts from the same options object and gets the store choice, seeding, the 503 reporting app, tenancy, rights, sign-in, plug-in discovery and the pipeline, instead of copying 560 lines. The Hosting project references 26 libraries by design (it is the composition layer, like `Adventures.Entities.NQuad` one level down); the architecture guards record each edge.

**Two small mechanics to know.** The Aspire service defaults live in an app project, so the host passes them in as two delegates. After the store and the data mode are decided, the Hosting library records them in two configuration keys (`Data:LegacyActive`, `LiveData:SkipSeedingActive`) so the later start-up step does not re-derive them.

**Verified.** The host tests (51) boot the real start-up in New mode, Legacy mode, with and without a connection string and in single-site mode, so they were the net; they pass unchanged. Foundation full suite (architecture guards updated), app API 65, MCP 91, NQuad browser 13, LegacyImport 16 pass. The built host output carries the same 25 seed files as before. I started the API host as a real process in Production on the memory store: `/` answers `{"service":"AiBlogResearch.WebApi","status":"ok"}`, `/api/runtime` answers, an anonymous `/api/admin/menu` is 401. Not verified: a live start against the production database, a live `Claude-verify.ps1`, a browser.

**Not done / open.** `AiBlogResearch.ServiceDefaults` keeps its app name (the standard Aspire defaults project). The NQuad browser host still composes itself (it is small and different: no identity or tenancy). The dev-login guard test now reads the Hosting folder for the single `AddDevLogin` call.
