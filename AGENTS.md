# AGENTS.md

Context for AI agents working in this repository. This is a learning
project — keep changes simple, readable, and easy to verify. Don't
introduce a framework or abstraction the current task doesn't need.

## Project

- Repo: `BillKrat/ai-research-blog`
- Stack: Python, Streamlit (UI), pytest, Anthropic Claude API,
  PostgreSQL
- Deploy: Railway, auto-deploys from `main` on push
- Live: https://blogresearch.net

## Workflow

Every push to `main` triggers a live Railway deploy, so feature work
happens on a branch and only gets merged to `main` (then pushed) once
it's working end to end. Commit as you go on the branch — no need to
keep history tidy, this is a learning project.

The work below currently lives on `feature/postgres`.

> ⚠️ **`AGENTS.md` itself has been silently overwritten before.**
> During a Copilot session on this branch, this file was replaced
> wholesale and the design-intent section below (triple store,
> form-builder vision) was lost — it's been restored here from the
> prior session's history. If you're an agent editing this file,
> **extend it, don't replace it wholesale** — especially the "Vision"
> and "Still open" sections, which represent decisions made across
> multiple sessions, not just the current one.

## Current codebase state

The app is structured as MVP + DI + a provider registry, adapted to
Streamlit's rerun-the-whole-script execution model:

- **View** — `app.py` is the Streamlit entrypoint (the only module
  that imports `streamlit`). `business/interfaces.py::IView` is the
  contract; `views/streamlit_view.py::StreamlitView` is the only place
  that knows the `st.session_state` key names. Presenters never touch
  `st.session_state` directly.
- **Presenter** — `business/`. `HelloPresenter` owns the shared
  success/error flow for `IProvider` (`on_button_click()`: call the
  provider, catch `ProviderError`, call `view.show_error()` or
  `view.show_result()`). `CustomPresenter` inherits `HelloPresenter`
  and only overrides `_format_result()` — a template-method
  arrangement, not duplicated logic. `DbHelloPresenter` is the
  `IDbProvider`-backed equivalent — **a separate class on purpose**,
  not a shared one; see session history item 4 for why.
- **Data layer** — `data/interfaces.py` defines three interfaces, kept
  deliberately separate (see the file's own docstring for the full
  rationale):
  - **`IProvider`** — LLM/completion backends. Implementations:
    `ClaudeProvider` (Anthropic API; if unconfigured, `say_hello()`
    raises `ProviderError` cleanly rather than crashing) and
    `DCIProvider` (fixed response, for local/offline flows).
  - **`IDbProvider`** — persistence backends. Implementation:
    `PostgresProvider.get_message()` — currently queries a trivial
    `hello_messages` fixture table, and there's a separate
    `triple_store` fixture table used only by an integration test.
    **Neither of these is the real triple-store schema** — see Vision
    below.
  - **`IToolProvider`** — tool discovery/execution for a future
    reasoning engine. Defined, no implementation anywhere yet — see
    Vision's "Still open" for when to build one.

  All three raise `data.exceptions.ProviderError` on failure — never
  crash with an unrelated exception, never return an error string as
  if it were data.
- **Composition root** — `config/container.py`. Two registries, not
  one: `LLM_PROVIDER_FACTORIES: dict[str, Callable[[], IProvider]]`
  and `DB_PROVIDER_FACTORIES: dict[str, Callable[[], IDbProvider]]`.
  `resolve_presenter()` checks which registry a `provider_name` falls
  into and returns the matching presenter type. Adding a new provider
  means registering a factory in the right registry, not editing an
  if/elif chain (Open/Closed).
