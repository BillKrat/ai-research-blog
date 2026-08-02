# 0003. Split IProvider into IProvider / IDbProvider / IToolProvider

Status: Accepted
Date: 2026-08-01

## Context

Even after ADR-0002's realignment, `IProvider` still covered Claude,
DCI, *and* Postgres alike — as if querying a database and asking an
LLM a question were the same responsibility, just because both
happened to return a `str` in this demo app. The user caught this and
supplied the corrected breakdown directly, from context (prompts
shared with Copilot earlier the same day) that hadn't been part of the
Claude review that produced ADR-0002.

## Decision

Three interfaces in `data/interfaces.py`, each raising the shared
`ProviderError` on failure:

- **`IProvider`** — narrowed to LLM/completion backends only:
  `ClaudeProvider`, `DCIProvider`.
- **`IDbProvider`** (new) — persistence backends. `PostgresProvider`
  moved onto it; `say_hello()` renamed to `get_message()` (an
  LLM-shaped method name doesn't belong on a storage interface).
  Deliberately minimal — one method, matching what the app actually
  reads today; expand when there's a second real read/write need, not
  before.
- **`IToolProvider`** (new, stub only) — tool discovery/execution for
  a future reasoning engine (`get_tool_schemas()` / `execute_tool()`).
  No concrete implementation: nothing in the app calls it yet. When a
  first real tool shows up, a dict/registry-driven implementation
  (mirroring the `LLM_PROVIDER_FACTORIES`/`DB_PROVIDER_FACTORIES`
  pattern below) is the recommended starting point — not a framework,
  and not a Pydantic-validated version until there are enough tools
  that malformed-argument bugs are a real risk.

At the presenter layer, `HelloPresenter`/`CustomPresenter` stayed
`IProvider`-only, and a new `DbHelloPresenter` was added for
`IDbProvider` — deliberately a separate class, not one presenter
accepting "anything shaped like a no-arg method returning a string."
That would have quietly reintroduced the exact conflation being fixed
one layer up.

`config/container.py` now has two registries, `LLM_PROVIDER_FACTORIES`
and `DB_PROVIDER_FACTORIES`; `resolve_presenter()` dispatches to the
matching presenter type based on which registry a `provider_name`
falls into.

**Naming collision to keep straight:** the `ToolsProvider`/
`IToolsProvider` removed in ADR-0002 was a config/feature-flag DTO
(which provider/presenter to use), unrelated to this `IToolProvider`
(LLM tool/function invocation) despite the similar name.

## Consequences

- `IDbProvider` is where ADR-0004's `FormDataRepository` is expected
  to build a richer, domain-specific repository on top — that
  repository sits *above* `IDbProvider`, not in place of it.
- Two presenter families (`IProvider`-backed, `IDbProvider`-backed)
  instead of one — more classes, but each stays honest about what it
  depends on.
- If a future capability doesn't obviously fit `IProvider`,
  `IDbProvider`, or `IToolProvider`, that's a signal to add a fourth
  interface, not to force it into one of these three.
