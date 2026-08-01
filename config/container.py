"""Composition root: wires interfaces to concrete implementations.

This is the only module that imports every provider and presenter
concretely. Everything else in the app depends on the
IProvider / IPresenter / IView interfaces only.
"""

import os
from typing import Callable

from business.custom_presenter import CustomPresenter
from business.hello_presenter import HelloPresenter
from business.interfaces import IPresenter, IView
from config.app_settings import AppSettings
from data.claude_provider import ClaudeProvider
from data.dci_provider import DCIProvider
from data.interfaces import IProvider
from data.postgres_provider import PostgresProvider


def _get_anthropic_api_key() -> str | None:
    return os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY")


def _build_claude_provider() -> IProvider:
    return ClaudeProvider(api_key=_get_anthropic_api_key())


def _build_dci_provider() -> IProvider:
    return DCIProvider()


def _build_postgres_provider() -> IProvider:
    return PostgresProvider()


# Registered by provider name (case-insensitive). Add a new provider by
# adding an entry here - resolve_provider() itself never needs to change.
PROVIDER_FACTORIES: dict[str, Callable[[], IProvider]] = {
    "claude": _build_claude_provider,
    "dci": _build_dci_provider,
    "postgres": _build_postgres_provider,
}


def resolve_provider(settings: AppSettings) -> IProvider:
    name = settings.provider_name.strip().lower()
    try:
        factory = PROVIDER_FACTORIES[name]
    except KeyError:
        known = ", ".join(sorted(PROVIDER_FACTORIES))
        raise ValueError(
            f"Unknown provider '{settings.provider_name}'. Known providers: {known}"
        ) from None
    return factory()


def resolve_presenter(settings: AppSettings, view: IView) -> IPresenter:
    provider = resolve_provider(settings)
    if settings.use_custom_presenter:
        return CustomPresenter(view, provider)
    return HelloPresenter(view, provider)
