# AI Research Blog

BlogResearch is a small Streamlit application built around a decoupled,
provider-based architecture: the UI never talks to Claude, Postgres, or
any other data source directly — everything goes through interfaces
wired up by a small application-level composition root.

Design rationale and decision history live in
[docs/adr/](docs/adr/) — this file covers current capabilities only.

## Architecture

- **View** — Streamlit UI in [app.py](app.py). `IView`
  ([blogresearch/interfaces.py](blogresearch/interfaces.py)) is the contract;
  [blogresearch/views/streamlit_view.py](blogresearch/views/streamlit_view.py) is the Streamlit
  adapter, and the only place that knows the `st.session_state` key
  names.
- **Presenter** — [blogresearch/presenters/](blogresearch/presenters/):
  - `HelloPresenter` / `CustomPresenter` — `IProvider`-backed.
    `CustomPresenter` inherits `HelloPresenter` and overrides only the
    result formatting.
  - `DbHelloPresenter` — `IDbProvider`-backed, a separate class.
- **Data layer** — [blogresearch/providers/interfaces.py](blogresearch/providers/interfaces.py) defines
  three interfaces, each implementation raising `ProviderError`
  ([blogresearch/providers/exceptions.py](blogresearch/providers/exceptions.py)) on failure:
  - `IProvider` — LLM/completion backends: [ClaudeProvider](blogresearch/providers/claude_provider.py), [DCIProvider](blogresearch/providers/dci_provider.py).
  - `IDbProvider` — persistence backends: [PostgresProvider](blogresearch/providers/postgres_provider.py).
  - `IToolProvider` — tool discovery/execution for a reasoning engine.
    Defined, not yet implemented anywhere.
- **Composition root** — [blogresearch/config/registrations.py](blogresearch/config/registrations.py):
  `LLM_PROVIDER_FACTORIES` / `DB_PROVIDER_FACTORIES` registries;
  `resolve_presenter()` returns the matching presenter type.
  [blogresearch/config/app_settings.py](blogresearch/config/app_settings.py) holds the env-driven
  `AppSettings` (`PROVIDER_NAME`, `USE_CUSTOM_PRESENTER`).

### What the app does today

- Renders a UI with an "Ask" button.
- Resolves a presenter through the DI container, based on
  `AppSettings`.
- Depending on `PROVIDER_NAME`, that presenter is backed by an
  `IProvider` (LLM) or an `IDbProvider` (storage), and displays either
  the result or a user-facing error.
- Supported values for `PROVIDER_NAME`:
  - `claude` (default) — Anthropic API (`IProvider`)
  - `dci` — fixed-response provider for local/offline flows (`IProvider`)
  - `postgres` — reads one row from a fixture table (`IDbProvider`)

## Local setup

1. Create and activate a virtual environment:

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Create a local environment file and fill in the values you need:

   ```bash
   cp .env.example .env
   ```

   The app reads environment variables from the local `.env` file when
   available (a real environment variable always takes precedence over
   `.env`).

   Recommended values:
   - `ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`) for Claude-based runs
   - `DATABASE_URL` for Postgres-backed runs
   - `PROVIDER_NAME` — `claude` (default), `dci`, or `postgres`
   - `USE_CUSTOM_PRESENTER` — `true` to use `CustomPresenter`'s
     formatting instead of the default (applies to the LLM path only)

4. Run the app:

   ```bash
   streamlit run app.py
   ```

## Deployment note

The project is set up for Railway deployment through
[Procfile](Procfile). Production secrets should be stored as
environment variables in Railway rather than committed to source
control.

## Testing

```bash
pytest
```

- [tests/test_container.py](tests/test_container.py) — DI resolution
  through both provider registries, presenter dispatch, Postgres
  connection-string resolution, and a Postgres integration test that
  exercises the real database when `DATABASE_URL` is configured and
  reachable (skips gracefully otherwise).
- [tests/test_presenter.py](tests/test_presenter.py) — `HelloPresenter`,
  `CustomPresenter`, and `DbHelloPresenter`, covering both the success
  path and the `ProviderError` → `view.show_error()` path for each.
- [tests/test_claude_provider.py](tests/test_claude_provider.py) —
  a real Anthropic SDK error wrapped as `ProviderError`.
- [tests/test_environment.py](tests/test_environment.py) — `.env`
  loading behavior.

## Project structure

```text
app.py
blogresearch/
  interfaces.py            # IView, IPresenter, ViewModelResolver
  presenters/
    hello_presenter.py     # IProvider-backed presenter (owns success/error flow)
    custom_presenter.py    # overrides HelloPresenter's result formatting only
    db_hello_presenter.py   # IDbProvider-backed presenter (separate on purpose)
  providers/
    interfaces.py          # IProvider, IDbProvider, IToolProvider
    exceptions.py          # ProviderError
    claude_provider.py     # IProvider
    dci_provider.py        # IProvider
    postgres_provider.py   # IDbProvider
  views/
    streamlit_view.py      # IView adapter for st.session_state
  view_models/
    session_state_view_model.py
  config/
    environment.py         # .env loading (no import-time side effects)
    app_settings.py        # AppSettings — env-driven provider/presenter choice
    registrations.py       # app composition root: per-family registries + resolve_*()
shared/
  container.py             # reusable DI container primitives
tests/
docs/
  adr/                    # Architecture Decision Log — see docs/adr/
```

## Further reading

Why the app is structured this way, what was tried and replaced, and
what's designed but not yet built: [docs/adr/](docs/adr/).
