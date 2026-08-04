# AGENTS.md

Context for AI agents and developers working in this repository. This
is a learning project — keep changes simple, readable, and easy to
verify. Don't introduce a framework or abstraction the current task
doesn't need.

This file covers setup, configuration, and what the app can currently
do. Rationale and history for *why* it's built this way lives in
[docs/adr/](docs/adr/) — check there before making a change that
seems to contradict something here. Where the product is headed —
requirements not yet built, several with real open decisions — is
tracked in [docs/ASR.md](docs/ASR.md).

> ⚠️ Don't replace this file wholesale when editing it — extend it.
> (It's happened before, silently, during a Copilot session.)

## Working style

- The user has a long .NET/C# background (see the Kratochvil/MVPVM/Prism
  references in [docs/adr/0002](docs/adr/0002-mvp-di-provider-architecture.md)
  and [docs/adr/0007](docs/adr/0007-repository-pattern-for-domain-layer.md))
  and is learning Python through this project. Requests may be phrased
  in .NET terms (or ask for .NET-shaped solutions) without that being
  the actual goal — the goal is an idiomatic Python solution, and for
  the user to learn Python idioms in the process. When a literal
  reading would import .NET ceremony (an interface for a single
  implementation with no near-term second one, a generic DI container,
  a DAL/BLL/Repository stack three layers deep for something that
  doesn't need it), prefer the smaller, more direct Python shape and
  say so, rather than building the .NET-shaped version by default.
- The MVPVM / DI / Provider / Repository *pattern*
  ([docs/adr/0002](docs/adr/0002-mvp-di-provider-architecture.md),
  [docs/adr/0007](docs/adr/0007-repository-pattern-for-domain-layer.md))
  is now considered sufficiently settled. Build features on top of it;
  don't keep redesigning the pattern itself unless a real, current
  need shows up that it can't accommodate. This is distinct from where
  the code implementing that pattern *lives* — the `shared/` vs
  `blogresearch/` package boundary (ADR-0009) is expected to keep
  shifting a little as new code is written and gets sorted onto the
  correct side; that's routine maintenance of an already-decided
  boundary, not the kind of restructuring this bullet is about.

## Project

- Repo: `BillKrat/ai-research-blog`
- Stack: Python, Streamlit (UI), pytest, Anthropic Claude API,
  PostgreSQL
- Deploy: Railway, auto-deploys from `main` on push
- Live: https://blogresearch.net

## Workflow

Feature work happens on a branch; merge to `main` (then push) only
once it's working end to end — every push to `main` deploys live.
Rationale: [docs/adr/0001](docs/adr/0001-branch-then-merge-workflow.md).

## Capabilities — current architecture

The pattern is **MVPVM** (Model-View-Presenter-ViewModel), adapted for
Streamlit's rerun model — not generic "MVP." See
[docs/adr/0002](docs/adr/0002-mvp-di-provider-architecture.md) for the
precise mapping and source citation.

Two packages, split by reusability, not by architectural layer — see
[docs/adr/0009](docs/adr/0009-extract-reusable-framework-into-shared.md):

- **`shared/`** — the reusable framework. Nothing in here references
  `ai-research-blog`'s specific demo feature, Claude, or a "hello"
  vocabulary of any kind. This is what a second app built on the same
  pattern would start from.
- **`blogresearch/`** — this app's own choices built on top of
  `shared/`: which concrete providers exist, what the one demo
  feature does, how they're wired together. A second app would not
  reuse this package — it would write its own equivalent of it,
  against `shared/`.

When adding something new, ask which side it belongs on: no
app-specific vocabulary (feature names, this app's field/method
names) → `shared/`; anything that names this app's specific choices →
`blogresearch/`. When genuinely unsure, default to `blogresearch/` —
moving something to `shared/` later is cheap, walking back something
prematurely generalized is not.

- **View** — `app.py` (Streamlit entrypoint, the only module that
  imports `streamlit`). `IView` (`shared/interfaces.py`) exposes
  `session_state` (the raw binding container) and a settable
  `view_model` property; it has no `show_result()`/`show_error()`
  methods. Interim by design —
  [docs/adr/0006](docs/adr/0006-streamlit-interim-view.md).
  `StreamlitView` (`shared/streamlit_view.py`) is the concrete
  adapter — generic, not tied to this app's demo feature.
- **ViewModel** — `IViewModel` (`shared/interfaces.py`) is the real
  bindable state contract: `result`/`error` as properties with
  setters. `SessionStateViewModel` (`shared/session_state_view_model.py`)
  backs it with `st.session_state`. A Presenter takes a
  `ViewModelResolver` (`shared/interfaces.py` —
  `Callable[[IPresenter], IViewModel]`) as a constructor argument and
  calls it with itself to get its ViewModel, then assigns the result
  to `view.view_model` in its own `__init__`; after that, presenters
  write through `view.view_model.result = ...` / `.error = ...` and
  never touch `st.session_state` directly again. (Property is
  `view_model`, snake_case — not `ViewModel` — Python naming, not the
  C#/WPF convention the concept comes from.)
- **Presenter** — `blogresearch/presenters/` (app-specific: these
  implement this app's one demo feature, not reusable):
  - `HelloPresenter` / `CustomPresenter` — `IProvider`-backed.
  - `DbHelloPresenter` — `IDbProvider`-backed, a separate class on
    purpose.
  - Neither imports `blogresearch/config/registrations.py` — each
    takes `resolve_viewmodel` as a constructor argument instead (see
    ViewModel above). `registrations.py` imports every presenter class
    already, so a presenter importing it back would be circular;
    taking the resolver as a parameter keeps the dependency
    one-directional (`blogresearch/config/` → `blogresearch/presenters/`
    only) instead of just timing around the cycle with a deferred
    import.
- **Data layer** — `blogresearch/providers/interfaces.py` defines two
  app-specific interfaces:
  - `IProvider` — LLM backends: `ClaudeProvider`, `DCIProvider`.
  - `IDbProvider` — storage backends: `PostgresProvider`.
  - Both raise `shared.exceptions.ProviderError` on failure.
  - These stay in `blogresearch/`, not `shared/`, because their
    methods (`say_hello()`, `get_message()`) name this app's specific
    demo feature, not a generic capability — see ADR-0009. A future
    `IToolProvider`-shaped need would go in `shared/` instead (see
    `shared/tool_provider.py` below), since tool discovery/execution
    isn't blog-specific vocabulary.
  - Persistence-facing domain logic sits on top as a **Repository** —
    [docs/adr/0007](docs/adr/0007-repository-pattern-for-domain-layer.md).
- **Repository** — `shared/repositories/` (reusable, domain-agnostic):
  - `TripleRepository` (`interfaces.py`) — CRUDL (`create`/`read`/
    `update`/`delete`/`list`) over `(subject, predicate, object_value)`
    rows, one `(subject, predicate)` slot at a time (single-valued,
    not RDF multi-valued facts). `PostgresTripleRepository` is the
    concrete implementation, over the existing `triple_store` table.
  - Talks to Postgres directly (same `DATABASE_URL`/`psycopg2`
    pattern as `PostgresProvider`) rather than composing through
    `IDbProvider` — see
    [docs/adr/0008](docs/adr/0008-triple-repository-first-implementation.md)
    for why.
  - Not yet wired into `resolve_presenter()`/the composition root —
    no presenter or UI feature consumes it yet. The not-yet-built
    `FormDataRepository` (ADR-0004) is expected to compose it once
    the forms-specific DTO/schema questions are resolved.
- **Tool provider** — `shared/tool_provider.py::IToolProvider` — tool
  discovery/execution for a reasoning engine. Defined, not yet
  implemented anywhere; domain-agnostic, so it lives in `shared/`
  rather than alongside `IProvider`/`IDbProvider`.
- **Composition root** — `blogresearch/config/registrations.py`
  (inherently app-specific — it wires *this app's* concrete choices,
  so it stays in `blogresearch/` even though the pattern it follows
  is reusable): `LLM_PROVIDER_FACTORIES` and `DB_PROVIDER_FACTORIES`
  registries; `resolve_presenter(view, settings=None)` dispatches to
  the matching presenter type, resolving through the reusable generic
  `Container`/`Scope` in `shared/container.py`. `settings` defaults to
  `AppSettings()` (environment-driven) when omitted — same
  optional-override pattern as `PostgresProvider.conn_string` — so
  `app.py` stays a one-liner while tests can still inject explicit
  settings directly instead of monkeypatching env vars.
  `resolve_viewmodel(presenter)` resolves the `IViewModel` a presenter
  gets; passed to `DbHelloPresenter`/`HelloPresenter`/`CustomPresenter`
  as a constructor argument here in `resolve_presenter()`, then called
  by each presenter with itself once it exists.
- **Settings** — `blogresearch/config/app_settings.py::AppSettings`,
  env-driven (`PROVIDER_NAME`, `USE_CUSTOM_PRESENTER`).
- **Environment loading** — `shared/environment.py::load()` — `.env`
  loading, generic, no app-specific vocabulary.

Design rationale: [docs/adr/0002](docs/adr/0002-mvp-di-provider-architecture.md)
(overall architecture), [docs/adr/0003](docs/adr/0003-provider-interface-split.md)
(why the data-layer interfaces are split), [docs/adr/0007](docs/adr/0007-repository-pattern-for-domain-layer.md)
(Repository pattern for persistence-facing logic), [docs/adr/0008](docs/adr/0008-triple-repository-first-implementation.md)
(`TripleRepository`'s scope and schema decisions), [docs/adr/0009](docs/adr/0009-extract-reusable-framework-into-shared.md)
(the `shared/` vs `blogresearch/` boundary and why it's settled now).

**Not yet built:** the form-specific `FormDataRepository` — schema
representation, DTO routing (grid data vs. form layout metadata), and
a first concrete form — see
[docs/adr/0004](docs/adr/0004-triple-store-for-user-forms.md)
(proposed, not implemented). The generic `TripleRepository` it's
expected to sit on is built (above).

## Environment and secrets

- Local dev uses `.env` (gitignored); `.env.example` is the committed
  placeholder template — **never put a real secret in
  `.env.example`, only in `.env`.**
- `ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`) — Claude provider.
- `DATABASE_URL` — Postgres provider.
- `PROVIDER_NAME` — `claude` (default) / `dci` / `postgres`.
- `USE_CUSTOM_PRESENTER` — `true` to use `CustomPresenter`; defaults
  to `false`. Only affects the LLM path.
- Production: same variables set in Railway's Variables tab, never
  committed.

## Local development

```bash
python3 -m venv venv
source venv/bin/activate       # VS Code's integrated terminal does this automatically
                                # once "Python: Select Interpreter" points at ./venv/bin/python
pip install -r requirements.txt
streamlit run app.py
```

Debugging: use the "Streamlit: app.py" config in VS Code's Run and
Debug panel (`.vscode/launch.json`) — not plain F5 on whatever file
happens to be open, which will try to execute the wrong file.

## Testing

```bash
pytest
```

- `tests/test_container.py` — DI resolution through both provider
  registries, presenter dispatch, Postgres connection-string
  resolution, and a Postgres integration test (skip-safe when
  `DATABASE_URL` is unset or unreachable).
- `tests/test_presenter.py` — all three presenters, success and
  `ProviderError` paths.
- `tests/test_claude_provider.py` — a real Anthropic SDK error wrapped
  as `ProviderError`.
- `tests/test_environment.py` — `.env` loading behavior.
- `tests/test_triple_repository.py` — `TripleRepository` CRUDL logic
  against a fake connection (no database needed — `DATABASE_URL`
  resolves to Railway's private network and isn't reachable from a
  local dev machine), plus skip-safe integration tests against the
  real `triple_store` table.

## What to avoid

- Don't introduce a DI framework, ORM, or other heavy dependency
  unless the task clearly needs it — extend the existing registry/ABC
  patterns instead.
- Don't let application code become aware of the test framework —
  tests inject what they need explicitly.
- Don't add an interface/ABC for something with only one real
  implementation and no near-term second one.
- Don't put two genuinely different responsibilities behind one
  interface just because they're currently shaped the same. If a new
  capability doesn't obviously fit `IProvider`, `IDbProvider`, or
  `IToolProvider`, add a new interface rather than force it in.
- Don't reintroduce import-time side effects (env loading, DB
  connections, etc.) in modules other than the explicit entrypoints
  (`app.py`, `tests/conftest.py`).
- Don't hardcode credentials or connection strings.
- Don't put app-specific vocabulary (feature names, this app's own
  method/field names) in `shared/` — and don't move something to
  `shared/` speculatively, before it's actually proven app-agnostic.
  When unsure which side something belongs on, default to
  `blogresearch/`: moving to `shared/` later is cheap, walking back a
  premature generalization is not. See ADR-0009.
- Don't replace this file wholesale — extend it.

## Decision log

Full context, rationale, and history for the decisions above:
[docs/adr/](docs/adr/)
