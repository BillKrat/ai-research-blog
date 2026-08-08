# AI Research Blog

BlogResearch is a small Next.js application with a Python API built around a decoupled,
provider-based architecture: the UI never talks to Claude, Postgres, or
any other data source directly — everything goes through interfaces
wired up by a small application-level composition root.

Design rationale and decision history live in
[docs/adr/](docs/adr/) — this file covers current capabilities only.

## Architecture

Two packages, split by reusability — see
[docs/adr/0009](docs/adr/0009-extract-reusable-framework-into-shared.md):
[`shared/`](shared/) is the reusable framework (no app-specific
vocabulary anywhere in it — what a second app built on this pattern
would start from); [`blogresearch/`](blogresearch/) is this app's own
choices built on top of it.

- **View** — Next.js UI in [frontend/](frontend/), backed by the FastAPI
  endpoints in [app.py](app.py). `IView`
  ([shared/interfaces.py](shared/interfaces.py)) is the contract;
  [shared/api_view.py](shared/api_view.py) is the request-scoped API
  adapter.
- **Presenter** — [blogresearch/presenters/](blogresearch/presenters/)
  (app-specific — these implement this app's one demo feature):
  - `HelloPresenter` / `CustomPresenter` — `IProvider`-backed.
    `CustomPresenter` inherits `HelloPresenter` and overrides only the
    result formatting.
  - `DbHelloPresenter` — `IDbProvider`-backed, a separate class.
- **Data layer** — [shared/providers/interfaces.py](shared/providers/interfaces.py)
  defines three interfaces, each implementation raising `ProviderError`
  ([shared/exceptions.py](shared/exceptions.py)) on failure:
  - `IProvider` — LLM/completion backends: [ClaudeProvider](shared/providers/claude_provider.py), [DCIProvider](shared/providers/dci_provider.py).
  - `IDbProvider` — persistence backends: [PostgresProvider](shared/providers/postgres_provider.py).
  - `IToolProvider` — tool discovery/execution for a reasoning engine.
    Defined, not yet implemented anywhere.
  - Structurally decoupled from any one app, but `IProvider`/
    `IDbProvider`'s only implementations still hardcode this app's
    demo behavior (a fixed prompt, a fixed fixture table) — see
    ADR-0009's 2026-08-04 update. Reusing the classes themselves, not
    just the interfaces, still needs their method signatures
    generalized first.
- **Composition root** — [blogresearch/config/registrations.py](blogresearch/config/registrations.py)
  (inherently app-specific — it wires this app's concrete choices):
  `LLM_PROVIDER_FACTORIES` / `DB_PROVIDER_FACTORIES` registries;
  `resolve_presenter()` returns the matching presenter type, resolving
  through [shared/container.py](shared/container.py)'s reusable `Container`.
  [blogresearch/config/app_settings.py](blogresearch/config/app_settings.py) holds the env-driven
  `AppSettings` (`PROVIDER_NAME`, `USE_CUSTOM_PRESENTER`).
- **Repository** — [shared/repositories/](shared/repositories/)
  (reusable, domain-agnostic):
  `TripleRepository` — CRUDL over `(subject, predicate, object_value)`
  triples, one `(subject, predicate)` slot at a time.
  [PostgresTripleRepository](shared/repositories/postgres_triple_repository.py)
  is the concrete implementation. Not yet wired into the composition
  root — no UI feature consumes it yet; see
  [docs/adr/0008](docs/adr/0008-triple-repository-first-implementation.md).

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
  uvicorn app:app --reload --port 8000
   ```

  In another terminal, run the Next.js client:

  ```bash
  cd frontend
  npm install
  npm run dev
  ```

  The client runs at `http://localhost:3000` and calls the API at
  `http://localhost:8000`. Set `NEXT_PUBLIC_API_URL` when the API is hosted
  elsewhere.

## Deployment note

The Python API is set up for Railway deployment through [Procfile](Procfile).
Deploy the API as one Railway service and the Next.js client as a second
service.

### Railway environment variables

API service
- `ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`) for Claude-backed runs
- `DATABASE_URL` for Postgres-backed runs
- `PROVIDER_NAME` — `claude` (default), `dci`, or `postgres`
- `USE_CUSTOM_PRESENTER` — `true` or `false`
- `FRONTEND_ORIGIN` — the public URL of the frontend service, for example
  `https://your-frontend.up.railway.app`

Frontend service
- `NEXT_PUBLIC_API_URL` — the public URL of the API service, for example
  `https://your-api.up.railway.app`

### Deployment steps

1. Create a Railway service from the repository root for the FastAPI app.
2. The included [railway.toml](railway.toml) already sets the API start command to `uvicorn app:app --host 0.0.0.0 --port $PORT`.
3. Create a second Railway service from the `frontend/` directory for the Next.js app.
4. The included [frontend/railway.toml](frontend/railway.toml) already sets the frontend start command to `npm run start`.
5. Set the frontend service's build command to `npm run build`.
6. Set the frontend service's `NEXT_PUBLIC_API_URL` to the API service URL.
7. Set the API service's `FRONTEND_ORIGIN` to the frontend service URL.
8. Keep secrets in Railway environment variables rather than committing them to source control.

With this wiring, the frontend calls `/api/ask`, and the Next.js rewrite forwards it to the configured API URL.

## Testing

```bash
pytest
```

- [tests/test_container.py](tests/test_container.py) — DI resolution
  through both provider registries, presenter dispatch, Postgres
  connection-string resolution, and a Postgres integration test that
  exercises the real database when `DATABASE_URL` is configured and
  reachable (skips gracefully otherwise).
- [tests/test_api.py](tests/test_api.py) — the FastAPI `/api/ask` endpoint
  through the offline DCI provider.
- [tests/test_presenter.py](tests/test_presenter.py) — `HelloPresenter`,
  `CustomPresenter`, and `DbHelloPresenter`, covering both the success
  path and the `ProviderError` path for each.
- [tests/test_claude_provider.py](tests/test_claude_provider.py) —
  a real Anthropic SDK error wrapped as `ProviderError`.
- [tests/test_environment.py](tests/test_environment.py) — `.env`
  loading behavior.
- [tests/test_triple_repository.py](tests/test_triple_repository.py) —
  `TripleRepository` CRUDL logic against a fake connection, plus
  integration tests against the real `triple_store` table (skip
  gracefully when unreachable, same as the Postgres test above).

## Project structure

```text
app.py                      # FastAPI API entrypoint
frontend/                   # Next.js client
shared/                     # reusable framework - no app-specific vocabulary (ADR-0009)
  container.py              # reusable DI container primitives
  interfaces.py              # IView, IViewModel, IPresenter, ViewModelResolver
  exceptions.py               # ProviderError
  environment.py               # .env loading (no import-time side effects)
  api_view.py                   # IView adapter for HTTP requests
  mapping_view_model.py         # IViewModel adapter for request state
  providers/
    interfaces.py                 # IProvider, IDbProvider, IToolProvider
    claude_provider.py            # IProvider
    dci_provider.py               # IProvider
    postgres_provider.py          # IDbProvider
  repositories/
    interfaces.py                 # Triple, TripleRepository
    postgres_triple_repository.py  # TripleRepository backed by triple_store
blogresearch/                # this app's own choices, built on shared/ - deliberately small
  presenters/
    hello_presenter.py       # IProvider-backed presenter (owns success/error flow)
    custom_presenter.py      # overrides HelloPresenter's result formatting only
    db_hello_presenter.py    # IDbProvider-backed presenter (separate on purpose)
  config/
    app_settings.py          # AppSettings — env-driven provider/presenter choice
    registrations.py         # app composition root: per-family registries + resolve_*()
tests/
docs/
  adr/                    # Architecture Decision Log — see docs/adr/
```

## Further reading

Why the app is structured this way, what was tried and replaced, and
what's designed but not yet built: [docs/adr/](docs/adr/).
