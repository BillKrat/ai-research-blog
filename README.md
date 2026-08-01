# AI Research Blog

BlogResearch is a small Streamlit application built around a decoupled,
provider-based architecture: the UI never talks to Claude, Postgres, or
any other data source directly — everything goes through interfaces
wired up by a small dependency-injection composition root.

## Current implementation

The app follows an MVP-style structure adapted to Streamlit's
rerun-the-whole-script execution model:

- **View** — the Streamlit UI lives in [app.py](app.py); the `IView`
  contract and its Streamlit adapter are in [views/](views/).
- **Presenter** — in [business/](business/). Presenters depend on
  `IView` and `IProvider` only, never on Streamlit or a concrete data
  source.
- **Provider (data layer)** — in [data/](data/). Each provider
  implements `IProvider.say_hello()` and raises `ProviderError` on
  failure instead of crashing or silently returning an error string.
  Failures are always wrapped and re-raised as `ProviderError` (never
  swallowed into a fake "success") — `ClaudeProvider` catches both the
  Anthropic SDK's own exception hierarchy and any other unexpected
  exception, always re-raising as `ProviderError` with the original
  preserved via `raise ... from exc`.
- **Composition root** — dependency resolution is centralized in
  [config/container.py](config/container.py); application settings
  (which provider, which presenter) live in
  [config/app_settings.py](config/app_settings.py).

### What the app does today

- Renders a simple UI with an "Ask" button.
- Resolves a presenter through the DI container, based on
  `AppSettings` (which reads from the environment).
- Calls a provider through the `IProvider` interface to produce a
  response, and displays either the result or a user-facing error.
- Supports three providers, selected via `PROVIDER_NAME`:
  - `claude` (default) — [data/claude_provider.py](data/claude_provider.py), via the Anthropic API
  - `dci` — [data/dci_provider.py](data/dci_provider.py), a fixed-response provider for local/offline flows
  - `postgres` — [data/postgres_provider.py](data/postgres_provider.py)

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
     formatting instead of the default

4. Run the app:

   ```bash
   streamlit run app.py
   ```

## Deployment note

The project is set up for Railway deployment through
[Procfile](Procfile). Production secrets should be stored as
environment variables in Railway rather than committed to source
control.

## Architecture overview

- **Presentation layer:** Streamlit UI in [app.py](app.py); `IView` /
  `StreamlitView` in [views/](views/).
- **Business layer:** presenters in [business/](business/).
  `HelloPresenter` owns the shared success/error flow; `CustomPresenter`
  inherits it and only overrides how a successful message is
  formatted (a template-method arrangement, not duplicated logic).
- **Data layer:** providers in [data/](data/), all implementing
  `IProvider` and raising `ProviderError` on failure.
- **DI container:** [config/container.py](config/container.py) maps
  provider names to factory functions in a registry — adding a new
  provider means registering it, not editing an if/else chain.

This keeps the UI independent of the underlying provider
implementation and makes it possible to swap providers, presenters, or
even the UI framework without touching the others.

**A framework-agnostic reusability note:** the interfaces
(`IProvider`, `IPresenter`, `IView`) and the composition-root pattern
are the pieces most likely to be reusable across future apps. Nothing
is packaged for external reuse yet — that's deliberately deferred
until there's a second real consumer — but the code is kept clean of
app-specific logic bleeding into those interfaces, so extracting them
later should be mechanical rather than a redesign.

## Testing

The project uses pytest for automated checks.

### Run the test suite

```bash
pytest
```

### Current test coverage

- [tests/test_container.py](tests/test_container.py) — DI resolution
  (including the provider registry, case-insensitivity, and the
  unknown-provider error path), and Postgres connection-string
  resolution from the environment.
- [tests/test_presenter.py](tests/test_presenter.py) — presenter
  behavior for both `HelloPresenter` and `CustomPresenter`, covering
  both the success path and the `ProviderError` → `view.show_error()`
  path.
- [tests/test_claude_provider.py](tests/test_claude_provider.py) —
  verifies a real Anthropic SDK error (e.g. `AuthenticationError`) is
  wrapped as `ProviderError` rather than propagating unchanged.
- [tests/test_environment.py](tests/test_environment.py) — `.env`
  loading, including that a real environment variable always wins
  over a value in `.env`.

## Integration test for PostgreSQL

[tests/test_container.py](tests/test_container.py) also contains an
integration-style test that exercises the real Postgres provider when
`DATABASE_URL` is configured and reachable.

### What it does

- Connects to the configured database.
- Queries the `triple_store` table for the fixed subjects
  `unit-test-1` and `unit-test-2`.
- Verifies the returned rows match the expected fixture values — this
  assertion is deliberately outside the connection try/except, so a
  real mismatch fails the test rather than being silently skipped.
- Skips gracefully only when `DATABASE_URL` is missing or the database
  is unreachable (e.g. a `.railway.internal` host that only resolves
  from inside Railway's network).

## Project structure

```text
app.py
business/
  interfaces.py       # IView, IPresenter
  hello_presenter.py   # default presenter (owns success/error flow)
  custom_presenter.py  # overrides result formatting only
config/
  environment.py       # .env loading (no import-time side effects)
  app_settings.py       # AppSettings — env-driven provider/presenter choice
  container.py          # composition root: provider registry + resolve_*()
data/
  interfaces.py         # IProvider
  exceptions.py          # ProviderError
  claude_provider.py
  dci_provider.py
  postgres_provider.py
views/
  streamlit_view.py     # IView adapter for st.session_state
tests/
```
