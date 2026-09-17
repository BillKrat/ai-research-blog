# AGENTS.md — ai-research-blog

Working context for any agent touching this repo — Claude Code (Windows/macOS) or the local LM Studio agent described below. **Read [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md) first** — it's the source of truth for current status, decided architecture, and what's next. This file is about *how agents work in this repo*, not what's been decided about the product.

## Local LM Studio Agent — Role & Workflow

**Why:** peak Claude sessions are rate-limited. When a limit is hit (or Claude isn't available), a local model in LM Studio on the Mac Mini (currently `qwen/qwen3.8-27b` via MLX) can keep doing legwork — exploration, running builds/tests, drafting small fixes — so time isn't lost waiting. This mirrors the pattern used in the (now-retired) `poc/` repo; see `poc/AGENTS.md`'s "Local LM Studio Agent" section for the original design if more detail is ever needed.

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
