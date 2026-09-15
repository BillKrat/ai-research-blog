# Session Handoff — AI Research Blog Rebuild

Status as of 2026-09-14. Read this first in any new session before touching architecture or deployment — it's the source of truth for decisions made so far, so nothing above it should be reconstructed from memory or re-litigated without reading this.

**Current branch: `rebuild/dotnet-angular-scaffold`** (off `main`), one commit, not yet merged/pushed — today's full scaffold (see below) is committed there.

## Immediate next session: deployment (reprioritized ahead of McpHost/MCP servers)

**Objective: local dev loop AND a deployed WebApi + Angular client both working by end of that session.** Concretely:
1. Browse the actual SmarterASP.NET control panel / `global-webnet.com` site setup (see "Hosting reality" below for account/site details already known) to determine the most efficient deploy path for *this* project's shape — don't assume VSDeploy vs GitHub Deploy in advance, look at what's actually there first.
2. Get the WebApi deployed and reachable first.
3. Angular's `dist/` output will likely need a manual build + FTP upload (`ng build` doesn't auto-deploy) — but hold off on solving that until the WebApi side is actually working, per the user's own sequencing.
4. This is the **first deploy of the new stack to `global-webnet.com`** (the DEV site) — nothing from today's session has touched hosting yet.

## Then: Security / Auth (foundational, blocks most feature work after)

User is leaning toward **building a minimal, in-house Auth0-style auth service** rather than adopting a third-party IdP — "at minimal scale to get the job done." Explicitly called out as foundational to everything going forward, so it comes right after deployment is working, before McpHost/MCP-server/agent work resumes. No design decisions made yet on this — user wants a tech assist (options, tradeoffs, scope-appropriate architecture) when that session starts. Worth weighing against the project's own stated vendor-risk framework (see "Why not Blazor / Python" below) if a third-party option comes up again: rolling your own auth has its own well-known risk profile (session/token handling, password storage, key rotation) that's worth naming explicitly rather than assuming "minimal scale" avoids it.

## Where the project actually is right now (updated 2026-09-14)

**First 7 objectives complete and verified end-to-end** (Windows session): Python skeleton purged, Aspire solution scaffolded, Angular 22 + Angular Material client built, WebApi health-check controller wired, Angular calls it through the dev proxy, and `dotnet run` on the AppHost brings up both WebApi and Angular together locally. Confirmed working in-browser (dark-by-default theme, toggle to light, green "healthy" badge from a live `/api/health` call).

**Actual solution layout** (matches the originally planned layout below, minus the not-yet-built MCP servers/McpHost — those are still future work):
```
AiBlogResearch.slnx                          ← .NET 10 uses the new XML solution format by default now, not .sln
├── AiBlogResearch.AppHost/                  ← wires webapi + angular together, dotnet run starts both
├── AiBlogResearch.ServiceDefaults/
├── src/
│   └── AiBlogResearch.WebApi/               ← controllers-based (dotnet new webapi -controllers); HealthController at /api/health
└── client/
    └── ai-blog-research-ui/                 ← Angular 22, Angular Material (not PrimeNG — see below), Vitest for unit tests
```

