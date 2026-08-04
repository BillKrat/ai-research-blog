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


@dataclass(frozen=True)
class AppSettings:
    provider_name: str = field(default_factory=_provider_name_from_env)
    use_custom_presenter: bool = field(default_factory=_use_custom_presenter_from_env)
