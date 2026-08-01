"""Interfaces for the data layer (providers)."""

from abc import ABC, abstractmethod


class IProvider(ABC):
    """A source of the "hello" message - Claude, Postgres, DCI, etc.

    Implementations must raise data.exceptions.ProviderError for any
    expected failure (missing configuration, network or driver error)
    rather than letting a lower-level exception escape unchanged, or
    swallowing it and returning an error string as if it were data.
    """

    @abstractmethod
    def say_hello(self) -> str:
        """Return the hello message, or raise ProviderError on failure."""
