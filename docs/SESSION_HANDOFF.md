# Session Handoff — AI Research Blog Rebuild

Status as of 2026-09-13. Read this first in any new session before touching architecture or deployment — it's the source of truth for decisions made so far, so nothing above it should be reconstructed from memory or re-litigated without reading this.

## Cross-machine continuity (Mac ↔ Windows/Parallels)

Work happens from two Claude Code instances: this one (macOS) and a Windows one running under Parallels. **They share the same physical filesystem** — Parallels maps the Mac home directory as `M:\` in Windows, so `M:\Dev\repos\ai-research-blog` is not a clone, it's the *same files* as this repo. No git push/pull is needed for either side to see the other's committed (or even uncommitted) changes — normal editor/OS file-locking caveats aside, saving a file on one side makes it immediately visible on the other.

That means two things are available to a fresh Windows session, in order of reliability:

1. **This file** (`docs/SESSION_HANDOFF.md`) — read it first, always. It's project-specific and lives in the repo, so it's versioned and travels with the code.
2. **The Mac-side auto-memory files**, also reachable from Windows via the same shared mount: `M:\.claude\projects\-Users-billkratochvil-Dev\memory\MEMORY.md` and the individual `.md` files it indexes. These hold general context about Bill and this project (background, decision-making style, stack rationale) that isn't repo-specific. Windows Claude Code won't auto-load these (its own memory store is keyed to its own project path, `M:\Dev\repos\...`, which reads as a different project than `/Users/billkratochvil/Dev`), so they need to be pointed at explicitly if wanted.

**Peer-to-peer session messaging** (`SendMessage`/`ListAgents`) also exists as a mechanism for two live Claude sessions to talk directly, but it depends on a "Remote Control" account feature whose behavior across the Mac↔Parallels boundary hasn't been confirmed yet. Worth testing when both sessions are up at the same time (run `ListAgents` from either side to see if the other appears) — if it works, it's a nice-to-have for future sessions, but the file-based handoff above is the one to actually depend on.

## Where the project actually is right now

`app.py` in the repo root is still the original minimal FastAPI/Python skeleton. **None of the stack below has been scaffolded yet.** Tomorrow's session (on Windows/Visual Studio 2026, via Parallels) is the first coding session for the new stack.

## Decided stack

- **Client**: Angular, latest version, generated via the Angular CLI directly (`ng new`) — deliberately *not* Visual Studio's built-in SPA template, which pins an older Angular version. Plus PrimeNG (latest) for UI components.
- **Backend**: ASP.NET Core Web API (`AiBlogResearch.WebApi`) — plays the **MCP Host** role (embeds the LLM client, orchestrates tool use). "MCP Host" names the architectural *role*, deliberately not tied to "WebApi" as the only possible implementation.
- **Reusable host logic**: the actual agent/orchestration code lives in a separate class library, `AiBlogResearch.McpHost`, behind an `IResearchAgent` interface, registered into the WebApi via DI (`AddScoped<IResearchAgent, ResearchAgent>()`). In-process, not a network service — reuse across future projects is solved by referencing/extracting this library later, not by adding a network hop now.
- **MCP servers**: `McpServer.FileSearch` and `McpServer.Database` — standalone ASP.NET Core minimal API projects, each a separate deployable process with its own credentials (the DB server holds the connection string; the Host never sees it directly). Talk to the Host over MCP's stateless HTTP transport (2026-07-28 spec).
- **AI orchestration**: Microsoft Agent Framework (MAF) — the 2026 GA convergence of Semantic Kernel + AutoGen. (Semantic Kernel itself is now in maintenance mode — bug/security fixes only, no new features — so MAF is the framework to build on, not SK.)
- **Claude calls**: the official `anthropics/anthropic-sdk-csharp` NuGet package (`Anthropic`) — first-party, not a community port.
- **Local dev orchestration**: .NET Aspire — `AiBlogResearch.AppHost` + `AiBlogResearch.ServiceDefaults` projects. Angular is wired in via `Aspire.Hosting.NodeJs`'s `AddNpmApp` (Aspire does **not** auto-discover non-.NET projects any other way). Postgres can be an Aspire-managed container resource for local dev.
- **Python is not required** anywhere in this stack. It would only become relevant if the project later needs to train/fine-tune models (PyTorch/Hugging Face) or a LangChain-only integration — neither is currently planned.

### Target solution layout

```
AiBlogResearch.sln
├── AiBlogResearch.AppHost/              ← Aspire orchestrator
├── AiBlogResearch.ServiceDefaults/      ← shared telemetry/health/resilience/service-discovery
├── src/
│   ├── AiBlogResearch.McpHost/          ← IResearchAgent + implementation (class library)
│   ├── AiBlogResearch.WebApi/           ← public API Angular calls; hosts McpHost via DI
│   ├── McpServer.FileSearch/            ← standalone MCP server
│   └── McpServer.Database/              ← standalone MCP server
└── client/
    └── ai-blog-research-ui/             ← Angular CLI app + PrimeNG
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

## Next session: what to actually do

1. Scaffold the solution per the layout above (AppHost, ServiceDefaults, McpHost, WebApi, both MCP servers, Angular client).
2. Get Aspire running everything together locally (`dotnet run` on AppHost → dashboard shows WebApi + both MCP servers + Angular, all wired via service discovery).
3. Wire a minimal working path end-to-end: Angular → WebApi → `IResearchAgent` (MAF) → one MCP server tool call → Claude via Anthropic SDK → response back to Angular.
4. Defer: production deploy pipeline, the `/BlogAi` housekeeping cleanup, and moving the Railway domains — none of these block getting a working local dev loop.
