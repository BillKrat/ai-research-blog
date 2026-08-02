# AGENTS.md

Context for AI agents and developers working in this repository. This
is a learning project — keep changes simple, readable, and easy to
verify. Don't introduce a framework or abstraction the current task
doesn't need.

This file covers setup, configuration, and what the app can currently
do. Rationale and history for *why* it's built this way lives in
[docs/adr/](docs/adr/) — check there before making a change that
seems to contradict something here.

> ⚠️ Don't replace this file wholesale when editing it — extend it.
> (It's happened before, silently, during a Copilot session.)

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

- **View** — `app.py` (Streamlit entrypoint, the only module that
  imports `streamlit`). `IView` (`business/interfaces.py`) is the
  contract; `StreamlitView` (`views/streamlit_view.py`) is the only
  place that knows the `st.session_state` key names.
- **Presenter** — `business/`:
  - `HelloPresenter` / `CustomPresenter` — `IProvider`-backed.
  - `DbHelloPresenter` — `IDbProvider`-backed, a separate class on
    purpose.
- **Data layer** — `data/interfaces.py` defines three interfaces:
  - `IProvider` — LLM backends: `ClaudeProvider`, `DCIProvider`.
  - `IDbProvider` — storage backends: `PostgresProvider`.
  - `IToolProvider` — tool discovery/execution for a reasoning engine.
    Defined, not yet implemented anywhere.
  - All raise `data.exceptions.ProviderError` on failure.
- **Composition root** — `config/container.py`: `LLM_PROVIDER_FACTORIES`
  and `DB_PROVIDER_FACTORIES` registries; `resolve_presenter()`
  dispatches to the matching presenter type.
- **Settings** — `config/app_settings.py::AppSettings`, env-driven
  (`PROVIDER_NAME`, `USE_CUSTOM_PRESENTER`).

Design rationale: [docs/adr/0002](docs/adr/0002-mvp-di-provider-architecture.md)
(overall architecture), [docs/adr/0003](docs/adr/0003-provider-interface-split.md)
(why three data-layer interfaces).

**Not yet built:** a Postgres-backed triple store for user-defined
forms — see [docs/adr/0004](docs/adr/0004-triple-store-for-user-forms.md)
(proposed, not implemented).

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
  `IToolProvider`, add a fourth interface rather than force it in.
- Don't reintroduce import-time side effects (env loading, DB
  connections, etc.) in modules other than the explicit entrypoints
  (`app.py`, `tests/conftest.py`).
- Don't hardcode credentials or connection strings.
- Don't replace this file wholesale — extend it.

## Decision log

Full context, rationale, and history for the decisions above:
[docs/adr/](docs/adr/)
