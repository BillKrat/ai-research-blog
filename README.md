# AI Research Blog

An AI-assisted, multi-tenant blog platform: Claude helps users draft
posts grounded in their own uploaded documents, and queries can span
both a user's own blogs and any other user's blog they subscribe to.
Two tenants and four blogs
([blogresearch.net](https://blogresearch.net),
[adventuresedge.net](https://adventuresedge.net)) are already seeded
in Postgres as the target data model; the live site today still runs
the single-feature demo this decoupled architecture was built to
prove out first (see "What the app does today" below) — this is a
working testbed for the architecture, not the finished product.

Two things make this more than a CRUD blog:

- **Locked, versioned business logic for regulated data.** User-created
  content can be sealed ("locked-down") once signed off, so a value
  stays reproducible exactly as it was at lock time even after the
  underlying algorithm improves for new work — the direct answer to a
  data-integrity failure mode from prior regulated-data experience
  (see [ASR-008](docs/ASR.md#asr-008-locked-value--versioned-bll-for-regulated-data)).
  A "Try Beta" toggle is planned on top of it, letting a user swap to a
  new implementation at runtime and revert if it isn't ready.
- **Schema-flexible data via a triple store**, not a fixed relational
  schema — the same model already proven out for blog/organization data
  in Postgres, and moving toward genuine RDF-style multi-valued facts.
  A `morph-kgc`-based SQLite→RDF pipeline is already proven end-to-end
  (`artifacts/rdf-poc/`). Neo4j Aura was evaluated and ruled out as the
  landing spot for that RDF — neither its RDF-import plugin nor its fast
  bulk-load path survives Aura's managed-service model at production
  scale (evidence: `artifacts/neo4j/`). **Oxigraph**, an embedded
  RDF/SPARQL store, is the adopted near-term target instead — a POC
  (`artifacts/rdf-poc/oxigraph_poc.py`) confirmed real bulk loading and
  on-disk persistence against this project's own seed data.

Everywhere the UI is decoupled from Claude, Postgres, or any other data
source: nothing talks to a concrete provider directly, everything goes
through interfaces wired up by a small application-level composition
root. That decoupling is what lets the roadmap below — a real graph
database, an MCP-mediated tool layer for Claude, JWT-based per-user
authorization — get added as new implementations rather than rewrites.

**Where this is headed**, requirement by requirement, is tracked in
[docs/ASR.md](docs/ASR.md) — each entry states what's required, why it
matters architecturally, and what's still an open decision:
[triple-store schema](docs/ASR.md#asr-001-postgresql-triple-store-with-inspectable-schema),
[JWT-based security](docs/ASR.md#asr-002-security-as-the-cross-cutting-foundation),
[MCP as the Claude tool gateway](docs/ASR.md#asr-003-mcp-as-the-tool-layer-gateway-for-the-ai-assistant),
[documents + cross-user subscriptions](docs/ASR.md#asr-004-ai-assisted-blog-platform-with-documents-and-cross-user-subscriptions),
[cost-aware model routing](docs/ASR.md#asr-005-ai-cost-mitigation-via-model-routing),
[MEF-style plugin extensibility](docs/ASR.md#asr-006-pluginextensibility-framework-mef-style),
[the Blogs feature](docs/ASR.md#asr-007-blogs-feature--multi-domain-pipeline-built-toward-the-model),
and [locked/versioned BLL](docs/ASR.md#asr-008-locked-value--versioned-bll-for-regulated-data).

Design rationale and decision history for what's already built live in
[docs/adr/](docs/adr/) — the rest of this file covers current
capabilities only.

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
  through [shared/container.py](shared/container.py)'s reusable
  `Container` — parent/child scoping, named registrations, and
  constructor auto-injection by type hint. A process-wide root
  container is built once (lazily, from environment settings);
  `resolve_presenter()`/`resolve_user_profile_presenter()` each resolve
  against a **child** of it, so page-specific registrations
  (`UserRepository`/`UserService`) never leak between pages while
  singletons like `TripleRepository` stay truly process-wide (not
  rebuilt per request — see the on-disk `OxigraphTripleRepository`
  constraint noted below).
  `TRIPLE_REPOSITORY_FACTORIES` is a third, independent registry —
  registered unconditionally (not gated by `PROVIDER_NAME`), since which
  `TripleRepository` backend is active has nothing to do with which
  LLM/DB demo provider is active.
  [blogresearch/config/app_settings.py](blogresearch/config/app_settings.py) holds the env-driven
  `AppSettings` (`PROVIDER_NAME`, `USE_CUSTOM_PRESENTER`,
  `TRIPLE_REPOSITORY_NAME`).
- **Repository** — [shared/repositories/](shared/repositories/)
  (reusable, domain-agnostic):
  `TripleRepository` — CRUDL over `(subject, predicate, object_value)`
  triples, one `(subject, predicate)` slot at a time (each also
  carries a stable `id` for row-level/cross-store reference — see
  [docs/adr/0010](docs/adr/0010-stable-id-for-triples.md)). Two
  implementations:
  [PostgresTripleRepository](shared/repositories/postgres_triple_repository.py)
  and
  [OxigraphTripleRepository](shared/repositories/oxigraph_triple_repository.py)
  (an embedded RDF store, deliberately enforcing the same
  single-valued contract even though it's natively multi-valued — see
  [artifacts/rdf-poc/FINDINGS.md](artifacts/rdf-poc/FINDINGS.md)).
  Both are wired into the composition root as a `TripleRepository`
  singleton, selected by `TRIPLE_REPOSITORY_NAME` — its own axis,
  independent of `PROVIDER_NAME` (see "Local setup" below). See
  [docs/adr/0008](docs/adr/0008-triple-repository-first-implementation.md).
  `TripleRepository.find(criteria)` adds a compound (AND-combined)
  query on top of `list()`, backed by a real index/query capability on
  both implementations rather than a full scan — see its docstring.
- **`UserRepository`/`UserService`** — the first real feature built on
  the triple store (users, fully triple-based — see
  [docs/adr/0011](docs/adr/0011-fully-triple-based-users-identity-anchor-deferred.md)).
  [`TripleUserRepository`](shared/repositories/triple_user_repository.py)
  is the one `UserRepository` implementation, composing an injected
  `TripleRepository` — callers work purely in `user_id` and
  [`RecordSet`](shared/recordset.py) (a `Column`-described schema
  paired with row dicts) terms, never a `Triple` or a subject URI.
  `UserSearchFilter` (`name`/`email`) is an optional compound filter on
  `list()`. [`UserService`](shared/user_service.py) is a thin CRUDL
  pass-through business layer on top, the seam
  [ASR-008](docs/ASR.md#asr-008-locked-value--versioned-bll-for-regulated-data)'s
  locked/versioned-BLL roadmap expects to grow real logic into later.
  [`UserProfilePresenter`](blogresearch/presenters/user_profile_presenter.py)/
  [`UserProfileViewModel`](blogresearch/viewmodels/user_profile_view_model.py)
  expose it as full CRUDL through `/api/users` (see "What the app does
  today") — purpose-built types, not `IView`/`IViewModel`/`IPresenter`,
  since that trio is shaped for the hello-world demo's single
  result/error pair.

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
- Full user CRUDL through `/api/users` (`GET`/`POST`/`PUT`/`DELETE`),
  backed end-to-end by the triple store — no frontend page yet (still
  ahead, tracked as the next step on the branch this shipped from), but
  verified live end-to-end via `curl`/the FastAPI docs UI. Errors come
  back as a JSON `error` field with HTTP 200, matching `/api/ask`'s
  existing convention, not per-case HTTP status codes.

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
   - `DATABASE_URL` for Postgres-backed runs — see "Local Postgres" below
     for a ready-to-run local instance matching this
   - `PROVIDER_NAME` — `claude` (default), `dci`, or `postgres`
   - `USE_CUSTOM_PRESENTER` — `true` to use `CustomPresenter`'s
     formatting instead of the default (applies to the LLM path only)
   - `TRIPLE_REPOSITORY_NAME` — `oxigraph` (default) or `postgres`;
     which `TripleRepository` backend the composition root resolves,
     independent of `PROVIDER_NAME` above
   - `OXIGRAPH_STORE_PATH` — only read when
     `TRIPLE_REPOSITORY_NAME=oxigraph`; a local on-disk directory (e.g.
     `./local_data/oxigraph`) for persistence across restarts. Unset
     falls back to an in-memory store — fine for tests, gone on exit.

4. (Optional) Start a local Postgres, if you'll use `PROVIDER_NAME=postgres`
   or `TRIPLE_REPOSITORY_NAME=postgres`:

   ```bash
   docker compose -f local/postgres/docker-compose.yml up -d
   ```

   `local/postgres/init/001-schema.sql` creates `hello_messages` and
   `triple_store` (including the `unit-test-1`/`unit-test-2` fixture rows
   the test suite asserts on) on first run — matches `.env.example`'s
   default `DATABASE_URL`
   (`postgresql://postgres:postgres@localhost:5432/railway` — named
   `railway` rather than after the app itself, so the same URL shape works
   against Railway's managed Postgres too). Stop it
   with `docker compose -f local/postgres/docker-compose.yml down`; its
   data lives in `local/postgres/data/` (gitignored).

   The same compose file also runs pgAdmin at
   [http://localhost:5050](http://localhost:5050) (login
   `admin@example.com` / `admin`) for browsing this database directly.
   Its own saved-server list lives in an anonymous Docker volume, not
   named in compose — a `docker compose down` resets it, `stop`/`start`
   doesn't.

5. (Optional) Browse a `TripleRepository` backend directly, outside the
   app:
   - **Oxigraph** — `pip install oxigraph` (the standalone CLI package;
     separate from `pyoxigraph`, the embedded library the app itself
     depends on), then
     `oxigraph serve --location ./local_data/oxigraph` (or wherever your
     `OXIGRAPH_STORE_PATH` points) for a SPARQL UI at
     `http://localhost:7878`. Only one process can hold that directory
     open at a time (a RocksDB file lock) — stop the app first, or point
     at a copy of the directory.
   - **Postgres** — any Postgres client against `DATABASE_URL`
     (`psql`, a GUI tool, etc.).

6. (Optional) Reseed the actively configured `TripleRepository` (whichever
   `TRIPLE_REPOSITORY_NAME` selects) from
   [shared/seed_data/initial_triples.json](shared/seed_data/initial_triples.json) —
   deletes everything currently in that store, then recreates the seed
   set:

   ```bash
   python scripts/reseed_triple_store.py
   ```

   Prompts for confirmation unless the target looks local (add `--yes`
   to skip that for scripted use).

> Steps 4–5's commands are the portable, versioned way to do this on any
> machine. On a machine set up for this project day to day, they may also
> be wrapped as personal `postgres-start`/`postgres-stop` and
> `oxigraph-start`/`oxigraph-stop` shell scripts (e.g. in `~/bin`) —
> those are machine-specific launchers, not part of this repo, so they
> won't exist on a fresh checkout. The commands above work everywhere
> regardless.

7. Run the app:

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
- [tests/test_oxigraph_triple_repository.py](tests/test_oxigraph_triple_repository.py) —
  the same `TripleRepository` CRUDL logic against a real in-memory
  `pyoxigraph.Store` (no fake needed), plus an on-disk persistence
  test across separate instances — not skip-safe, since an embedded
  store has no external network dependency to be unreachable.
- [tests/test_vocabulary.py](tests/test_vocabulary.py) —
  `seed_initial_vocabulary()` (conflict-safe: leaves existing data
  alone) and `reseed()` (destructive kill-and-fill), both against an
  in-memory fake `TripleRepository`.
- [tests/test_recordset.py](tests/test_recordset.py) — `Column`/
  `RecordSet`'s contract (frozen shape, row-by-column-name access).
- [tests/test_triple_user_repository.py](tests/test_triple_user_repository.py) —
  `TripleUserRepository` CRUDL and `find()`-backed compound-filter
  logic against a fake `TripleRepository`.
- [tests/test_user_service.py](tests/test_user_service.py) —
  `UserService`'s pass-through behavior against a fake `UserRepository`.
- [tests/test_user_profile_view_model.py](tests/test_user_profile_view_model.py) /
  [tests/test_user_profile_presenter.py](tests/test_user_profile_presenter.py) —
  `UserProfileViewModel`/`UserProfilePresenter`, including `undo()`'s
  snapshot behavior, against a fake `UserService`.

## Project structure

```text
app.py                      # FastAPI API entrypoint
frontend/                   # Next.js client
local/postgres/              # local Postgres (docker compose - see "Local setup")
  docker-compose.yml
  init/001-schema.sql          # hello_messages + triple_store, incl. unit-test-*/kind fixture
  data/                          # gitignored - the container's own runtime data
scripts/
  reseed_triple_store.py       # kill-and-fill the active TripleRepository from the seed file
shared/                     # reusable framework - no app-specific vocabulary (ADR-0009)
  container.py              # reusable DI container: parent/child scoping, auto-injection
  interfaces.py              # IView, IViewModel, IPresenter, ViewModelResolver
  recordset.py                  # Column/RecordSet - the schema-shaped DTO above any repository
  user_service.py               # UserService (CRUDL pass-through) + UserCreateRequest/UserUpdateRequest
  exceptions.py               # ProviderError
  environment.py               # .env loading (no import-time side effects)
  api_view.py                   # IView adapter for HTTP requests
  mapping_view_model.py         # IViewModel adapter for request state
  vocabulary.py                 # Vocabulary - predicate/type URIs, person(user_id) subject minting
  providers/
    interfaces.py                 # IProvider, IDbProvider, IToolProvider
    claude_provider.py            # IProvider
    dci_provider.py               # IProvider
    postgres_provider.py          # IDbProvider
  repositories/
    interfaces.py                 # Triple, TripleRepository (incl. find()); UserRepository, UserSearchFilter
    postgres_triple_repository.py  # TripleRepository backed by triple_store
    oxigraph_triple_repository.py  # TripleRepository backed by an embedded pyoxigraph.Store
    triple_user_repository.py      # UserRepository, composing an injected TripleRepository
  seed_data/
    initial_triples.json          # the master seed file scripts/reseed_triple_store.py loads
    loader.py                     # seed_initial_vocabulary() (safe) and reseed() (destructive)
blogresearch/                # this app's own choices, built on shared/ - deliberately small
  presenters/
    hello_presenter.py       # IProvider-backed presenter (owns success/error flow)
    custom_presenter.py      # overrides HelloPresenter's result formatting only
    db_hello_presenter.py    # IDbProvider-backed presenter (separate on purpose)
    user_profile_presenter.py # UserService-backed CRUDL presenter (no IView/resolver indirection)
  viewmodels/
    user_profile_view_model.py # purpose-built ViewModel: row/columns/error + undo() snapshot
  config/
    app_settings.py          # AppSettings — env-driven provider/presenter choice
    registrations.py         # app composition root: per-family registries + resolve_*()
tests/
docs/
  adr/                    # Architecture Decision Log — see docs/adr/
```

## Further reading

Where the product is headed, requirement by requirement:
[docs/ASR.md](docs/ASR.md). Why the app is structured this way and
what was tried and replaced: [docs/adr/](docs/adr/).
