# 0002. MVPVM + DI + provider-registry architecture

Status: Accepted
Date: 2026-08-01
Amended: 2026-08-03 (pattern name corrected from generic "MVP" to MVPVM — see bottom)

## Context

The initial app was a single-file Streamlit script with no separation
between UI, business logic, and the Claude API call. Extending it
(multiple providers, testability, the future Postgres/triple-store
feature in ADR-0004) needed real structure. The user had Copilot
scaffold a first attempt, with the explicit intent that a Claude-driven
review would realign it afterward — a way to flesh out ideas without
spending Claude usage budget on scaffolding.

Streamlit's execution model (the whole script reruns on every
interaction) doesn't map cleanly onto textbook MVP, where a Presenter
holds a persistent reference to a View object and calls methods on it
— there's no persistent View to call back into between reruns, only
`st.session_state`.

## Decision

Adopt an MVPVM-flavored structure adapted to that constraint (see the
naming note at the bottom — this wasn't identified as MVPVM until
2026-08-03, but the shape below is unchanged since it was first
written):

- **View** — `app.py` (Streamlit entrypoint) + `IView` /
  `StreamlitView` (`views/`). `StreamlitView` is the only code that
  knows the `st.session_state` key names — presenters call
  `view.show_result()` / `view.show_error()`, never touch
  `st.session_state` directly.
- **Presenter** — `business/`. Owns the success/error flow;
  `CustomPresenter` inherits `HelloPresenter` and overrides only the
  result formatting (template method), rather than duplicating the
  whole flow.
- **Data layer** — interfaces + concrete providers in `data/`, each
  raising a shared `ProviderError` on failure rather than crashing or
  silently returning an error string as if it were data.
- **Composition root** — `config/container.py`, using a registry
  (`dict[str, Callable[[], T]]`) rather than an if/elif chain, so
  adding a provider means registering it (Open/Closed), not editing a
  branch. No DI framework — a hand-rolled composition root is the
  right complexity for this project's size.
- **Settings** — `config/app_settings.py::AppSettings`, a plain
  dataclass reading from the environment — not an interface, since
  there's only one shape of "app settings" and an ABC would be
  unnecessary ceremony.

The initial Copilot scaffold had several problems the review
corrected: a real bug (`ClaudeProvider` crashed with `AttributeError`
on the exact "no API key" fallback path it was supposed to handle
safely), inconsistent error handling between providers, a DI
anti-pattern (`resolve_provider()` checking `PYTEST_CURRENT_TEST` —
application code aware of the test framework), Service-Locator-style
if/elif resolution instead of a registry, no `IView` (presenters wrote
into `st.session_state` directly), an over-abstracted `IToolsProvider`
config DTO with exactly one implementation, duplicated `.env`-loading
code called as an import-time side effect in two different files, and
a Postgres integration test whose real assertions lived inside the
same `try/except` that skipped on connection failure (so a wrong
assertion would skip, not fail).

## Consequences

- Providers, presenters, and the view can each be swapped or tested
  independently.
- Slightly more files/indirection than a single script — appropriate
  here because the app is genuinely growing multiple providers and a
  future feature (ADR-0004), not speculative.
- Environment loading (`config/environment.py::load_environment()`)
  must be called explicitly once, from `app.py` for the running app
  and `tests/conftest.py` for the test session — it has no
  import-time side effects, unlike the version this replaced.

## Naming note (added 2026-08-03)

This is the **MVPVM** pattern — Model-View-Presenter-ViewModel — as
defined by Bill Kratochvil, ["MVPVM Design Pattern: The Model-View-Presenter-ViewModel
Design Pattern for WPF,"](https://learn.microsoft.com/en-us/archive/msdn-magazine/2011/december/mvpvm-design-pattern-the-model-view-presenter-viewmodel-design-pattern-for-wpf)
*MSDN Magazine*, December 2011. Originally described here only as
"MVP-flavored"; the precise name was identified after the fact, but
the architecture itself is unchanged — this is a naming correction,
not a new decision. Mapping this codebase onto the article's own
terms:

| MVPVM (Kratochvil, 2011) | This codebase |
|---|---|
| View | `app.py` + `StreamlitView` |
| Presenter | `HelloPresenter` / `CustomPresenter` / `DbHelloPresenter` |
| BLL interfaces | `IProvider`, `IDbProvider` |
| Module / bootstrapper | `config/container.py` (the registries) |
| Configuration | `AppSettings` (env-driven `PROVIDER_NAME`) |
| DAL | `ClaudeProvider` / `PostgresProvider`'s actual external calls |
| Model | Postgres triple store (ADR-0004) |

Per the article: *"The Presenter will have dependencies on the
interfaces for the BLLs from which it needs to retrieve domain
objects (data)... It will use the resolved instances as configured in
the module or bootstrapper."* That's exactly `HelloPresenter`
depending on `IProvider`/`IDbProvider` for its constructor type, with
`config/container.py` deciding which concrete class satisfies it — the
Presenter knowing the *interface* is correct and prescribed; only
knowledge of the *concrete implementation* is confined to the
composition root.

Two honest gaps versus the full pattern, not mistakes:

- **No distinct ViewModel.** `StreamlitView` holds `result`/`error`
  directly rather than a separate ViewModel object the Presenter
  populates. Reasonable given Streamlit reruns the whole script on
  every interaction — there's no persistent object graph for
  `NotifyPropertyChanged`-style binding to matter the way it does in
  WPF. Worth revisiting once a React-based frontend (Next.js) is in
  play, since React's state model is much closer to what ViewModel was
  built to serve.
- **No distinct BLL/DAL split.** `IProvider`/`IDbProvider` currently do
  both jobs — the interface and the actual external call live in one
  class. See ADR-0007 (Repository pattern) for how this resolves as
  the triple-store work (ADR-0004) is built.
