# AGENTS.md — ai-research-blog

Working context for any agent touching this repo — Claude Code (Windows/macOS) or the local LM Studio agent described below. **Read [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md) first** — it's the source of truth for current status, decided architecture, and what's next. This file is about *how agents work in this repo*, not what's been decided about the product.

**Machine-bootstrap / non-project tooling now lives in a separate repo: [`dev-tools`](https://github.com/BillKrat/dev-tools).** The `blog_repo_runner.py` MCP tool referenced below has its canonical source there (`lmstudio/tools/blog_repo_runner.py`) — this repo's copy at `~/.lmstudio/tools/blog_repo_runner.py` is a deployed instance, not the source of truth. If you edit its behavior, edit it in `dev-tools` and redeploy, or the change is lost if this machine is ever replaced.

## Review cadence: staged blog-entry summaries under `docs/artifacts/`

**Decided 2026-09-20, after a long architecture-design session (see [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md)'s 2026-09-20 entry) — this is a working-process rule for any agent doing multi-stage development in this repo, not a one-off request.**

After a realistically-scoped chunk of development work is finished — the agent doing the work judges what counts as a stage, there's no fixed line-count or time box — write a short review blog entry (an overview plus a Mermaid diagram of what was actually built/changed) and save it as a new file under `docs/artifacts/` (create that directory if it doesn't exist yet; name files `<date>-<short-topic>.md`, e.g. `2026-09-25-generic-dal-bll.md`). Then stop and let the user review it and ask questions before starting the next stage — this is a deliberate checkpoint, not a formality to skip through.

**Why a repo file, not a claude.ai Artifact link:** the [Login Path Autopsy](https://claude.ai/artifact/WuFQzaVGDYvFjjYxjesdYf) Claude Artifact referenced in SESSION_HANDOFF.md's 2026-09-19 "NEW DIRECTION" entry proved the concept (overview + Mermaid sequence diagram of real session work) but was explicitly "not itself part of any repo's code." This is that same shape, made durable — a plain Markdown file with fenced `mermaid` code blocks (renders natively on GitHub, diffable, survives session deletion) instead of a session-scoped link. This is the practiced, concrete version of the larger "BlogAI (new)" product vision described in that same SESSION_HANDOFF.md entry: a human reviewer can't keep up reading every line of AI-written code, but can review a concise overview and diagram and approve or redirect from there.

**Keep each entry scoped to that stage's actual diff, not a cumulative running summary** — same dated/additive spirit as `SESSION_HANDOFF.md`, just per development stage instead of per session.

## Local LM Studio Agent — Role & Workflow

**Why:** peak Claude sessions are rate-limited, and Copilot usage is now also time-shared against the same monthly limits (the user alternates between Claude Code and GitHub Copilot depending on which has remaining quota). When both are exhausted or unavailable, a local model in LM Studio on the Mac Mini (currently `qwen/qwen3.8-27b` via MLX, on 48GB unified memory) can keep doing legwork — exploration, running builds/tests, drafting small fixes — so time isn't lost waiting. This mirrors the pattern used in the (now-retired) `poc/` repo; see `poc/AGENTS.md`'s "Local LM Studio Agent" section for the original design if more detail is ever needed.

## Documentation practices for cross-model continuity (why decisions are written the way they are)

**This repo is deliberately over-documented on *rationale*, not just *what changed*, because the next session picking up a decision may be a much smaller, lower-context local model (qwen3.8-27b, ~27B params) rather than a frontier model.** A smaller model is far less able to infer unstated reasoning, reconstruct "why" from a terse changelog line, or safely guess at intent when a decision looks incomplete or is only half-explained. The practical consequence: every architectural decision recorded in `docs/SESSION_HANDOFF.md` should be written so that a model with much less reasoning headroom than Claude/GPT-5 can still act on it correctly without re-deriving the reasoning from scratch or guessing. Concretely, when adding or updating a decision record:

- **State the "why," not just the "what."** "Uses PBKDF2 instead of SHA-256 for user passwords" is not enough on its own — say *why* (low-entropy human-chosen passwords need a slow KDF to resist offline brute force, whereas the M2M secret hasher's single-round SHA-256 is fine for high-entropy generated secrets). A smaller model is much more likely to "fix" an under-explained decision into something wrong than a larger one is.
- **Spell out rejected alternatives and why they were rejected**, not just the chosen path — this is what stops a future session (of any model size) from re-litigating a settled decision or reintroducing something already ruled out (see the Auth0 section above for the pattern to follow).
- **Prefer explicit file/symbol references over pronouns or "the above."** A smaller model's effective context window and instruction-following are both weaker; concrete anchors (`IPasswordHasher` in the `Adventures.Security` package — see [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md)'s 2026-09-19 extraction entry for where the security/data code actually lives now — not "the hasher we talked about") reduce the chance of it editing or reasoning about the wrong thing.
- **Keep entries dated and additive ("newest first"), never silently rewritten**, per the existing convention — this lets any session, regardless of model size, tell current-and-settled apart from historical-and-superseded without needing to hold the whole edit history in context at once.
- **State explicitly what is *not yet done*, not just what is done.** A smaller model is more prone to assuming a partially-built feature is complete than a larger one is to notice the gap unprompted — see how the data-access-layer and user/credential-vault sections above each end with an explicit "explicitly deferred" list; keep that pattern for new work.
- **When in doubt, over-explain rather than compress.** Token cost of a slightly longer decision record is trivial compared to the cost of a future session (especially a smaller local model) making an incorrect architectural change because a decision's reasoning wasn't spelled out.

**Cross-machine reality this design accounts for:** `M:\Dev\repos\ai-research-blog` (Windows/Parallels) and `/Users/billkratochvil/Dev/repos/ai-research-blog` (macOS, where LM Studio runs) are **the same working tree**, not separate clones — Parallels shares the filesystem. That means:
- A branch switch on one side changes what the other side sees, mid-session.
- A `git push` from either side can trigger this repo's GitHub Actions, which **deploy straight to production** (`global-webnet.com` / `api.global-webnet.com`) on every push to `main`.

Given that, the guardrails below are deliberate, not an oversight.

**Tools available to the LM Studio agent (`~/.lmstudio/mcp.json`):**
- `filesystem` (`@modelcontextprotocol/server-filesystem`, scoped to `~/Dev/repos`) — read/search/edit files.
- `blog-repo-runner` (`~/.lmstudio/tools/blog_repo_runner.py`) — hardcoded to this repo only, no path/shell-string parameters accepted:
  - `dotnet_build(project)` — `webapi` / `apphost` / `servicedefaults` (fixed set; deliberately never builds the `.slnx`, since its `.esproj` is VS-only and may not resolve via plain `dotnet` — use `ng_build` for the Angular client instead).
  - `ng_build()`, `ng_test()`, `npm_install()` — Angular client (`client/ai-blog-research-ui`).
  - `git_status()`, `git_diff(staged)`, `git_log(count)` — **read-only.**

**`npm_install` is last-resort, not routine — it prunes the shared `node_modules`' native platform binaries (e.g. `@esbuild/win32-x64` vs `@esbuild/darwin-arm64`) for whichever OS runs it.** This isn't an npm bug or a flag to disable — npm intentionally reconciles OS/CPU-tagged optional dependencies against the current platform on every install, removing what doesn't match. There's no "keep both platforms installed" option. Since day-to-day development now happens in VS Code (client) and Visual Studio 2026 (WebApi) on Windows, and LM Studio's role is occasional verification, not continuous serving:
- Only call `npm_install` if `ng_build`/`ng_test` actually fails with a platform-mismatch or missing-module error — don't run it speculatively "just in case."
- If you do run it, say so prominently in the dated Local Agent Log entry (not buried) — it means the *next* Windows-side build will fail until `npm install` runs there too, and that's the one thing the next session needs to see before it assumes the client still builds.

**No `git commit` or `git push` tool exists, on purpose.** The local agent explores, builds, tests, and edits files (via `filesystem`) freely — but leaves the working tree dirty. It does not commit, does not push, and does not switch branches. The next Claude session reviews `git diff`/`git status` and decides what to commit.

**This is a policy, not just a missing tool — do not route around it.** If some other tool available in the chat (a JS/code-execution sandbox, a generic shell tool, anything with subprocess access) is technically capable of running `git commit`, `git push`, `git checkout`, or `git restore`, do not use it for that purpose. The restriction to read-only git exists specifically because this repo's GitHub Actions deploy straight to production on push to `main` — treat "no commit/push tool" as "don't commit or push," full stop, regardless of what else happens to be reachable.

**Off-limits regardless of tool access:** `.github/workflows/**`, any publish profile / FTP / deploy secret, and don't rewrite decided sections of `docs/SESSION_HANDOFF.md` (appending a dated note about a finding is fine — that doc's own convention is "newest first" / dated entries).

**Division of labor:**
- **Local LM Studio agent:** repo exploration, verifying builds/tests actually pass after an edit (call `dotnet_build`/`ng_build`/`ng_test` after any change in `src/` or `client/` — don't hand back unverified code), drafting small fixes or scaffolding, catching regressions early.
- **Claude (peak sessions):** architecture/design decisions, review, committing, and anything touching deploy config or secrets.

**Recording results:** since the local agent can't commit or hand off through a shared conversation, log findings/blockers/in-progress state as a dated entry under **Local Agent Log** below, so the next Claude session doesn't have to re-derive it from a dirty working tree alone.

**LM Studio doesn't auto-read this file** the way Claude Code auto-loads `AGENTS.md`/`CLAUDE.md` — set it as the chat's system prompt / project instructions (LM Studio → this workspace → point it at reading `AGENTS.md` first) so it's actually in context each session.

## Local Agent Log

(Dated entries from the local LM Studio agent go here — findings, blockers, what it verified. Newest first.)

### 2026-09-17 — Full solution build verified on macOS; esbuild platform-mismatch in shared node_modules (recurring gotcha)

Bill asked for a full solution build. The `.slnx` itself can't be built via plain `dotnet` (VS-only `.esproj`, per the tooling note above), so built the documented equivalent — `dotnet_build` for webapi + apphost, `ng_build` for the client:

- **WebApi** (incl. ServiceDefaults): ✅ 0 warnings / 0 errors.
- **AppHost** (all three .NET projects): ✅ 0 warnings / 0 errors.
- **Angular `ng build`**: ❌ first attempt failed — `You installed esbuild for another platform… "@esbuild/win32-x64" is present but this platform needs "@esbuild/darwin-arm64"`. Root cause: `node_modules` was last installed on the Windows side of the shared Parallels tree, so its platform-specific native binaries are for win32-x64. **Fixed with `npm_install` on the Mac side** (added 10 / removed 14 packages — swaps the platform binaries in place). Re-ran `ng_build`: ✅ (initial bundle 290.59 kB raw / 79.30 kB transfer). `ng_test`: ✅ 2/2 tests passed.

**Recurring gotcha to remember:** every time the active machine flips between Windows ↔ macOS, the first `ng build`/`ng serve` on the newly-active side will fail with an esbuild (or similar native-dep) platform mismatch until `npm install` is run there. Not a bug to "fix" in code — just run `npm_install` on whichever side is driving before building the client.

Side note: `npm install` warned that `fsevents@2.3.3`'s install script was skipped under npm's allow-scripts policy. Harmless for `ng build` (fsevents is only used by file-watching), but if a Mac-side `ng serve`/watch build ever misbehaves on file changes, that's the first thing to check (`npm approve-scripts fsevents`).

### 2026-09-16 — LMS_TRIAGE_HANDOFF items closed (macOS Claude session)

Both open items from [docs/LMS_TRIAGE_HANDOFF.md](docs/LMS_TRIAGE_HANDOFF.md) are resolved:

- **Item 1 (tool-confirmation bypass):** `js-code-sandbox` disabled entirely for this workspace in LM Studio's per-chat tool picker (done by Bill in the UI). `~/.lmstudio/settings.json`'s `skipToolConfirmationPatterns` no longer has a path to arbitrary shell/subprocess execution — `blog-repo-runner` (build/test/read-only-git) and `filesystem` (file edits) are the only capabilities available to the local agent, matching the division of labor above. Also flagged as a side note: `mcp/poc-test-runner:*` was still lingering in that same settings list as a dead entry (the server itself was already removed from `mcp.json`) — harmless, but worth deleting next time that file is opened.
- **Item 2 (dirty-working-tree mystery):** root-caused, not the "stale LM Studio context" hypothesis — a native macOS `git status`/`git diff` also showed all ~45-48 files dirty, confirming it was real. Actual cause: `core.fileMode=false` (the earlier fix) was correctly in place and had already eliminated the mode-bit noise, but every file was still CRLF on disk vs. LF in the committed blobs. Since `M:\Dev\repos\ai-research-blog` (Windows) and `~/Dev/repos/ai-research-blog` (macOS) are the same physical working tree via Parallels, per-machine `core.autocrlf` settings can't be the fix — whichever side last checked out or saved a file wins, dirtying the other side. Fixed at the repo level instead: added [.gitattributes](.gitattributes) with `* text=auto eol=lf` (plus explicit `binary` declarations for `favicon.ico` and other image/font types, to prevent `text=auto`'s heuristic from ever corrupting a binary file via CRLF conversion). Committed and pushed as `f8f33bc` — working tree was fully clean immediately after (git's clean/smudge filters now normalize CRLF↔LF consistently regardless of which OS's git or editor touches the files next).

Nothing further to do on either item. If a fresh dirty-tree report ever recurs, re-verify natively (`git status --porcelain=v1 -b` + `git diff --stat`, not through the LM Studio MCP tool) before assuming it's the same root cause — this fix addresses line endings specifically, not every possible cross-platform git artifact.
