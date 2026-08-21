"""Application composition root.

This module wires the app's concrete providers and presenters into the
reusable shared container.
"""

import os
from typing import Callable

from blogresearch.presenters.custom_presenter import CustomPresenter
from blogresearch.presenters.db_hello_presenter import DbHelloPresenter
from blogresearch.presenters.hello_presenter import HelloPresenter
from blogresearch.config.app_settings import AppSettings
from shared.container import Container
from shared.interfaces import IPresenter, IView, IViewModel
from shared.providers.claude_provider import ClaudeProvider
from shared.providers.dci_provider import DCIProvider
from shared.providers.postgres_provider import PostgresProvider
from shared.providers.interfaces import IDbProvider, IProvider
from shared.mapping_view_model import MappingViewModel
from shared.repositories.interfaces import TripleRepository
from shared.repositories.oxigraph_triple_repository import OxigraphTripleRepository
from shared.repositories.postgres_triple_repository import PostgresTripleRepository


def _get_anthropic_api_key() -> str | None:
    return os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY")


def _build_claude_provider() -> IProvider:
    return ClaudeProvider(api_key=_get_anthropic_api_key())


def _build_dci_provider() -> IProvider:
    return DCIProvider()


def _build_postgres_provider() -> IDbProvider:
    return PostgresProvider()


def _build_postgres_triple_repository() -> TripleRepository:
    return PostgresTripleRepository()


def _build_oxigraph_triple_repository() -> TripleRepository:
    # One instance for the whole app lifetime: register_singleton below caches
    # it, matching the one-live-Store-per-path constraint documented on
    # OxigraphTripleRepository (a second Store on the same on-disk path
    # while this one is alive raises ProviderError).
    return OxigraphTripleRepository()


# Registered by provider name (case-insensitive). Add a new LLM provider
# or DB provider by adding an entry to the matching registry - the
# resolve_*() functions below never need to change.
LLM_PROVIDER_FACTORIES: dict[str, Callable[[], IProvider]] = {
    "claude": _build_claude_provider,
    "dci": _build_dci_provider,
}

DB_PROVIDER_FACTORIES: dict[str, Callable[[], IDbProvider]] = {
    "postgres": _build_postgres_provider,
}

# Which backend answers TripleRepository CRUDL calls - independent of
# LLM_PROVIDER_FACTORIES/DB_PROVIDER_FACTORIES above, selected by its own
# settings field (see AppSettings.triple_repository_name).
TRIPLE_REPOSITORY_FACTORIES: dict[str, Callable[[], TripleRepository]] = {
    "postgres": _build_postgres_triple_repository,
    "oxigraph": _build_oxigraph_triple_repository,
}


def register_app_services(container: Container, settings: AppSettings | None = None) -> Container:
    """Register the app's concrete services in a reusable container.

    This is the app-level composition root. The container stays generic;
    this function decides which concrete provider implementations get
    wired for the current settings.
    """
    settings = settings if settings is not None else AppSettings()
    name = settings.provider_name.strip().lower()

    if name in LLM_PROVIDER_FACTORIES:
        container.register_singleton(IProvider, lambda: resolve_llm_provider(settings))
    elif name in DB_PROVIDER_FACTORIES:
        container.register_singleton(IDbProvider, lambda: resolve_db_provider(settings))
    else:
        known = sorted(set(LLM_PROVIDER_FACTORIES) | set(DB_PROVIDER_FACTORIES))
        raise ValueError(
            f"Unknown provider '{settings.provider_name}'. Known providers: {', '.join(known)}"
        )

    # Always registered, unlike the IProvider/IDbProvider branch above -
    # triple_repository_name is its own axis, not part of the
    # provider_name choice.
    container.register_singleton(TripleRepository, lambda: resolve_triple_repository(settings))
    return container


def build_container(settings: AppSettings | None = None) -> Container:
    """Create a container with the app's registrations applied."""
    return register_app_services(Container(), settings)


_root_container: Container | None = None


