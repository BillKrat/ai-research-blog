"""Small, application-owned vocabulary for the triple store.

This is intentionally not a complete RDF implementation. The application
uses ordinary HTTPS URIs as names and stores facts through TripleRepository.
"""

from dataclasses import dataclass
from urllib.parse import urlparse


DEFAULT_BASE_URI = "https://blogresearch.net/2026/08/"


@dataclass(frozen=True)
class Vocabulary:
    """URIs used by the application, rooted at one deployment's base URI."""

    base_uri: str = DEFAULT_BASE_URI

    def __post_init__(self) -> None:
        parsed = urlparse(self.base_uri)
        if parsed.scheme != "https" or not parsed.netloc or not self.base_uri.endswith("/"):
            raise ValueError("base_uri must be an HTTPS URI ending with '/'")

    def uri(self, name: str) -> str:
        """Return a vocabulary URI below the configured base URI."""
        return f"{self.base_uri}{name}"

    @property
    def type(self) -> str:
        return self.uri("type")

    @property
    def name(self) -> str:
        return self.uri("name")

    @property
    def description(self) -> str:
        return self.uri("description")

    @property
    def email(self) -> str:
        return self.uri("email")

    @property
    def database_schema(self) -> str:
        return self.uri("database-schema")

    @property
    def person_type(self) -> str:
        """The class/type URI for a Person - the object_value a `type`
        triple points at, e.g. `(subject, vocabulary.type,
        vocabulary.person_type)`. Not a specific person - see `person()`
        below for minting one of those."""
        return self.uri("Person")

    def person(self, user_id: str) -> str:
        """Mint the subject URI for one specific user, keyed by user_id.

        Every triple describing that user (name, email, later roles/
        groups) is written against this one subject - see docs/adr/0011
        and shared/repositories/triple_user_repository.py. user_id is
        the bare id UserRepository callers work with (typically a
        uuid4 string); this method is the only place that id gets
        turned into a URI - callers above UserRepository never see
        this shape at all.
        """
        return self.uri(f"person/{user_id}")

    @property
    def dataset(self) -> str:
        return self.uri("DataSet")

    @property
    def database_schema_class(self) -> str:
        return self.uri("DatabaseSchema")


__all__ = ["DEFAULT_BASE_URI", "Vocabulary"]