"""Application settings.

This is plain configuration, not a swappable behavior. Defaults come
from the environment so the app can change providers without code
changes.
"""

import os
from dataclasses import dataclass, field


def _provider_name_from_env() -> str:
    return os.environ.get("PROVIDER_NAME", "claude")


def _use_custom_presenter_from_env() -> bool:
    return os.environ.get("USE_CUSTOM_PRESENTER", "false").strip().lower() == "true"


def _triple_repository_name_from_env() -> str:
    return os.environ.get("TRIPLE_REPOSITORY_NAME", "oxigraph")


@dataclass(frozen=True)
class AppSettings:
    provider_name: str = field(default_factory=_provider_name_from_env)
    use_custom_presenter: bool = field(default_factory=_use_custom_presenter_from_env)
    # Independent of provider_name: provider_name picks the LLM-vs-DB demo
    # provider (mutually exclusive today), but a TripleRepository is an
    # orthogonal concern - which backend answers TripleRepository CRUDL
    # calls, regardless of which demo provider is active. See
    # registrations.py's TRIPLE_REPOSITORY_FACTORIES.
    triple_repository_name: str = field(default_factory=_triple_repository_name_from_env)