**PrimeNG was dropped for Angular Material — do not re-add PrimeNG without new evidence.** PrimeNG v22.1.1 (current "latest" as of this session) turned out to require a paid "PrimeUI" license — its own `package.json` now describes it as a "premium UI library," and without a configured license key it injects an "Invalid PrimeUI License" banner into the running app via a shadow-DOM element (`primeng/license`'s `showInvalidLicenseBanner`). A free "Community License" does exist for individual developers/small orgs (this project would qualify), but obtaining it requires registering an account at primeui.dev, which is outside what an agent can do on the user's behalf. Given that, the call was to switch to Angular Material (Google-backed, MIT, no account/license step ever) instead of pausing the whole build on an external signup. **If PrimeNG is ever reconsidered, that account-registration step is the blocker to plan around, not a technical one.**

**Node version saga — resolved 2026-09-14, system Node is now v26.8.2, no PATH workarounds remain.** The original system Node (v22.15.1 at `C:\Program Files\nodejs`) was too old for Angular CLI 22 (requires ^22.22.3/^24.15.0/>=26, hard-fails otherwise). Two scoped, non-admin workarounds were tried and abandoned in turn: (1) `fnm`-managed Node 24 with manual PATH exports per command — worked for the agent's own Bash tool calls, but its multishell junctions don't survive across separate shell processes, so it wasn't reliable as a general fix; (2) an `AppHost.cs`-level `Environment.SetEnvironmentVariable("PATH", ...)` prepend, scoped to just this project — this genuinely fixed *Aspire's own* npm resolution (verified: the dashboard's console logs showed the correct `npm.cmd` path and Angular stayed up), but still didn't reliably take effect when launched from Visual Studio specifically (suspected VS-side caching/launch-path difference, never fully root-caused). Chocolatey was considered as a cleaner install/upgrade mechanism but turned out to need the same admin rights the investigation kept running into. **In the end the user just upgraded the system Node install directly** (now v26.8.2) and cleaned the now-unnecessary PATH line out of `AppHost.cs` — the simplest fix, and the right call once "early in development, stay agile" won out over minimizing machine-wide change. **Don't reintroduce any PATH-prepending hack in `AppHost.cs` — system Node is the fix, full stop.**

**Aspire + Angular wiring** (`AiBlogResearch.AppHost/AppHost.cs`): `AddNpmApp("angular", "../client/ai-blog-research-ui", "start")` with `.WithReference(webApi)`, `.WithEnvironment("BACKEND_URL", webApi.GetEndpoint("https"))`, and a **fixed** (non-Aspire-proxied) port 4200 (`.WithHttpEndpoint(port: 4200, targetPort: 4200, isProxied: false)`) — deliberately not using Aspire's dynamic-port/env-based `PORT` pattern for Node apps, to keep the first working version simple (Angular's own default dev-server port). The Angular app never calls the backend cross-origin: `client/ai-blog-research-ui/proxy.conf.js` reads `process.env.BACKEND_URL` (falling back to `https://localhost:7052` for a plain `ng serve` outside Aspire) and Angular's dev-server proxies `/api/*` to it, so `HealthService` just calls relative `/api/health`. WebApi (`Program.cs`) also has a permissive CORS policy for `localhost:4200` for Development, kept as a fallback for scenarios that don't go through the proxy (e.g. calling the API directly from a browser during debugging).

**`client/ai-blog-research-ui/ai-blog-research-ui.client.esproj` added (user, 2026-09-14)** — Visual Studio's JS/TS project type (`Microsoft.VisualStudio.JavaScript.Sdk`), wired into `AiBlogResearch.slnx`, so the Angular source is visible/navigable inside the VS solution. **This does not give Visual Studio JS/TS debugging for free**: Angular is actually launched by Aspire's `AddNpmApp` as a generic child process, not by the `.esproj`'s own debug launch, so VS has no automatic browser-attach for it. A TS breakpoint can still be hit via `Debug → Attach to Process → Script`, picking the already-open browser tab (source maps are on — `angular.json`'s `development` build config has `sourceMap: true`) — but **the user has decided to develop the Angular client in VS Code Insiders instead** and isn't pursuing VS-side TS debugging further. WebApi (C#) debugging in Visual Studio is unaffected by any of this and works normally.

**Next up** (per the original plan below): McpHost class library + `IResearchAgent`, the two standalone MCP servers (FileSearch, Database), and wiring MAF + the Anthropic C# SDK for the first real end-to-end agent call. None of that is started yet.

## Cross-machine continuity (Mac ↔ Windows/Parallels)

