"""Provider-layer contracts for this app's own demo capabilities.

IProvider and IDbProvider are app-specific by nature - their methods
name this app's one demo feature (say_hello / get_message), not a
generic capability every app would need, so they stay here rather
than in shared/. IToolProvider moved to shared/tool_provider.py
instead: it's domain-agnostic (no blog/forms vocabulary), unlike
these two - see docs/adr/0009.

Both raise ProviderError (shared/exceptions.py) on failure rather than
leaking lower-level exceptions to the UI layer.
"""

from abc import ABC, abstractmethod


class IProvider(ABC):
    """A source of LLM-generated text - Claude, OpenAI, etc."""

    @abstractmethod
    def say_hello(self) -> str:
        """Return the hello message, or raise ProviderError on failure."""


class IDbProvider(ABC):
    """A source of persisted data - Postgres, or any future storage backend.

    Deliberately minimal: only get_message() exists because that's the
    only thing this app currently reads from storage. Expand this
    interface when there's a second real read/write need, not before -
    see FormDataRepository in docs/adr/0004-triple-store-for-user-forms.md
    for where the triple-store work is expected to build a richer,
    domain-specific repository on top of an implementation of this
    interface.
    """

    @abstractmethod
    def get_message(self) -> str:
        """Return a stored message, or raise ProviderError on failure."""