- **Settings** — `config/app_settings.py::AppSettings`, a plain
  dataclass (not an interface — there's only one shape of "app
  settings," so an ABC would be unnecessary ceremony). Reads
  `PROVIDER_NAME` (default `"claude"`) and `USE_CUSTOM_PRESENTER`
  (default `false`) from the environment. `USE_CUSTOM_PRESENTER` only
  affects the `IProvider` path (`claude`/`dci`) — `postgres` always
  resolves to plain `DbHelloPresenter`, no custom-formatting variant
  exists for it yet.
- **Environment loading** — `config/environment.py::load_environment()`
  has no import-time side effects; it's called explicitly once, from
  `app.py` for the running app and from `tests/conftest.py` for the
  test session. (Earlier versions of this code called it as a
  module-level side effect in two different files, which required an
  `importlib.reload()` hack in tests to verify — don't reintroduce
  that pattern.)

## Session history

1. **Initial scaffold** — minimal "Say Hello" button proving
   Streamlit → Claude API → Railway → custom domain worked end to end.
2. **Branching + vision session** — adopted the branch-then-merge
   workflow (this file's "Workflow" section); had an extended design
   discussion about a Postgres-backed triple store for user-defined
   forms — see **Vision** below. Nothing from that vision was built
   yet at that point.
3. **Copilot MVP/DI scaffold + realignment (current)** — the user had
   Copilot build out an MVP + DI + provider-model skeleton
   (`business/`, `data/`, `config/container.py`) on `feature/postgres`
   as a way to flesh out ideas without spending Claude usage on
   scaffolding, with the explicit intent that a Claude-driven review
   would realign it afterward. That review found:
   - **A real bug:** `ClaudeProvider.say_hello()` crashed with
     `AttributeError` whenever unconfigured (missing API key) — the
     exact "safe fallback" path the container routed to. Fixed by
     raising `ProviderError` instead. The error handling was then
     refined further (same session) to wrap both the Anthropic SDK's
     own exception hierarchy and any other unexpected exception,
     always re-raising as `ProviderError` via `raise ... from exc` so
     the original is preserved — never swallowed into a fake result.
     `tests/test_claude_provider.py` covers this with a real
     `AuthenticationError`.
   - **Inconsistent error handling** across providers (Postgres caught
     and returned error strings; Claude didn't catch at all) — fixed
     via the shared `ProviderError` contract.
   - **A DI anti-pattern:** `resolve_provider()` checked
     `os.environ.get("PYTEST_CURRENT_TEST")` — production code aware
     of the test framework. Removed; tests inject their own
     `AppSettings`/providers explicitly instead.
   - **Service-Locator-style resolution** (if/elif on a string) instead
     of a real registry — replaced with `PROVIDER_FACTORIES`.
   - **No `IView`** — presenters wrote into `st.session_state`
     directly (a magic string key), which isn't real MVP. Added `IView`
     + `StreamlitView`.
   - **Over-abstraction in the other direction:** `IToolsProvider` was
     an ABC interface with exactly one implementation — a config DTO
     wearing an interface's clothes. Replaced with the plain
     `AppSettings` dataclass.
   - **Duplicated `_load_environment()`** in two files, called as an
     import-time side effect — consolidated into
     `config/environment.py`, called explicitly instead of at import
     time.
   - **A test that could never fail:** the Postgres integration test
     had its real assertions *inside* a broad `try/except` that
     skipped on any exception — a wrong assertion would skip, not
     fail. Fixed by moving the assertion outside the try/except.
   - **Repo hygiene:** `.DS_Store` was tracked in git (added to
     `.gitignore`, untracked); `app.py.original.md` was a stray
     Copilot-left backup (deleted, git history already has it);
     duplicate test files consolidated.
   - Full test suite (`pytest`) and a live smoke test (real Claude
     call through the whole DI chain) both verified after the
     refactor.
4. **`IProvider` was still ambiguous — split into three interfaces.**
   Even after the realignment above, `IProvider` covered Claude, DCI,
   *and* Postgres alike — as if querying a database and asking an LLM
   a question were the same responsibility. They aren't. The user
   caught this (context Copilot never had, from prompts shared with it
   earlier the same day) and gave the corrected breakdown directly:
   - **`IProvider`** narrowed to LLM/completion backends only (Claude,
     DCI). Unchanged behavior, corrected scope.
   - **`IDbProvider`** (new) — persistence backends. `PostgresProvider`
     moved onto it; `say_hello()` renamed to `get_message()`, since
     "say hello" is an LLM-shaped name, not a storage-shaped one. Kept
     deliberately minimal (one method) — matches what the app actually
     reads today; expand when there's a second real read/write need,
     not before. This is also where `IDbProvider` connects to the
     Vision section below: `FormDataRepository` (the triple-store
     repository, not yet built) is expected to be a domain-specific
     layer built *on top of* an `IDbProvider` implementation — two
     layers, not one.
   - **`DbHelloPresenter`** (new) — a presenter is not allowed to treat
     "ask an LLM" and "read the database" as interchangeable just
     because both currently return a `str`. Rather than one presenter
     accepting any object shaped like a no-arg method returning a
     string (which would have quietly re-introduced the exact
     conflation being fixed one layer up), `HelloPresenter`/
     `CustomPresenter` stay `IProvider`-only and `DbHelloPresenter` is
     a separate, small class for `IDbProvider`. `config/container.py`
     now has `LLM_PROVIDER_FACTORIES` and `DB_PROVIDER_FACTORIES` as
     two registries, and `resolve_presenter()` dispatches to the right
     presenter type based on which registry the requested provider
     name falls into.
   - **`IToolProvider`** (new, stub only) — tool discovery/execution
     for a future reasoning engine (`get_tool_schemas()` /
     `execute_tool()`), a third and genuinely orthogonal concern from
     either of the above. Defined in `data/interfaces.py` because the
     shape was worth settling now, but **no concrete implementation
     exists** — nothing in the app calls it. When a first real tool
     shows up, a dict/registry-driven implementation (mirroring
     `PROVIDER_FACTORIES`'s pattern) is the recommended starting
     point, not a framework and not a Pydantic-validated version
     (that's the right upgrade *once* there are enough tools that
     malformed-argument bugs are a real risk, not before).
   - **Naming collision to keep straight:** the `ToolsProvider`/
     `IToolsProvider` deleted in item 3 above was a config/feature-flag
     DTO (which provider/presenter to use) — an unrelated concept that
     happens to closely resemble this new `IToolProvider`'s name (LLM
     tool/function invocation). Don't conflate them; the old one is
     gone and replaced by `AppSettings`, the new one is a genuinely
     different, forward-looking interface.
   - Full test suite and a live smoke test (Streamlit → `AppSettings`
     → container → `HelloPresenter` → `ClaudeProvider` → real Claude
     call → `StreamlitView`) both verified after the split. The
     Postgres path is covered by unit tests only in this session — the
     local machine can't reach `postgres.railway.internal` to smoke
     test it live, same limitation as before.

## Vision: PostgreSQL-backed triple store (design intent, not yet built)

**This predates the current scaffold and is still the actual goal.**
The MVP/DI/provider work above is foundation, not the feature itself —
`PostgresProvider` today just reads one row from a fixture table.

### The goal

Users design their own forms — choose fields, lay them out, and CRUDL
(Create/Read/Update/Delete/List) their own form data — without a
developer defining a fixed schema per form up front.

### Why a triple store

The user has real production experience with RDF triple stores (prior
work in Utility Engineering) and strong opinions earned from it:

- **What's good:** a `(subject, predicate, object)` model fits
  schema-less, user-defined forms — no migration needed every time
  someone adds a field.
- **What was bad, and deliberately avoided here:** the prior system's
  ontologies were designed by architects for architects, and SPARQL
  was a barrier for developers. **This project skips SPARQL** — query
  the triple table with plain SQL, kept simple and developer-friendly.
- **Known tradeoff, scoped around deliberately:** pivoting triples
  back into rows/columns is expensive at volume (learned the hard way
  processing thousands of pump records in the prior system). This
  project's use case — user-generated forms, picklists, simple record
  structures — is the low-hanging-fruit case where that cost doesn't
  bite. Don't reach for this pattern for high-volume/bulk-record use
  cases without re-evaluating.

### Data shape — two DTO types depending on content

- **Grid/tabular data** (rows of form submissions) → translate triples
  into a `pandas.DataFrame` → render/edit via Streamlit's built-in
  `st.data_editor`, which already gives an editable grid with
  add/delete-row support largely for free.
- **Form layout metadata** (labels, field types, position on the
  form) → a lightweight dict or Pydantic model — this isn't tabular
  data, it's structural/config data describing a form.

Exact routing logic (how the app decides which DTO type applies to a
given predicate/subject) is still to be worked out.

### Data-layer abstraction

The user has always used dependency injection to configure data
layers in .NET (interface + swappable implementation) and wants the
same discipline here — this is directly what `IProvider`/`IDbProvider`
+ `config/container.py`'s registries already establish as a pattern;
the triple store's repository should follow the same shape, one layer
up from `IDbProvider`:

- A `FormDataRepository`-style abstract base class (`abc.ABC`, per the
  existing `IProvider`/`IDbProvider` convention in this repo) — `get`,
  `save`, `list`, `delete` (exact method signatures TBD). This sits
  *above* `IDbProvider`, not in place of it: `IDbProvider` is generic
  storage access (get/save bytes or rows), `FormDataRepository` is the
  domain-specific triple/form logic built on top of a concrete
  `IDbProvider` implementation.
- A Postgres-backed triple-store implementation (via `IDbProvider`) is
  the first concrete implementation.
- Business logic and the Streamlit UI depend only on the repository
  interface, never on Postgres, `IDbProvider`, or triples directly —
  this is what allows a different storage backend to be swapped in
  later for use cases that don't suit triples well (e.g. high-volume
  data).
- No DI framework needed — the existing hand-rolled composition root
  in `config/container.py` is the right complexity for this project;
  extend its registry pattern rather than introducing a container
  library.

### Still open — settle before/while building

- Exact triple table schema (columns, types, how `object` values of
  different types — text, number, date — are stored). The current
  `triple_store` fixture table (`subject, predicate, object_value`,
  all text) is a test fixture, not this schema.
- `psycopg2` raw queries vs. an ORM — leaning toward raw queries for
  simplicity given the schema is one triple table, open to
  reconsidering.
- The repository's exact method signatures and the DTO routing logic
  (DataFrame vs. dict/Pydantic).
- A first concrete form to build end-to-end as the proof of concept.

### Reusability — explicitly deferred, but keep in mind

It's too early to know what's suitable for extraction into a
standalone, pip-installable package for reuse across apps (the user's
explicit call). Nothing is packaged yet — no `pyproject.toml`, no
`src/` layout. But keep the boundary clean as this develops: interfaces
and the composition-root pattern are the reusable candidates; app-specific
logic (this app's exact session-state contract, this app's schema)
is not. Keeping that boundary clean now means extraction later is
mechanical, not a redesign — no action needed until there's a second
real consumer app.

## Environment and secrets

- Local dev uses `.env` (gitignored); `.env.example` is the committed
  placeholder template — **never put a real secret in
  `.env.example`, only in `.env`.**
- `ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`) — Claude provider.
- `DATABASE_URL` — Postgres provider.
- `PROVIDER_NAME` — which provider to resolve: `claude` / `dci`
  (`IProvider`, LLM) or `postgres` (`IDbProvider`, storage); defaults
  to `claude`.
- `USE_CUSTOM_PRESENTER` — `true` to use `CustomPresenter`; defaults
  to `false`.
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

Coverage:

- `tests/test_container.py` — DI resolution through both
  `LLM_PROVIDER_FACTORIES` and `DB_PROVIDER_FACTORIES` (including
  case-insensitivity and the unknown-provider error path for each),
  which presenter type `resolve_presenter()` returns for a given
  `AppSettings`, Postgres connection-string resolution, and a Postgres
  integration test that's skip-safe when `DATABASE_URL` is unset or
  unreachable (its real assertions run outside the skip-triggering
  try/except, so a genuine mismatch fails the test rather than
  silently skipping).
- `tests/test_presenter.py` — `HelloPresenter`, `CustomPresenter`, and
  `DbHelloPresenter`, each covering the success path and the
  `ProviderError` → `view.show_error()` path.
- `tests/test_claude_provider.py` — a real Anthropic SDK error wrapped
  as `ProviderError` rather than propagating unchanged.
- `tests/test_environment.py` — `.env` loading, including that a real
  environment variable always wins over `.env`.

## What to avoid

- Don't introduce a DI framework, ORM, or other heavy dependency
  unless the task clearly needs it — extend the existing registry/ABC
  patterns instead.
- Don't let application code become aware of the test framework (the
  removed `PYTEST_CURRENT_TEST` check is the cautionary example) —
  tests inject what they need explicitly.
- Don't add an interface/ABC for something with only one real
  implementation and no near-term second one (the removed
  `IToolsProvider` is the cautionary example) — that's over-engineering
  in the other direction.
- Don't put two genuinely different responsibilities behind one
  interface just because they're currently shaped the same (the
  original `IProvider` covering both Claude and Postgres, because both
  happened to return a `str`, is the cautionary example). If a new
  capability doesn't obviously fit `IProvider`, `IDbProvider`, or
  `IToolProvider`, that's a signal to add a fourth interface, not to
  force it into one of the existing three.
- Don't reintroduce import-time side effects (env loading, DB
  connections, etc.) in modules other than the explicit entrypoints
  (`app.py`, `tests/conftest.py`).
- Don't hardcode credentials or connection strings.
- Don't replace this file wholesale — extend it, especially the
  Vision and Session history sections.