Work happens from two Claude Code instances: this one (macOS) and a Windows one running under Parallels. **They share the same physical filesystem** — Parallels maps the Mac home directory as `M:\` in Windows, so `M:\Dev\repos\ai-research-blog` is not a clone, it's the *same files* as this repo. No git push/pull is needed for either side to see the other's committed (or even uncommitted) changes — normal editor/OS file-locking caveats aside, saving a file on one side makes it immediately visible on the other.

That means two things are available to a fresh Windows session, in order of reliability:

1. **This file** (`docs/SESSION_HANDOFF.md`) — read it first, always. It's project-specific and lives in the repo, so it's versioned and travels with the code.
2. **The Mac-side auto-memory files**, also reachable from Windows via the same shared mount: `M:\.claude\projects\-Users-billkratochvil-Dev\memory\MEMORY.md` and the individual `.md` files it indexes. These hold general context about Bill and this project (background, decision-making style, stack rationale) that isn't repo-specific. Windows Claude Code won't auto-load these (its own memory store is keyed to its own project path, `M:\Dev\repos\...`, which reads as a different project than `/Users/billkratochvil/Dev`), so they need to be pointed at explicitly if wanted.

**Peer-to-peer session messaging tested and does not bridge the boundary** (2026-09-14): ran `ListAgents` from the Windows session — it returned no reachable agents, with the tool's own description scoping peer messaging to sessions "running on this machine." Parallels' Windows VM and macOS count as separate machines to Claude Code even though they share the filesystem via the `M:\` mount, so this mechanism should not be relied on for Mac↔Windows sync. **Decision: don't retest this without new evidence** — the file-based handoff above is the one to depend on.

**Decision (2026-09-14): Windows is now the primary/predominant development machine going forward**, not just for this scaffolding session — because the stack (Visual Studio, .NET, Aspire) needs the ability to run Windows apps that the macOS side can't. The Mac session becomes secondary/occasional. This doesn't change the file-based handoff mechanism above — it still applies regardless of which side is "primary" — but new-session context should assume Windows-first unless told otherwise.

## Decided stack

- **Client**: Angular, latest version, generated via the Angular CLI directly (`ng new`) — deliberately *not* Visual Studio's built-in SPA template, which pins an older Angular version. Plus Angular Material for UI components (originally planned as PrimeNG — switched 2026-09-14 when PrimeNG turned out to require a paid license; see the "Where the project actually is" section above for why).
- **Backend**: ASP.NET Core Web API (`AiBlogResearch.WebApi`) — plays the **MCP Host** role (embeds the LLM client, orchestrates tool use). "MCP Host" names the architectural *role*, deliberately not tied to "WebApi" as the only possible implementation.
- **Reusable host logic**: the actual agent/orchestration code lives in a separate class library, `AiBlogResearch.McpHost`, behind an `IResearchAgent` interface, registered into the WebApi via DI (`AddScoped<IResearchAgent, ResearchAgent>()`). In-process, not a network service — reuse across future projects is solved by referencing/extracting this library later, not by adding a network hop now.
- **MCP servers**: `McpServer.FileSearch` and `McpServer.Database` — standalone ASP.NET Core minimal API projects, each a separate deployable process with its own credentials (the DB server holds the connection string; the Host never sees it directly). Talk to the Host over MCP's stateless HTTP transport (2026-07-28 spec).
- **AI orchestration**: Microsoft Agent Framework (MAF) — the 2026 GA convergence of Semantic Kernel + AutoGen. (Semantic Kernel itself is now in maintenance mode — bug/security fixes only, no new features — so MAF is the framework to build on, not SK.)
- **Claude calls**: the official `anthropics/anthropic-sdk-csharp` NuGet package (`Anthropic`) — first-party, not a community port.
- **Local dev orchestration**: .NET Aspire — `AiBlogResearch.AppHost` + `AiBlogResearch.ServiceDefaults` projects. Angular is wired in via `Aspire.Hosting.NodeJs`'s `AddNpmApp` (Aspire does **not** auto-discover non-.NET projects any other way). Postgres can be an Aspire-managed container resource for local dev.
- **Python is not required** anywhere in this stack. It would only become relevant if the project later needs to train/fine-tune models (PyTorch/Hugging Face) or a LangChain-only integration — neither is currently planned.

### Target solution layout

```
AiBlogResearch.slnx                       ← .slnx now, see note above — .NET 10's new default solution format
├── AiBlogResearch.AppHost/              ← Aspire orchestrator
├── AiBlogResearch.ServiceDefaults/      ← shared telemetry/health/resilience/service-discovery
├── src/
│   ├── AiBlogResearch.McpHost/          ← IResearchAgent + implementation (class library) — not yet built
│   ├── AiBlogResearch.WebApi/           ← public API Angular calls; hosts McpHost via DI
│   ├── McpServer.FileSearch/            ← standalone MCP server — not yet built
│   └── McpServer.Database/              ← standalone MCP server — not yet built
└── client/
    └── ai-blog-research-ui/             ← Angular CLI app + Angular Material
```

## Why not Blazor / Python (don't re-litigate without new evidence)

- **Blazor** was ruled out: same single-vendor-risk pattern as Silverlight/WPF/UWP (all Microsoft-controlled client frameworks Microsoft later deprioritized), with a much smaller community than Angular/React and no foundation backing.
- **Gemini CLI** (Google) was reviewed as a case study: 107k GitHub stars and Apache 2.0 license did *not* protect it from being redirected into a closed-source successor (Antigravity CLI) with a ~98% free-quota cut — proof that star count/open license alone isn't a safety signal against single-vendor control.
- **MCP itself** is *not* single-vendor risk: Anthropic donated MCP to the Linux Foundation's Agentic AI Foundation (2025-12-09), co-founded with Block and OpenAI, Microsoft/Google/AWS/Cloudflare/Bloomberg also participating. The C# SDK is Tier 1 (same as TypeScript/Python), with a published, mechanically-enforced tiering system (conformance tests, auto-relegation) — not just a vendor's promise.
- **Angular** clears the vendor-risk bar Blazor doesn't: compiles to portable static JS with no backend dependency, MIT-licensed, and has a near-decade track record of low-pain major-version upgrades via `ng update` (unlike the AngularJS→Angular jump).
- Full reasoning trail is in this session's transcript if ever needed, but the conclusions above are the ones to build from.

## Hosting reality (SmarterASP.NET)

Account `billkrat-001` (plan W1000-US, Premium tier as of Sep 2026 → unlimited sites). Control panel: `https://member10-1.smarterasp.net/panel...`.

