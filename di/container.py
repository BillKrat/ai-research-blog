"""Composition root: wires interfaces to concrete implementations.

This is the only module that imports every provider and presenter
concretely. Everything else in the app depends on the
IProvider / IDbProvider / IPresenter / IView interfaces only.

Two separate registries, not one: IProvider (LLM backends) and
IDbProvider (storage backends) are different responsibilities, so a
provider name resolves through exactly one of them, never both.
"""

import os
from typing import Callable

from business.custom_presenter import CustomPresenter
from business.db_hello_presenter import DbHelloPresenter
from business.hello_presenter import HelloPresenter
from business.interfaces import IPresenter, IView, IViewModel
from config.app_settings import AppSettings
from data.claude_provider import ClaudeProvider
from data.dci_provider import DCIProvider
from data.interfaces import IDbProvider, IProvider
from data.postgres_provider import PostgresProvider
from view_models.session_state_view_model import SessionStateViewModel


def _get_anthropic_api_key() -> str | None:
    return os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY")


def _build_claude_provider() -> IProvider:
    return ClaudeProvider(api_key=_get_anthropic_api_key())


def _build_dci_provider() -> IProvider:
    return DCIProvider()


def _build_postgres_provider() -> IDbProvider:
    return PostgresProvider()


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


def resolve_viewmodel(presenter: IPresenter) -> IViewModel:
    """Resolve the ViewModel for the given presenter.

    Every presenter today gets a SessionStateViewModel; the indirection
    means a future presenter needing a different ViewModel shape is a
    change here, not in every presenter's __init__.

    Not called by presenters directly - passed to each one as the
    resolve_viewmodel constructor argument (see resolve_presenter()
    below and ViewModelResolver in business/interfaces.py). That way
    presenters depend on the ViewModelResolver callable type, never on
    this module, so business/ -> di/ never has to happen.
    """
    return SessionStateViewModel(presenter.view.session_state)


def resolve_presenter(view: IView, settings: AppSettings | None = None) -> IPresenter:
    """Resolve the presenter for the given view.

    settings defaults to AppSettings() (environment-driven) when not
    given - same pattern as PostgresProvider's conn_string parameter.
    Pass settings explicitly in tests to avoid monkeypatching env vars.
    """
    settings = settings if settings is not None else AppSettings()
    name = settings.provider_name.strip().lower()

    if name in DB_PROVIDER_FACTORIES:
        return DbHelloPresenter(view, resolve_db_provider(settings), resolve_viewmodel)

    if name in LLM_PROVIDER_FACTORIES:
        provider = resolve_llm_provider(settings)
        if settings.use_custom_presenter:
            return CustomPresenter(view, provider, resolve_viewmodel)
        return HelloPresenter(view, provider, resolve_viewmodel)

    known = sorted(set(LLM_PROVIDER_FACTORIES) | set(DB_PROVIDER_FACTORIES))
    raise ValueError(
        f"Unknown provider '{settings.provider_name}'. Known providers: {', '.join(known)}"
    )