def get_root_container() -> Container:
    """The process-wide root container, built once from environment settings.

    Only meaningful for the real request path: `app.py` never passes
    `settings` to `resolve_presenter()`, so every request would otherwise
    call `build_container()` fresh, defeating `TripleRepository`'s
    singleton registration in practice - `OxigraphTripleRepository`'s
    on-disk store can only be held open by one live `Store` at a time (see
    its docstring), so a second instance from a second per-request
    container would fail outright, not just waste a reconnect. Building
    the root once and handing out a child per request keeps one real
    process-wide singleton instead of one per container.

    Tests that pass `settings` explicitly bypass this entirely (see
    `resolve_presenter()`) and always get their own fresh container, so a
    test's chosen configuration is honored exactly as given - this cache
    only ever reflects the environment `AppSettings()` read on first use.
    """
    global _root_container
    if _root_container is None:
        _root_container = build_container(AppSettings())
    return _root_container


def resolve_llm_provider(settings: AppSettings) -> IProvider:
    name = settings.provider_name.strip().lower()
    try:
        factory = LLM_PROVIDER_FACTORIES[name]
    except KeyError:
        known = ", ".join(sorted(LLM_PROVIDER_FACTORIES))
        raise ValueError(
            f"Unknown LLM provider '{settings.provider_name}'. Known providers: {known}"
        ) from None
    return factory()


def resolve_db_provider(settings: AppSettings) -> IDbProvider:
    name = settings.provider_name.strip().lower()
    try:
        factory = DB_PROVIDER_FACTORIES[name]
    except KeyError:
        known = ", ".join(sorted(DB_PROVIDER_FACTORIES))
        raise ValueError(
            f"Unknown DB provider '{settings.provider_name}'. Known providers: {known}"
        ) from None
    return factory()


def resolve_triple_repository(settings: AppSettings) -> TripleRepository:
    name = settings.triple_repository_name.strip().lower()
    try:
        factory = TRIPLE_REPOSITORY_FACTORIES[name]
    except KeyError:
        known = ", ".join(sorted(TRIPLE_REPOSITORY_FACTORIES))
        raise ValueError(
            f"Unknown triple repository '{settings.triple_repository_name}'. "
            f"Known triple repositories: {known}"
        ) from None
    return factory()


def resolve_viewmodel(presenter: IPresenter) -> IViewModel:
    """Resolve the ViewModel for the given presenter.

    Every presenter today gets a MappingViewModel; the indirection
    means a future presenter needing a different ViewModel shape is a
    change here, not in every presenter's __init__.

    Not called by presenters directly - passed to each one as the
    resolve_viewmodel constructor argument (see resolve_presenter()
    below and ViewModelResolver in shared/interfaces.py). That way
    presenters depend on the ViewModelResolver callable type, never on
    this module, so the app wiring stays at the edge.
    """
    return MappingViewModel(presenter.view.session_state)


def resolve_presenter(view: IView, settings: AppSettings | None = None) -> IPresenter:
    """Resolve the presenter for the given view.

    settings defaults to AppSettings() (environment-driven) when not
    given - same pattern as PostgresProvider's conn_string parameter.
    Pass settings explicitly in tests to avoid monkeypatching env vars.

    When settings is omitted (the real request path), this resolves
    against a child of the process-wide root container (see
    get_root_container()) rather than building a fresh container per
    call - see that function's docstring for why. Passing settings
    explicitly (as tests do) opts out of the root cache entirely, so
    each such call gets its own independently-configured container,
    unaffected by whatever the root happened to resolve first.
    """
    explicit_settings = settings is not None
    settings = settings if settings is not None else AppSettings()
    container = build_container(settings) if explicit_settings else get_root_container().create_child_container()
    name = settings.provider_name.strip().lower()

    if name in DB_PROVIDER_FACTORIES:
        return DbHelloPresenter(view, container.resolve(IDbProvider), resolve_viewmodel)

    if name in LLM_PROVIDER_FACTORIES:
        provider = container.resolve(IProvider)
        if settings.use_custom_presenter:
            return CustomPresenter(view, provider, resolve_viewmodel)
        return HelloPresenter(view, provider, resolve_viewmodel)

    known = sorted(set(LLM_PROVIDER_FACTORIES) | set(DB_PROVIDER_FACTORIES))
    raise ValueError(
        f"Unknown provider '{settings.provider_name}'. Known providers: {', '.join(known)}"
    )
