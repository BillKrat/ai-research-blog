# Review: deploy workflows missing an Adventures.Foundation checkout

**Target:** `.github/workflows/deploy-webapi.yml` and `.github/workflows/deploy-mcp.yml`
(`deploy-webapi.yml` was last touched by Copilot in `#2`, "Harden WebApi FTP deploy against IIS
file-lock failures"; `deploy-mcp.yml` has no non-Claude authorship).

## What I found

`f6a6415` ("Updated so Foundation is not referenced as nuget", 2026-09-24, human) switched
`AiBlogResearch.WebApi.csproj` and `McpServer.WebApi.csproj` from NuGet `PackageReference`s on
`Adventures.*` to relative-path `ProjectReference`s against a sibling `Adventures.Foundation`
checkout - correct for local dev, where that sibling directory always exists. Neither deploy
workflow was updated to match: both only run `actions/checkout@v4` on `ai-research-blog` itself,
so `dotnet publish` would fail on a GitHub Actions runner with no `Adventures.Foundation` sibling
on disk. No commit since 2026-09-24 touches either workflow file, and no deploy-relevant push to
`main` has landed since then either - so this has been silently broken for about a week, never
caught because nothing exercised it.

This is not a hunch and nothing here reverts Copilot's or anyone else's logic - the hardening
Copilot added (`app_offline.htm`, retry-safe FTP) and the smoke-test steps are untouched; this is
purely an addition earlier in the job, before any of that runs.

## Fix applied

Added a second `actions/checkout@v4` step to both workflows, immediately after the primary
checkout: checks out `BillKrat/Adventures.Foundation` at `ref: main` into `path: ../Adventures.Foundation`
- a true sibling of the `ai-research-blog` checkout on the runner, matching the `..\..\..\` relative
paths in both `.csproj` files. Both repos are public, so no additional secret or token is needed.
Pinned to `main` because that is Adventures.Foundation's own "deploy-ready" branch, by the same
convention this repo already follows for itself.

## What the owner should change

Nothing required - this is additive and necessary for any WebApi/McpServer deploy to succeed at
all once a cross-repo `ProjectReference` is in play. If a future change needs a *different*
Adventures.Foundation ref per deploy (e.g. pinning a tag instead of tracking `main`), update the
`ref:` in both files together, since they must stay in sync with whatever `ai-research-blog/main`
was actually built and tested against.