| Site | Domain | Status |
|---|---|---|
| **Adventures** | adventuresontheedge.net | **LIVE PRODUCTION** — actively maintained (recent fixes: JS editor copy/paste menu bug, JS-edit cache/refresh issue). Repo: `github.com/BillKrat/BlogAI.git` (legacy BlogEngine.NET). **Do not touch with new-stack work.** |
| **global** | global-webnet.com | **DEV environment — all new development targets this site.** |
| ForGod | di-forgod.com | Untouched, not relevant to this project. |
| PhotosByDi | (temp URL only) | Untouched, not relevant. |

**Domains still on Railway, to be migrated to SmarterASP.NET at beta**: `adventuresEdge.net` (will mirror adventuresontheedge.net's open-source feature set) and `blogresearch.net` (becomes the advanced/production line, features beyond the open-source project).

**The `/BlogAi` virtual-path concept is scrapped entirely** (decided 2026-09-13). Original idea: use BlogEngine.NET's tenant/org model (`tenant=domain`, `org=domain/BlogAi`) to publish the new stack as a sibling blog sharing Adventures' theme, sneaking new features onto production without touching BlogEngine.NET's code. Dropped because the new stack is now a multi-service Angular/C#/MCP/Aspire build, not a simple blog generator — the coexistence trick isn't worth its own added complexity anymore. **There is no plan to ever put the new stack under adventuresontheedge.net.** The stray `BlogAI` virtual directory currently sitting under `global-webnet.com` is orphaned cruft from this scrapped idea — safe to delete whenever, nothing depends on it.

**Deployment mechanism**: SmarterASP.NET's per-site "GitHub Deploy" runs on Railpack (Railway's open-source buildpack) via Docker, and requires a `.csproj` or `package.json` at the **true repository root** — no root-directory override for monorepos. This is why earlier `BillKrat/BlogAI.git` auto-deploys failed (`Could not identify a project root`). **Primary planned deploy path: VSDeploy** — each site's control panel has a "Download publish settings" button producing a `.publishsettings` file that Visual Studio's built-in Publish dialog imports directly. GitHub Deploy remains an option per-project as long as that project's file sits at its own repo root (or gets its own repo).

**Workflow**: branch-based — work in feature branches, deploy to DEV (global-webnet.com) when ready to push something new. No continuous-deploy pipeline to production planned yet.

## Reference material

- Architecture concept map (UI/Agent/Model/Tool/Retrieval/Memory/Security/MCP Host/MCP Server): live at MindMapAI — `https://mindmapai.app/canvas/dfe305970dd2afbc23718d38f9f3b1a74a971480214e374e5fcd11dcc3e540f1/edit`. MindMapAI's per-node Notes feature isn't shipped yet, so `docs/architecture/ai-system-architecture.opml` in this repo is the durable backup for design-rationale notes — keep it in sync with the canvas whenever the canvas structure changes.
- `artifacts/docs-research-arch.md` — raw transcript excerpts from the stack-selection debate, kept for anyone who wants the full reasoning trail.

## After deployment and auth: the MCP/agent work (McpHost, MCP servers, MAF)

Objectives 1–7 (purge Python, scaffold Aspire solution, Angular + Material client, WebApi health check, Angular↔WebApi wired and running locally) are **done** — see "Where the project actually is right now" at the top. This section is now **third in line**, after deployment and auth (see the top of this doc) — not the next thing to pick up:

1. Add `AiBlogResearch.McpHost` class library with the `IResearchAgent` interface, DI-registered into WebApi.
2. Scaffold `McpServer.FileSearch` and `McpServer.Database` as standalone ASP.NET Core minimal API projects, wired into the AppHost as their own resources.
3. Wire MAF + the Anthropic C# SDK, and get a minimal working path end-to-end: Angular → WebApi → `IResearchAgent` (MAF) → one MCP server tool call → Claude via Anthropic SDK → response back to Angular.
4. Defer: the `/BlogAi` housekeeping cleanup and moving the Railway domains — neither blocks the work above.
