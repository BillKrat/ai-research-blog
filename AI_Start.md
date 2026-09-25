# AI_Start.md — ai-research-blog

Entry point for any new or resumed AI session on this repo. Read this first; it links out rather
than duplicating extended docs. See `AI_Stop.md` for how this file was last updated and why.

## Purpose

Ground a new AI session with enough context to resume the `Adventures.Entities` /
`Adventures.Data.NQuad` reusable-entity work without re-deriving history from chat transcripts.

## Project context

`ai-research-blog` is an Angular + ASP.NET Core (Aspire-composed) replacement for
AdventuresOnTheEdge.net. Reusable identity/security/data-access capabilities live in the sibling
repo `Adventures.Foundation`, referenced from `AiBlogResearch.slnx` via relative paths. A
proof-of-concept repo, `poc` (specifically `poc/nquad-end-to-end-poc`), is the read-only reference
sandbox for the N-Quad/dynamic-entity direction — do not edit it as part of this work.

Multi-repo layout (all siblings under `M:\Dev\repos\`):
- `M:\Dev\repos\ai-research-blog\` — open workspace root; solution file `AiBlogResearch.slnx`.
- `M:\Dev\repos\Adventures.Foundation\` — reusable library/tests (`src/`, `test/`), branch
  `nguid-slice`.
- `M:\Dev\repos\poc\` — POC reference repo (`nquad-end-to-end-poc`), branch `main`. Reference only.

## Current state

Mid-flow on a deliberate, incremental build-out of a reusable, storage-agnostic dynamic-entity
model, proven end-to-end against the POC's seed data before widening scope.

**Done and green (validated 2026-09-24):**
- `Adventures.Data.NQuad` (library) + `Adventures.Data.NQuad.Tests` (live-Postgres tool tests) —
  N-Quad parsing/storage over PostgreSQL, verified against the live SmarterASP instance.
- `Adventures.Entities` (library) — storage-agnostic dynamic entity model ported from the POC,
  with one deliberate change: every stored field value is a `FieldValue(IEntityId Id, object
  Value)` pair, not a bare value, so update/delete against the originating record is possible
  later. Key types: `IEntityId`/`EntityId`, `FieldValue`, `SchemaTypeConverter`, `EntitySchema`/
  `EntitySchemaField` (built from raw triples, no dependency on any specific store),
  `IDynamicEntity`/`DynamicEntity` (`Set`/`Add` require an explicit id argument), `User`,
  `EntityConstants`.
- `Adventures.Data.NQuad.NQuadUserAdapter` — bridges N-Quads to `Adventures.Entities`: builds a
  "UserSchema" `EntitySchema` and materializes `IEnumerable<User>` from parsed `NQuad` rows,
  tagging each field's `FieldValue.Id` with the originating quad's `Guid`.
- `Adventures.Entities.Tests.UserAndUserSchemaTests` — file-based (no live DB needed) test that
  parses `seed.nq`, builds the User schema, materializes Bill's `User`, and asserts both the value
  and that its `FieldValue.Id` is populated. Passing.
- `AiBlogResearch.slnx` updated with both new projects under `/Adventures/` and
  `/Adventures/Tests/`.
- Filed `docs/bug-reports/vs-edit-outside-workspace-dialog-hang.md` — a Visual Studio bug report
  for the recurring "edit outside workspace" trust-dialog hang (see Known constraints below).

**Explicitly deferred (do not start without new direction):**
- Multi-tenancy fields on `User`/schema.
- Any changes to `mock-data.txt`, `seed.nq`, `validated.csv` beyond what already exists — these
  three must stay in sync; if any one changes, update the other two in the same change.
- Update/delete implementations that actually use the preserved `FieldValue.Id` (only the
  plumbing to preserve the id exists so far — no mutation path has been built yet).

## Immediate goals / tasks

1. Confirm with the user what the next concrete increment is (likely: either a second entity type
   beyond `User`, or the first update/delete operation that consumes `FieldValue.Id`, or widening
   `NQuadUserAdapter` test coverage). Do not assume — ask if unclear.
2. Keep growth test-first and incremental: one small proven step before the next, per established
   working style this session.
3. If/when multi-tenancy fields are introduced, update `seed.nq`, `mock-data.txt`, and
   `validated.csv` together in the same change.

## How to run & test

From `M:\Dev\repos\ai-research-blog\` (workspace root), restore/build/test via the `.slnx` or
directly against the affected `.csproj` using `dotnet` CLI (the IDE's own build/test tools can lag
behind a fresh sibling-repo project addition until a `dotnet restore` has run once):

```powershell
cd M:\Dev\repos\ai-research-blog
dotnet restore .\AiBlogResearch.slnx
dotnet build "M:\Dev\repos\Adventures.Foundation\test\Adventures.Entities.Tests\Adventures.Entities.Tests.csproj"
dotnet test "M:\Dev\repos\Adventures.Foundation\test\Adventures.Entities.Tests\Adventures.Entities.Tests.csproj" --filter "FullyQualifiedName~UserAndUserSchemaTests"
```

Expected output: `Passed! - Failed: 0, Passed: 1, Skipped: 0, Total: 1`.

Live-Postgres tool tests (separate, opt-in, require `ConnectionStrings:Postgres` user-secret):

```powershell
dotnet test "M:\Dev\repos\Adventures.Foundation\test\Adventures.Data.NQuad.Tests\Adventures.Data.NQuad.Tests.csproj"
```

## Important files & entry points

- `AiBlogResearch.slnx` — solution wiring for both this repo and the two sibling repos.
- `M:\Dev\repos\Adventures.Foundation\src\Adventures.Entities\` — the reusable entity model
  (`DynamicEntity.cs`, `FieldValue.cs`, `IEntityId.cs`, `EntitySchema.cs`,
  `SchemaTypeConverter.cs`, `User.cs`, `EntityConstants.cs`, `IDynamicEntity.cs`).
- `M:\Dev\repos\Adventures.Foundation\src\Adventures.Data.NQuad\NQuadUserAdapter.cs` — the
  N-Quad-to-`User` bridge.
- `M:\Dev\repos\Adventures.Foundation\test\Adventures.Entities.Tests\UserAndUserSchemaTests.cs` —
  the proof test described above.
- `M:\Dev\repos\Adventures.Foundation\src\Adventures.Data.NQuad\Sql\seed\seed.nq` — seed artifact
  (linked into both test projects); source of truth for instance/schema quads.
- `M:\Dev\repos\poc\nquad-end-to-end-poc\artifacts\{mock-data.txt,seed.nq,validated.csv}` — the
  original POC artifact triad; must stay in sync with the copy under `Adventures.Data.NQuad`.
- `M:\Dev\repos\poc\nquad-end-to-end-poc\src\Poc\{DynamicEntity.cs,User.cs,EntitySchema.cs,
  SchemaTypeConverter.cs,IDynamicEntity.cs,AuditRecord.cs}` — POC reference implementations this
  work was ported/adapted from. Read-only reference.
- `docs/bug-reports/vs-edit-outside-workspace-dialog-hang.md` — VS bug report ready to submit.
- `AGENTS.md` — dated session log with fuller narrative for this and prior sessions.

## Known constraints (read before editing files)

- **Never** use `create_file` / `replace_string_in_file` / `multi_replace_string_in_file` on paths
  under the sibling repos (`Adventures.Foundation`, `poc`) — this triggers an unclosable Visual
  Studio "edit outside workspace" trust dialog that hangs the session. Always use
  `run_command_in_terminal` with PowerShell (`Set-Content`, `Get-Content -Raw` + `-replace`,
  `New-Item`, `Copy-Item`, `Move-Item`) for those files instead. Build content as single-line
  strings using `` `n `` for newlines — PowerShell here-strings (`@'...'@`) hang the terminal
  waiting for more input.
- If the trust dialog appears anyway, do not click its buttons (they do not respond) — interrupt
  the in-flight agent tool call instead, then verify no partial/locked file was left before
  resuming with the terminal-based approach.
- Files under `M:\Dev\repos\ai-research-blog\` (the open workspace root) can be edited normally
  with the standard editor tools.

## Resumption notes

- Open decision: what the next concrete increment is (see Immediate goals above) — ask the user.
- No partial/uncommitted risky state: all changes described above are complete, build-clean, and
  test-green as of this write-up.
- See `AI_Stop.md` for exact repository/commit status at session end.
