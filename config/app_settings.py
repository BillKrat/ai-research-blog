"""Application-level configuration: which provider and presenter to use.

This is plain configuration, not a swappable behavior - there's only
ever one shape of "app settings," so it's a dataclass rather than an
interface/implementation pair. (Contrast with IProvider, which has
three real implementations and genuinely needs an interface.)

Defaults come from the environment so the running provider can be
changed without a code change - the same pattern already used for
ANTHROPIC_API_KEY and DATABASE_URL.
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
