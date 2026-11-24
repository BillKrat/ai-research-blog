# Stage review: R6 the thin-host ratchet, and the host reuse review closed (2026-11-24)

**What was built.** A guard test, `ThinHostRatchetTests` (app test project), that keeps the three hosts thin so the copies the review found cannot grow back:

1. **A line budget per host** (today's size plus a small margin, to be lowered, never raised): API 620, MCP 60, NQuad browser 200.
2. **A list of the store projects each host may reference.** The API host and the NQuad browser choose a store, so they list theirs; the MCP host lists none.
3. **A list of types the shared libraries now own** (`StartupChecks`, `ClientSite`, `McpController`, `ReviewQueue`, `SecurityHeaders` and so on): a host that declares one again has started a copy.

I proved the ratchet bites by lowering the MCP budget to 10 (the test failed), then restoring it.

**One last copy removed.** The NQuad browser had its own security-header middleware, the third arrangement the review named. `UseSecurityHeaders` and `SetSecurityHeaders` in `Adventures.WebApi` now take an optional Content-Security-Policy, and the browser passes its own (`SecurityHeaders.cs` 33 to 20 lines). New Foundation test for the override.

## The whole review, before and after

| Host | Lines before | Lines now | Where the rest went |
|---|---|---|---|
| `AiBlogResearch.WebApi` | 1,570 in 20 files | 584 in 9 files | R1 shared hosting, R2 feature registrations, seeds and start-up tasks, R3 menu and dashboard |
| `McpServer.WebApi` | 1,176 in 12 files | 49 in 1 file | R4 gateway library, R5 research module |
| `NQuadBrowser.WebApi` | 212 in 4 files | about 196 in 4 files | the header copy (R6) |

New Foundation projects: `Adventures.Entities.NQuad` (feature entity registrations), `Adventures.Mcp.WebApi` (gateway), `Adventures.Blog.Legacy.Research` (optional research module). New shared pieces in existing ones: `Hosting` (logging, startup checks, live-data, seed profile, client site, pipeline preamble, start-up tasks, service clients), seed manifests per feature, admin menu contributions, `Scopes`.

**What the review's drift list became.** Each item of the "drift that already exists" list is closed: the REST diagnostics proxy is removed (R4); the MCP host has file logging, the shared exception handler, the rate limiter and a readable 503 (R4, proved by running it); the pipeline preamble exists once (R1, R4, R6); scope names exist once (R4); the two outgoing client recipes are one (R4); the 25 repeated `using` lines went with the moved files (not with the files that stayed in the host, a cosmetic leftover).

**Still open from the review's "smaller findings".** `AiBlogResearch.ServiceDefaults` keeps its app name (the standard Aspire defaults project); the host's remaining `AppPlatformServices`, `AppIdentityServices` and `AppEntityServices` still hold the tenancy, rights, mail and identity wiring that a second tenant-aware host would copy. That is the next candidate (a `AddAdventuresIdentity` and `AddAdventuresApi` pair), but it is a larger move than the review's six stages and is yours to prioritise against the beta list. The menu and dashboard tests also still sit in the app's test project.

**Verified.** Foundation full suite, app API 65 (56 plus 9 ratchet), host 51, MCP 91, NQuad browser 13, LegacyImport 16. Nothing deployed; no live `Claude-verify.ps1`; nothing seen in a browser.

**Before a deploy.** The review's changes touch both sites. Deploy the API first (it carries the shared hosting and the menu), then the MCP site together with the new `docs/Claude-diagnose.ps1`, then run `Claude-verify.ps1`. The Foundation changed, so dispatch the API deploy by hand if the push does not start it.
