# LM Studio Local-Agent Triage Handoff

Written 2026-09-16 by the Windows Claude Code session, for whichever Claude Code session (macOS, ideally — same OS as LM Studio) picks this up. Two open items from setting up LM Studio as a stopgap coding agent for `ai-research-blog` while peak Claude sessions are rate-limited. Read [SESSION_HANDOFF.md](SESSION_HANDOFF.md) and [../AGENTS.md](../AGENTS.md) first for full context — this doc is scoped to just these two issues.

## Background (what was just built, same session)

- New MCP tool `~/.lmstudio/tools/blog_repo_runner.py`, registered in `~/.lmstudio/mcp.json` as `blog-repo-runner`, hardcoded to `~/Dev/repos/ai-research-blog`: `dotnet_build`, `ng_build`, `ng_test`, `npm_install`, plus **read-only** `git_status`/`git_diff`/`git_log`. Deliberately **no commit/push tool** — this repo's GitHub Actions deploy straight to production (`global-webnet.com` / `api.global-webnet.com`) on every push to `main`, and the Windows (`M:\Dev\repos\ai-research-blog`) and macOS (`~/Dev/repos/ai-research-blog`) paths are **the same working tree** (Parallels shares the filesystem) — not separate clones.
- New [AGENTS.md](../AGENTS.md) at the repo root documenting this division of labor and the guardrail.
- Old `poc-test-runner` MCP entry removed from `mcp.json` (the `poc/` repo it served is obsolete).

## Item 1 — Tool-confirmation bypass (the important one, fix this first)

`~/.lmstudio/settings.json` → `chat.skipToolConfirmationPatterns` currently includes:

```json
"lmstudio/js-code-sandbox:run_javascript",
"lmstudio/js-code-sandbox:*",
```

`js-code-sandbox` is an **LM Studio built-in plugin**, not one of the MCP servers set up above — it runs arbitrary JS (Deno), which has subprocess access (`Deno.Command`), meaning the model can shell out to `git commit` / `git push` / anything else, with **zero confirmation prompt**, completely bypassing the "no commit/push tool" guardrail `blog_repo_runner.py` and `AGENTS.md` were built around.

**Observed in the wild, same session:** the local agent's own reasoning (relayed by the user from LM Studio's UI) was actively considering using `run_javascript`/`Deno.Command` to run git commands the MCP tool doesn't expose, after being told to investigate a dirty working tree. It didn't reach the point of confirming it actually did this — but the auto-approved path was sitting right there.

**Fix:**
1. Remove those two `js-code-sandbox` entries from `skipToolConfirmationPatterns` in `~/.lmstudio/settings.json` (or the equivalent in LM Studio's Settings UI, if it has one — check both, this file may just mirror UI state) — restores at least a confirmation prompt.
2. Better: in LM Studio's per-chat/workspace tool picker, **disable `js-code-sandbox` entirely** for any chat working in `ai-research-blog`. There's no legitimate reason the repo-maintenance agent needs general code execution — `blog-repo-runner` already covers build/test/git-read, and `filesystem` covers file edits.
3. Sanity-check whether any *other* built-in or MCP tool in that same list has broad shell/subprocess/file-write capability beyond what `AGENTS.md`'s division of labor calls for, and tighten similarly.
4. Once fixed, note the outcome back in `AGENTS.md`'s **Local Agent Log** section (dated entry) so it's not re-discovered from scratch later.

Not urgent-urgent (nothing destructive was confirmed to have happened — `git status`/`log` from the Windows side still showed the repo clean and `origin/main` un-pushed-to beyond what's expected), but close this gap before leaning on LM Studio unattended for the multi-hour Saturday-morning stopgap scenario this was built for.

## Item 2 — Dirty-working-tree mystery (probably already resolved, verify)

Earlier in this session, `git status` via LM Studio showed ~45 files as modified with no real content change. Root cause found and fixed: `.git/config` had `core.filemode = true`, and permission bits read back through the Parallels-shared mount don't reliably match what git recorded — pure noise, no actual diffs. Fixed via (from Windows, but it's the same `.git/config` both sides read):

```
git config --local core.fileMode false
```

Confirmed clean from the Windows side immediately after (`git status` → only untracked `AGENTS.md`). But the local LM Studio agent, asked to re-check afterward, still reported the tree as dirty with roughly the same ~45-file set (minus two files that had "resolved"). Two live hypotheses, not yet distinguished:

1. **Stale context** — the agent was reasoning over an old cached tool result from earlier in its own conversation rather than a truly fresh `git_status` call. (Most likely, given the fix is confirmed present in the one shared `.git/config` file, and a native macOS `git status` should read it identically to Windows' git.)
2. **A genuine macOS-native git discrepancy** — something about how git behaves against this specific SMB/Parallels-shared path differs between a native macOS git process and a Windows one, independent of the `core.fileMode` setting. Less likely (no global `~/.gitconfig` override was found on the Mac side either), but worth ruling out empirically rather than assumed away.

**To verify:** run `git status --porcelain=v1 -b` and `git diff --stat` **directly** (native terminal, not through the LM Studio MCP tool) from the macOS side against `~/Dev/repos/ai-research-blog`. If clean (matches Windows), it confirms hypothesis 1 — the earlier LM Studio transcript was stale, nothing further to fix, just note it in the Local Agent Log. If still dirty natively on macOS too, that's a real finding — capture the actual `git diff` output for a couple of the affected files (not just `--stat`) to see whether it's still mode-only noise (a different permission bit than `filemode`, e.g. something in `core.sparseCheckout`/`core.symlinks`) or something else entirely, and report back before assuming it's safe to `git restore` anything.
