"""Contracts for the triple-store repository.

Business logic and the UI depend on TripleRepository, never on
Postgres or raw SQL directly - see docs/adr/0004 and docs/adr/0007 for
why. This is the first Repository in the codebase; see
docs/adr/0008 for how it relates to IDbProvider.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class Triple:
    """A single (subject, predicate, object_value) fact."""

    subject: str
    predicate: str
    object_value: str


class TripleRepository(ABC):
    """CRUDL access to triples, one (subject, predicate) pair at a time.

    (subject, predicate) is treated as a single-valued slot - the case
    this project needs today (a form field, a config value): one
    object_value per (subject, predicate). True RDF multi-valued facts
    (the same subject+predicate holding several objects at once, e.g.
    ASR-004's user-subscribes-to-user triples) are a different access
    pattern with different CRUDL semantics and are out of scope here;
    that would be its own repository, not forced through this one.
    """

    @abstractmethod
    def create(self, subject: str, predicate: str, object_value: str) -> Triple:
        """Insert a new triple.

        Raises ProviderError if one already exists for this
        (subject, predicate).
        """

    @abstractmethod
    def read(self, subject: str, predicate: str) -> Triple | None:
        """Return the triple for (subject, predicate), or None if absent."""

    @abstractmethod
    def update(self, subject: str, predicate: str, object_value: str) -> Triple:
        """Change an existing triple's object_value.

        Raises ProviderError if no triple exists for this
        (subject, predicate).
        """

    @abstractmethod
    def delete(self, subject: str, predicate: str) -> None:
        """Remove the triple for (subject, predicate).

        Idempotent - no error if it doesn't exist.
        """

    @abstractmethod
    def list(self, subject: str | None = None) -> list[Triple]:
        """Return all triples, or all triples for one subject if given."""
