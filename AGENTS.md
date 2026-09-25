# AGENTS.md — ai-research-blog

Working context for any agent touching this repo — auto-loaded at the start of every session. This document was purged and repurposed on 2026-09-24 after a prior session went off-track and did not follow the objectives it was given; starting clean rather than layering more process on top of a session that already produced noise.

## Current objective: red-green refactor cleanup

This repo is mid red-green-refactor cleanup. Track objectives, status, and findings for that work here as the active session log — this file **is** the working scratchpad for this effort, not a pointer to another doc.

**Reference only — do not modify:** `M:\Dev\repos\poc\nquad-end-to-end-poc` (its own `AGENTS.md` and `docs/artifacts/` included). It's a separate sandbox repo used to prove out concepts before they land here. Read it for context/ideas when relevant, but this cleanup pass is scoped to `ai-research-blog` only — no edits to the POC repo as part of this work.

## Session log

(Dated entries go here — newest first. Each entry: what objective was being worked, what actually happened, current red/green state, and what's next.)

### 2026-09-24 — Adventures.Entities created; User + UserSchema materialized from seed.nq (green)

Objective: build reusable, storage-agnostic entity/security types (`Adventures.Entities`) from the
`poc/nquad-end-to-end-poc` `User`/`DynamicEntity` model, with the important addition that every
stored field value must carry the id of its originating record (not just the raw value), so future
update/delete operations against the source store have something to target.

What happened:
- Created `Adventures.Entities` (net10.0 library, no dependency on any storage engine) with
  `IEntityId`/`EntityId`, `FieldValue` (the (id, value) pair — the key new requirement),
  `SchemaTypeConverter`, storage-agnostic `EntitySchema`/`EntitySchemaField` (built from raw
  `(Subject, Predicate, Object)` triples instead of the POC's `InMemoryQuadrupleStore`),
  `IDynamicEntity`/`DynamicEntity` (internal storage is `Dictionary<string, List<FieldValue>>`;
  `Set`/`Add` now require an explicit `id` argument), `User`, `EntityConstants`.
- Added `NQuadUserAdapter` in `Adventures.Data.NQuad` (the storage-specific side, referencing
  `Adventures.Entities`) that builds a "UserSchema" `EntitySchema` and materializes
  `IEnumerable<User>` from parsed `NQuad` rows, tagging each `FieldValue.Id` with the originating
  quad's `Guid`.
- Added `Adventures.Entities.Tests` with `UserAndUserSchemaTests` — parses the existing
  `seed.nq` artifact (file-based, no live Postgres needed), builds the schema, materializes Bill's
  `User`, and asserts both the value (`"BillKrat"`) and that its `FieldValue.Id` is populated.
  Test passes; full solution builds clean (`dotnet build`/`run_build` both green).
- Wired both new projects into `AiBlogResearch.slnx` under `/Adventures/` and `/Adventures/Tests/`.
- Hit the recurring "edit outside workspace" VS trust-dialog hang multiple times while editing
  files under the sibling `Adventures.Foundation` repo via `create_file`/`replace_string_in_file`.
  Confirmed workaround: interrupt/cancel the in-flight agent tool call (not the dialog) to recover;
  then redo the edit via `run_command_in_terminal` + PowerShell. Filed as a bug report:
  `docs/bug-reports/vs-edit-outside-workspace-dialog-hang.md`.

Current state: green. `mock-data.txt`, `seed.nq`, `validated.csv` unchanged/in sync (no
multi-tenancy fields added yet, per explicit instruction to prove the base User/UserSchema path
first before widening scope).

Next: extend `Adventures.Entities` test coverage / adapters as directed in the next session,
starting from `AI_Start.md`.

### 2026-09-24 — Document purged and repurposed

Prior AGENTS.md content (initiative notes, LM Studio agent workflow, review-cadence rules, local agent log) removed — it had accumulated into noise and the last session ignored its stated objectives anyway. This file now tracks the red-green refactor cleanup directly. `docs/SESSION_HANDOFF.md` and `docs/artifacts/` still exist from before and can be consulted for prior architecture decisions, but are no longer the mandatory first read for this effort.
