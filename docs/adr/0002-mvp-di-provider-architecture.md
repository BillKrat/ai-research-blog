# 0002. MVP + DI + provider-registry architecture

Status: Accepted
Date: 2026-08-01

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

Adopt an MVP-flavored structure adapted to that constraint:

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
