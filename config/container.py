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
from business.interfaces import IPresenter, IView
from config.app_settings import AppSettings
from data.claude_provider import ClaudeProvider
from data.dci_provider import DCIProvider
from data.interfaces import IDbProvider, IProvider
from data.postgres_provider import PostgresProvider


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


def resolve_presenter(settings: AppSettings, view: IView) -> IPresenter:
    name = settings.provider_name.strip().lower()

    if name in DB_PROVIDER_FACTORIES:
        return DbHelloPresenter(view, resolve_db_provider(settings))

    if name in LLM_PROVIDER_FACTORIES:
        provider = resolve_llm_provider(settings)
        if settings.use_custom_presenter:
            return CustomPresenter(view, provider)
        return HelloPresenter(view, provider)

    known = sorted(set(LLM_PROVIDER_FACTORIES) | set(DB_PROVIDER_FACTORIES))
    raise ValueError(
        f"Unknown provider '{settings.provider_name}'. Known providers: {', '.join(known)}"
    )
